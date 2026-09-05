/* Standalone logic test — no Firebase, no Razorpay, no network.
   Run: node functions/lib/razorpaySubscription.test.mjs                */
import crypto from 'node:crypto'
import {
  verifyRazorpaySignature,
  mapSubscriptionEvent,
  extractFirebaseUid,
  isSubscriptionActive,
  RAZORPAY_EVENTS,
} from './razorpaySubscription.js'

const results = []
const ok = (name, cond, extra = '') => results.push([!!cond, name, extra])

const SECRET = 'whsec_test_1234567890'
const UID = 'firebaseUid_ABC123'

/* ---------- signature verification ---------- */
const bodyObj = {
  entity: 'event',
  event: RAZORPAY_EVENTS.ACTIVATED,
  payload: { subscription: { entity: { id: 'sub_test', notes: { firebase_uid: UID } } } },
}
const raw = JSON.stringify(bodyObj)
const goodSig = crypto.createHmac('sha256', SECRET).update(raw).digest('hex')

ok('valid signature accepted', verifyRazorpaySignature(raw, goodSig, SECRET) === true)
ok('tampered body rejected', verifyRazorpaySignature(raw + ' ', goodSig, SECRET) === false)
ok('wrong secret rejected', verifyRazorpaySignature(raw, goodSig, 'whsec_wrong') === false)
ok('garbage signature rejected', verifyRazorpaySignature(raw, 'deadbeef', SECRET) === false)
ok('empty signature rejected', verifyRazorpaySignature(raw, '', SECRET) === false)
ok('missing args rejected', verifyRazorpaySignature(null, null, null) === false)
ok(
  'Buffer body verifies same as string',
  verifyRazorpaySignature(Buffer.from(raw, 'utf8'), goodSig, SECRET) === true,
)

/* ---------- uid recovery ---------- */
ok('extractFirebaseUid from subscription notes', extractFirebaseUid(bodyObj) === UID)
ok(
  'extractFirebaseUid from payment notes fallback',
  extractFirebaseUid({ event: 'payment.failed', payload: { payment: { entity: { notes: { firebase_uid: UID } } } } }) === UID,
)
ok('extractFirebaseUid null when absent', extractFirebaseUid({ event: 'x', payload: {} }) === null)

/* ---------- event mapping: ACTIVATION ---------- */
const activatedEvt = {
  event: RAZORPAY_EVENTS.ACTIVATED,
  payload: {
    subscription: {
      entity: {
        id: 'sub_ACT',
        current_start: 1_700_000_000,
        current_end: 1_702_592_000,
        notes: { firebase_uid: UID },
      },
    },
  },
}
const act = mapSubscriptionEvent(activatedEvt)
ok('activation → uid correct', act?.uid === UID)
ok('activation → plan pro', act?.update?.subscription?.plan === 'pro')
ok('activation → status active', act?.update?.subscription?.status === 'active')
ok('activation → razorpaySubscriptionId', act?.update?.subscription?.razorpaySubscriptionId === 'sub_ACT')
ok('activation → startedAt ISO', act?.update?.subscription?.startedAt === new Date(1_700_000_000_000).toISOString())
ok('activation → expiresAt ISO from current_end', act?.update?.subscription?.expiresAt === new Date(1_702_592_000_000).toISOString())
ok('activation → lastEvent tag', act?.update?.subscription?.lastEvent === RAZORPAY_EVENTS.ACTIVATED)
ok(
  'activation → update shape is { subscription: {...} } only',
  JSON.stringify(Object.keys(act.update)) === JSON.stringify(['subscription']),
)

/* ---------- event mapping: RENEWAL (charged) ---------- */
const chargedEvt = {
  event: RAZORPAY_EVENTS.CHARGED,
  payload: {
    payment: { entity: { id: 'pay_1', subscription_id: 'sub_ACT' } },
    subscription: {
      entity: {
        id: 'sub_ACT',
        current_start: 1_702_592_000,
        current_end: 1_705_270_400,
        notes: { firebase_uid: UID },
      },
    },
  },
}
const chg = mapSubscriptionEvent(chargedEvt)
ok('renewal → status active', chg?.update?.subscription?.status === 'active')
ok('renewal → expiresAt pushed to new current_end', chg?.update?.subscription?.expiresAt === new Date(1_705_270_400_000).toISOString())

/* ---------- event mapping: CANCELLATION ---------- */
const cancelledEvt = {
  event: RAZORPAY_EVENTS.CANCELLED,
  payload: { subscription: { entity: { id: 'sub_ACT', current_end: 1_705_270_400, notes: { firebase_uid: UID } } } },
}
const can = mapSubscriptionEvent(cancelledEvt)
ok('cancellation → status cancelled', can?.update?.subscription?.status === 'cancelled')
ok('cancellation → keeps expiresAt (access until cycle end)', can?.update?.subscription?.expiresAt === new Date(1_705_270_400_000).toISOString())

/* ---------- event mapping: FAILURE / HALT / PENDING / COMPLETE / PAUSE ---------- */
ok('payment.failed → past_due', mapSubscriptionEvent({ event: RAZORPAY_EVENTS.PAYMENT_FAILED, payload: { payment: { entity: { notes: { firebase_uid: UID } } } } })?.update?.subscription?.status === 'past_due')
ok('subscription.pending → past_due', mapSubscriptionEvent({ event: RAZORPAY_EVENTS.PENDING, payload: { subscription: { entity: { notes: { firebase_uid: UID } } } } })?.update?.subscription?.status === 'past_due')
ok('subscription.halted → halted', mapSubscriptionEvent({ event: RAZORPAY_EVENTS.HALTED, payload: { subscription: { entity: { notes: { firebase_uid: UID } } } } })?.update?.subscription?.status === 'halted')
ok('subscription.completed → completed', mapSubscriptionEvent({ event: RAZORPAY_EVENTS.COMPLETED, payload: { subscription: { entity: { notes: { firebase_uid: UID } } } } })?.update?.subscription?.status === 'completed')
ok('subscription.paused → paused', mapSubscriptionEvent({ event: RAZORPAY_EVENTS.PAUSED, payload: { subscription: { entity: { notes: { firebase_uid: UID } } } } })?.update?.subscription?.status === 'paused')

/* ---------- event mapping: no-op cases ---------- */
ok('unknown event → null', mapSubscriptionEvent({ event: 'order.paid', payload: {} }) === null)
ok('missing firebase_uid → null (cannot map)', mapSubscriptionEvent({ event: RAZORPAY_EVENTS.ACTIVATED, payload: { subscription: { entity: { id: 'sub_x' } } } }) === null)
ok('no event name → null', mapSubscriptionEvent({ payload: {} }) === null)

/* ---------- isSubscriptionActive ---------- */
const future = new Date(Date.now() + 5 * 864e5).toISOString()
const past = new Date(Date.now() - 864e5).toISOString()
ok('active + future expiry → entitled', isSubscriptionActive({ status: 'active', expiresAt: future }) === true)
ok('active + past expiry → NOT entitled', isSubscriptionActive({ status: 'active', expiresAt: past }) === false)
ok('cancelled → NOT entitled', isSubscriptionActive({ status: 'cancelled', expiresAt: future }) === false)
ok('null → NOT entitled', isSubscriptionActive(null) === false)

/* ---------- report ---------- */
console.log('\n===== razorpaySubscription.js logic test =====')
let fails = 0
for (const [pass, name, extra] of results) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? `  — ${extra}` : ''}`)
  if (!pass) fails++
}
console.log(`\n${results.length - fails}/${results.length} passed`)
process.exit(fails ? 1 : 0)
