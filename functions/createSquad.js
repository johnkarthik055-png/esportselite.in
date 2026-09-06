/**
 * createSquad — Firebase Callable (v2)
 *
 * Creates a squad, resolves Firebase UIDs for all emails, creates a
 * Razorpay Payment Link for every member (including the owner), stores
 * the squad document in Firestore, and returns the new squadId.
 *
 * Secrets:
 *   RAZORPAY_KEY_ID     — Razorpay publishable key id
 *   RAZORPAY_KEY_SECRET — Razorpay API secret
 *   RAZORPAY_PLAN_IDS   — JSON map of plan keys (squad_2 … squad_6)
 *
 * Input:  { memberEmails: string[], size: number }
 * Returns: { squadId: string }
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2'
import admin from 'firebase-admin'
import Razorpay from 'razorpay'

const RAZORPAY_KEY_ID     = defineSecret('RAZORPAY_KEY_ID')
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET')
const RAZORPAY_PLAN_IDS   = defineSecret('RAZORPAY_PLAN_IDS')

setGlobalOptions({ region: 'us-central1', maxInstances: 10 })

if (!admin.apps.length) admin.initializeApp()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* Per-player monthly price in paise, indexed by squad size */
const PRICE_PAISE = { 2: 12900, 3: 11900, 4: 10900, 5: 9900, 6: 8900 }

export const createSquad = onCall(
  {
    secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_PLAN_IDS],
    cors: true,
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (req) => {
    const uid = req.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Log in to create a squad.')
    }

    const ownerEmail = (req.auth?.token?.email || '').toLowerCase().trim()
    const { memberEmails, size } = req.data || {}

    /* ── validate size ─────────────────────────────────────────────────── */
    if (!size || !Number.isInteger(size) || size < 2 || size > 6) {
      throw new HttpsError('invalid-argument', 'Squad size must be an integer between 2 and 6.')
    }

    /* ── validate memberEmails ─────────────────────────────────────────── */
    if (!Array.isArray(memberEmails) || memberEmails.length !== size - 1) {
      throw new HttpsError(
        'invalid-argument',
        `Provide exactly ${size - 1} member email(s) — the squad owner counts as the first member.`,
      )
    }

    const normalisedMembers = memberEmails.map((e) => {
      if (typeof e !== 'string' || !EMAIL_RE.test(e.trim())) {
        throw new HttpsError('invalid-argument', `Invalid email address: ${e}`)
      }
      return e.trim().toLowerCase()
    })

    for (const email of normalisedMembers) {
      if (email === ownerEmail) {
        throw new HttpsError(
          'invalid-argument',
          'You are already counted as a squad member — do not add your own email.',
        )
      }
    }

    const unique = new Set(normalisedMembers)
    if (unique.size !== normalisedMembers.length) {
      throw new HttpsError('invalid-argument', 'Duplicate email addresses in member list.')
    }

    /* ── load secrets ──────────────────────────────────────────────────── */
    const keyId     = RAZORPAY_KEY_ID.value()
    const keySecret = RAZORPAY_KEY_SECRET.value()

    if (!keyId || !keySecret) {
      throw new HttpsError('failed-precondition', 'Payments are not configured yet. Contact support.')
    }

    const planIdsRaw = (RAZORPAY_PLAN_IDS.value() || '').trim()
    let planIds
    try { planIds = JSON.parse(planIdsRaw) } catch {
      throw new HttpsError('failed-precondition', 'Plan configuration error. Contact support.')
    }

    const planKey     = `squad_${size}`
    const pricePaise  = PRICE_PAISE[size]

    /* ── resolve Firebase Auth UIDs for all emails ─────────────────────── */
    const auth    = admin.auth()
    const allEmails = [ownerEmail, ...normalisedMembers]
    const uidMap  = {}

    await Promise.all(
      allEmails.map(async (email) => {
        try {
          const record = await auth.getUserByEmail(email)
          uidMap[email] = record.uid
        } catch {
          uidMap[email] = null
        }
      }),
    )

    /* ── generate squadId before creating payment links (embed in notes) ── */
    const squadRef = admin.firestore().collection('squads').doc()
    const squadId  = squadRef.id

    /* ── create one Razorpay Payment Link per member ───────────────────── */
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret })

    const linkResults = {}
    await Promise.all(
      allEmails.map(async (email) => {
        try {
          const link = await rzp.paymentLink.create({
            amount:           pricePaise,
            currency:         'INR',
            description:      `Esports Elite Squad (${size} members) — ₹${pricePaise / 100}/month per player`,
            customer:         { email },
            notify:           { email: true },
            reminder_enable:  true,
            callback_url:     'https://app.esportselite.in/#/squad-payment-success',
            callback_method:  'get',
            notes: {
              squadId,
              memberEmail:  email,
              planKey,
              ownerUid:     uid,
            },
          })
          linkResults[email] = { id: link.id, url: link.short_url || '' }
        } catch (err) {
          const desc = err?.error?.description || err?.message || String(err)
          console.error(`[createSquad] payment link failed for ${email}:`, desc)
          throw new HttpsError('internal', `Could not create payment link for ${email}. Please try again.`)
        }
      }),
    )

    /* ── build member list ─────────────────────────────────────────────── */
    const members = allEmails.map((email) => ({
      email,
      uid:            uidMap[email] || null,
      status:         'invited',
      paymentLinkId:  linkResults[email]?.id  || null,
      paymentLinkUrl: linkResults[email]?.url || null,
      paidAt:         null,
    }))

    /* memberUids array makes Firestore security rules easy to check */
    const memberUids = allEmails
      .map((e) => uidMap[e])
      .filter(Boolean)

    /* ── write squad document ──────────────────────────────────────────── */
    await squadRef.set({
      ownerId:    uid,
      ownerEmail,
      size,
      planKey,
      status:     'pending',
      memberUids,
      members,
      createdAt:  admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log(
      `[createSquad] uid=${uid} squadId=${squadId} size=${size} members=${allEmails.join(',')}`,
    )

    return { squadId }
  },
)
