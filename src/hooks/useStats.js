import { useMemo } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { STORAGE_KEYS } from '../utils/constants'
import {
  dateKey,
  startOfRollingWindow,
  normalizeSessions,
  formatPracticeTime,
} from '../utils/helpers'

/**
 * Resolve a match's weakness/strength IDs from either the new
 * `weakestPoints` array OR the legacy `weakestPoint` string (best-effort
 * name match against the suggestions catalog).
 */
function resolveWeaknessIds(match, suggestions) {
  if (Array.isArray(match.weakestPoints) && match.weakestPoints.length > 0) {
    return match.weakestPoints
  }
  const legacy = (match.weakestPoint || '').trim()
  if (!legacy) return []
  const sug = suggestions.find(s => s.name.toLowerCase() === legacy.toLowerCase())
  return sug ? [sug.id] : []
}

export function useStats() {
  const [sessionsRaw] = useLocalStorage(STORAGE_KEYS.SESSIONS, [])
  const [matches] = useLocalStorage(STORAGE_KEYS.MATCHES, [])
  const [suggestions] = useLocalStorage(STORAGE_KEYS.SUGGESTIONS, [])

  return useMemo(() => {
    const sessions = normalizeSessions(sessionsRaw)

    /* -------- TOTAL PRACTICE TIME -------- */
    const totalSeconds = sessions.reduce(
      (sum, s) => sum + (Number(s.durationSeconds) || 0),
      0
    )
    const totalPracticeTime = formatPracticeTime(totalSeconds)

    // eslint-disable-next-line no-console
    console.log(
      '[Esports Elite] Total practice seconds:',
      totalSeconds,
      '→',
      totalPracticeTime,
      `(across ${sessions.length} session${sessions.length === 1 ? '' : 's'})`
    )

    /* -------- WEEKLY CONSISTENCY (rolling 7) -------- */
    const sevenDaysAgo = startOfRollingWindow(7)
    const sessionsLast7 = sessions.filter(s => new Date(s.timestamp) >= sevenDaysAgo)
    const uniqueDaysLast7 = new Set(sessionsLast7.map(s => dateKey(s.timestamp))).size
    const weeklyConsistency = Math.round((uniqueDaysLast7 / 7) * 100)

    /* -------- THIS MONTH -------- */
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const sessionsThisMonth = sessions.filter(s => new Date(s.timestamp) >= monthStart)

    /* -------- WEAKNESS COUNTS (by suggestion ID) -------- */
    const fourteenDaysAgo = startOfRollingWindow(14)
    const sevenDaysAgoForFocus = startOfRollingWindow(7)

    function tallyBySuggestion(filteredMatches) {
      const counts = {}
      filteredMatches.forEach(m => {
        const ids = resolveWeaknessIds(m, suggestions)
        ids.forEach(id => {
          counts[id] = (counts[id] || 0) + 1
        })
      })
      return Object.entries(counts)
        .map(([id, count]) => {
          const sug = suggestions.find(s => s.id === id)
          return sug ? { ...sug, count } : null
        })
        .filter(Boolean)
        .sort((a, b) => b.count - a.count)
    }

    const matchesLast14 = matches.filter(m => new Date(m.timestamp) >= fourteenDaysAgo)
    const matchesLast7 = matches.filter(m => new Date(m.timestamp) >= sevenDaysAgoForFocus)

    const weaknessRankedAllTime = tallyBySuggestion(matches)
    const weaknessRankedLast14 = tallyBySuggestion(matchesLast14)
    const weaknessRankedLast7 = tallyBySuggestion(matchesLast7)

    /* ---- PRIORITY FOCUS — most repeated in last 14 days,
            falling back to all-time if 14-day window is empty. ---- */
    const priorityFocus =
      weaknessRankedLast14[0] || weaknessRankedAllTime[0] || null
    const priorityFocusWindowLabel =
      weaknessRankedLast14[0] ? 'in last 14 days' : 'overall'

    /* ---- FOCUS TOMORROW — ranks #2-#4 from all-time,
            or top 3 from last 7 days if that has MORE items. ---- */
    const allTimeBelowFirst = weaknessRankedAllTime.slice(1, 4)
    const last7Top3 = weaknessRankedLast7.slice(0, 3)
    const focusTomorrow =
      last7Top3.length > allTimeBelowFirst.length ? last7Top3 : allTimeBelowFirst

    const totalWeaknessLogged = matches.reduce((sum, m) => {
      return sum + resolveWeaknessIds(m, suggestions).length
    }, 0)
    const uniqueWeaknessCount = weaknessRankedAllTime.length
    const fewSamples = totalWeaknessLogged <= 1

    /* -------- STRENGTH RANKED -------- */
    function tallyStrengthBySuggestion() {
      const counts = {}
      matches.forEach(m => {
        const ids = Array.isArray(m.strongestPoints)
          ? m.strongestPoints
          : m.strongestPoint
          ? [m.strongestPoint]
          : []
        ids.forEach(id => {
          counts[id] = (counts[id] || 0) + 1
        })
      })
      return Object.entries(counts)
        .map(([id, count]) => {
          const sug = suggestions.find(s => s.id === id)
          return sug ? { ...sug, count } : { id, label: id, count }
        })
        .sort((a, b) => b.count - a.count)
    }
    const strengthRanked = tallyStrengthBySuggestion()

    /* -------- RECENT SESSIONS -------- */
    const recentSessions = [...sessions]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)

    return {
      totalSeconds,
      totalPracticeTime,
      totalSessions: sessions.length,
      sessionsLast7Days: sessionsLast7.length,
      uniqueDaysLast7,
      weeklyConsistency,
      sessionsThisMonth: sessionsThisMonth.length,
      priorityFocus,
      priorityFocusWindowLabel,
      focusTomorrow,
      strengthRanked,
      recentSessions,
      matchCount: matches.length,
      uniqueWeaknessCount,
      totalWeaknessLogged,
      fewSamples,
    }
  }, [sessionsRaw, matches, suggestions])
}
