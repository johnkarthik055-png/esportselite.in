import { readLS } from '../hooks/useLocalStorage.js'
import { STORAGE_KEYS } from './constants.js'

/**
 * Resolve the player's display name in this order:
 *   1. Firebase auth displayName
 *   2. Local profile.username (UID-scoped via readLS)
 *   3. 'Player' fallback
 */
export function getDisplayName(user, profile) {
  if (user?.displayName) return user.displayName
  if (profile?.username) return profile.username
  try {
    const stored = readLS(STORAGE_KEYS.USER, null)
    if (stored?.username) return stored.username
  } catch {
    /* ignore */
  }
  return 'Player'
}
