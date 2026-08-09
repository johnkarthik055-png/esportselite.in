import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Check, X } from 'lucide-react'
import { useDailySessions } from '../hooks/useDailySessions.js'
import { dateKey, todayKey } from '../utils/helpers.js'

const DOW_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] // Sun-Sat

/**
 * Compact 14-day horizontal strip for the Dashboard.
 * Each cell: dow letter • status icon • date number.
 * Click any cell → routes to /training?date=YYYY-MM-DD.
 *
 * Status icons (replacing the legacy dots):
 *   completed     → green circle + ✓
 *   incomplete    → yellow circle + !
 *   not_completed → red circle + ✕
 *   in_progress / today → blue pulsing circle
 *   not_started / future → gray ring (disabled look)
 */
export default function MiniCalendarStrip() {
  const sessions = useDailySessions()
  const navigate = useNavigate()
  const today = todayKey()

  /* Build 14 days: 13 days ago → today, in chronological order. */
  const days = useMemo(() => {
    const out = []
    const now = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      out.push(d)
    }
    return out
  }, [])

  function gotoDate(date) {
    navigate(`/training?date=${date}`)
  }

  return (
    <div className="glass clip-corner-sm p-5 relative overflow-hidden">
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-accent-primary opacity-[0.08] blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="heading text-sm uppercase tracking-[0.18em] text-white flex items-center gap-2">
          <Calendar size={14} className="text-accent-secondary" /> LAST 14 DAYS
        </h3>
        <button
          onClick={() => gotoDate(today)}
          className="text-[10px] heading uppercase tracking-widest text-accent-secondary hover:text-white transition-all"
        >
          Open full calendar →
        </button>
      </div>

      {/* Strip — horizontally scrollable on mobile */}
      <div className="relative z-10 -mx-1 overflow-x-auto">
        <div
          className="grid gap-1 px-1 min-w-[560px] sm:min-w-0"
          style={{ gridTemplateColumns: 'repeat(14, minmax(36px, 1fr))' }}
        >
          {days.map(d => {
            const key = dateKey(d)
            const isToday = key === today
            const status = sessions.getStatusForDate(key)
            const isFuture = status === 'future'

            return (
              <button
                key={key}
                onClick={() => !isFuture && gotoDate(key)}
                disabled={isFuture}
                className={`flex flex-col items-center gap-1 py-1.5 rounded-md transition-all ${
                  isToday
                    ? 'bg-[rgba(74,158,255,0.06)] hover:bg-[rgba(74,158,255,0.12)]'
                    : isFuture
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-white/[0.04]'
                }`}
                title={`${key} • ${status.replace('_', ' ')}`}
              >
                <span className="text-[10px] heading uppercase tracking-widest text-text-muted">
                  {DOW_LETTERS[d.getDay()]}
                </span>
                <StatusIcon status={status} isToday={isToday} />
                <span className={`mono text-[11px] ${isToday ? 'text-white' : 'text-text-secondary'}`}>
                  {d.getDate()}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="relative z-10 mt-3 flex items-center justify-center gap-3 sm:gap-4 flex-wrap text-[10px] uppercase tracking-widest heading text-text-secondary">
        <LegendItem status="completed" label="Completed" />
        <LegendItem status="incomplete" label="Incomplete" />
        <LegendItem status="not_completed" label="Missed" />
        <LegendItem status="in_progress" label="Today" isToday />
      </div>
    </div>
  )
}

function StatusIcon({ status, isToday }) {
  /* Today always renders as the blue pulsing puck regardless of status. */
  if (isToday) {
    return (
      <span
        className="w-4 h-4 rounded-full animate-pulse-red inline-flex items-center justify-center"
        style={{ background: '#4A9EFF', boxShadow: '0 0 8px rgba(74,158,255,0.6)' }}
      />
    )
  }

  switch (status) {
    case 'completed':
      return (
        <span
          className="w-4 h-4 rounded-full inline-flex items-center justify-center"
          style={{ background: '#00E676', boxShadow: '0 0 6px rgba(0,230,118,0.5)' }}
        >
          <Check size={10} className="text-bg-primary" strokeWidth={3.5} />
        </span>
      )
    case 'incomplete':
      return (
        <span
          className="w-4 h-4 rounded-full inline-flex items-center justify-center"
          style={{ background: '#FFD700' }}
        >
          <span
            className="text-bg-primary leading-none"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontWeight: 800, fontSize: 10 }}
          >
            !
          </span>
        </span>
      )
    case 'not_completed':
      return (
        <span
          className="w-4 h-4 rounded-full inline-flex items-center justify-center"
          style={{ background: '#FF3D44', boxShadow: '0 0 6px rgba(255,61,68,0.4)' }}
        >
          <X size={10} className="text-white" strokeWidth={3.5} />
        </span>
      )
    case 'not_started':
      return (
        <span className="w-4 h-4 rounded-full inline-block border border-text-muted/40" />
      )
    case 'future':
    default:
      return (
        <span className="w-4 h-4 rounded-full inline-block border border-text-muted/30 opacity-60" />
      )
  }
}

function LegendItem({ status, label, isToday }) {
  return (
    <span className="flex items-center gap-1.5">
      <StatusIcon status={status} isToday={isToday} />
      {label}
    </span>
  )
}
