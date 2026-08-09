import { auth } from './firebase.js'
import { setCurrentUid } from '../hooks/useLocalStorage.js'

/**
 * Direct (non-React) UID-scoped localStorage helpers. The base key here
 * is just the suffix (e.g. 'sessions', 'trial') — UID prefixing happens
 * inside getKey().
 *
 * For React state-aware reads in components, prefer useLocalStorage from
 * hooks/useLocalStorage.js. These helpers are for non-hook call sites
 * (initTrial, clear-on-logout, ad-hoc utilities).
 */
const ROOT = 'esportselite'

/**
 * Module-level UID cache. Set eagerly by setActiveUID() before any
 * auth-triggered re-render so getData/setData never read a stale null.
 */
let _currentUID = null

/**
 * Set the active user UID. Call this BEFORE calling setUser() in any
 * auth flow so that storage helpers are ready the moment components
 * re-render. Also forwards to useLocalStorage's setCurrentUid so that
 * hook-based storage readers get the same uid + dispatch the auth event.
 */
export function setActiveUID(uid) {
  _currentUID = uid || null
  setCurrentUid(uid || null)
}

export function getUID() {
  return _currentUID || auth.currentUser?.uid || null
}

export function getKey(key) {
  const uid = getUID()
  if (!uid) return null
  return `${ROOT}_${uid}_${key}`
}

export function getData(key, fallback = null) {
  const storageKey = getKey(key)
  if (!storageKey) {
    /* eslint-disable-next-line no-console */
    console.warn('getData called with no UID for key:', key)
    return fallback
  }
  try {
    const data = localStorage.getItem(storageKey)
    return data ? JSON.parse(data) : fallback
  } catch {
    return fallback
  }
}

export function setData(key, value) {
  const storageKey = getKey(key)
  if (!storageKey) return
  try {
    localStorage.setItem(storageKey, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export function removeData(key) {
  const storageKey = getKey(key)
  if (!storageKey) return
  localStorage.removeItem(storageKey)
}

/** Wipe only the current user's data — leaves other users alone. */
export function clearAllUserData() {
  const uid = getUID()
  if (!uid) return
  const prefix = `${ROOT}_${uid}_`
  Object.keys(localStorage)
    .filter(k => k.startsWith(prefix))
    .forEach(k => localStorage.removeItem(k))
}

/**
 * One-time migration: copies any old un-prefixed `esportselite_<key>` values
 * into the UID-scoped `esportselite_<uid>_<key>` slot, then removes the old
 * key so the next login for a different account starts clean.
 *
 * Call after every successful auth (email, signup, Google redirect).
 * Idempotent — gated by a per-UID migration flag.
 */
export function migrateOldData(uid) {
  if (!uid) return
  const migrationKey = `esportselite_${uid}_migrated`
  if (localStorage.getItem(migrationKey)) return

  const keys = [
    'user', 'sessions', 'matches', 'modules',
    'streak', 'daily_sessions', 'daily_matches',
    'notifications', 'user_avatar', 'tournament_stages',
    'custom_modules', 'weakness_strength_suggestions',
    'trial', 'pb_longest_drill', 'migration_v2_done',
    'notif_initialized',
  ]

  keys.forEach(key => {
    const oldKey = `esportselite_${key}`
    const newKey = `esportselite_${uid}_${key}`
    const oldData = localStorage.getItem(oldKey)
    if (oldData && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, oldData)
      localStorage.removeItem(oldKey)
    }
  })

  localStorage.setItem(migrationKey, 'true')
}

/**
 * Resolve the player's display name. Priority order:
 *   1. auth.currentUser?.displayName  (always fresh after reload())
 *   2. getData('user')?.username       (UID-scoped localStorage)
 *   3. 'Player' fallback
 *
 * Components should import this from storage.js so they always read the
 * freshest value after a Profile save + refreshUser() re-render cycle.
 */
export function getDisplayName() {
  if (auth.currentUser?.displayName) return auth.currentUser.displayName
  const profile = getData('user')
  if (profile?.username) return profile.username
  return 'Player'
}
