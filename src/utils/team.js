/**
 * team.js — Firestore utilities for the Team Management module.
 *
 * Firestore layout:
 *   teams/{teamId}
 *   teams/{teamId}/members/{userId}
 *   teams/{teamId}/practices/{practiceId}
 *   teams/{teamId}/scrims/{scrimId}
 *   teams/{teamId}/announcements/{announcementId}
 *   users/{userId}.teamId
 *
 * All writes go through named helpers so callers don't touch the SDK
 * directly; that keeps the security-rule surface small and predictable.
 */

import {
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where, orderBy,
  increment, serverTimestamp, writeBatch, Timestamp,
  limit,
} from 'firebase/firestore'
import { db } from './firebase.js'

const MAX_TEAM_SIZE = 6
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/* Removed I, O, 0, 1 to avoid confusion when typing codes. */

/* ============================================================
   INVITE CODES
   ============================================================ */
export function generateInviteCode() {
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)]
  }
  return out
}

/* ============================================================
   CREATE / JOIN
   ============================================================ */
export async function createTeam(uid, userData, teamData) {
  if (!uid) throw new Error('Not signed in')

  /* Ensure user isn't already in a team. */
  const userSnap = await getDoc(doc(db, 'users', uid))
  if (userSnap.exists() && userSnap.data()?.teamId) {
    throw new Error('You are already in a team')
  }

  const inviteCode = generateInviteCode()
  const teamPayload = {
    name: (teamData.name || '').trim(),
    tag: (teamData.tag || '').trim().toUpperCase().slice(0, 5),
    logo: teamData.logo || '',
    banner: teamData.banner || '',
    description: (teamData.description || '').trim(),
    region: teamData.region || 'Other',
    isPublic: !!teamData.isPublic,
    inviteCode,
    ownerId: uid,
    createdAt: Timestamp.now(),
    memberCount: 1,
    stats: {
      totalMatches: 0,
      wins: 0,
      totalKills: 0,
      totalPlacements: 0,
    },
  }

  const teamRef = await addDoc(collection(db, 'teams'), teamPayload)
  const teamId = teamRef.id

  const memberPayload = {
    uid,
    ign: (userData.ign || '').trim(),
    bgmiUid: (userData.bgmiUid || '').trim(),
    role: 'owner',
    inGameRole: userData.inGameRole || 'All-rounder',
    device: (userData.device || '').trim(),
    fps: userData.fps || '60',
    gyro: !!userData.gyro,
    joinDate: Timestamp.now(),
    status: 'active',
    avatar: userData.avatar || '',
  }
  await setDoc(doc(db, 'teams', teamId, 'members', uid), memberPayload)
  await setDoc(doc(db, 'users', uid), { teamId }, { merge: true })

  return teamId
}

export async function joinTeamByCode(uid, userData, inviteCode) {
  if (!uid) throw new Error('Not signed in')
  const code = (inviteCode || '').trim().toUpperCase()
  if (!code) throw new Error('Enter an invite code')

  /* Reject if user is already in a team. */
  const userSnap = await getDoc(doc(db, 'users', uid))
  if (userSnap.exists() && userSnap.data()?.teamId) {
    throw new Error('You are already in a team')
  }

  const q = query(
    collection(db, 'teams'),
    where('inviteCode', '==', code),
    limit(1)
  )
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('Invalid invite code')

  const teamDoc = snap.docs[0]
  const teamId = teamDoc.id
  const teamData = teamDoc.data()

  if ((teamData.memberCount ?? 0) >= MAX_TEAM_SIZE) {
    throw new Error('Team is full')
  }

  /* Guard against double-joining if the user race-condition adds twice. */
  const existingMember = await getDoc(doc(db, 'teams', teamId, 'members', uid))
  if (existingMember.exists()) {
    throw new Error('You are already in this team')
  }

  const memberPayload = {
    uid,
    ign: (userData.ign || '').trim(),
    bgmiUid: (userData.bgmiUid || '').trim(),
    role: 'player',
    inGameRole: userData.inGameRole || 'All-rounder',
    device: (userData.device || '').trim(),
    fps: userData.fps || '60',
    gyro: !!userData.gyro,
    joinDate: Timestamp.now(),
    status: 'active',
    avatar: userData.avatar || '',
  }
  await setDoc(doc(db, 'teams', teamId, 'members', uid), memberPayload)
  await updateDoc(doc(db, 'teams', teamId), { memberCount: increment(1) })
  await setDoc(doc(db, 'users', uid), { teamId }, { merge: true })

  return teamId
}

/* ============================================================
   READS
   ============================================================ */
export async function getTeam(teamId) {
  if (!teamId) return null
  const snap = await getDoc(doc(db, 'teams', teamId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getTeamMembers(teamId) {
  if (!teamId) return []
  const snap = await getDocs(
    query(collection(db, 'teams', teamId, 'members'), orderBy('joinDate', 'asc'))
  )
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }))
}

export async function getTeamMember(teamId, uid) {
  if (!teamId || !uid) return null
  const snap = await getDoc(doc(db, 'teams', teamId, 'members', uid))
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null
}

/* ============================================================
   TEAM + MEMBER UPDATES
   ============================================================ */
export async function updateTeam(teamId, data) {
  if (!teamId) throw new Error('Missing teamId')
  await updateDoc(doc(db, 'teams', teamId), data)
}

export async function updateMember(teamId, uid, data) {
  if (!teamId || !uid) throw new Error('Missing teamId/uid')
  await updateDoc(doc(db, 'teams', teamId, 'members', uid), data)
}

export async function removeMember(teamId, uid, currentUserRole) {
  if (currentUserRole !== 'owner' && currentUserRole !== 'igl') {
    throw new Error('Permission denied')
  }
  await deleteDoc(doc(db, 'teams', teamId, 'members', uid))
  await setDoc(doc(db, 'users', uid), { teamId: null }, { merge: true })
  await updateDoc(doc(db, 'teams', teamId), { memberCount: increment(-1) })
}

export async function leaveTeam(teamId, uid, role) {
  if (role === 'owner') {
    throw new Error('Transfer ownership before leaving')
  }
  await deleteDoc(doc(db, 'teams', teamId, 'members', uid))
  await setDoc(doc(db, 'users', uid), { teamId: null }, { merge: true })
  await updateDoc(doc(db, 'teams', teamId), { memberCount: increment(-1) })
}

/* ============================================================
   ROLE ASSIGNMENTS
   ============================================================ */
export async function assignIGL(teamId, uid, targetUid) {
  const caller = await getTeamMember(teamId, uid)
  if (!caller || caller.role !== 'owner') throw new Error('Owner only')
  await updateDoc(doc(db, 'teams', teamId, 'members', targetUid), { role: 'igl' })
}

export async function removeIGL(teamId, uid, targetUid) {
  const caller = await getTeamMember(teamId, uid)
  if (!caller || caller.role !== 'owner') throw new Error('Owner only')
  await updateDoc(doc(db, 'teams', teamId, 'members', targetUid), { role: 'player' })
}

export async function transferOwnership(teamId, uid, targetUid) {
  const caller = await getTeamMember(teamId, uid)
  if (!caller || caller.role !== 'owner') throw new Error('Owner only')

  const batch = writeBatch(db)
  batch.update(doc(db, 'teams', teamId, 'members', targetUid), { role: 'owner' })
  batch.update(doc(db, 'teams', teamId, 'members', uid), { role: 'player' })
  batch.update(doc(db, 'teams', teamId), { ownerId: targetUid })
  await batch.commit()
}

/* ============================================================
   DELETE TEAM
   ============================================================ */
export async function deleteTeam(teamId, uid, members) {
  const team = await getTeam(teamId)
  if (!team) throw new Error('Team not found')
  if (team.ownerId !== uid) throw new Error('Only the owner can delete the team')

  /* Clear teamId on every member's user doc. */
  const memberList = Array.isArray(members) && members.length > 0
    ? members
    : await getTeamMembers(teamId)

  const b1 = writeBatch(db)
  memberList.forEach(m => {
    b1.set(doc(db, 'users', m.uid), { teamId: null }, { merge: true })
  })
  await b1.commit()

  /* Wipe subcollections. */
  await deleteSubcollection(teamId, 'members')
  await deleteSubcollection(teamId, 'practices')
  await deleteSubcollection(teamId, 'scrims')
  await deleteSubcollection(teamId, 'announcements')

  await deleteDoc(doc(db, 'teams', teamId))
}

async function deleteSubcollection(teamId, subPath) {
  const snap = await getDocs(collection(db, 'teams', teamId, subPath))
  if (snap.empty) return
  /* Firestore batches cap at 500 ops — split if needed. */
  let batch = writeBatch(db)
  let count = 0
  for (const d of snap.docs) {
    batch.delete(d.ref)
    count++
    if (count === 450) {
      await batch.commit()
      batch = writeBatch(db)
      count = 0
    }
  }
  if (count > 0) await batch.commit()
}

/* ============================================================
   INVITE CODE MANAGEMENT
   ============================================================ */
export async function regenerateInviteCode(teamId, uid) {
  const team = await getTeam(teamId)
  if (!team) throw new Error('Team not found')
  if (team.ownerId !== uid) throw new Error('Owner only')
  const newCode = generateInviteCode()
  await updateDoc(doc(db, 'teams', teamId), { inviteCode: newCode })
  return newCode
}

/* ============================================================
   PRACTICES
   ============================================================ */
export async function getPractices(teamId) {
  if (!teamId) return []
  try {
    const snap = await getDocs(
      query(collection(db, 'teams', teamId, 'practices'), orderBy('date', 'desc'))
    )
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch {
    const snap = await getDocs(collection(db, 'teams', teamId, 'practices'))
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  }
}

export async function createPractice(teamId, uid, data) {
  const payload = {
    title: (data.title || '').trim(),
    date: data.date || '',
    time: data.time || '',
    notes: (data.notes || '').trim(),
    createdBy: uid,
    createdAt: Timestamp.now(),
    attendance: {},
  }
  const ref = await addDoc(collection(db, 'teams', teamId, 'practices'), payload)
  return ref.id
}

export async function updatePractice(teamId, practiceId, data) {
  await updateDoc(doc(db, 'teams', teamId, 'practices', practiceId), data)
}

export async function deletePractice(teamId, practiceId) {
  await deleteDoc(doc(db, 'teams', teamId, 'practices', practiceId))
}

export async function markAttendance(teamId, practiceId, targetUid, status) {
  await updateDoc(doc(db, 'teams', teamId, 'practices', practiceId), {
    [`attendance.${targetUid}`]: status,
  })
}

/* ============================================================
   SCRIMS
   ============================================================ */
export async function getScrims(teamId) {
  if (!teamId) return []
  try {
    const snap = await getDocs(
      query(collection(db, 'teams', teamId, 'scrims'), orderBy('date', 'desc'))
    )
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch {
    const snap = await getDocs(collection(db, 'teams', teamId, 'scrims'))
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  }
}

export async function createScrim(teamId, uid, data) {
  const payload = {
    opponent: (data.opponent || '').trim(),
    date: data.date || '',
    time: data.time || '',
    roomId: (data.roomId || '').trim(),
    password: (data.password || '').trim(),
    notes: (data.notes || '').trim(),
    result: null,
    createdBy: uid,
    createdAt: Timestamp.now(),
  }
  const ref = await addDoc(collection(db, 'teams', teamId, 'scrims'), payload)
  return ref.id
}

export async function updateScrim(teamId, scrimId, data) {
  await updateDoc(doc(db, 'teams', teamId, 'scrims', scrimId), data)
}

export async function deleteScrim(teamId, scrimId) {
  await deleteDoc(doc(db, 'teams', teamId, 'scrims', scrimId))
}

export async function saveScrimResult(teamId, scrimId, result) {
  const clean = {
    won: !!result?.won,
    ourKills: Number(result?.ourKills) || 0,
    opponentKills: Number(result?.opponentKills) || 0,
    placement: Number(result?.placement) || 0,
  }
  await updateDoc(doc(db, 'teams', teamId, 'scrims', scrimId), { result: clean })

  /* Roll stats forward onto the team doc. */
  await updateDoc(doc(db, 'teams', teamId), {
    'stats.totalMatches': increment(1),
    'stats.wins': increment(clean.won ? 1 : 0),
    'stats.totalKills': increment(clean.ourKills),
    'stats.totalPlacements': increment(clean.placement),
  })
}

/* ============================================================
   ANNOUNCEMENTS
   ============================================================ */
export async function getAnnouncements(teamId) {
  if (!teamId) return []
  const snap = await getDocs(collection(db, 'teams', teamId, 'announcements'))
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  /* Sort client-side: pinned first, then newest. */
  return list.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    const at = a.createdAt?.toMillis?.() || 0
    const bt = b.createdAt?.toMillis?.() || 0
    return bt - at
  })
}

export async function createAnnouncement(teamId, uid, name, data) {
  const payload = {
    title: (data.title || '').trim(),
    body: (data.body || '').trim(),
    pinned: false,
    createdBy: uid,
    createdByName: name || 'Unknown',
    createdAt: Timestamp.now(),
    editedAt: null,
  }
  const ref = await addDoc(collection(db, 'teams', teamId, 'announcements'), payload)
  return ref.id
}

export async function updateAnnouncement(teamId, id, data) {
  await updateDoc(doc(db, 'teams', teamId, 'announcements', id), {
    ...data,
    editedAt: Timestamp.now(),
  })
}

export async function deleteAnnouncement(teamId, id) {
  await deleteDoc(doc(db, 'teams', teamId, 'announcements', id))
}

export async function togglePin(teamId, id, currentPinned) {
  await updateDoc(doc(db, 'teams', teamId, 'announcements', id), {
    pinned: !currentPinned,
  })
}

/* ============================================================
   ACTIVITY FEED (best-effort derived)
   ============================================================ */
export async function getRecentActivity(teamId, limitN = 5) {
  if (!teamId) return []
  const [ann, prac, scr, mem] = await Promise.all([
    getAnnouncements(teamId).catch(() => []),
    getPractices(teamId).catch(() => []),
    getScrims(teamId).catch(() => []),
    getTeamMembers(teamId).catch(() => []),
  ])

  const events = []
  ann.slice(0, 5).forEach(a => events.push({
    kind: 'announcement',
    title: `Announcement: ${a.title}`,
    at: a.createdAt?.toMillis?.() || 0,
    who: a.createdByName || '',
  }))
  scr.filter(s => s.result).slice(0, 5).forEach(s => events.push({
    kind: 'scrim',
    title: s.result.won
      ? `Won scrim vs ${s.opponent}`
      : `Lost scrim vs ${s.opponent}`,
    at: s.createdAt?.toMillis?.() || 0,
    who: '',
  }))
  prac.slice(0, 5).forEach(p => events.push({
    kind: 'practice',
    title: `Practice: ${p.title}`,
    at: p.createdAt?.toMillis?.() || 0,
    who: '',
  }))
  mem.slice(-5).reverse().forEach(m => events.push({
    kind: 'member',
    title: `${m.ign || 'Player'} joined`,
    at: m.joinDate?.toMillis?.() || 0,
    who: '',
  }))

  return events
    .sort((a, b) => b.at - a.at)
    .slice(0, limitN)
}
