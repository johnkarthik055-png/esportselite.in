/**
 * createRazorpayOrder — Firebase Callable (v2)
 *
 * Creates a Razorpay SUBSCRIPTION server-side, tied to the authenticated
 * Firebase user. The client never marks itself subscribed — activation
 * happens exclusively via razorpayWebhook.js on `subscription.activated`.
 *
 * Secrets (set once via `firebase functions:secrets:set <NAME>`):
 *   RAZORPAY_KEY_ID      — Razorpay publishable Key ID (safe to return to browser)
 *   RAZORPAY_KEY_SECRET  — Razorpay API secret (NEVER returned to browser)
 *   RAZORPAY_PLAN_IDS    — the Razorpay plan ID as a plain string, e.g. plan_Abcd1234
 *
 * Input from client:
 *   { email?, name?, contact? }
 *
 * Returns to client (everything Checkout.js needs):
 *   { subscriptionId, keyId, prefill, amountDisplay, currency }
 * `keyId` is the publishable Key ID — safe to hand to the browser.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2'
import Razorpay from 'razorpay'

const RAZORPAY_KEY_ID     = defineSecret('RAZORPAY_KEY_ID')
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET')
const RAZORPAY_PLAN_IDS   = defineSecret('RAZORPAY_PLAN_IDS')

setGlobalOptions({ region: 'us-central1', maxInstances: 10 })

const CURRENCY = 'INR'
/* ~10 years of monthly renewals; Razorpay marks the subscription "completed"
   after this many cycles. Keeps recurring billing alive indefinitely in practice. */
const TOTAL_BILLING_CYCLES = 120

export const createRazorpayOrder = onCall(
  {
    secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_PLAN_IDS],
    cors: true,
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (req) => {
    const uid = req.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Log in with your Esports Elite account to subscribe.')
    }

    /* --- read caller info -------------------------------------------------- */
    const email   = String(req.data?.email   || req.auth?.token?.email || '').slice(0, 200)
    const name    = String(req.data?.name    || req.auth?.token?.name  || '').slice(0, 120)
    const contact = String(req.data?.contact || '').replace(/[^\d+]/g, '').slice(0, 20)

    /* --- load secrets ------------------------------------------------------ */
    const keyId     = RAZORPAY_KEY_ID.value()
    const keySecret = RAZORPAY_KEY_SECRET.value()
    /* RAZORPAY_PLAN_IDS is stored as a plain plan ID string (e.g. plan_Abcd1234),
       not JSON. Read and trim it directly — no parsing needed. */
    const planId    = (RAZORPAY_PLAN_IDS.value() || '').trim()

    if (!keyId || !keySecret) {
      console.error('[createRazorpayOrder] missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET')
      throw new HttpsError('failed-precondition', 'Payments are not configured yet. Contact support.')
    }
    if (!planId) {
      console.error('[createRazorpayOrder] RAZORPAY_PLAN_IDS secret is empty')
      throw new HttpsError('failed-precondition', 'Plan ID not configured. Contact support.')
    }

    /* --- create Razorpay subscription -------------------------------------- */
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret })

    let subscription
    try {
      subscription = await rzp.subscriptions.create({
        plan_id: planId,
        total_count: TOTAL_BILLING_CYCLES,
        quantity: 1,
        customer_notify: 1,
        /* firebase_uid in notes is how razorpayWebhook.js maps back to the user. */
        notes: {
          firebase_uid: uid,
          email,
          source: 'esportselite.in/pricing',
        },
      })
    } catch (err) {
      const desc   = err?.error?.description || err?.message || String(err)
      const status = err?.statusCode || err?.status
      console.error('[createRazorpayOrder] subscription create failed:', status, desc)
      if (status === 401) throw new HttpsError('failed-precondition', 'Payment gateway credentials are invalid. Contact support.')
      if (status === 400) throw new HttpsError('invalid-argument', `Razorpay rejected the request: ${desc}`)
      throw new HttpsError('internal', 'Could not start the subscription. Please try again.')
    }

    if (!subscription?.id) {
      throw new HttpsError('internal', 'Razorpay did not return a subscription id.')
    }

    console.log(`[createRazorpayOrder] uid=${uid} plan=${planId} sub=${subscription.id} status=${subscription.status}`)

    return {
      subscriptionId: subscription.id,
      keyId,
      currency: CURRENCY,
      amountDisplay: '₹149/month',
      prefill: { name, email, contact },
    }
  },
)
