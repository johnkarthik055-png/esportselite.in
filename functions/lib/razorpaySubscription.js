/**
 * razorpaySubscription.js — pure helpers for the Razorpay webhook.
 *
 * Deliberately dependency-free (only `node:crypto`) so it can be unit-tested
 * in isolation without pulling in firebase-functions / firebase-admin /
 * the Razorpay SDK. `razorpayWebhook.js` wires these into the HTTP handler.
 *
 * Two responsibilities:
 *   1. verifyRazorpaySignature() — HMAC-SHA256 of the RAW request body,
 *      constant-time compared against the `X-Razorpay-Signature` header.
 *   2. mapSubscriptionEvent()   — turn a verified Razorpay webhook event
 *      into `{ uid, update }`, where `update` is the exact object to
 *      `set(..., { merge: true })` onto `users/{uid}`. Returns `null` for
 *      events we don't act on (or when no Firebase uid can be recovered).
 *
 * The Firebase uid is carried end-to-end via the Razorpay subscription's
 * `notes.firebase_uid`, set by createRazorpayOrder.js at creation time.
 */
import crypto from 'node:crypto'

/* Razorpay subscription lifecycle events.
 * Payment SUCCESS for a subscription surfaces as:
 *   - subscription.activated  → first successful charge, subscription goes live
 *   - subscription.charged    → every subsequent successful renewal charge
 * (subscription.authenticated fires when the mandate is approved but before
 *  the first charge clears — we treat that as "pending", not "active".)
 */
export const RAZORPAY_EVENTS = {
  AUTHENTICATED: 'subscription.authenticated',
  ACTIVATED: 'subscription.activated',
  CHARGED: 'subscription.charged',
  PENDING: 'subscription.pending',
  HALTED: 'subscription.halted',
  CANCELLED: 'subscription.cancelled',
  COMPLETED: 'subscription.completed',
  PAUSED: 'subscription.paused',
  RESUMED: 'subscription.resumed',
  PAYMENT_FAILED: 'payment.failed',
}

const PLAN = 'pro'
const MONTH_MS = 31 * 24 * 60 * 60 * 1000

/* ------------------------------------------------------------------ */
/* signature verification                                             */
/* ------------------------------------------------------------------ */

/**
 * @param {string|Buffer} rawBody  the exact bytes Razorpay POSTed (never the
 *                                  re-serialised parsed body — key order matters)
 * @param {string} signature       value of the `X-Razorpay-Signature` header
 * @param {string} secret          the webhook secret (defineSecret)
 * @returns {boolean}
 */
export function verifyRazorpaySignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(typeof rawBody === 'string' ? rawBody : Buffer.from(rawBody))
      .digest('hex')
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(String(signature), 'utf8')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* event → Firestore update                                           */
/* ------------------------------------------------------------------ */

function subEntity(event) {
  return event?.payload?.subscription?.entity || null
}
function paymentEntity(event) {
  return event?.payload?.payment?.entity || null
}

/** Recover the Firebase uid attached at subscription-creation time. */
export function extractFirebaseUid(event) {
  const sub = subEntity(event)
  const pay = paymentEntity(event)
  return (
    sub?.notes?.firebase_uid ||
    sub?.notes?.firebaseUid ||
    pay?.notes?.firebase_uid ||
    pay?.notes?.firebaseUid ||
    null
  )
}

/** unix-seconds → ISO string, with a sane fallback. */
function iso(unixSeconds, fallbackMs) {
  const ms = Number(unixSeconds) * 1000
  if (Number.isFinite(ms) && ms > 0) return new Date(ms).toISOString()
  return new Date(fallbackMs).toISOString()
}

/**
 * @param {object} event  parsed Razorpay webhook event
 * @returns {{ uid: string, update: object } | null}
 */
export function mapSubscriptionEvent(event) {
  const name = event?.event
  if (!name) return null

  const uid = extractFirebaseUid(event)
  if (!uid) return null

  const sub = subEntity(event) || {}
  const now = Date.now()
  const razorpaySubscriptionId = sub.id || event?.payload?.payment?.entity?.subscription_id || null

  /* base fields present on every write */
  const base = {
    plan: PLAN,
    razorpaySubscriptionId,
    lastEvent: name,
    updatedAt: new Date(now).toISOString(),
  }

  switch (name) {
    /* ---- success: subscription is live / renewed ---- */
    case RAZORPAY_EVENTS.ACTIVATED:
    case RAZORPAY_EVENTS.CHARGED:
    case RAZORPAY_EVENTS.RESUMED:
      return {
        uid,
        update: {
          subscription: {
            ...base,
            status: 'active',
            startedAt: iso(sub.current_start || sub.start_at, now),
            /* renewal (`charged`) pushes expiry to the new cycle end */
            expiresAt: iso(sub.current_end || sub.charge_at, now + MONTH_MS),
          },
        },
      }

    /* ---- mandate approved but first charge not cleared yet ---- */
    case RAZORPAY_EVENTS.AUTHENTICATED:
      return {
        uid,
        update: {
          subscription: {
            ...base,
            status: 'pending',
            startedAt: iso(sub.current_start || sub.start_at, now),
            expiresAt: iso(sub.current_end || sub.charge_at, now + MONTH_MS),
          },
        },
      }

    /* ---- a charge failed; Razorpay will retry ---- */
    case RAZORPAY_EVENTS.PENDING:
    case RAZORPAY_EVENTS.PAYMENT_FAILED:
      return {
        uid,
        update: { subscription: { ...base, status: 'past_due' } },
      }

    /* ---- retries exhausted ---- */
    case RAZORPAY_EVENTS.HALTED:
      return {
        uid,
        update: { subscription: { ...base, status: 'halted' } },
      }

    /* ---- user / system cancelled ---- */
    case RAZORPAY_EVENTS.CANCELLED:
      return {
        uid,
        update: {
          subscription: {
            ...base,
            status: 'cancelled',
            /* keep access until the paid-for cycle actually ends */
            expiresAt: iso(sub.current_end || sub.end_at, now),
          },
        },
      }

    /* ---- all billing cycles done ---- */
    case RAZORPAY_EVENTS.COMPLETED:
      return {
        uid,
        update: { subscription: { ...base, status: 'completed' } },
      }

    /* ---- paused by merchant/customer ---- */
    case RAZORPAY_EVENTS.PAUSED:
      return {
        uid,
        update: { subscription: { ...base, status: 'paused' } },
      }

    default:
      return null
  }
}

/**
 * Client-safe check: is this subscription object currently entitling the user?
 * Shared shape used by the main app's useSubscription() hook — kept here so the
 * webhook and the client agree on exactly what "active" means.
 */
export function isSubscriptionActive(subscription, atMs = Date.now()) {
  if (!subscription || subscription.status !== 'active') return false
  if (!subscription.expiresAt) return true
  const exp = Date.parse(subscription.expiresAt)
  return Number.isFinite(exp) ? exp > atMs : true
}
