import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getProfile,
  getSessions,
  getMatches,
  getModules,
  getAllDailySessions,
  getAllDailyMatches,
  getTrialStatus,
  getNotifications,
  saveXP,
  XP_PER_LEVEL,
  LEVEL_NAMES_ARR,
  calcLevelFromXP,
} from '../utils/db.js'
import {
  generateDailyNotifications,
  cleanOldNotifications,
} from '../utils/notifications.js'

/* Re-use the same event strings as xp.js for cross-component sync */
const XP_EVENT    = 'esports-elite:xp-gained'
const LEVEL_EVENT = 'esports-elite:level-up'

const EMPTY_DATA = {
  profile: null,
  sessions: [],
  matches: [],
  modules: [],
  dailySessions: {},
  dailyMatches: {},
  trial: null,
  notifications: [],
  streak: null,
}

/**
 * Central hook that loads all user data from Firestore (with localStorage
 * fallback). Exposes `updateXP(earnedXP)` for Firestore-persisted XP gains
 * and `refreshData()` for force-reloading after writes.
 *
 * Multiple instances share XP state via window events — when any component
 * calls updateXP(), every mounted useUserData consumer re-syncs.
 *
 * Notification generation: runs at most ONCE per calendar day per user,
 * guarded by a localStorage timestamp. The notifications themselves are
 * idempotent in Firestore (see ../utils/notifications.js), so even if the
 * guard fails the same card never appears twice.
 */
export function useUserData() {
  const { user } = useAuth()

  const [data, setData]     = useState(EMPTY_DATA)
  const [loading, setLoading] = useState(true)

  /* XP and level live as first-class state so components that need only
     these values re-render on XP changes without a full data reload.
     Level is 0-indexed (0 = Rookie … 6 = Elite) to match db.js. */
  const [xp, setXpState]       = useState(0)
  const [level, setLevelState] = useState(0)

  /* ── Initial full load ───────────────────────────────────────── */
  const loadAllData = useCallback(async () => {
    if (!user) {
      setData(EMPTY_DATA)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [
        profile,
        sessions,
        matches,
        modules,
        dailySessions,
        dailyMatches,
        trial,
        notifications,
      ] = await Promise.all([
        getProfile(user.uid),
        getSessions(user.uid),
        getMatches(user.uid),
        getModules(user.uid),
        getAllDailySessions(user.uid),
        getAllDailyMatches(user.uid),
        getTrialStatus(user.uid),
        getNotifications(user.uid),
      ])

      const loadedXP    = profile?.xp    ?? 0
      /* Always compute level from XP so we ignore any stale stored
         `level` values written under the old 1-indexed name ladder
         (Grinder/Competitor/Veteran/…). One extra call, no data
         migration required — the next XP update overwrites the
         stored value with the fresh 0-indexed number. */
      const loadedLevel = calcLevelFromXP(loadedXP)

      console.log('[useUserData] XP loaded:', loadedXP)
      console.log('[useUserData] Level (computed from XP):', loadedLevel)

      setData({
        profile:       profile || {},
        sessions:      sessions      || [],
        matches:       matches       || [],
        modules:       modules       || [],
        dailySessions: dailySessions || {},
        dailyMatches:  dailyMatches  || {},
        trial:         trial         || null,
        notifications: notifications || [],
        streak:        profile?.streak || null,
      })

      setXpState(loadedXP)
      setLevelState(loadedLevel)
    } catch (error) {
      console.error('[useUserData] Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadAllData() }, [loadAllData])

  /* ── Listen for XP changes from other components ──────────────
     When DrillTimer / MatchLogger / SessionBanner call updateXP(),
     they dispatch XP_EVENT. All mounted useUserData instances (e.g.
     TopBar) pick this up and update their xp/level state.          */
  useEffect(() => {
    function onXPEvent(e) {
      const detail = e?.detail || {}
      if (typeof detail.xp === 'number') setXpState(detail.xp)
      if (detail.level) {
        const l = typeof detail.level === 'object'
          ? detail.level.level
          : detail.level
        if (typeof l === 'number') setLevelState(l)
      }
    }
    window.addEventListener(XP_EVENT, onXPEvent)
    return () => window.removeEventListener(XP_EVENT, onXPEvent)
  }, [])

  /* ── Daily notification generation — ONCE per (user, day) ──────
     The notifications themselves are idempotent (key-based), but we
     still gate by a localStorage timestamp so we don't even attempt
     the Firestore writes more than once per day per device. This is
     the ONLY localStorage usage in this hook — not app data. */
  useEffect(() => {
    if (!user?.uid || loading) return

    const lastGenKey = `notif_generated_${user.uid}`
    const today = new Date().toISOString().split('T')[0]
    const lastGen = (() => {
      try { return localStorage.getItem(lastGenKey) }
      catch { return null }
    })()

    /* Only generate once per day. */
    if (lastGen === today) return

    generateDailyNotifications(user.uid, {
      streak: data.streak,
      sessions: data.sessions,
      trial: data.trial,
    }).catch(err => console.warn('[useUserData] notif gen failed:', err))

    cleanOldNotifications(user.uid)
      .catch(err => console.warn('[useUserData] notif cleanup failed:', err))

    try { localStorage.setItem(lastGenKey, today) }
    catch { /* ignore quota */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, loading])

  /* ── Partial refresh (sessions, matches, modules, daily data) ── */
  const refreshData = useCallback(async () => {
    if (!user) return
    try {
      const [sessions, matches, modules, dailySessions, dailyMatches] =
        await Promise.all([
          getSessions(user.uid),
          getMatches(user.uid),
          getModules(user.uid),
          getAllDailySessions(user.uid),
          getAllDailyMatches(user.uid),
        ])
      setData(prev => ({
        ...prev,
        sessions:      sessions      || [],
        matches:       matches       || [],
        modules:       modules       || [],
        dailySessions: dailySessions || {},
        dailyMatches:  dailyMatches  || {},
      }))
    } catch {
      /* swallow — data stays at last known state */
    }
  }, [user])

  /* ── updateXP — called by DrillTimer, MatchLogger, SessionBanner ──
     Adds earnedXP to the current total, calculates new level,
     updates state, saves to Firestore, and dispatches events so
     XPToast, TopBar, and every other useUserData consumer stays in sync. */
  const updateXP = useCallback(async (earnedXP) => {
    const uid = user?.uid
    if (!uid || !earnedXP) return

    let newXP, newLevel, prevLevel
    setXpState(prev => {
      prevLevel = calcLevelFromXP(prev)
      newXP     = prev + earnedXP
      newLevel  = calcLevelFromXP(newXP)
      return newXP
    })
    setLevelState(() => {
      newLevel = calcLevelFromXP(newXP ?? (xp + earnedXP))
      return newLevel
    })

    const computedXP    = xp + earnedXP
    const computedLevel = calcLevelFromXP(computedXP)

    await saveXP(uid, computedXP, computedLevel)

    console.log('[useUserData] XP updated:', computedXP, 'Level:', computedLevel)

    const levelName = LEVEL_NAMES_ARR[computedLevel] || 'Rookie'
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(XP_EVENT, {
        detail: {
          amount: earnedXP,
          action: 'XP earned',
          xp: computedXP,
          level: { level: computedLevel, name: levelName.toUpperCase() },
        },
      }))

      if (computedLevel > calcLevelFromXP(xp)) {
        window.dispatchEvent(new CustomEvent(LEVEL_EVENT, {
          detail: {
            level: { level: computedLevel, name: levelName.toUpperCase() },
            amount: earnedXP,
            action: 'Level Up',
          },
        }))
        window.dispatchEvent(new CustomEvent('levelUp', {
          detail: { level: computedLevel, name: levelName },
        }))
      }
    }
  }, [user, xp])

  return {
    /* data fields */
    ...data,
    xp,
    level,
    loading,
    /* actions */
    refreshData,
    updateXP,
  }
}
