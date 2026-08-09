/**
 * db.js — Firestore CRUD helpers for Esports Elite.
 *
 * Firestore data model:
 *   users/{uid}                — profile + xp + level + streak + trial (merged)
 *   users/{uid}/sessions/      — subcollection, one doc per drill session
 *   users/{uid}/matches/       — subcollection, one doc per match
 *   users/{uid}/daily_sessions/{date}  — training-day status document
 *   users/{uid}/daily_matches/{date}   — match-day status document
 *   users/{uid}/data/modules           — { modules: [...] }
 *   users/{uid}/data/notifications     — { notifications: [...] }
 *
 * All writes are dual: localStorage (instant UI) + Firestore (persistence).
 * All reads prefer localStorage; fall back to Firestore if empty.
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { getUID } from './storage.js'

/* ─── Level system (7 levels, 0-indexed to match the app spec) ───
 * 0 → Rookie   (0 XP)
 * 1 → Bronze   (500 XP)
 * 2 → Silver   (1000 XP)
 * 3 → Gold     (2000 XP)
 * 4 → Platinum (3500 XP)
 * 5 → Diamond  (5000 XP)
 * 6 → Elite    (7500 XP)
 *
 * The previous version used a 1-indexed range with names
 * (Grinder/Competitor/Veteran/Pro/Champion) that no longer match
 * the design system's badge palette. Everything downstream reads
 * these constants so switching here propagates automatically. */
export const XP_PER_LEVEL    = [0, 500, 1000, 2000, 3500, 5000, 7500]
export const LEVEL_NAMES_ARR = ['Rookie', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Elite']
export const LEVEL_NAME_MAP  = { 0:'Rookie', 1:'Bronze', 2:'Silver', 3:'Gold', 4:'Platinum', 5:'Diamond', 6:'Elite' }

export function getLevelName(level) {
  return LEVEL_NAMES_ARR[level] || 'Rookie'
}

export function calcLevelFromXP(xp = 0) {
  for (let i = XP_PER_LEVEL.length - 1; i >= 0; i--) {
    if (xp >= XP_PER_LEVEL[i]) return i
  }
  return 0
}

/* ─── localStorage helpers (UID-scoped) ─────────────────────── */

function _lsGet(uid, key, fallback = null) {
  if (!uid) return fallback
  try {
    const raw = localStorage.getItem(`esportselite_${uid}_${key}`)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
function _lsSet(uid, key, value) {
  if (!uid) return
  try { localStorage.setItem(`esportselite_${uid}_${key}`, JSON.stringify(value)) }
  catch { /* ignore quota */ }
}

function lsGet(key, fallback = null, uid) {
  return _lsGet(uid || getUID(), key, fallback)
}
function lsSet(key, value, uid) {
  _lsSet(uid || getUID(), key, value)
}

/* ─── PROFILE + XP ──────────────────────────────────────────── */

export async function getProfile(uid) {
  const id = uid || getUID()
  if (!id) return null
  try {
    const snap = await getDoc(doc(db, 'users', id))
    if (!snap.exists()) return null
    const data = snap.data()
    return {
      ...data,
      xp: data.xp ?? 0,
      level: data.level ?? 1,
    }
  } catch {
    const stored = _lsGet(id, 'user', null)
    if (stored) return { ...stored, xp: 0, level: 1 }
    return null
  }
}

export async function saveProfile(uid, data) {
  const id = uid || getUID()
  if (!id) return
  try {
    await setDoc(doc(db, 'users', id), data, { merge: true })
    const existing = _lsGet(id, 'user', {})
    _lsSet(id, 'user', { ...existing, ...data })
  } catch {
    /* swallow — localStorage already updated */
  }
}

export async function saveXP(uid, xp, level) {
  const id = uid || getUID()
  if (!id) return
  try {
    await setDoc(
      doc(db, 'users', id),
      { xp, level },
      { merge: true }
    )
    console.log('[db] XP saved:', xp, 'Level:', level, 'uid:', id)
  } catch (err) {
    console.warn('[db] saveXP failed:', err)
  }
}

/* ─── SESSIONS ──────────────────────────────────────────────── */

export async function addSession(sessionData) {
  const uid = getUID()
  const existing = lsGet('sessions', [])
  lsSet('sessions', [...existing, sessionData])

  if (!uid) return
  try { await addDoc(collection(db, 'users', uid, 'sessions'), sessionData) }
  catch { /* ignore */ }
}

export async function getSessions(uid) {
  const id = uid || getUID()
  const stored = _lsGet(id, 'sessions', null)
  if (Array.isArray(stored) && stored.length > 0) return stored

  if (!id) return []
  try {
    const snap = await getDocs(query(collection(db, 'users', id, 'sessions'), orderBy('timestamp', 'desc')))
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    if (docs.length > 0) _lsSet(id, 'sessions', docs)
    return docs
  } catch { return [] }
}

/* ─── MATCHES ───────────────────────────────────────────────── */

export async function addMatch(matchData) {
  const uid = getUID()
  const existing = lsGet('matches', [])
  lsSet('matches', [matchData, ...existing])

  if (!uid) return
  try { await addDoc(collection(db, 'users', uid, 'matches'), matchData) }
  catch { /* ignore */ }
}

export async function getMatches(uid) {
  const id = uid || getUID()
  const stored = _lsGet(id, 'matches', null)
  if (Array.isArray(stored) && stored.length > 0) return stored

  if (!id) return []
  try {
    const snap = await getDocs(query(collection(db, 'users', id, 'matches'), orderBy('timestamp', 'desc')))
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    if (docs.length > 0) _lsSet(id, 'matches', docs)
    return docs
  } catch { return [] }
}

/* ─── MODULES ───────────────────────────────────────────────── */

export async function saveModules(modules, uid) {
  const id = uid || getUID()
  lsSet('modules', modules, id)
  if (!id) return
  try { await setDoc(doc(db, 'users', id, 'data', 'modules'), { modules }) }
  catch { /* ignore */ }
}

export async function getModules(uid) {
  const id = uid || getUID()
  const stored = _lsGet(id, 'modules', null)
  if (Array.isArray(stored) && stored.length > 0) return stored

  if (!id) return []
  try {
    const snap = await getDoc(doc(db, 'users', id, 'data', 'modules'))
    if (snap.exists()) {
      const mods = snap.data().modules || []
      if (mods.length > 0) _lsSet(id, 'modules', mods)
      return mods
    }
    return []
  } catch { return [] }
}

/* ─── DAILY SESSIONS ────────────────────────────────────────── */

export async function saveDailySession(uid, date, entry) {
  const id = uid || getUID()
  if (!id || !date) return
  const existing = _lsGet(id, 'daily_sessions', {}) || {}
  const updated = { ...existing, [date]: entry }
  _lsSet(id, 'daily_sessions', updated)

  try { await setDoc(doc(db, 'users', id, 'daily_sessions', date), entry) }
  catch { /* ignore */ }
}

export async function getAllDailySessions(uid) {
  const id = uid || getUID()
  const stored = _lsGet(id, 'daily_sessions', null)
  if (stored && typeof stored === 'object' && Object.keys(stored).length > 0) return stored

  if (!id) return {}
  try {
    const snap = await getDocs(collection(db, 'users', id, 'daily_sessions'))
    const result = {}
    snap.docs.forEach(d => { result[d.id] = d.data() })
    if (Object.keys(result).length > 0) _lsSet(id, 'daily_sessions', result)
    return result
  } catch { return {} }
}

/* ─── DAILY MATCHES ─────────────────────────────────────────── */

export async function saveDailyMatch(date, entry, uid) {
  const id = uid || getUID()
  const existing = lsGet('daily_matches', {}, id)
  const updated = { ...existing, [date]: entry }
  lsSet('daily_matches', updated, id)

  if (!id) return
  try { await setDoc(doc(db, 'users', id, 'daily_matches', date), entry) }
  catch { /* ignore */ }
}

export async function getAllDailyMatches(uid) {
  const id = uid || getUID()
  const stored = _lsGet(id, 'daily_matches', null)
  if (stored && typeof stored === 'object' && Object.keys(stored).length > 0) return stored

  if (!id) return {}
  try {
    const snap = await getDocs(collection(db, 'users', id, 'daily_matches'))
    const result = {}
    snap.docs.forEach(d => { result[d.id] = d.data() })
    if (Object.keys(result).length > 0) _lsSet(id, 'daily_matches', result)
    return result
  } catch { return {} }
}

/* ─── STREAK ────────────────────────────────────────────────── */

export async function saveStreak(uid, streak) {
  const id = uid || getUID()
  if (!id) return
  try {
    await setDoc(doc(db, 'users', id), { streak }, { merge: true })
    console.log('[db] Streak saved:', streak, 'uid:', id)
  } catch (err) {
    console.warn('[db] saveStreak failed:', err)
  }
}

/* ─── TRIAL ─────────────────────────────────────────────────── */

export const initTrial = async (uid) => {
  if (!uid) return
  const snap = await getDoc(doc(db, 'users', uid))
  if (snap.exists() && snap.data().trial) return
  const startDate = new Date()
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 90)
  await setDoc(doc(db, 'users', uid), {
    trial: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      plan: 'free_trial',
      daysTotal: 90
    }
  }, { merge: true })
}

export const getTrialStatus = async (uid) => {
  if (!uid) return { active: false, daysLeft: 0, expired: true }
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists() || !snap.data().trial) return { active: false, daysLeft: 0, expired: true }
  const trial = snap.data().trial
  const now = new Date()
  const endDate = new Date(trial.endDate)
  const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))
  return {
    active: daysLeft > 0,
    daysLeft: Math.max(0, daysLeft),
    expired: daysLeft <= 0,
    startDate: trial.startDate,
    endDate: trial.endDate,
    plan: trial.plan || 'free_trial'
  }
}

export async function saveTrialData(trialData, uid) {
  const id = uid || getUID()
  if (!id) return
  try { localStorage.setItem(`esportselite_${id}_trial`, JSON.stringify(trialData)) }
  catch { /* ignore */ }
  try { await setDoc(doc(db, 'users', id), { trial: trialData }, { merge: true }) }
  catch { /* ignore */ }
}

/* ─── NOTIFICATIONS ──────────────────────────────────────────── */

export async function saveNotifications(notifications, uid) {
  const id = uid || getUID()
  lsSet('notifications', notifications, id)
  if (!id) return
  try { await setDoc(doc(db, 'users', id, 'data', 'notifications'), { notifications }) }
  catch { /* ignore */ }
}

export async function getNotifications(uid) {
  const id = uid || getUID()
  const stored = _lsGet(id, 'notifications', null)
  if (Array.isArray(stored)) return stored

  if (!id) return []
  try {
    const snap = await getDoc(doc(db, 'users', id, 'data', 'notifications'))
    if (snap.exists()) {
      const data = snap.data().notifications || []
      _lsSet(id, 'notifications', data)
      return data
    }
    return []
  } catch { return [] }
}

/* ─── TEAM re-exports (see ./team.js) ────────────────────────
   Central hub so callers can import team helpers from db.js as
   they do for the rest of the Firestore surface. */
export {
  createTeam,
  joinTeamByCode,
  getTeam,
  getTeamMembers,
  updateTeam,
  removeMember,
  leaveTeam,
  deleteTeam,
  assignIGL,
  removeIGL,
  transferOwnership,
  regenerateInviteCode,
} from './team.js'
