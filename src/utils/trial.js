/**
 * trial.js — Per-user 3-month free trial, Firestore-backed.
 *
 * Storage of record:
 *   users/{uid}.trial = {
 *     startDate: ISO string,
 *     endDate:   ISO string,
 *     plan:      'free_trial',
 *     daysTotal: 90,
 *   }
 *
 * `getTrialStatus()` always hits Firestore (so the badge cannot lie if the
 * user clears localStorage), but it also writes a small read-only cache to
 * localStorage so legacy *sync* callers (`isTrialExpired`) can still answer
 * without becoming async. The cache is never authoritative — Firestore is.
 *
 * Why dynamic imports: matches the spec exactly and keeps the firebase
 * SDK out of the initial bundle until the first trial check actually runs.
 */

const CACHE_KEY = (uid) => `esportselite_${uid}_trial_cache`

/* ─── INIT ──────────────────────────────────────────────────── */

export const initTrial = async (uid) => {
  if (!uid) return

  try {
    const { db } = await import('./firebase.js')
    const { doc, getDoc, setDoc } = await import('firebase/firestore')

    const ref = doc(db, 'users', uid)
    const snap = await getDoc(ref)

    /* Only create trial if it does not exist. */
    if (snap.exists() && snap.data()?.trial) {
      console.log('Trial already exists for:', uid)
      return
    }

    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 90)

    await setDoc(
      ref,
      {
        trial: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          plan: 'free_trial',
          daysTotal: 90,
        },
      },
      { merge: true }
    )

    console.log('Trial created for:', uid, 'Expires:', endDate.toISOString())
  } catch (error) {
    console.error('initTrial error:', error)
  }
}

/* ─── READ ──────────────────────────────────────────────────── */

export const getTrialStatus = async (uid) => {
  if (!uid) {
    return { active: false, daysLeft: 0, expired: true, plan: 'none' }
  }

  try {
    const { db } = await import('./firebase.js')
    const { doc, getDoc } = await import('firebase/firestore')

    const snap = await getDoc(doc(db, 'users', uid))

    if (!snap.exists() || !snap.data()?.trial) {
      return { active: false, daysLeft: 0, expired: true, plan: 'none' }
    }

    const trial = snap.data().trial
    const now = new Date()
    const endDate = new Date(trial.endDate)
    const startDate = new Date(trial.startDate)

    const daysLeft = Math.ceil(
      (endDate - now) / (1000 * 60 * 60 * 24)
    )
    const daysUsed = Math.ceil(
      (now - startDate) / (1000 * 60 * 60 * 24)
    )

    const result = {
      active: daysLeft > 0,
      daysLeft: Math.max(0, daysLeft),
      daysUsed: Math.max(0, daysUsed),
      expired: daysLeft <= 0,
      startDate: trial.startDate,
      endDate: trial.endDate,
      plan: trial.plan || 'free_trial',
    }

    console.log('Trial status:', {
      uid,
      daysLeft: result.daysLeft,
      daysUsed: result.daysUsed,
      endDate: trial.endDate,
    })

    /* Cache for sync callers like isTrialExpired(). Best-effort only. */
    try {
      localStorage.setItem(CACHE_KEY(uid), JSON.stringify(result))
    } catch {
      /* ignore quota */
    }

    return result
  } catch (error) {
    console.error('getTrialStatus error:', error)
    return { active: false, daysLeft: 0, expired: true, plan: 'none' }
  }
}

/* ─── SYNC HELPERS ──────────────────────────────────────────── */

/**
 * Synchronous best-effort check used by DrillTimer / MatchLogger / Training
 * to gate write actions. Reads the localStorage cache populated by the most
 * recent `getTrialStatus()` call. If we have no cached state yet (e.g. the
 * page just loaded), we fail OPEN — better to let the user log a match than
 * to lock them out on a cold start.
 */
export function isTrialExpired(uid) {
  if (!uid) return false
  try {
    const raw = localStorage.getItem(CACHE_KEY(uid))
    if (!raw) return false
    const cached = JSON.parse(raw)
    return !!cached?.expired && !!cached?.endDate
  } catch {
    return false
  }
}

/** "4 June 2025" — used in the Profile subscription card. */
export function formatTrialDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}
