import { useEffect, useRef, useState } from 'react'
import {
  MoreVertical,
  Pencil,
  Copy,
  CheckCircle2,
  Trash2,
  Plus,
  Sparkles,
} from 'lucide-react'
import DayEditor from './DayEditor.jsx'

const DAY_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DAY_FULL = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

function dateKeyLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

/**
 * A single saved training plan.
 *
 * Props:
 *  - plan
 *  - dailySessions  — esportselite_daily_sessions (for progress cross-check)
 *  - modules        — all modules (for DayEditor dropdown + icons)
 *  - onUpdate(plan)
 *  - onDelete(id)
 *  - onDuplicate(id)
 *  - onSetActive(id)
 *  - onEdit(plan)   — open the edit-name/goal modal
 */
export default function PlanCard({
  plan,
  dailySessions = {},
  modules = [],
  onUpdate,
  onDelete,
  onDuplicate,
  onSetActive,
  onEdit,
}) {
  const [editingDayIndex, setEditingDayIndex] = useState(null)
  const days = Array.isArray(plan.days) ? plan.days : []

  /* ---- Progress ---- */
  const start = new Date(plan.startDate)
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const msPerDay = 86400000
  const elapsed = Math.floor((today - start) / msPerDay)
  const duration = Number(plan.duration) || 7
  const currentDay = Math.min(Math.max(elapsed + 1, 1), duration)

  let completedDays = 0
  const lastOffset = Math.min(elapsed, duration - 1)
  for (let i = 0; i <= lastOffset; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const entry = dailySessions[dateKeyLocal(d)]
    if (entry && (entry.status === 'completed' || (entry.drillCount || 0) > 0)) {
      completedDays++
    }
  }
  const remaining = Math.max(duration - completedDays, 0)
  const progressPct =
    duration > 0 ? Math.min(100, Math.round((completedDays / duration) * 100)) : 0

  function openDay(i) {
    setEditingDayIndex(i)
  }

  function saveDay(updatedDay) {
    const nextDays = days.map((d, idx) =>
      idx === editingDayIndex ? { ...d, ...updatedDay } : d
    )
    onUpdate({ ...plan, days: nextDays })
    setEditingDayIndex(null)
  }

  const editingDay = editingDayIndex != null ? days[editingDayIndex] : null

  return (
    <div
      className={`glass clip-corner-sm relative overflow-hidden ${
        plan.isActive ? 'border border-[rgba(0,230,118,0.4)]' : ''
      }`}
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-red-gradient pointer-events-none" />

      <div className="p-5 sm:p-6 pl-6 sm:pl-7">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="heading text-lg sm:text-xl text-white tracking-wide truncate">
                {plan.name}
              </h3>
              {plan.isAiGenerated && (
                <span className="pill text-[10px] bg-[rgba(232,0,28,0.12)] border-[rgba(232,0,28,0.4)] text-accent-secondary inline-flex items-center gap-1">
                  <Sparkles size={10} /> AI
                </span>
              )}
              {plan.isActive && (
                <span className="pill text-[10px] bg-[rgba(0,230,118,0.12)] border-[rgba(0,230,118,0.4)] text-success inline-flex items-center gap-1">
                  🟢 Active
                </span>
              )}
            </div>
            {plan.goal && (
              <p className="text-sm text-text-secondary mt-1 truncate">
                Goal: <span className="text-text-primary">{plan.goal}</span>
              </p>
            )}
            <p className="text-[11px] text-text-muted uppercase tracking-widest mt-1">
              {duration} day{duration === 1 ? '' : 's'}
            </p>
          </div>

          <PlanKebab
            isActive={plan.isActive}
            onEdit={() => onEdit?.(plan)}
            onDuplicate={() => onDuplicate?.(plan.id)}
            onSetActive={() => onSetActive?.(plan.id)}
            onDelete={() => onDelete?.(plan.id)}
          />
        </div>

        {/* Day cells — 4 col mobile, 7 col desktop */}
        <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
          {DAY_FULL.map((name, i) => {
            const d = days[i]
            const count = Array.isArray(d?.sessions) ? d.sessions.length : 0
            const isRest = !!d?.isRestDay
            const hasMatch = !!d?.matchPractice
            const filled = count > 0 || hasMatch || isRest
            return (
              <button
                key={name}
                onClick={() => openDay(i)}
                className={`rounded-md border p-2 min-h-[68px] flex flex-col items-center justify-center gap-1 transition-all text-center ${
                  filled
                    ? 'border-border bg-bg-elevated/60 hover:border-accent-primary'
                    : 'border-dashed border-border bg-bg-elevated/20 hover:border-accent-secondary'
                }`}
              >
                <span className="text-[10px] heading tracking-widest text-text-secondary">
                  {DAY_SHORT[i]}
                </span>
                {isRest ? (
                  <span className="text-[11px] text-text-muted">😴 Rest</span>
                ) : count > 0 ? (
                  <span className="text-[11px] text-success flex items-center gap-1">
                    🟢 {count} mod{count === 1 ? '' : 's'}
                  </span>
                ) : hasMatch ? (
                  <span className="text-[11px] text-accent-secondary">🎮 Match</span>
                ) : (
                  <span className="text-text-muted flex items-center justify-center w-5 h-5 rounded-full border border-border">
                    <Plus size={12} />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Progress */}
        <div className="mt-5 rounded-md border border-border bg-bg-elevated/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs heading uppercase tracking-widest text-text-secondary">
              Progress: Day {currentDay} of {duration}
            </span>
            <span className="mono text-sm text-accent-secondary">{progressPct}%</span>
          </div>
          <div className="h-2 w-full bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-red-gradient transition-all duration-500 shadow-red-glow"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-[11px] text-text-muted mt-2">
            {completedDays} day{completedDays === 1 ? '' : 's'} completed /{' '}
            {remaining} remaining
          </div>
        </div>
      </div>

      <DayEditor
        open={editingDayIndex != null}
        dayName={editingDayIndex != null ? DAY_FULL[editingDayIndex] : 'Day'}
        day={editingDay}
        modules={modules}
        onClose={() => setEditingDayIndex(null)}
        onSave={saveDay}
      />
    </div>
  )
}

/* ============================================================
   KEBAB MENU
   ============================================================ */
function PlanKebab({ isActive, onEdit, onDuplicate, onSetActive, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function wrap(fn) {
    return e => {
      e.stopPropagation()
      setOpen(false)
      fn?.()
    }
  }

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={e => {
          e.stopPropagation()
          setOpen(v => !v)
        }}
        className={`p-2 rounded-md transition-all ${
          open
            ? 'bg-[rgba(232,0,28,0.12)] text-accent-secondary'
            : 'text-text-secondary hover:text-white hover:bg-white/5'
        }`}
        title="Manage plan"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-52 glass-strong rounded-md overflow-hidden shadow-2xl z-30 animate-fade-in"
          onClick={e => e.stopPropagation()}
        >
          <KebabItem icon={Pencil} label="Edit name / goal" onClick={wrap(onEdit)} />
          <KebabItem icon={Copy} label="Duplicate plan" onClick={wrap(onDuplicate)} />
          {!isActive && (
            <KebabItem
              icon={CheckCircle2}
              label="Set as active"
              onClick={wrap(onSetActive)}
            />
          )}
          <div className="h-px bg-border" />
          <KebabItem icon={Trash2} label="Delete plan" onClick={wrap(onDelete)} destructive />
        </div>
      )}
    </div>
  )
}

function KebabItem({ icon: Icon, label, onClick, destructive }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all ${
        destructive
          ? 'text-accent-secondary hover:bg-[rgba(232,0,28,0.08)]'
          : 'text-text-primary hover:bg-white/5'
      }`}
    >
      <Icon size={15} />
      <span className="heading text-xs tracking-wider uppercase">{label}</span>
    </button>
  )
}
