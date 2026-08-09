import { useCallback, useEffect, useMemo, useState } from 'react'
import { readLS, writeLS } from './useLocalStorage.js'
import { STORAGE_KEYS } from '../utils/constants.js'
import {
  uid,
  dateKey,
  todayKey,
  daysBetween,
  formatDuration,
  normalizeSessions,
} from '../utils/helpers.js'
import { awardXP, XP_AWARDS } from '../utils/xp.js'
import { auth } from '../utils/firebase.js'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/* ============================================================
   SAME-TAB EVENT BUS
   useLocalStorage syncs across TABS via the `storage` event,
   but same-tab instances never see each other's writes.
   This custom event keeps every `useNotifications()` consumer
   in sync the moment any one of them mutates state.
   ============================================================ */
const NOTIFY_CHANGE_EVENT = 'esports-elite:notifications-changed'

function broadcastChange(notifications) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(NOTIFY_CHANGE_EVENT, { detail: notifications })
  )
}

/* ============================================================
   AUTO-GENERATION LOGIC
   Runs once per page load, deduped via `dedupeKey` so reloads
   don't spam the user with the same notification twice.
   ============================================================ */
function generateAutoNotifications(existing) {
  const out = []
  const existingKeys = new Set(existing.map(n => n.dedupeKey).filter(Boolean))

  const sessions = normalizeSessions(readLS(STORAGE_KEYS.SESSIONS, []))
  const dailySessions = readLS(STORAGE_KEYS.DAILY_SESSIONS, {})

  /* ---------- 1. FIRST-TIME ONBOARDING — 3 welcome tips ----------
     Guard with a UID-scoped flag so these only ever fire once per
     account, even if the notifications array is cleared or the user
     logs out and back in. */
  const notifsAlreadyInitialized = readLS(STORAGE_KEYS.NOTIF_INITIALIZED, false)
  if (!notifsAlreadyInitialized) {
    if (sessions.length === 0) {
      /* Personalize the welcome with the player's display name when available. */
      const storedProfile = readLS(STORAGE_KEYS.USER, null)
      const displayName =
        auth?.currentUser?.displayName ||
        storedProfile?.username ||
        'Player'
      const welcomeTitle =
        displayName && displayName !== 'Player'
          ? `Welcome to Esports Elite, ${displayName}!`
          : 'Welcome to Esports Elite!'

      const onboarding = [
        {
          key: 'onboard-welcome',
          icon: '👋',
          title: welcomeTitle,
          message: 'Start by completing your first ADS drill.',
        },
        {
          key: 'onboard-profile',
          icon: '🎯',
          title: 'Complete your Profile',
          message:
            'Add your IGN and IG ID so your stats are properly labelled.',
        },
        {
          key: 'onboard-coach',
          icon: '📊',
          title: 'Coach AI Analysis',
          message:
            'After your first match, your Coach AI Analysis will activate and give you personalized tips.',
        },
      ]
      for (const o of onboarding) {
        if (existingKeys.has(o.key)) continue
        out.push({
          id: uid(),
          type: 'tip',
          icon: o.icon,
          title: o.title,
          message: o.message,
          timestamp: new Date().toISOString(),
          read: false,
          dedupeKey: o.key,
        })
      }
    }
    /* Mark initialized regardless of whether sessions exist — a returning
       user who cleared their notification list should not see onboarding again. */
    writeLS(STORAGE_KEYS.NOTIF_INITIALIZED, true)
  }

  /* ---------- 2. STREAK MILESTONES ---------- */
  /* Streak: consecutive days with status==='completed' in DAILY_SESSIONS. */
  const completedDays = Object.entries(dailySessions)
    .filter(([, v]) => v?.status === 'completed')
    .map(([k]) => k)
    .sort()

  let currentStreak = 0
  if (completedDays.length > 0) {
    const today = todayKey()
    const latest = completedDays[completedDays.length - 1]
    if (daysBetween(latest, today) <= 1) {
      currentStreak = 1
      for (let i = completedDays.length - 1; i > 0; i--) {
        if (daysBetween(completedDays[i - 1], completedDays[i]) === 1) currentStreak++
        else break
      }
    }
  }

  const milestones = [3, 7, 14, 30]
  for (const m of milestones) {
    if (currentStreak >= m) {
      const key = `streak-${m}`
      if (!existingKeys.has(key)) {
        out.push({
          id: uid(),
          type: 'streak',
          icon: '🔥',
          title: `You're on a ${m}-day streak!`,
          message: 'Keep grinding.',
          timestamp: new Date().toISOString(),
          read: false,
          dedupeKey: key,
        })
        /* IMPROVEMENT 5 — XP award the first time each streak milestone unlocks. */
        awardXP(XP_AWARDS.STREAK_MAINTAINED, `${m}-Day Streak`)
      }
    }
  }

  /* ---------- 3. YESTERDAY SESSION NOT ENDED ---------- */
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const ydKey = dateKey(yesterday)
  const hadActivityYesterday = sessions.some(s => dateKey(s.timestamp) === ydKey)
  const yesterdayEnded = dailySessions[ydKey]?.status === 'completed'

  if (hadActivityYesterday && !yesterdayEnded) {
    const key = `warning-not-ended-${ydKey}`
    if (!existingKeys.has(key)) {
      out.push({
        id: uid(),
        type: 'warning',
        icon: '⚠',
        title: "Yesterday's session not ended",
        message: 'Mark complete?',
        timestamp: new Date().toISOString(),
        read: false,
        dedupeKey: key,
      })
    }
  }

  /* ---------- 4. PERSONAL BEST — LONGEST DRILL ---------- */
  const longest = sessions.reduce(
    (max, s) => Math.max(max, Number(s.durationSeconds) || 0),
    0
  )
  const storedBest = Number(readLS(STORAGE_KEYS.PB_LONGEST_DRILL, 0)) || 0
  if (longest > storedBest && longest > 60) {
    writeLS(STORAGE_KEYS.PB_LONGEST_DRILL, longest)
    if (storedBest > 0) {
      out.push({
        id: uid(),
        type: 'achievement',
        icon: '🎯',
        title: 'New personal best!',
        message: `Longest drill: ${formatDuration(longest)}.`,
        timestamp: new Date().toISOString(),
        read: false,
        dedupeKey: `pb-longest-${longest}`,
      })
    }
  }

  /* ---------- 5. WEEKLY RECAP ---------- */
  if (sessions.length > 0) {
    const lastRecap = existing
      .filter(n => n.type === 'recap')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    const lastTs = lastRecap ? new Date(lastRecap.timestamp).getTime() : 0
    if (!lastRecap || Date.now() - lastTs > SEVEN_DAYS_MS) {
      out.push({
        id: uid(),
        type: 'recap',
        icon: '📊',
        title: 'Weekly recap available',
        message: 'View your stats on the dashboard.',
        timestamp: new Date().toISOString(),
        read: false,
        dedupeKey: `recap-${todayKey()}`,
      })
    }
  }

  /* ---------- 6. MODULE SKIPPED 3+ DAYS ---------- */
  /* Find modules that the user has used historically but not in the last 3 days. */
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 3)
  cutoff.setHours(0, 0, 0, 0)

  const modulesUsedHistorically = new Set(
    sessions.map(s => s.moduleId).filter(Boolean)
  )
  const modulesUsedRecently = new Set(
    sessions
      .filter(s => new Date(s.timestamp) >= cutoff)
      .map(s => s.moduleId)
      .filter(Boolean)
  )

  const skipped = [...modulesUsedHistorically].filter(id => !modulesUsedRecently.has(id))
  if (skipped.length > 0 && sessions.length >= 3) {
    /* Show one rotating reminder per session (dedup key by week so it doesn't spam). */
    const weekStamp = Math.floor(Date.now() / SEVEN_DAYS_MS)
    const key = `tip-skipped-${weekStamp}`
    if (!existingKeys.has(key)) {
      const firstSkippedSession = sessions.find(s => s.moduleId === skipped[0])
      const moduleName = firstSkippedSession?.module || 'a training module'
      out.push({
        id: uid(),
        type: 'tip',
        icon: '🎯',
        title: 'Time to revisit ' + moduleName,
        message: "You haven't trained this module in 3+ days.",
        timestamp: new Date().toISOString(),
        read: false,
        dedupeKey: key,
      })
    }
  }

  return out
}

/* ============================================================
   HOOK
   ============================================================ */
export function useNotifications() {
  /* Always seed React state from a fresh localStorage read — this guarantees
     read-state survives a page refresh and is shared across consumers
     mounting at different times. */
  const [notifications, setNotifications] = useState(() =>
    readLS(STORAGE_KEYS.NOTIFICATIONS, [])
  )

  /* Single mutation pipeline: write to LS + broadcast the change so every
     other useNotifications() instance in the same tab updates immediately. */
  const update = useCallback((updater) => {
    setNotifications(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      writeLS(STORAGE_KEYS.NOTIFICATIONS, next)
      broadcastChange(next)
      return next
    })
  }, [])

  /* Same-tab sync: any other instance that mutates broadcasts via CustomEvent. */
  useEffect(() => {
    function onChange(e) {
      setNotifications(e.detail || [])
    }
    window.addEventListener(NOTIFY_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(NOTIFY_CHANGE_EVENT, onChange)
  }, [])

  /* Cross-tab sync: native storage event. */
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== STORAGE_KEYS.NOTIFICATIONS) return
      try {
        setNotifications(e.newValue ? JSON.parse(e.newValue) : [])
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /* Cleanup + auto-gen on mount. We read LS directly here so multiple
     useNotifications instances mounting simultaneously all converge on
     the same merged list (generateAutoNotifications dedupes by key). */
  useEffect(() => {
    const now = Date.now()
    const prev = readLS(STORAGE_KEYS.NOTIFICATIONS, [])
    const fresh = prev.filter(n => {
      const t = new Date(n.timestamp).getTime()
      return now - t < THIRTY_DAYS_MS
    })
    const newOnes = generateAutoNotifications(fresh)

    /* No changes? No-op. */
    if (newOnes.length === 0 && fresh.length === prev.length) return

    const next = [...newOnes, ...fresh]
    writeLS(STORAGE_KEYS.NOTIFICATIONS, next)
    broadcastChange(next)
    setNotifications(next)
  }, [])

  const sorted = useMemo(
    () =>
      [...(notifications || [])].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [notifications]
  )

  const unreadCount = useMemo(
    () => sorted.filter(n => !n.read).length,
    [sorted]
  )

  const markRead = useCallback(
    (id) => update(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n))),
    [update]
  )

  const markAllRead = useCallback(
    () => update(prev => prev.map(n => ({ ...n, read: true }))),
    [update]
  )

  const clearAll = useCallback(() => update([]), [update])

  const removeNotification = useCallback(
    (id) => update(prev => prev.filter(n => n.id !== id)),
    [update]
  )

  return {
    notifications: sorted,
    unreadCount,
    markRead,
    markAllRead,
    clearAll,
    removeNotification,
  }
}
