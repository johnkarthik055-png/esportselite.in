import { useCallback, useMemo } from 'react'
import { useLocalStorage } from './useLocalStorage.js'
import { STORAGE_KEYS } from '../utils/constants.js'
import {
  todayKey,
  dateKey,
  computeDayStatus,
  normalizeSessions,
} from '../utils/helpers.js'

/* ============================================================
   TRAINING — per-day training session state
   ============================================================ */
export function useDailySessions() {
  const [daily, setDaily] = useLocalStorage(STORAGE_KEYS.DAILY_SESSIONS, {})
  const [sessionsRaw] = useLocalStorage(STORAGE_KEYS.SESSIONS, [])
  const sessions = useMemo(() => normalizeSessions(sessionsRaw), [sessionsRaw])

  const getEntry = useCallback(
    (date) => daily[date] || null,
    [daily]
  )

  const getStatusForDate = useCallback(
    (date) => {
      const hasActivity = sessions.some(s => dateKey(s.timestamp) === date)
      return computeDayStatus(date, hasActivity, daily[date])
    },
    [sessions, daily]
  )

  /** Aggregate sessions for one date for the calendar summary. */
  const getDayActivity = useCallback(
    (date) => {
      const items = sessions.filter(s => dateKey(s.timestamp) === date)
      const totalDuration = items.reduce(
        (sum, s) => sum + (Number(s.durationSeconds) || 0),
        0
      )
      const modulesWorked = Array.from(
        new Set(items.map(s => s.module || s.moduleId).filter(Boolean))
      )
      return {
        items,
        drillCount: items.length,
        totalDuration,
        modulesWorked,
      }
    },
    [sessions]
  )

  const endTodaysSession = useCallback(
    ({ mood, notes }) => {
      const today = todayKey()
      const todaysSessions = sessions.filter(s => dateKey(s.timestamp) === today)
      const totalDuration = todaysSessions.reduce(
        (sum, s) => sum + (Number(s.durationSeconds) || 0),
        0
      )
      const modulesWorked = Array.from(
        new Set(todaysSessions.map(s => s.module || s.moduleId).filter(Boolean))
      )

      setDaily(prev => ({
        ...prev,
        [today]: {
          status: 'completed',
          endedAt: Date.now(),
          mood: mood || null,
          notes: (notes || '').trim(),
          modulesWorked,
          drillCount: todaysSessions.length,
          totalDuration,
        },
      }))
    },
    [sessions, setDaily]
  )

  const todaysStatus = useMemo(
    () => getStatusForDate(todayKey()),
    [getStatusForDate]
  )

  const todaysActivity = useMemo(
    () => getDayActivity(todayKey()),
    [getDayActivity]
  )

  return {
    daily,
    todaysStatus,
    todaysActivity,
    getEntry,
    getStatusForDate,
    getDayActivity,
    endTodaysSession,
  }
}

/* ============================================================
   MATCHES — per-day match-logger session state
   ============================================================ */
export function useDailyMatches() {
  const [daily, setDaily] = useLocalStorage(STORAGE_KEYS.DAILY_MATCHES, {})
  const [matches] = useLocalStorage(STORAGE_KEYS.MATCHES, [])

  const getEntry = useCallback(
    (date) => daily[date] || null,
    [daily]
  )

  const getStatusForDate = useCallback(
    (date) => {
      const hasActivity = matches.some(m => dateKey(m.timestamp) === date)
      return computeDayStatus(date, hasActivity, daily[date])
    },
    [matches, daily]
  )

  const getDayActivity = useCallback(
    (date) => {
      const items = matches.filter(m => dateKey(m.timestamp) === date)
      return {
        items,
        matchCount: items.length,
      }
    },
    [matches]
  )

  const endTodaysMatches = useCallback(
    ({ performance, takeaway }) => {
      const today = todayKey()
      const todaysMatches = matches.filter(m => dateKey(m.timestamp) === today)

      setDaily(prev => ({
        ...prev,
        [today]: {
          status: 'completed',
          endedAt: Date.now(),
          performance: performance || null,
          takeaway: (takeaway || '').trim(),
          matchCount: todaysMatches.length,
        },
      }))
    },
    [matches, setDaily]
  )

  const todaysStatus = useMemo(
    () => getStatusForDate(todayKey()),
    [getStatusForDate]
  )

  const todaysActivity = useMemo(
    () => getDayActivity(todayKey()),
    [getDayActivity]
  )

  return {
    daily,
    todaysStatus,
    todaysActivity,
    getEntry,
    getStatusForDate,
    getDayActivity,
    endTodaysMatches,
  }
}
