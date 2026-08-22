/*
 * ADD TO FIRESTORE RULES:
 *
 * match /users/{uid}/schedules/{scheduleId} {
 *   allow read, write: if request.auth != null &&
 *                         request.auth.uid == uid;
 *   match /days/{dayId} {
 *     allow read, write: if request.auth != null &&
 *                           request.auth.uid == uid;
 *   }
 * }
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot,
  orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore'
import {
  Trophy, Target, Calendar as CalendarIcon, CalendarClock,
  Zap, Bot, Settings,
  Loader2, ChevronRight, ChevronLeft, Play, Pause, XCircle,
  Sparkles, Coffee, ArrowRight, Check, AlertTriangle, X,
  History, Info, RotateCcw,
} from 'lucide-react'
import { db } from '../utils/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useUserData } from '../hooks/useUserData.js'
import { getLevelName } from '../utils/db.js'
import { awardXP } from '../utils/xp.js'
import { useConfirm } from '../hooks/useConfirm.js'
import ConfirmModal from '../components/ConfirmModal.jsx'

/* ============================================================
   CONSTANTS
   ============================================================ */
const MODULES = [
  'ADS Drills', 'Spray Control', 'Close Range',
  'Car Spray', 'Recoil Master', 'Match Logger',
]

const INTENSITIES = [
  { key: 'light',   label: 'Light',   tasksPerDay: [1, 2], minPerTask: [20, 30], desc: '1–2 tasks · 20–30 min' },
  { key: 'medium',  label: 'Medium',  tasksPerDay: [2, 3], minPerTask: [30, 45], desc: '2–3 tasks · 30–45 min' },
  { key: 'intense', label: 'Intense', tasksPerDay: [3, 4], minPerTask: [45, 60], desc: '3–4 tasks · 45–60 min' },
]

const DURATION_PRESETS = [7, 14, 21, 30]

const RANK_LADDER = [
  'Bronze', 'Silver', 'Gold', 'Platinum',
  'Diamond', 'Crown', 'Ace', 'Conqueror',
]

const GOAL_TYPES = [
  { key: 'weakness', icon: Target,       title: 'Fix a specific weakness', desc: 'Build targeted drills around your weakest areas.' },
  { key: 'rank',     icon: Trophy,       title: 'Reach a rank',            desc: 'Train consistently to push your in-game rank.' },
  { key: 'sessions', icon: CalendarIcon, title: 'Complete X sessions',    desc: 'Build a habit by hitting a session-count target.' },
  { key: 'custom',   icon: Zap,          title: 'Custom goal',             desc: 'Define your own training objective.' },
]

const XP_PER_INTENSITY = { light: 50, medium: 75, intense: 100 }
const MODEL_ID = 'claude-sonnet-4-20250514'
const AI_LOADING_MESSAGES = [
  'Analysing your match history…',
  'Identifying your weak points…',
  'Building your daily plan…',
  'Personalising tasks for you…',
  'Almost ready…',
]

/* ============================================================
   FIRESTORE HELPERS
   ============================================================ */
const schedulesCol = (uid)           => collection(db, 'users', uid, 'schedules')
const scheduleDoc  = (uid, id)       => doc(db, 'users', uid, 'schedules', id)
const daysCol      = (uid, id)       => collection(db, 'users', uid, 'schedules', id, 'days')
const dayDoc       = (uid, sid, did) => doc(db, 'users', uid, 'schedules', sid, 'days', did)

/* ============================================================
   PAGE ROOT
   ============================================================ */
export default function Scheduler() {
  const { user } = useAuth()
  const uid = user?.uid
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    if (!uid) return
    const q = query(schedulesCol(uid), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSchedules(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => { setError(err?.message || 'Failed to load schedules.'); setLoading(false) },
    )
    return unsub
  }, [uid])

  const active = useMemo(
    () => schedules.find(s => s.status === 'active' || s.status === 'paused'),
    [schedules]
  )
  const past = useMemo(
    () => schedules.filter(s => !(s.status === 'active' || s.status === 'paused')),
    [schedules]
  )

  if (loading) return <LoadingBlock />
  if (error)   return <ErrorBlock message={error} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-transition">
      <Header
        hasActive={!!active}
        onCreate={() => setCreateOpen(true)}
      />

      {!active ? (
        <LandingCTA onCreate={() => setCreateOpen(true)} />
      ) : (
        <ScheduleDashboard schedule={active} uid={uid} />
      )}

      {past.length > 0 && (
        <PastSchedules
          items={past}
          open={historyOpen}
          onToggle={() => setHistoryOpen(v => !v)}
        />
      )}

      {createOpen && uid && (
        <CreateScheduleModal
          uid={uid}
          onClose={() => setCreateOpen(false)}
        />
      )}

      <SchedulerStyles />
    </div>
  )
}

/* ============================================================
   HEADER
   ============================================================ */
function Header({ hasActive, onCreate }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <h1 style={pageTitleStyle}>Scheduler</h1>
        <div style={pageSubtitleStyle}>Goal-based day-by-day training plan</div>
      </div>
      {hasActive && (
        <button onClick={onCreate} className="btn btn-secondary btn-sm">
          <Sparkles size={13} /> New schedule
        </button>
      )}
    </div>
  )
}

function LandingCTA({ onCreate }) {
  return (
    <div className="card empty-state">
      <CalendarClock size={48} className="empty-state-icon" />
      <div className="empty-state-title">Set your training goal</div>
      <div className="empty-state-desc">
        Create a personalized day-by-day training plan to reach your target.
      </div>
      <button onClick={onCreate} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
        <Sparkles size={13} /> Create Schedule
      </button>
    </div>
  )
}

/* ============================================================
   ACTIVE-SCHEDULE DASHBOARD
   ============================================================ */
function ScheduleDashboard({ schedule, uid }) {
  const { confirm, confirmModalProps } = useConfirm()
  const [days, setDays] = useState([])
  const [selectedDayId, setSelectedDayId] = useState(null)

  useEffect(() => {
    if (!uid || !schedule.id) return
    const q = query(daysCol(uid, schedule.id), orderBy('dayNumber', 'asc'))
    const unsub = onSnapshot(
      q,
      (snap) => setDays(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      /* Silent fallback for legacy days lacking dayNumber. */
      () => {
        const alt = onSnapshot(daysCol(uid, schedule.id), (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          list.sort((a, b) => (Number(a.dayNumber) || 0) - (Number(b.dayNumber) || 0))
          setDays(list)
        })
        return alt
      },
    )
    return unsub
  }, [uid, schedule.id])

  /* Missed-day sweep — runs whenever days change so it self-heals
     even if the user leaves the tab open across midnight. Any
     'upcoming'/'active' day whose date is strictly before today
     without being 'done' gets marked 'missed'. */
  useEffect(() => {
    if (!uid || !schedule.id || days.length === 0) return
    const today = todayISO()
    const stale = days.filter(d =>
      d.date && d.date < today &&
      (d.status === 'upcoming' || d.status === 'active') &&
      !allTasksDone(d.tasks)
    )
    if (stale.length === 0) return
    ;(async () => {
      try {
        const batch = writeBatch(db)
        for (const d of stale) {
          batch.update(dayDoc(uid, schedule.id, d.id), { status: 'missed' })
        }
        const missedNew = stale.length
        batch.update(scheduleDoc(uid, schedule.id), {
          missedDays: (Number(schedule.missedDays) || 0) + missedNew,
          currentStreak: 0,
        })
        await batch.commit()
      } catch { /* non-fatal — day sweep can retry next tick */ }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length])

  const todayId = todayISO()
  const todayDay = days.find(d => d.date === todayId)
  const selectedDay = days.find(d => d.id === selectedDayId) || null

  async function togglePause() {
    const nextStatus = schedule.status === 'paused' ? 'active' : 'paused'
    try { await updateDoc(scheduleDoc(uid, schedule.id), { status: nextStatus }) }
    catch (e) { alert('Update failed: ' + (e?.message || e)) }
  }

  async function abandonSchedule() {
    if (!await confirm(`Abandon "${schedule.title}"?\n\nProgress will be kept in your history but no new tasks will fire.`)) return
    try {
      await updateDoc(scheduleDoc(uid, schedule.id), {
        status: 'failed',
        completedAt: serverTimestamp(),
      })
    } catch (e) { alert('Update failed: ' + (e?.message || e)) }
  }

  return (
    <>
      <ScheduleHeader
        schedule={schedule}
        onTogglePause={togglePause}
        onAbandon={abandonSchedule}
      />

      <TodayTasksCard
        uid={uid}
        schedule={schedule}
        day={todayDay}
      />

      <div
        className="sched-grid-shell"
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: selectedDay ? 'minmax(0, 1fr) 320px' : 'minmax(0, 1fr)',
        }}
      >
        <CalendarGrid
          days={days}
          todayId={todayId}
          selectedDayId={selectedDayId}
          onSelect={(id) => setSelectedDayId(prev => prev === id ? null : id)}
        />

        {selectedDay && (
          <DayDetailPanel
            uid={uid}
            schedule={schedule}
            day={selectedDay}
            isToday={selectedDay.date === todayId}
            onClose={() => setSelectedDayId(null)}
          />
        )}
      </div>
      <ConfirmModal {...confirmModalProps} />
    </>
  )
}

/* ============================================================
   ACTIVE-SCHEDULE HEADER CARD
   ============================================================ */
function ScheduleHeader({ schedule, onTogglePause, onAbandon }) {
  const completed = Number(schedule.completedDays) || 0
  const total = Math.max(1, Number(schedule.totalDays) || 1)
  const percent = Math.min(100, Math.round((completed / total) * 100))
  const daysLeft = Math.max(0, total - completed)
  const isPaused = schedule.status === 'paused'

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
            <StatusBadge status={schedule.status} />
            <IntensityBadge intensity={schedule.intensity} />
            <GenBadge generationType={schedule.generationType} />
          </div>
          <h2 style={cardTitleStyle}>{schedule.title || 'Training schedule'}</h2>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>
            {schedule.goal || '—'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onTogglePause} className="btn btn-secondary btn-sm">
            {isPaused ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}
          </button>
          <button onClick={onAbandon} className="btn btn-secondary btn-sm sched-danger">
            <XCircle size={12} /> Abandon
          </button>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-muted)' }}>
            Day {completed} of {total}
          </span>
          <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 20, letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
            {percent}%
          </span>
        </div>
        <div className="xp-bar-track" style={{ height: 10 }}>
          <div className="xp-bar-fill" style={{ width: `${percent}%`, background: 'var(--red)' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        <MiniStat label="Days done" value={completed} />
        <MiniStat label="Days left" value={daysLeft} />
        <MiniStat label="Missed" value={Number(schedule.missedDays) || 0} accent="var(--red)" />
        <MiniStat label="Streak" value={`${Number(schedule.currentStreak) || 0}d`} accent="var(--amber)" />
      </div>
    </div>
  )
}

function MiniStat({ label, value, accent }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '10px 12px',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: 'Bebas Neue, sans-serif',
        fontSize: 22,
        letterSpacing: '0.04em',
        color: accent || 'var(--text-primary)',
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 10,
        color: 'var(--text-subtle)',
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        {label}
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'completed') return <span className="badge badge-green">Completed</span>
  if (status === 'failed')    return <span className="badge badge-red">Failed</span>
  if (status === 'paused')    return <span className="badge badge-amber">Paused</span>
  if (status === 'active')    return <span className="badge badge-green">Active</span>
  return <span className="badge">{String(status || '').toUpperCase()}</span>
}
function IntensityBadge({ intensity }) {
  const map = { light: 'badge', medium: 'badge badge-amber', intense: 'badge badge-red' }
  return <span className={map[intensity] || 'badge'}>{String(intensity || 'medium')}</span>
}
function GenBadge({ generationType }) {
  if (generationType === 'ai')
    return <span className="badge badge-blue" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Bot size={11} /> AI</span>
  return <span className="badge">Rule</span>
}

/* ============================================================
   TODAY TASKS CARD
   ============================================================ */
function TodayTasksCard({ uid, schedule, day }) {
  const [saving, setSaving] = useState(false)

  if (!day) {
    return (
      <div className="card">
        <SectionLabel>Today</SectionLabel>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          No tasks scheduled for today.
        </div>
      </div>
    )
  }

  if (day.status === 'rest' || tasksAreOnlyRest(day.tasks)) {
    return (
      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Coffee size={22} style={{ color: 'var(--text-subtle)' }} />
        <div>
          <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 18, letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
            Rest day
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Recovery is part of training — see you tomorrow.
          </div>
        </div>
      </div>
    )
  }

  const done = day.status === 'done'
  const allDone = allTasksDone(day.tasks)
  const tasks = Array.isArray(day.tasks) ? day.tasks : []

  async function toggleTask(taskId, checked) {
    const nextTasks = tasks.map(t => t.id === taskId
      ? { ...t, done: checked, doneAt: checked ? new Date().toISOString() : null }
      : t)
    try {
      await updateDoc(dayDoc(uid, schedule.id, day.id), { tasks: nextTasks })
    } catch (e) { alert('Update failed: ' + (e?.message || e)) }
  }

  async function completeDay() {
    if (!allDone) return
    setSaving(true)
    try {
      const nowISO = new Date().toISOString()
      const xpReward = Number(day.xpReward) || XP_PER_INTENSITY[schedule.intensity] || 50
      const nextStreak = (Number(schedule.currentStreak) || 0) + 1

      const batch = writeBatch(db)
      batch.update(dayDoc(uid, schedule.id, day.id), {
        status: 'done',
        completedAt: nowISO,
        tasks: tasks.map(t => ({ ...t, done: true, doneAt: t.doneAt || nowISO })),
      })
      const nextCompleted = (Number(schedule.completedDays) || 0) + 1
      const total = Math.max(1, Number(schedule.totalDays) || 1)
      const progressPercent = Math.min(100, Math.round((nextCompleted / total) * 100))
      const scheduleUpdate = {
        completedDays: nextCompleted,
        currentStreak: nextStreak,
        longestStreak: Math.max(Number(schedule.longestStreak) || 0, nextStreak),
        progressPercent,
        xpEarned: (Number(schedule.xpEarned) || 0) + xpReward,
      }
      if (nextCompleted >= total) {
        scheduleUpdate.status = 'completed'
        scheduleUpdate.completedAt = serverTimestamp()
      }
      batch.update(scheduleDoc(uid, schedule.id), scheduleUpdate)
      await batch.commit()

      awardXP(xpReward, 'Schedule day completed')
    } catch (e) { alert('Save failed: ' + (e?.message || e)) }
    finally    { setSaving(false) }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 20,
            letterSpacing: '0.04em',
          }}>
            Today — Day {day.dayNumber}
          </span>
        </div>
        <span className="badge">{prettyDate(day.date)}</span>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.length === 0 ? (
          <li style={{ fontSize: 13, color: 'var(--text-muted)' }}>No tasks defined for today.</li>
        ) : tasks.map(t => (
          <TaskRow
            key={t.id}
            task={t}
            disabled={done}
            onToggle={(checked) => toggleTask(t.id, checked)}
          />
        ))}
      </ul>

      {!done && tasks.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={completeDay}
            disabled={!allDone || saving}
            className="btn btn-primary btn-sm"
          >
            {saving
              ? <><Loader2 size={12} className="animate-spin" /> Saving</>
              : allDone
                ? <><Check size={12} /> Complete Day (+{Number(day.xpReward) || XP_PER_INTENSITY[schedule.intensity] || 50} XP)</>
                : <>Finish all tasks to complete</>}
          </button>
        </div>
      )}

      {done && (
        <div style={{
          marginTop: 10,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--green-tint)',
          border: '1px solid rgba(0, 201, 110, 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          color: 'var(--green)',
          fontSize: 13,
        }}>
          <Check size={14} /> Day completed — earned {day.xpReward || 0} XP.
        </div>
      )}
    </div>
  )
}

function TaskRow({ task, disabled, onToggle }) {
  const typeLabel = task.type === 'drill' ? 'Drill'
                  : task.type === 'match' ? 'Match'
                  : task.type === 'review' ? 'Review'
                  : task.type === 'rest' ? 'Rest'
                  : 'Custom'
  const typeClass = task.type === 'drill'  ? 'badge badge-blue'
                  : task.type === 'match'  ? 'badge badge-red'
                  : task.type === 'review' ? 'badge badge-amber'
                  : task.type === 'rest'   ? 'badge'
                  : 'badge'

  return (
    <li style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '10px 12px',
    }}>
      <TaskCheckbox
        checked={!!task.done}
        disabled={disabled}
        onChange={onToggle}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
            fontWeight: 600,
            color: task.done ? 'var(--text-muted)' : 'var(--text-primary)',
            textDecoration: task.done ? 'line-through' : 'none',
          }}>
            {task.title || '—'}
          </span>
          <span className={typeClass}>{typeLabel}</span>
          {task.duration ? (
            <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{task.duration} min</span>
          ) : null}
        </div>
        {task.description && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
            {task.description}
          </div>
        )}
      </div>
    </li>
  )
}

function TaskCheckbox({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="sched-checkbox"
      style={{
        width: 18, height: 18, borderRadius: 4,
        background: checked ? 'var(--green)' : 'var(--bg-elevated)',
        border: `1px solid ${checked ? 'var(--green)' : 'var(--border)'}`,
        color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0,
        transition: 'all 0.2s ease',
      }}
    >
      {checked ? <Check size={12} strokeWidth={3} /> : null}
    </button>
  )
}

/* ============================================================
   CALENDAR GRID — full month calendar with navigation
   ============================================================ */
function CalendarGrid({ days, todayId, selectedDayId, onSelect }) {
  /* Default to the month that contains today or the first schedule day */
  const [monthKey, setMonthKey] = useState(() => {
    const anchor = days.find(d => d.date)?.date || todayId
    const d = new Date(anchor + 'T00:00')
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  /* When new days load (Firestore onSnapshot) re-anchor to the first day's month
     only if the user hasn't manually navigated yet. We track that with a ref. */
  const hasNavigated = useRef(false)
  useEffect(() => {
    if (hasNavigated.current || days.length === 0) return
    const first = days.find(d => d.date)
    if (!first) return
    const d = new Date(first.date + 'T00:00')
    setMonthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }, [days.length])   // eslint-disable-line react-hooks/exhaustive-deps

  const [year, month0] = monthKey.split('-').map(Number)  /* month0 is 1-based */
  const month = month0 - 1                                /* 0-based for Date() */

  const firstOfMonth = new Date(year, month, 1)
  const startDow     = firstOfMonth.getDay()              /* 0=Sun */

  /* Build cells — 35 or 42 depending on whether the month needs 6 rows */
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells  = startDow + daysInMonth > 35 ? 42 : 35
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayOffset = i - startDow
    const cellDate  = new Date(year, month, 1 + dayOffset)
    const dateStr   = cellDate.toISOString().split('T')[0]
    const inMonth   = cellDate.getMonth() === month
    const schedDay  = days.find(d => d.date === dateStr) || null
    return { dateStr, inMonth, cellDate, schedDay }
  })

  const monthLabel = firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  function prevMonth() {
    hasNavigated.current = true
    const d = new Date(year, month - 1, 1)
    setMonthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  function nextMonth() {
    hasNavigated.current = true
    const d = new Date(year, month + 1, 1)
    setMonthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="card">
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={prevMonth} className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }}>
          <ChevronLeft size={14} />
        </button>
        <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 18, letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
          {monthLabel}
        </span>
        <button onClick={nextMonth} className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(l => (
          <div key={l} style={{
            textAlign: 'center', fontSize: 10, fontWeight: 600,
            fontFamily: 'DM Sans, sans-serif', color: 'var(--text-subtle)',
            textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 0',
          }}>{l}</div>
        ))}
      </div>

      {/* Calendar cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {cells.map((cell, i) => (
          <CalendarCell
            key={i}
            cell={cell}
            isToday={cell.dateStr === todayId}
            isSelected={!!cell.schedDay && cell.schedDay.id === selectedDayId}
            onClick={() => cell.schedDay && onSelect(cell.schedDay.id)}
          />
        ))}
      </div>

      {days.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-subtle)', marginTop: 10, textAlign: 'center' }}>
          No days generated yet.
        </div>
      )}
    </div>
  )
}

function CalendarCell({ cell, isToday, isSelected, onClick }) {
  const { dateStr, inMonth, schedDay } = cell
  const tasks    = schedDay ? (Array.isArray(schedDay.tasks) ? schedDay.tasks : []) : []
  const nonRest  = tasks.filter(t => t.type !== 'rest')
  const visible  = nonRest.slice(0, 2)
  const more     = nonRest.length - 2
  const status   = schedDay?.status

  const borderColor =
    isSelected ? 'var(--text-primary)' :
    isToday    ? 'var(--amber)'        :
    status === 'done'   ? 'var(--green)' :
    status === 'missed' ? 'var(--red)'   :
    'var(--border)'
  const bg =
    !inMonth ? 'transparent' :
    status === 'done'   ? 'rgba(0,201,110,0.10)' :
    status === 'missed' ? 'rgba(232,0,28,0.07)'  :
    isToday  ? 'var(--amber-tint)'               :
    'var(--bg-elevated)'

  return (
    <div
      onClick={schedDay ? onClick : undefined}
      style={{
        minHeight: 90,
        borderRadius: 'var(--radius-sm)',
        background: bg,
        border: `${isToday || isSelected ? 2 : 1}px solid ${borderColor}`,
        padding: '5px 6px',
        cursor: schedDay && inMonth ? 'pointer' : 'default',
        opacity: inMonth ? 1 : 0.2,
        overflow: 'hidden',
        transition: 'background 0.12s ease',
        boxSizing: 'border-box',
      }}
    >
      {/* Date number */}
      <div style={{
        fontFamily: 'Bebas Neue, sans-serif',
        fontSize: 14, letterSpacing: '0.04em', lineHeight: 1,
        color:
          status === 'done'   ? 'var(--green)'  :
          status === 'missed' ? 'var(--red)'    :
          isToday ? 'var(--amber)'              :
          'var(--text-primary)',
        marginBottom: 4,
      }}>
        {new Date(dateStr + 'T00:00').getDate()}
      </div>

      {/* Task pills (max 2) */}
      {inMonth && visible.map((t, i) => (
        <div key={i} style={{
          fontSize: 9, fontFamily: 'DM Sans, sans-serif',
          color: t.done ? 'var(--text-subtle)' : 'var(--text-muted)',
          background: 'var(--bg-surface)',
          borderRadius: 3, padding: '1px 4px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: 2,
          textDecoration: t.done ? 'line-through' : 'none',
        }}>
          {t.title || 'Task'}
        </div>
      ))}

      {inMonth && more > 0 && (
        <div style={{ fontSize: 9, color: 'var(--text-subtle)', fontFamily: 'DM Sans, sans-serif' }}>
          +{more} more
        </div>
      )}
    </div>
  )
}

/* ============================================================
   DAY DETAIL PANEL
   ============================================================ */
function DayDetailPanel({ uid, schedule, day, isToday, onClose }) {
  const [notes, setNotes] = useState(day.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const tasks = Array.isArray(day.tasks) ? day.tasks : []

  useEffect(() => { setNotes(day.notes || '') }, [day.id])

  async function saveNotes() {
    setSavingNotes(true)
    try { await updateDoc(dayDoc(uid, schedule.id, day.id), { notes }) }
    catch (e) { alert('Save failed: ' + (e?.message || e)) }
    finally    { setSavingNotes(false) }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
      <button onClick={onClose} aria-label="Close" style={closeBtnStyle}>
        <X size={12} />
      </button>
      <div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <StatusBadge status={day.status} />
        </div>
        <h3 style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: 22,
          letterSpacing: '0.04em',
          color: 'var(--text-primary)',
          margin: '8px 0 4px',
        }}>
          Day {day.dayNumber}
        </h3>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{prettyDate(day.date)}</div>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tasks.length === 0
          ? <li style={{ fontSize: 12, color: 'var(--text-subtle)' }}>No tasks.</li>
          : tasks.map(t => (
              <li key={t.id} style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                display: 'flex', gap: 8, alignItems: 'center',
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
                <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{t.title}</span>
                <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{t.duration || '—'}m</span>
              </li>
            ))}
      </ul>

      <div>
        <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Notes
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          readOnly={!isToday}
          rows={3}
          placeholder={isToday ? 'Optional notes for today…' : 'Notes are read-only for past days.'}
          className="input"
          style={{ resize: 'vertical' }}
        />
        {isToday && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <button onClick={saveNotes} disabled={savingNotes} className="btn btn-secondary btn-sm">
              {savingNotes ? <><Loader2 size={11} className="animate-spin" /> Saving</> : 'Save notes'}
            </button>
          </div>
        )}
      </div>

      {day.status === 'done' && (
        <div style={{
          background: 'var(--gold-tint)',
          border: '1px solid rgba(255, 215, 0, 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          color: 'var(--gold)',
          fontSize: 12,
        }}>
          Earned {Number(day.xpReward) || 0} XP
        </div>
      )}
    </div>
  )
}

/* ============================================================
   PAST SCHEDULES
   ============================================================ */
function PastSchedules({ items, open, onToggle }) {
  return (
    <div className="card">
      <button
        onClick={onToggle}
        style={{
          background: 'transparent', border: 'none',
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', padding: 0, color: 'var(--text-primary)',
          fontFamily: 'DM Sans, sans-serif', fontSize: 12,
          fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.10em', marginBottom: open ? 10 : 0,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <History size={13} /> Past schedules ({items.length})
        </span>
        <ChevronRight
          size={14}
          style={{ color: 'var(--text-subtle)', transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }}
        />
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(s => (
            <div key={s.id} style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto auto auto',
              gap: 10, alignItems: 'center',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.title || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.goal || '—'}
                </div>
              </div>
              <StatusBadge status={s.status} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {Number(s.completedDays) || 0}/{Number(s.totalDays) || 0} · {Number(s.xpEarned) || 0} XP
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                {prettyDate(s.endDate)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   CREATE MODAL (3 steps)
   ============================================================ */
function CreateScheduleModal({ uid, onClose }) {
  const { profile, matches, sessions, level, xp } = useUserData()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [genError, setGenError] = useState('')
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const abortRef = useRef(null)

  useEffect(() => {
    if (!saving) return
    const t = setInterval(() => setLoadingMsgIdx(i => (i + 1) % AI_LOADING_MESSAGES.length), 2000)
    return () => clearInterval(t)
  }, [saving])

  const weaknesses = useMemo(() => computeTopWeaknesses(matches), [matches])

  const [goalType, setGoalType] = useState('weakness')
  const [weaknessChoice, setWeaknessChoice] = useState(weaknesses[0] || 'Spray Control')
  const [rankChoice, setRankChoice] = useState('Ace')
  const [sessionsCount, setSessionsCount] = useState(20)
  const [customGoal, setCustomGoal] = useState('')

  const [durationPreset, setDurationPreset] = useState(14)
  const [customStart, setCustomStart] = useState(todayISO())
  const [customEnd, setCustomEnd] = useState(addDaysISO(todayISO(), 14))
  const [useCustomDates, setUseCustomDates] = useState(false)

  const [intensity, setIntensity] = useState('medium')
  const [daysPerWeek, setDaysPerWeek] = useState(5)

  useEffect(() => {
    if (weaknesses.length && weaknessChoice === 'Spray Control' && !weaknesses.includes(weaknessChoice)) {
      setWeaknessChoice(weaknesses[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weaknesses.length])

  const goal = buildGoalString({ goalType, weaknessChoice, rankChoice, sessionsCount, customGoal })
  const startDate = useCustomDates ? customStart : todayISO()
  const endDate   = useCustomDates ? customEnd   : addDaysISO(startDate, durationPreset - 1)
  const totalDays = daysBetween(startDate, endDate)

  async function generate(kind) {
    setGenError('')
    setSaving(true)
    try {
      const config = {
        goalType, goal, weaknessChoice, rankChoice, sessionsCount, customGoal,
        startDate, endDate, totalDays,
        intensity, daysPerWeek,
        weaknesses,
        levelName: getLevelName(level),
        levelNum: level,
        xp,
        sessionCount: (sessions || []).length,
      }

      let dayPlan
      if (kind === 'ai') {
        abortRef.current = new AbortController()
        try {
          dayPlan = await generateAIPlan(config, abortRef.current.signal)
        } catch (e) {
          if (e?.name === 'AbortError') return
          // eslint-disable-next-line no-console
          console.warn('[Scheduler] AI generation failed, falling back to rule-based:', e)
          setGenError(`AI generation failed (${e?.message || e}). Fell back to standard plan.`)
          dayPlan = generateRulePlan(config)
        }
      } else {
        dayPlan = generateRulePlan(config)
      }

      const scheduleId = await createSchedule(uid, config, kind, dayPlan)
      // eslint-disable-next-line no-console
      console.log('[Scheduler] created schedule', scheduleId, 'with', dayPlan.length, 'days')
      onClose()
    } catch (e) {
      setGenError(e?.message || 'Failed to create schedule.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={saving ? undefined : onClose}>
      <div
        className="modal sched-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 680, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div className="card-header">
          <div className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={15} style={{ color: 'var(--text-subtle)' }} />
            Create schedule
          </div>
          <StepDots current={step} total={3} />
          {!saving && (
            <button onClick={onClose} className="btn btn-secondary btn-sm">
              <X size={12} />
            </button>
          )}
        </div>

        {step === 1 && (
          <Step1
            goalType={goalType} onGoalType={setGoalType}
            weaknesses={weaknesses}
            weaknessChoice={weaknessChoice} onWeakness={setWeaknessChoice}
            rankChoice={rankChoice} onRank={setRankChoice}
            sessionsCount={sessionsCount} onSessions={setSessionsCount}
            customGoal={customGoal} onCustomGoal={setCustomGoal}
          />
        )}
        {step === 2 && (
          <Step2
            durationPreset={durationPreset} onDurationPreset={(n) => { setDurationPreset(n); setUseCustomDates(false) }}
            useCustomDates={useCustomDates} onUseCustomDates={setUseCustomDates}
            customStart={customStart} onCustomStart={setCustomStart}
            customEnd={customEnd} onCustomEnd={setCustomEnd}
            totalDays={totalDays}
            intensity={intensity} onIntensity={setIntensity}
            daysPerWeek={daysPerWeek} onDaysPerWeek={setDaysPerWeek}
          />
        )}
        {step === 3 && (
          <Step3
            saving={saving}
            loadingMsg={AI_LOADING_MESSAGES[loadingMsgIdx]}
            error={genError}
            onAI={() => generate('ai')}
            onRule={() => generate('rule')}
            onCancel={() => {
              abortRef.current?.abort()
              setSaving(false)
              setGenError('AI generation cancelled.')
            }}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1 || saving}
            className="btn btn-secondary btn-sm"
          >
            <ChevronLeft size={12} /> Back
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(s => Math.min(3, s + 1))}
              disabled={saving || !isStepValid(step, { goal, totalDays })}
              className="btn btn-primary btn-sm"
            >
              Next <ChevronRight size={12} />
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  )
}

function StepDots({ current, total }) {
  return (
    <div style={{ display: 'inline-flex', gap: 6, marginLeft: 12 }}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i + 1 <= current ? 'var(--red)' : 'var(--border)',
          }}
        />
      ))}
    </div>
  )
}

function isStepValid(step, { goal, totalDays }) {
  if (step === 1) return !!goal.trim()
  if (step === 2) return totalDays >= 1
  return true
}

/* ============================================================
   STEP 1 — Goal
   ============================================================ */
function Step1({
  goalType, onGoalType, weaknesses,
  weaknessChoice, onWeakness,
  rankChoice, onRank,
  sessionsCount, onSessions,
  customGoal, onCustomGoal,
}) {
  return (
    <>
      <h3 style={stepTitleStyle}>What's your goal?</h3>

      <div className="sched-goal-grid">
        {GOAL_TYPES.map(g => {
          const active = goalType === g.key
          const Icon = g.icon
          return (
            <button
              key={g.key}
              onClick={() => onGoalType(g.key)}
              className="sched-goal-card"
              style={{
                background: active ? 'var(--red-tint)' : 'var(--bg-elevated)',
                border: `1px solid ${active ? 'var(--red)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: 14, textAlign: 'left', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 6,
                color: 'var(--text-primary)',
              }}
            >
              <Icon size={20} style={{ color: active ? 'var(--red)' : 'var(--text-subtle)' }} />
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600 }}>
                {g.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {g.desc}
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        {goalType === 'weakness' && (
          <Field label="Weakness to target">
            <select
              className="input"
              value={weaknessChoice}
              onChange={(e) => onWeakness(e.target.value)}
            >
              {(weaknesses.length ? weaknesses : ['Spray Control', 'Close Range', 'Rotations', 'Long Range', 'Movement']).map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            <span style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 4 }}>
              {weaknesses.length
                ? 'Pulled from your recent match logs.'
                : 'Log a few matches to see personalised suggestions here.'}
            </span>
          </Field>
        )}
        {goalType === 'rank' && (
          <Field label="Target rank">
            <select className="input" value={rankChoice} onChange={(e) => onRank(e.target.value)}>
              {RANK_LADDER.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        )}
        {goalType === 'sessions' && (
          <Field label="Target session count">
            <input
              type="number" min={1} className="input mono"
              value={sessionsCount}
              onChange={(e) => onSessions(Number(e.target.value) || 1)}
            />
          </Field>
        )}
        {goalType === 'custom' && (
          <Field label="Describe your goal">
            <input
              className="input"
              placeholder="e.g. Improve final-zone decision-making"
              value={customGoal}
              onChange={(e) => onCustomGoal(e.target.value)}
            />
          </Field>
        )}
      </div>
    </>
  )
}

/* ============================================================
   STEP 2 — Duration + intensity + cadence
   ============================================================ */
function Step2({
  durationPreset, onDurationPreset,
  useCustomDates, onUseCustomDates,
  customStart, onCustomStart,
  customEnd, onCustomEnd,
  totalDays,
  intensity, onIntensity,
  daysPerWeek, onDaysPerWeek,
}) {
  return (
    <>
      <h3 style={stepTitleStyle}>Set your schedule</h3>

      <Field label="Duration">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DURATION_PRESETS.map(n => (
            <button
              key={n}
              onClick={() => onDurationPreset(n)}
              className="btn btn-sm"
              style={pillStyle(!useCustomDates && durationPreset === n)}
            >
              {n} days
            </button>
          ))}
          <button
            onClick={() => onUseCustomDates(true)}
            className="btn btn-sm"
            style={pillStyle(useCustomDates)}
          >
            Custom
          </button>
        </div>
        {useCustomDates && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <input type="date" className="input" value={customStart} onChange={(e) => onCustomStart(e.target.value)} />
            <input type="date" className="input" value={customEnd}   onChange={(e) => onCustomEnd(e.target.value)} />
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 6 }}>
          {totalDays > 0 ? `${totalDays} days total` : 'End date must be after start date.'}
        </div>
      </Field>

      <Field label="Intensity">
        <div className="sched-intensity-grid">
          {INTENSITIES.map(it => {
            const active = intensity === it.key
            return (
              <button
                key={it.key}
                onClick={() => onIntensity(it.key)}
                className="sched-goal-card"
                style={{
                  background: active ? 'var(--red-tint)' : 'var(--bg-elevated)',
                  border: `1px solid ${active ? 'var(--red)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: 12, textAlign: 'left', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 4,
                  color: 'var(--text-primary)',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>{it.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{it.desc}</div>
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Days per week">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[3, 5, 7].map(n => (
            <button
              key={n}
              onClick={() => onDaysPerWeek(n)}
              className="btn btn-sm"
              style={pillStyle(daysPerWeek === n)}
            >
              {n === 7 ? 'Every day' : `${n} days`}
            </button>
          ))}
        </div>
      </Field>
    </>
  )
}

/* ============================================================
   STEP 3 — Generate
   ============================================================ */
function Step3({ saving, loadingMsg, error, onAI, onRule, onCancel }) {
  return (
    <>
      <h3 style={stepTitleStyle}>Generate your plan</h3>

      {saving ? (
        <div className="card" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 12, padding: 24,
        }}>
          <Bot size={28} style={{ color: 'var(--blue)', animation: 'ee-sched-pulse 1.4s ease-in-out infinite' }} />
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'var(--text-primary)', textAlign: 'center' }}>
            {loadingMsg}
          </div>
          <button onClick={onCancel} className="btn btn-secondary btn-sm" style={{ marginTop: 4 }}>
            <X size={12} /> Cancel
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div className="card" style={{
            background: 'var(--blue-tint)',
            border: '1px solid var(--blue)',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bot size={18} style={{ color: 'var(--blue)' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>AI Generated</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Claude analyses your match data, weaknesses, and goal to create a personalised
              day-by-day plan.
            </p>
            <button
              onClick={onAI}
              className="btn btn-sm"
              style={{ background: 'var(--blue)', color: '#fff', border: '1px solid var(--blue)' }}
            >
              <Bot size={12} /> Generate with AI
            </button>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={18} style={{ color: 'var(--text-subtle)' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Standard Plan</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              A structured plan built from proven training principles for your goal and
              intensity level. Works offline.
            </p>
            <button onClick={onRule} className="btn btn-secondary btn-sm">
              <ArrowRight size={12} /> Generate Plan
            </button>
          </div>
        </div>
      )}

      {error && !saving && (
        <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--red-ghost)', borderColor: 'var(--red)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{error}</div>
        </div>
      )}
    </>
  )
}

/* ============================================================
   AI + RULE-BASED PLAN GENERATION
   ============================================================ */
async function generateAIPlan(config, signal) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing VITE_ANTHROPIC_API_KEY')

  const sysPrompt = `You are a BGMI (Battlegrounds Mobile India) training coach AI. Generate a structured day-by-day training schedule in JSON format based on the player's data. Each day should have specific, actionable tasks tailored to their weaknesses and goal. Return ONLY valid JSON, no markdown, no explanation.`

  const userPrompt = `Generate a ${config.totalDays}-day BGMI training schedule for a player with these details:
- Goal: ${config.goal}
- Current weaknesses: ${config.weaknesses.length ? config.weaknesses.join(', ') : 'no match data yet'}
- Current level: ${config.levelNum} (${config.levelName})
- Total sessions logged so far: ${config.sessionCount}
- Intensity: ${config.intensity}
- Days per week: ${config.daysPerWeek}
- Available modules: ${MODULES.join(', ')}

Return JSON array of ${config.totalDays} day objects. Each day object:
{
  "dayNumber": number,
  "isRestDay": boolean,
  "tasks": [
    {
      "type": "drill" | "match" | "review" | "rest",
      "title": string,
      "description": string,
      "duration": number,
      "module": string (only if type is drill)
    }
  ],
  "focus": string,
  "xpReward": number (50-150 based on tasks)
}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL_ID,
      max_tokens: 4000,
      system: sysPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Claude API ${response.status}: ${text.slice(0, 200)}`)
  }

  const data = await response.json()
  const raw = data?.content?.[0]?.text || ''
  const parsed = extractJsonArray(raw)
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('AI returned no days')
  }

  return parsed.map((d, i) => finaliseAIDay(d, i, config))
}

function generateRulePlan(config) {
  const { totalDays, intensity, daysPerWeek, goalType, weaknessChoice, sessionsCount, startDate } = config
  const intensityCfg = INTENSITIES.find(x => x.key === intensity) || INTENSITIES[1]
  const [minTasks, maxTasks] = intensityCfg.tasksPerDay
  const [minMin, maxMin] = intensityCfg.minPerTask
  const xpReward = XP_PER_INTENSITY[intensity] || 75

  const days = []
  for (let i = 0; i < totalDays; i++) {
    const dayNumber = i + 1
    const date = addDaysISO(startDate, i)
    const dow = new Date(date + 'T00:00').getDay()
    const isRest = shouldRestOn(dow, daysPerWeek)

    if (isRest) {
      days.push({
        dayNumber, isRestDay: true, focus: 'Recovery',
        xpReward: Math.round(xpReward / 5),
        tasks: [
          { type: 'rest', title: 'Rest & recover', description: 'No drills today — focus on rest, hydration, and sleep.', duration: 0 },
        ],
      })
      continue
    }

    const numTasks = clamp(Math.round((minTasks + maxTasks) / 2), 1, 4)
    const tasks = pickTasksForGoal({
      goalType, weaknessChoice, sessionsCount,
      dayIndex: i, numTasks, minMin, maxMin,
    })

    days.push({
      dayNumber, isRestDay: false,
      focus: goalType === 'weakness' ? weaknessChoice
           : goalType === 'rank'     ? 'Rank push'
           : goalType === 'sessions' ? 'Session count'
           : 'Balanced training',
      xpReward,
      tasks,
    })
  }
  return days
}

function pickTasksForGoal({ goalType, weaknessChoice, sessionsCount, dayIndex, numTasks, minMin, maxMin }) {
  const tasks = []
  const dur = () => minMin + Math.floor(((dayIndex + tasks.length) * 7) % (maxMin - minMin + 1))
  const drillModule = weaknessKeywordToModule(weaknessChoice) || MODULES[dayIndex % MODULES.length]

  for (let i = 0; i < numTasks; i++) {
    const kind = pickKind(goalType, i, numTasks)
    if (kind === 'drill') {
      tasks.push({
        type: 'drill',
        title: `${drillModule} Session`,
        description: `Complete all drills in ${drillModule}. Focus on consistency and improvement.`,
        duration: dur(),
        module: drillModule,
      })
    } else if (kind === 'match') {
      const n = goalType === 'sessions'
        ? Math.max(1, Math.round(sessionsCount / Math.max(1, numTasks)))
        : 2
      tasks.push({
        type: 'match',
        title: `Log ${n} match${n === 1 ? '' : 'es'}`,
        description: `Play and log ${n} match${n === 1 ? '' : 'es'}. Note your weakest area after each.`,
        duration: 30 + Math.min(30, n * 10),
      })
    } else if (kind === 'review') {
      tasks.push({
        type: 'review',
        title: 'Performance review',
        description: 'Open Analytics, look at your last 5 matches, and jot down what improved and what still needs work.',
        duration: 15,
      })
    }
  }
  return tasks
}

function pickKind(goalType, taskIndex, numTasks) {
  if (goalType === 'sessions') return taskIndex === numTasks - 1 ? 'match' : 'drill'
  if (goalType === 'rank')     return taskIndex === 0 ? 'drill' : taskIndex === numTasks - 1 ? 'review' : 'match'
  if (goalType === 'weakness') return taskIndex === numTasks - 1 ? 'review' : 'drill'
  return ['drill', 'match', 'review'][taskIndex % 3]
}

function shouldRestOn(dow, daysPerWeek) {
  if (daysPerWeek >= 7) return false
  if (daysPerWeek === 5) return dow === 0 || dow === 6
  return !(dow === 1 || dow === 3 || dow === 5)
}

function weaknessKeywordToModule(w) {
  if (!w) return null
  const s = String(w).toLowerCase()
  if (s.includes('spray') || s.includes('recoil')) return 'Spray Control'
  if (s.includes('close') || s.includes('tdm'))    return 'Close Range'
  if (s.includes('car'))                           return 'Car Spray'
  if (s.includes('ads'))                           return 'ADS Drills'
  return null
}

function computeTopWeaknesses(matches) {
  const counts = {}
  const bag = Array.isArray(matches) ? matches : []
  for (const m of bag) {
    const raw = Array.isArray(m.weakestPoints) ? m.weakestPoints.join(' ')
             : Array.isArray(m.weaknesses)   ? m.weaknesses.join(' ')
             : String(m.weakness || m.weakestPoint || '')
    const s = raw.toLowerCase()
    if (!s) continue
    if (s.includes('spray') || s.includes('recoil')) bump(counts, 'Spray Control')
    if (s.includes('close') || s.includes('tdm'))    bump(counts, 'Close Range')
    if (s.includes('mid'))                            bump(counts, 'Mid Range')
    if (s.includes('long') || s.includes('snipe'))    bump(counts, 'Long Range')
    if (s.includes('movement') || s.includes('rotate') || s.includes('zone')) bump(counts, 'Rotations')
    if (s.includes('team') || s.includes('callout'))  bump(counts, 'Team Play')
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)
}
function bump(m, k) { m[k] = (m[k] || 0) + 1 }

function finaliseAIDay(d, i, config) {
  const dayNumber = Number(d.dayNumber) || (i + 1)
  const date = addDaysISO(config.startDate, dayNumber - 1)
  const rawTasks = Array.isArray(d.tasks) ? d.tasks : []
  const tasks = rawTasks.length
    ? rawTasks
    : d.isRestDay
      ? [{ type: 'rest', title: 'Rest & recover', description: 'No drills today.', duration: 0 }]
      : []
  return {
    dayNumber,
    isRestDay: !!d.isRestDay || tasksAreOnlyRest(tasks),
    date,
    focus: String(d.focus || '').slice(0, 120),
    xpReward: clamp(Number(d.xpReward) || 75, 20, 200),
    tasks: tasks.map(t => ({
      type: ['drill', 'match', 'review', 'rest', 'custom'].includes(t.type) ? t.type : 'custom',
      title: String(t.title || 'Task').slice(0, 120),
      description: String(t.description || '').slice(0, 400),
      duration: clamp(Number(t.duration) || 20, 0, 240),
      module: t.module || undefined,
    })),
  }
}

/* ============================================================
   PERSISTENCE
   ============================================================ */
async function createSchedule(uid, config, kind, dayPlan) {
  const scheduleRef = await addDoc(schedulesCol(uid), {
    title:           deriveTitle(config),
    goalType:        config.goalType,
    goal:            config.goal,
    targetRank:      config.goalType === 'rank' ? config.rankChoice : null,
    targetSessions:  config.goalType === 'sessions' ? Number(config.sessionsCount) || 0 : null,
    startDate:       config.startDate,
    endDate:         config.endDate,
    totalDays:       Number(config.totalDays) || dayPlan.length,
    intensity:       config.intensity,
    daysPerWeek:     Number(config.daysPerWeek) || 5,
    generationType:  kind === 'ai' ? 'ai' : 'rule',
    status:          'active',
    completedDays:   0,
    missedDays:      0,
    currentStreak:   0,
    longestStreak:   0,
    progressPercent: 0,
    xpEarned:        0,
    createdAt:       serverTimestamp(),
  })

  const batch = writeBatch(db)
  const todayId = todayISO()
  for (let i = 0; i < dayPlan.length; i++) {
    const d = dayPlan[i]
    const date = d.date || addDaysISO(config.startDate, i)
    const dayId = `day-${String(d.dayNumber || (i + 1)).padStart(3, '0')}`
    const isRest = !!d.isRestDay || tasksAreOnlyRest(d.tasks)
    const status = isRest
      ? 'rest'
      : date === todayId
        ? 'active'
        : date < todayId
          ? 'missed'
          : 'upcoming'
    batch.set(dayDoc(uid, scheduleRef.id, dayId), {
      dayNumber: Number(d.dayNumber) || (i + 1),
      date,
      status,
      tasks: (d.tasks || []).map((t, ti) => ({
        id:          `t-${(d.dayNumber || (i + 1))}-${ti}`,
        type:        t.type || 'custom',
        title:       t.title || 'Task',
        description: t.description || '',
        duration:    Number(t.duration) || 0,
        module:      t.module || null,
        done:        false,
        doneAt:      null,
      })),
      focus: d.focus || null,
      notes: '',
      completedAt: null,
      xpReward: Number(d.xpReward) || 50,
    })
  }
  await batch.commit()
  return scheduleRef.id
}

function deriveTitle(config) {
  if (config.goalType === 'weakness') return `${config.weaknessChoice} plan`
  if (config.goalType === 'rank')     return `Push to ${config.rankChoice}`
  if (config.goalType === 'sessions') return `${config.sessionsCount}-session challenge`
  return config.customGoal.trim() || 'Custom plan'
}

/* ============================================================
   HELPERS
   ============================================================ */
export function todayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}
export function addDaysISO(iso, days) {
  const d = new Date(iso + 'T00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
export function daysBetween(a, b) {
  if (!a || !b) return 0
  const ms = new Date(b + 'T00:00').getTime() - new Date(a + 'T00:00').getTime()
  return Math.max(0, Math.round(ms / 86400000) + 1)
}
export function prettyDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
export function shortDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)) }

export function allTasksDone(tasks) {
  const list = Array.isArray(tasks) ? tasks : []
  if (list.length === 0) return false
  return list.every(t => !!t.done)
}
export function tasksAreOnlyRest(tasks) {
  const list = Array.isArray(tasks) ? tasks : []
  return list.length > 0 && list.every(t => t.type === 'rest')
}

function buildGoalString({ goalType, weaknessChoice, rankChoice, sessionsCount, customGoal }) {
  if (goalType === 'weakness') return `Fix ${weaknessChoice.toLowerCase()}`
  if (goalType === 'rank')     return `Reach ${rankChoice}`
  if (goalType === 'sessions') return `Complete ${sessionsCount} sessions`
  return (customGoal || '').trim()
}

function extractJsonArray(raw) {
  if (!raw) return null
  const start = raw.indexOf('[')
  const end   = raw.lastIndexOf(']')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(raw.slice(start, end + 1)) }
  catch { return null }
}

/* ============================================================
   REUSABLE STYLE BITS
   ============================================================ */
const pageTitleStyle = {
  fontFamily: 'Bebas Neue, sans-serif',
  fontWeight: 400, fontSize: 28,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--text-primary)',
  margin: 0,
}
const pageSubtitleStyle = {
  fontFamily: 'DM Sans, sans-serif',
  fontSize: 13, color: 'var(--text-muted)', marginTop: 4,
}
const cardTitleStyle = {
  fontFamily: 'Bebas Neue, sans-serif',
  fontWeight: 400, fontSize: 24,
  letterSpacing: '0.04em',
  color: 'var(--text-primary)',
  margin: 0,
}
const stepTitleStyle = {
  fontFamily: 'DM Sans, sans-serif',
  fontSize: 16, fontWeight: 600,
  color: 'var(--text-primary)',
  margin: 0,
}
const closeBtnStyle = {
  position: 'absolute', top: 10, right: 10,
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--text-muted)',
  padding: 4, cursor: 'pointer', display: 'flex',
}

function pillStyle(active) {
  return {
    background: active ? 'var(--red)' : 'var(--bg-elevated)',
    border: `1px solid ${active ? 'var(--red)' : 'var(--border)'}`,
    color: active ? '#fff' : 'var(--text-primary)',
  }
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
      <span style={{
        fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--text-subtle)',
      }}>
        {label}
      </span>
      {children}
    </label>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 11, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.10em',
      color: 'var(--text-subtle)',
      marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

/* ============================================================
   STATES
   ============================================================ */
function LoadingBlock() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: 10, color: 'var(--text-muted)' }}>
      <Loader2 size={18} className="animate-spin" />
      <span style={{ fontSize: 13 }}>Loading scheduler…</span>
      <SchedulerStyles />
    </div>
  )
}
function ErrorBlock({ message }) {
  return (
    <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Couldn't load schedules</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{message}</div>
      </div>
    </div>
  )
}

/* ============================================================
   PAGE STYLES
   ============================================================ */
function SchedulerStyles() {
  return (
    <style>{`
      .sched-cal-grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 6px;
      }
      .sched-day-tile {
        aspect-ratio: 1 / 1;
        min-height: 32px;
        max-height: 44px;
      }
      @media (max-width: 767px) {
        .sched-cal-grid {
          grid-template-columns: repeat(7, 1fr);
          gap: 3px;
        }
        .sched-day-tile {
          min-height: 28px;
          max-height: 40px;
        }
        .sched-grid-shell {
          grid-template-columns: minmax(0, 1fr) !important;
        }
      }
      .sched-goal-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 10px;
      }
      @media (max-width: 480px) {
        .sched-goal-grid { grid-template-columns: repeat(2, 1fr); }
      }
      .sched-intensity-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 10px;
      }
      .sched-day-tile:hover { transform: translateY(-1px); }
      .sched-checkbox:hover { border-color: var(--text-subtle); }
      .sched-danger:hover {
        border-color: var(--red);
        color: var(--red);
      }
      @media (max-width: 767px) {
        .sched-modal {
          max-width: 100% !important;
          border-radius: 0 !important;
          min-height: 100vh;
        }
      }
      .animate-spin { animation: ee-sched-spin 0.9s linear infinite; }
      @keyframes ee-sched-spin { to { transform: rotate(360deg); } }
      @keyframes ee-sched-pulse {
        0%, 100% { opacity: 0.5; transform: scale(0.95); }
        50%      { opacity: 1;   transform: scale(1.05); }
      }
    `}</style>
  )
}
