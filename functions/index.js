/**
 * Esports Elite — Cloud Functions entry point.
 *
 * Secrets are Firebase Functions secrets — set each once with
 * `firebase functions:secrets:set <NAME>` and it is injected only into the
 * functions that declare it in `secrets: [...]`. None are ever bundled into
 * any web client.
 *
 *   OPENAI_KEY               — AI Coach (screenshot extraction + coaching)
 *   RAZORPAY_KEY_ID          — Razorpay publishable key id   (createRazorpayOrder, createSquad)
 *   RAZORPAY_KEY_SECRET      — Razorpay API secret           (createRazorpayOrder, createSquad)
 *   RAZORPAY_PLAN_IDS        — JSON map of plan ids          (createRazorpayOrder, createSquad)
 *   RAZORPAY_WEBHOOK_SECRET  — Razorpay webhook signing secret (razorpayWebhook)
 *
 * Deploy:  firebase deploy --only functions
 * (Requires the Blaze plan on the Firebase project.)
 */
export { extractMatchScreenshot } from './extractMatchScreenshot.js'
export { aiCoachChat } from './aiCoachChat.js'
export { createRazorpayOrder } from './createRazorpayOrder.js'
export { razorpayWebhook } from './razorpayWebhook.js'
export { createSquad } from './createSquad.js'
export { confirmSquadMemberPayment } from './confirmSquadMemberPayment.js'
