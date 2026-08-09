/**
 * notifications.js
 *
 * Idempotent notification generator backed by Firestore.
 *
 * Why this exists:
 *   The legacy notification flow re-emitted the same welcome / streak /
 *   reminder cards on every app load — users complained that the same
 *   3-day-streak banner kept piling up. Every notification now carries a
 *   stable `key` (type + date / milestone). `addUniqueNotification` queries
 *   by key before inserting, so retries become no-ops.
 *
 * Firestore layout:
 *   users/{uid}/notifications/{autoId}
 *     {
 *       key:       string   (unique idempotency key, e.g. "streak_7")
 *       type:      'streak' | 'warning' | 'tip' | 'reminder'
 *       title:     string
 *       message:   string
 *       timestamp: ISO string
 *       read:      boolean
 *     }
 *
 * Required Firestore index (Console → Indexes → Composite):
 *   collection: notifications
 *     field: key       (ascending)
 *     field: timestamp (descending)
 *
 * Security rules — owner-only access on users/{uid}/notifications.
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'

/* ───────────────────────────────────────────────────────────── */
/* Insert a notification only if no doc with the same `key` exists.
   `key` should encode anything that makes the notification "the
   same" so retries are silent (e.g. "streak_7", "trial_expiry_3",
   "session_reminder_2026-06-05", "welcome_first_login").          */
export const addUniqueNotification = async (uid, notif) => {
  if (!uid || !notif?.key) return

  const notifRef = collection(db, 'users', uid, 'notifications')

  /* Check if a notification with the same key already exists. */
  const existing = await getDocs(
    query(notifRef, where('key', '==', notif.key))
  )

  if (!existing.empty) {
    console.log('Notification already exists:', notif.key)
    return
  }

  await addDoc(notifRef, {
    ...notif,
    timestamp: new Date().toISOString(),
    read: false,
  })
  console.log('Notification added:', notif.key)
}

/* ───────────────────────────────────────────────────────────── */
/* Generate the standard "daily" notification set for a user.
   Safe to call any number of times in one day — each notification
   has an idempotency key that guarantees only one insert per key. */
export const generateDailyNotifications = async (uid, userData) => {
  if (!uid) return

  const today = new Date().toISOString().split('T')[0]

  const { streak, sessions, trial } = userData || {}

  /* ── Streak milestones — only fire when the streak EQUALS the
        milestone, and only once per milestone per account. ── */
  const streakCount = streak?.count || 0
  const milestones = [3, 7, 14, 30]

  for (const milestone of milestones) {
    if (streakCount === milestone) {
      await addUniqueNotification(uid, {
        key: `streak_${milestone}`,
        type: 'streak',
        title: `${milestone} Day Streak! 🔥`,
        message: `You have been grinding for ${milestone} days straight. Keep it up!`,
      })
    }
  }

  /* ── Trial expiry warning — bucket by remaining days so we get
        at most one warning per (uid, daysLeft) pair. ── */
  if (trial?.daysLeft <= 7 && trial?.daysLeft > 0) {
    await addUniqueNotification(uid, {
      key: `trial_expiry_${Math.floor(trial.daysLeft)}`,
      type: 'warning',
      title: 'Trial Expiring Soon ⚠',
      message: `Your free trial expires in ${trial.daysLeft} days.`,
    })
  }

  /* ── Welcome — ever-only. ── */
  await addUniqueNotification(uid, {
    key: 'welcome_first_login',
    type: 'tip',
    title: 'Welcome to Esports Elite! 👋',
    message: 'Start by completing your first ADS drill and logging a Classic match.',
  })

  /* ── Session reminder — once per calendar day, only if no
        session has been logged today. ── */
  const todaySessions = (sessions || []).filter(s => {
    const ts = s?.timestamp
    if (typeof ts === 'string') return ts.startsWith(today)
    if (typeof ts === 'number') {
      try { return new Date(ts).toISOString().startsWith(today) }
      catch { return false }
    }
    return false
  })

  if (todaySessions.length === 0) {
    await addUniqueNotification(uid, {
      key: `session_reminder_${today}`,
      type: 'reminder',
      title: 'No session today yet 📅',
      message: 'You have not trained today. Even 15 minutes makes a difference!',
    })
  }
}

/* ───────────────────────────────────────────────────────────── */
/* Delete notifications older than 30 days. Best-effort, fail-soft. */
export const cleanOldNotifications = async (uid) => {
  if (!uid) return
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)

  try {
    const snap = await getDocs(
      collection(db, 'users', uid, 'notifications')
    )

    await Promise.all(
      snap.docs.map(async d => {
        const raw = d.data()?.timestamp
        const ts = raw ? new Date(raw) : null
        if (ts && !Number.isNaN(ts.getTime()) && ts < cutoff) {
          try {
            await deleteDoc(doc(db, 'users', uid, 'notifications', d.id))
          } catch {
            /* swallow individual failures so one bad doc doesn't
               poison the whole prune pass. */
          }
        }
      })
    )
  } catch (err) {
    console.warn('[notifications] cleanOldNotifications failed:', err)
  }
}

/* ============================================================
   TEAM NOTIFICATIONS
   ============================================================ */

/* Fire-and-forget delivery to a single user. Doesn't use the
   idempotency-key path — team events are per-instance, not
   milestone-style, so every practice/scrim/announcement is
   genuinely a new notification. */
export const sendTeamNotification = async (uid, notification) => {
  if (!uid || !notification?.title) return
  try {
    await addDoc(collection(db, 'users', uid, 'notifications'), {
      title: notification.title,
      message: notification.message || '',
      type: notification.type || 'info',
      link: notification.link || '/team',
      read: false,
      createdAt: Timestamp.now(),
    })
  } catch (err) {
    console.warn('[notifications] sendTeamNotification failed for', uid, err)
  }
}

/* Fan out one notification to many recipients. Runs writes in
   parallel; individual failures are swallowed so one bad UID
   doesn't block the rest of the roster. */
export const notifyTeamMembers = async (memberUids, notification) => {
  if (!Array.isArray(memberUids) || memberUids.length === 0) return
  await Promise.all(
    memberUids.map((uid) => sendTeamNotification(uid, notification))
  )
}

export const TEAM_NOTIFICATIONS = {
  memberJoined: (name) => ({
    title: 'New Team Member',
    message: `${name || 'Someone'} joined the team`,
    type: 'success',
    link: '/team',
  }),
  memberLeft: (name) => ({
    title: 'Member Left',
    message: `${name || 'Someone'} left the team`,
    type: 'info',
    link: '/team',
  }),
  practiceReminder: (title, time) => ({
    title: 'Practice Reminder',
    message: `${title || 'Practice'} starts at ${time || 'TBD'}`,
    type: 'warning',
    link: '/team',
  }),
  scrimReminder: (opponent, time) => ({
    title: 'Scrim Reminder',
    message: `vs ${opponent || 'Opponent'} at ${time || 'TBD'}`,
    type: 'warning',
    link: '/team',
  }),
  newAnnouncement: (title) => ({
    title: 'New Announcement',
    message: title || 'A new announcement was posted',
    type: 'info',
    link: '/team',
  }),
  roleChanged: (role) => ({
    title: 'Role Updated',
    message: `You are now ${role || 'a team member'}`,
    type: 'info',
    link: '/team',
  }),
  removedFromTeam: (teamName) => ({
    title: 'Removed From Team',
    message: `You were removed from ${teamName || 'your team'}`,
    type: 'warning',
    link: '/team',
  }),
}
