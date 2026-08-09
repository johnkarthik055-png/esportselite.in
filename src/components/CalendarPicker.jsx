import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Activity,
  Trophy,
  Clock,
  Flag,
  StickyNote,
  Sparkles,
} from 'lucide-react'
import {
  STATUS_COLORS,
  STATUS_LABELS,
  SESSION_MOODS,
  MATCH_PERFORMANCES,
} from '../utils/constants.js'
import {
  todayKey,
  dateKey,
  getMonthCells,
  monthYearLabel,
  formatDateFull,
  formatDuration,
} from '../utils/helpers.js'
import { useDailySessions, useDailyMatches } from '../hooks/useDailySessions.js'

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/**
 * Month-view calendar with status dots + a summary panel below.
 *
 * Props:
 *  - context: 'training' | 'matches'   — which surface this calendar lives on
 *             (controls headline + "today action" button)
 *  - onTodayAction()                   — invoked when user clicks the
 *                                        today-context action button
 *                                        (e.g. scroll to modules / form)
 */
export default function CalendarPicker({ context = 'training', onTodayAction }) {
  const sessions = useDailySessions()
  const matches = useDailyMatches()
  const [searchParams] = useSearchParams()
  const urlDate = searchParams.get('date')

  const today = todayKey()
  const initialDate = urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate) ? urlDate : today

  const [viewDate, setViewDate] = useState(() => {
    const [y, m] = initialDate.split('-').map(Number)
    return new Date(y, m - 1, 1)
  })
  const [selected, setSelected] = useState(initialDate)

  /* If URL ?date= changes (e.g. navigating between mini-strip clicks), sync. */
  useEffect(() => {
    if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
      setSelected(urlDate)
      const [y, m] = urlDate.split('-').map(Number)
      setViewDate(new Date(y, m - 1, 1))
    }
  }, [urlDate])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const cells = useMemo(() => getMonthCells(year, month), [year, month])

  function gotoPrev() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }
  function gotoNext() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }
  function gotoToday() {
    const now = new Date()
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelected(todayKey())
  }

  /** Status to use for the calendar dot. For the active context it uses
   *  that surface's status; the other surface's data is shown in summary too. */
  function getDotStatus(date) {
    return context === 'training'
      ? sessions.getStatusForDate(date)
      : matches.getStatusForDate(date)
  }

  return (
    <div className="glass clip-corner-sm p-5 lg:p-7 relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-accent-primary opacity-[0.08] blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-bg-elevated border border-border flex items-center justify-center">
            <CalendarIcon size={18} className="text-accent-secondary" />
          </div>
          <div>
            <h3 className="heading text-xl text-white tracking-wide">
              📆 {monthYearLabel(viewDate)}
            </h3>
            <p className="text-xs text-text-secondary uppercase tracking-widest mt-0.5">
              {context === 'training' ? 'Training calendar' : 'Match calendar'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={gotoPrev}
            className="p-2 rounded-md border border-border text-text-secondary hover:text-white hover:border-accent-primary transition-all"
            title="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={gotoToday}
            className="px-3.5 py-2 rounded-md border border-border heading uppercase tracking-widest text-xs text-text-secondary hover:text-white hover:border-accent-primary transition-all"
          >
            Today
          </button>
          <button
            onClick={gotoNext}
            className="p-2 rounded-md border border-border text-text-secondary hover:text-white hover:border-accent-primary transition-all"
            title="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day-of-week row */}
      <div className="relative z-10 grid grid-cols-7 gap-1 mb-1">
        {DOW.map(d => (
          <div
            key={d}
            className="text-center text-[10px] heading uppercase tracking-[0.18em] text-text-muted py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="relative z-10 grid grid-cols-7 gap-1">
        {cells.map(cell => {
          const status = getDotStatus(cell.date)
          const isToday = cell.date === today
          const isSelected = cell.date === selected
          const isFuture = status === 'future'
          const dot = STATUS_COLORS[status]
          const hasDot = dot && dot !== 'transparent'

          return (
            <button
              key={cell.date}
              onClick={() => !isFuture && setSelected(cell.date)}
              disabled={isFuture}
              className={`
                relative aspect-square rounded-md p-1.5 flex flex-col items-center justify-center
                transition-all border
                ${cell.inMonth ? 'opacity-100' : 'opacity-30'}
                ${isFuture ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-white/[0.04]'}
                ${
                  isSelected
                    ? 'border-accent-primary bg-[rgba(232,0,28,0.12)] shadow-red-glow'
                    : isToday
                    ? 'border-accent-primary'
                    : 'border-transparent'
                }
              `}
            >
              <span
                className={`heading text-sm leading-none ${
                  isToday ? 'text-white' : 'text-text-primary'
                }`}
              >
                {cell.day}
              </span>
              {hasDot && (
                <span
                  className="absolute bottom-1 w-1.5 h-1.5 rounded-full"
                  style={{
                    background: dot,
                    boxShadow: `0 0 6px ${dot}`,
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="relative z-10 mt-5 flex items-center justify-center gap-4 flex-wrap text-[10px] uppercase tracking-widest heading text-text-secondary">
        <LegendDot color={STATUS_COLORS.completed} label="Completed" />
        <LegendDot color={STATUS_COLORS.incomplete} label="Incomplete" />
        <LegendDot color={STATUS_COLORS.not_completed} label="Missed" />
        <LegendDot color={STATUS_COLORS.in_progress} label="Today" />
      </div>

      {/* Summary panel */}
      <div className="relative z-10 mt-5">
        <DaySummary
          date={selected}
          context={context}
          sessions={sessions}
          matches={matches}
          onTodayAction={onTodayAction}
        />
      </div>
    </div>
  )
}

/* ----- Legend dot ----- */
function LegendDot({ color, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-full inline-block"
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      {label}
    </span>
  )
}

/* ============================================================
   DAY SUMMARY PANEL
   ============================================================ */
function DaySummary({ date, context, sessions, matches, onTodayAction }) {
  const today = todayKey()
  const isToday = date === today
  const isFuture = date > today

  if (isFuture) return null

  const sStatus = sessions.getStatusForDate(date)
  const mStatus = matches.getStatusForDate(date)
  const sEntry = sessions.getEntry(date)
  const mEntry = matches.getEntry(date)
  const sActivity = sessions.getDayActivity(date)
  const mActivity = matches.getDayActivity(date)

  // Pick "primary" status for the header badge (depends on context)
  const headerStatus = context === 'training' ? sStatus : mStatus
  const statusColor = STATUS_COLORS[headerStatus]
  const statusLabel =
    headerStatus === 'completed'
      ? 'Completed'
      : headerStatus === 'incomplete'
      ? 'Incomplete'
      : headerStatus === 'in_progress'
      ? 'In Progress'
      : headerStatus === 'not_started'
      ? 'Not Started'
      : 'Not Completed'

  const mood = sEntry?.mood
    ? SESSION_MOODS.find(m => m.id === sEntry.mood)
    : null
  const performance = mEntry?.performance
    ? MATCH_PERFORMANCES.find(p => p.id === mEntry.performance)
    : null

  return (
    <div className="rounded-md border border-border bg-bg-elevated/40 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-4 border-b border-border bg-bg-primary/30">
        <div className="flex items-center gap-3">
          <CalendarIcon size={16} className="text-accent-secondary" />
          <span className="heading text-base text-white tracking-wide">
            {formatDateFull(date)}
          </span>
        </div>
        <span
          className="pill text-xs heading uppercase tracking-widest"
          style={{
            background: `${statusColor}22`,
            borderColor: `${statusColor}66`,
            color: statusColor,
          }}
        >
          ● {statusLabel}
        </span>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Training block */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SummaryBlock
            icon={<Activity size={16} />}
            title="Training"
            empty={sActivity.drillCount === 0 ? 'No drills logged' : null}
          >
            {sActivity.drillCount > 0 && (
              <>
                <Row
                  label="Drills"
                  value={`${sActivity.drillCount} • ${formatDuration(sActivity.totalDuration)}`}
                />
                {mood && (
                  <Row
                    label="Mood"
                    value={
                      <span className="text-white">
                        {mood.emoji} {mood.label}
                      </span>
                    }
                  />
                )}
                {sActivity.modulesWorked.length > 0 && (
                  <div className="pt-1">
                    <div className="text-[10px] uppercase tracking-widest heading text-text-muted mb-1.5">
                      Modules
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {sActivity.modulesWorked.map(m => (
                        <span key={m} className="pill text-[10px]">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </SummaryBlock>

          <SummaryBlock
            icon={<Trophy size={16} />}
            title="Matches"
            empty={mActivity.matchCount === 0 ? 'No matches logged' : null}
          >
            {mActivity.matchCount > 0 && (
              <>
                <Row label="Logged" value={`${mActivity.matchCount}`} />
                {performance && (
                  <Row
                    label="Performance"
                    value={
                      <span className="text-white">
                        {performance.emoji} {performance.label}
                      </span>
                    }
                  />
                )}
                {mEntry?.takeaway && (
                  <div className="pt-1">
                    <div className="text-[10px] uppercase tracking-widest heading text-text-muted mb-1.5 flex items-center gap-1">
                      <StickyNote size={11} /> Takeaway
                    </div>
                    <p className="text-xs text-text-secondary italic leading-relaxed">
                      "{mEntry.takeaway}"
                    </p>
                  </div>
                )}
              </>
            )}
          </SummaryBlock>
        </div>

        {/* Session notes (training) */}
        {sEntry?.notes && (
          <div className="rounded-md border border-border bg-bg-primary/30 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest heading text-text-muted mb-1.5 flex items-center gap-1">
              <StickyNote size={11} /> Session notes
            </div>
            <p className="text-sm text-text-secondary italic leading-relaxed">
              "{sEntry.notes}"
            </p>
          </div>
        )}

        {/* Today action */}
        {isToday && headerStatus !== 'completed' && onTodayAction && (
          <div className="pt-1">
            <button
              onClick={onTodayAction}
              className="btn-red px-4 py-2.5 rounded-md text-xs uppercase tracking-[0.15em] flex items-center gap-2"
            >
              <Sparkles size={14} />
              {context === 'training' ? 'Start a Drill' : 'Log a Match'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ----- Reusable small blocks ----- */
function SummaryBlock({ icon, title, children, empty }) {
  return (
    <div className="rounded-md border border-border bg-bg-primary/30 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 text-text-secondary">
        {icon}
        <span className="heading text-xs uppercase tracking-widest">{title}</span>
      </div>
      {empty ? (
        <p className="text-xs text-text-muted italic">{empty}</p>
      ) : (
        <div className="space-y-1.5">{children}</div>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-text-muted text-xs uppercase tracking-widest heading">{label}</span>
      <span className="mono text-accent-secondary">{value}</span>
    </div>
  )
}
