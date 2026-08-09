import { readLS, writeLS } from '../hooks/useLocalStorage.js'

/* esportselite_xp lives outside STORAGE_KEYS — inline like other
   feature-local keys (quotes, training_plans, theme). */
export const XP_KEY = 'esportselite_xp'
export const XP_EVENT = 'esports-elite:xp-gained'
export const LEVEL_EVENT = 'esports-elite:level-up'

/* Tiered level table. Thresholds and names tuned to feel rewarding for
   a casual grind, not a hard ceiling. */
export const LEVELS = [
  { level: 1,  xp: 0,     name: 'ROOKIE' },
  { level: 2,  xp: 100,   name: 'GRINDER' },
  { level: 3,  xp: 300,   name: 'CONTENDER' },
  { level: 4,  xp: 700,   name: 'VETERAN' },
  { level: 5,  xp: 1500,  name: 'ELITE' },
  { level: 6,  xp: 3000,  name: 'PRO' },
  { level: 7,  xp: 6000,  name: 'LEGEND' },
  { level: 8,  xp: 12000, name: 'MYTHIC' },
  { level: 9,  xp: 25000, name: 'IMMORTAL' },
  { level: 10, xp: 50000, name: 'GOD-TIER' },
]

/* Standard XP awards — keep aligned with the spec's toast messages. */
export const XP_AWARDS = {
  DRILL_COMPLETED: 25,
  MATCH_LOGGED: 30,
  SESSION_ENDED: 50,
  STREAK_MAINTAINED: 20,
}

export function getXP() {
  return Number(readLS(XP_KEY, 0)) || 0
}

/** Resolve a player profile for a given total XP. */
export function getLevelFor(xp) {
  let result = LEVELS[0]
  for (const l of LEVELS) {
    if (xp >= l.xp) result = l
    else break
  }
  const idx = LEVELS.indexOf(result)
  const next = LEVELS[idx + 1] || null
  const span = next ? next.xp - result.xp : 0
  return {
    level: result.level,
    name: result.name,
    xp,
    floor: result.xp,
    ceil: next ? next.xp : result.xp,
    nextName: next ? next.name : null,
    progressInLevel: span > 0 ? Math.max(0, Math.min(1, (xp - result.xp) / span)) : 1,
    isMax: !next,
  }
}

/**
 * Award XP for an action. Persists to localStorage and broadcasts:
 *   - XP_EVENT  for the small bottom-right toast
 *   - LEVEL_EVENT if the user crossed a level threshold
 */
export function awardXP(amount, action) {
  const a = Math.max(0, Math.floor(Number(amount) || 0))
  if (a === 0) return null
  const prev = getXP()
  const next = prev + a
  writeLS(XP_KEY, next)
  const prevLevel = getLevelFor(prev)
  const nextLevel = getLevelFor(next)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(XP_EVENT, { detail: { amount: a, action, xp: next, level: nextLevel } })
    )
    if (nextLevel.level > prevLevel.level) {
      window.dispatchEvent(
        new CustomEvent(LEVEL_EVENT, { detail: { level: nextLevel, amount: a, action } })
      )
    }
  }
  return { xp: next, leveledUp: nextLevel.level > prevLevel.level, level: nextLevel }
}
