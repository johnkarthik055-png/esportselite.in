/**
 * razorpayWebhook — Firebase HTTP function (v2, onRequest — NOT a callable)
 *
 * Razorpay's servers POST subscription lifecycle events here directly. This
 * function is the ONLY thing that ever marks a user's subscription active —
 * client-side checkout "success" is UI optimism, never the activation trigger.
 *
 * Flow:
 *   1. Verify `X-Razorpay-Signature` (HMAC-SHA256 of the RAW body) against
 *      RAZORPAY_WEBHOOK_SECRET. Unverified → 400, nothing processed.
 *   2. Acknowledge Razorpay with 200 immediately (they expect a fast ack and
 *      will retry on any non-2xx).
 *   3. AFTER acking, map the event and merge `users/{uid}.subscription`
 *      via the Admin SDK. Handles activation, renewal, retry/failure,
 *      halt, cancellation, completion and pause — not just the happy path.
 *      The write is idempotent (deterministic `set(merge:true)`), so a
 *      Razorpay retry of an already-processed event is harmless.
 *
 * Set the secret (separate from the API key/secret used to create orders):
 *   firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
 * then configure the same value as the webhook secret in the Razorpay
 * Dashboard → Settings → Webhooks, subscribed to the `subscription.*` and
 * `payment.failed` events, pointing at this function's URL.
 */
import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2'
import admin from 'firebase-admin'
import { verifyRazorpaySignature, mapSubscriptionEvent } from './lib/razorpaySubscription.js'

const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET')

setGlobalOptions({ region: 'us-central1', maxInstances: 10 })

if (!admin.apps.length) admin.initializeApp()

export const razorpayWebhook = onRequest(
  {
    secrets: [RAZORPAY_WEBHOOK_SECRET],
    cors: false,
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.set('Allow', 'POST')
      res.status(405).send('Method Not Allowed')
      return
    }

    const signature = req.get('x-razorpay-signature') || ''
    const secret = RAZORPAY_WEBHOOK_SECRET.value()

    /* rawBody is a Buffer supplied by the Functions framework — required,
       because re-serialising req.body would change key order and break HMAC. */
    const raw = req.rawBody
      ? req.rawBody.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body || {})

    if (!verifyRazorpaySignature(raw, signature, secret)) {
      console.warn('[razorpayWebhook] signature verification FAILED — rejecting')
      res.status(400).send('invalid signature')
      return
    }

    let event
    try {
      event = JSON.parse(raw)
    } catch {
      res.status(400).send('invalid json')
      return
    }

    /* 2. Ack fast. Razorpay retries on non-2xx, so anything below this line
          is best-effort; failures get another delivery attempt. */
    res.status(200).json({ received: true })

    /* 3. Process after the ack. */
    try {
      const mapped = mapSubscriptionEvent(event)
      if (!mapped) {
        console.log(`[razorpayWebhook] no-op event=${event?.event || 'unknown'} (unhandled or no firebase_uid)`)
        return
      }

      const { uid, update } = mapped
      await admin
        .firestore()
        .collection('users')
        .doc(uid)
        .set(
          {
            ...update,
            subscription: {
              ...update.subscription,
              /* server clock wins for the audit field */
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          },
          { merge: true },
        )

      console.log(
        `[razorpayWebhook] applied uid=${uid} event=${event.event} status=${update.subscription?.status}`,
      )
    } catch (err) {
      /* Do not rethrow — the 200 is already sent. Log for Razorpay-retry
         visibility; the next delivery of the same event will retry the write. */
      console.error('[razorpayWebhook] post-ack processing error:', err?.message || err)
    }
  },
)
