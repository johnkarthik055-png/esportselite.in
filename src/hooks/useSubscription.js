import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../utils/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * useSubscription — live read of `users/{uid}.subscription`.
 *
 * The subscription object is written ONLY by the Razorpay webhook
 * (functions/razorpayWebhook.js) via the Admin SDK. Clients can read their
 * own copy but never write it — see firestore.rules.
 *
 * Shape written by the webhook:
 *   users/{uid}.subscription = {
 *     plan: 'pro',
 *     status: 'active' | 'pending' | 'past_due' | 'halted'
 *           | 'cancelled' | 'completed' | 'paused',
 *     startedAt: ISO string,
 *     expiresAt: ISO string,
 *     razorpaySubscriptionId: string,
 *     lastEvent: string,
 *     updatedAt: Firestore Timestamp,
 *   }
 *
 * Returns:
 *   {
 *     loading,               // still waiting on the first snapshot
 *     subscription,          // raw object (or null)
 *     status,                // convenience: subscription?.status ?? 'none'
 *     plan,                  // 'pro' | 'none'
 *     isActive,              // status === 'active' AND not past expiresAt
 *     expiresAt,             // Date | null
 *   }
 *
 * Usage (gating a premium feature later — not wired to anything yet):
 *   const { isActive, loading } = useSubscription()
 *   if (loading) return <Spinner />
 *   if (!isActive) return <UpgradePrompt />
 */
export function isSubscriptionActive(subscription, at = Date.now()) {
  if (!subscription || subscription.status !== 'active') return false
  const raw = subscription.expiresAt
  if (!raw) return true
  const ms =
    typeof raw?.toMillis === 'function'
      ? raw.toMillis()
      : Date.parse(raw)
  return Number.isFinite(ms) ? ms > at : true
}

export function useSubscription() {
  const { user } = useAuth()
  const uid = user?.uid || null

  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setSubscription(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        setSubscription(snap.exists() ? snap.data()?.subscription ?? null : null)
        setLoading(false)
      },
      (err) => {
        console.warn('[useSubscription] snapshot error:', err?.message || err)
        setSubscription(null)
        setLoading(false)
      },
    )
    return unsub
  }, [uid])

  const expiresRaw = subscription?.expiresAt
  const expiresAt = expiresRaw
    ? typeof expiresRaw?.toDate === 'function'
      ? expiresRaw.toDate()
      : new Date(expiresRaw)
    : null

  return {
    loading,
    subscription,
    status: subscription?.status ?? 'none',
    plan: subscription?.plan ?? 'none',
    isActive: isSubscriptionActive(subscription),
    expiresAt: expiresAt && !isNaN(expiresAt?.getTime?.()) ? expiresAt : null,
  }
}
