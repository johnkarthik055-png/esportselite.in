/**
 * confirmSquadMemberPayment — Firebase Callable (v2)
 *
 * Called by an authenticated member after Razorpay redirects to the
 * squad-payment-success page.  Marks the member as paid, and — if every
 * member has now paid — activates the squad and writes
 * users/{uid}.subscription for each member who has a Firebase UID.
 *
 * Input:  { paymentLinkId: string }
 * Returns: { squadStatus: "pending" | "active", allPaid: boolean }
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import admin from 'firebase-admin'

setGlobalOptions({ region: 'us-central1', maxInstances: 10 })

if (!admin.apps.length) admin.initializeApp()

export const confirmSquadMemberPayment = onCall(
  {
    cors: true,
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (req) => {
    const uid = req.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Log in to confirm your squad payment.')
    }

    const { paymentLinkId } = req.data || {}
    if (!paymentLinkId || typeof paymentLinkId !== 'string' || !paymentLinkId.trim()) {
      throw new HttpsError('invalid-argument', 'paymentLinkId is required.')
    }

    const db = admin.firestore()

    /* ── find the squad that contains this payment link ─────────────────── */
    const squadsSnap = await db
      .collection('squads')
      .where('status', 'in', ['pending', 'active'])
      .get()

    let squadRef   = null
    let squadData  = null
    let memberIdx  = -1

    for (const docSnap of squadsSnap.docs) {
      const data = docSnap.data()
      const idx = (data.members || []).findIndex(
        (m) => m.paymentLinkId === paymentLinkId.trim(),
      )
      if (idx !== -1) {
        squadRef  = docSnap.ref
        squadData = data
        memberIdx = idx
        break
      }
    }

    if (!squadRef || !squadData) {
      throw new HttpsError('not-found', 'No squad found for this payment link.')
    }

    const members = [...squadData.members]

    /* ── idempotent — if already paid, return current state ─────────────── */
    if (members[memberIdx].status === 'paid') {
      const allPaid = members.every((m) => m.status === 'paid')
      console.log(
        `[confirmSquadMemberPayment] already paid uid=${uid} paymentLinkId=${paymentLinkId}`,
      )
      return { squadStatus: squadData.status, allPaid }
    }

    /* ── mark this member as paid ─────────────────────────────────────── */
    members[memberIdx] = {
      ...members[memberIdx],
      uid,
      status: 'paid',
      paidAt: admin.firestore.Timestamp.now(),
    }

    const allPaid       = members.every((m) => m.status === 'paid')
    const newSquadStatus = allPaid ? 'active' : 'pending'
    const squadId        = squadRef.id

    const updatePayload = {
      members,
      status:     newSquadStatus,
      memberUids: admin.firestore.FieldValue.arrayUnion(uid),
      ...(allPaid ? { activatedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
    }

    await squadRef.update(updatePayload)

    /* ── if all paid, activate subscription for every UID-linked member ── */
    if (allPaid) {
      const { planKey, size } = squadData
      const activatedAt = admin.firestore.FieldValue.serverTimestamp()

      await Promise.all(
        members
          .filter((m) => m.uid)
          .map((m) =>
            db
              .collection('users')
              .doc(m.uid)
              .set(
                {
                  subscription: {
                    status:     'active',
                    plan:       'squad',
                    squadId,
                    planKey,
                    size,
                    activatedAt,
                    updatedAt:  activatedAt,
                  },
                },
                { merge: true },
              ),
          ),
      )

      console.log(
        `[confirmSquadMemberPayment] squad ${squadId} ACTIVATED — all ${members.length} members paid`,
      )
    }

    console.log(
      `[confirmSquadMemberPayment] uid=${uid} paymentLinkId=${paymentLinkId} allPaid=${allPaid}`,
    )

    return { squadStatus: newSquadStatus, allPaid }
  },
)
