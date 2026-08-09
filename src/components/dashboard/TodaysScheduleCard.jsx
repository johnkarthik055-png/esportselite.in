import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  collection, onSnapshot, orderBy, query,
} from 'firebase/firestore'
import { CalendarClock, ArrowRight, Check, Coffee } from 'lucide-react'
import { db } from '../../utils/firebase.js'
import { useAuth } from '../../context/AuthContext.jsx'

/* Dashboard widget for the currently-active training schedule.
 * Renders null (silent) when there is no active/paused schedule so
 * the Dashboard flow is untouched until the user creates one.
 *
 * Reads on mount and stays live via two onSnapshot subscriptions:
 *   1. users/{uid}/schedules   → pick the active/paused one
 *   2. users/{uid}/schedules/{id}/days → today's day only, matched
 *      by ISO date on the client (avoids needing a composite index). */
export default function TodaysScheduleCard() {
  const { user } = useAuth()
  const uid = user?.uid
  const [schedule, setSchedule] = useState(null)
  const [today, setToday] = useState(null)

  useEffect(() => {
    if (!uid) return
    const q = query(collection(db, 'users', uid, 'schedules'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        const active = list.find(s => s.status === 'active' || s.status === 'paused') || null
        setSchedule(active)
      },
      () => { /* silent — widget just disappears on rules/network failure */ },
    )
    return unsub
  }, [uid])

  useEffect(() => {
    if (!uid || !schedule?.id) { setToday(null); return }
    const unsub = onSnapshot(
      collection(db, 'users', uid, 'schedules', schedule.id, 'days'),
      (snap) => {
        const iso = todayISO()
        const found = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .find(d => d.date === iso) || null
        setToday(found)
      },
      () => setToday(null),
    )
    return unsub
  }, [uid, schedule?.id])

  if (!schedule) return null

  const completed = Number(schedule.completedDays) || 0
  const total = Math.max(1, Number(schedule.totalDays) || 1)
  const percent = Math.min(100, Math.round((completed / total) * 100))
  const tasks = Array.isArray(today?.tasks) ? today.tasks : []
  const shownTasks = tasks.slice(0, 3)
  const extra = Math.max(0, tasks.length - shownTasks.length)
  const isRest = today?.status === 'rest' || (tasks.length > 0 && tasks.every(t => t.type === 'rest'))
  const isDone = today?.status === 'done'

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card-header" style={{ marginBottom: 0 }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarClock size={15} style={{ color: 'var(--text-subtle)' }} />
          Today's schedule
        </div>
        <span className="label">Day {today?.dayNumber ?? '—'} of {total}</span>
      </div>

      <div>
        <div style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          {schedule.title || 'Training schedule'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {schedule.goal || '—'}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Progress
          </span>
          <span style={{ fontFamily: 'SF Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>
            {percent}%
          </span>
        </div>
        <div className="xp-bar-track" style={{ height: 6 }}>
          <div className="xp-bar-fill" style={{ width: `${percent}%`, background: 'var(--red)' }} />
        </div>
      </div>

      {!today ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          No tasks scheduled for today.
        </div>
      ) : isRest ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          <Coffee size={14} /> Rest day — recovery is part of training.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {shownTasks.map(t => (
            <li key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12,
              color: t.done ? 'var(--text-muted)' : 'var(--text-primary)',
            }}>
              <span style={{
                width: 14, height: 14, borderRadius: 3,
                background: t.done ? 'var(--green)' : 'transparent',
                border: `1px solid ${t.done ? 'var(--green)' : 'var(--border)'}`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', flexShrink: 0,
              }}>
                {t.done ? <Check size={9} strokeWidth={3} /> : null}
              </span>
              <span style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textDecoration: t.done ? 'line-through' : 'none',
              }}>
                {t.title || '—'}
              </span>
              {t.duration ? (
                <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{t.duration}m</span>
              ) : null}
            </li>
          ))}
          {extra > 0 && (
            <li style={{ fontSize: 11, color: 'var(--text-subtle)' }}>+{extra} more task{extra === 1 ? '' : 's'}</li>
          )}
          {isDone && (
            <li style={{ fontSize: 11, color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Check size={11} /> Day complete
            </li>
          )}
        </ul>
      )}

      <Link
        to="/scheduler"
        className="btn btn-secondary btn-sm"
        style={{ width: '100%', justifyContent: 'center' }}
      >
        View Full Schedule <ArrowRight size={13} />
      </Link>
    </div>
  )
}

function todayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}
