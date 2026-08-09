import { useMemo } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { STORAGE_KEYS } from '../utils/constants'
import { dateKey, todayKey, daysBetween } from '../utils/helpers'

export function useStreak() {
  const [sessions] = useLocalStorage(STORAGE_KEYS.SESSIONS, [])

  return useMemo(() => {
    if (!sessions.length) return { current: 0, lastActive: null }

    const days = Array.from(new Set(sessions.map(s => dateKey(s.timestamp)))).sort()
    if (!days.length) return { current: 0, lastActive: null }

    const latest = days[days.length - 1]
    const today = todayKey()

    const gapToToday = daysBetween(latest, today)
    if (gapToToday > 1) return { current: 0, lastActive: latest }

    let streak = 1
    for (let i = days.length - 1; i > 0; i--) {
      const diff = daysBetween(days[i - 1], days[i])
      if (diff === 1) streak += 1
      else break
    }

    return { current: streak, lastActive: latest }
  }, [sessions])
}

export function recordStreakActivity() {
  // no-op — streak is derived from sessions
}
