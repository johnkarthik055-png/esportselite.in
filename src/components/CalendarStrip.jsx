import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Calendar as CalendarIcon, Activity, Trophy, StickyNote, Sparkles,
} from 'lucide-react'
import { SESSION_MOODS, MATCH_PERFORMANCES } from '../utils/constants.js'
import {
  dateKey, todayKey, formatDateFull, formatDuration,
} from '../utils/helpers.js'
import { useDailySessions, useDailyMatches } from '../hooks/useDailySessions.js'

const DOW_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const EASE = [0.22, 1, 0.36, 1]

/**
 * 14-day calendar strip. Logic unchanged.
 * Selection styling fixed so missed days never look highlighted.
 */
export default function CalendarStrip({ context = 'training', onTodayAction }) {
  const sessions = useDailySessions()
  const matches = useDailyMatches()
  const reduce = useReducedMotion()

  const today = todayKey()
  const [searchParams] = useSearchParams()
  const urlDate = searchParams.get('date')
  const initialDate = urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate) ? urlDate : today

  const [selected, setSelected] = useState(initialDate)

  useEffect(() => {
    if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) setSelected(urlDate)
  }, [urlDate])

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

  function getDotStatus(d) {
    return context === 'training'
      ? sessions.getStatusForDate(d)
      : matches.getStatusForDate(d)
  }

  /* Dot colour + opacity rule:
       completed   → solid green
       in_progress → solid amber
       missed      → very faint subtle grey (40% opacity), NEVER red
       none/future → transparent (still rendered so layout doesn't shift) */
  function dotStyleFor(status) {
    if (status === 'completed')   return { background: '#16A34A', opacity: 1 }
    if (status === 'in_progress') return { background: '#F59E0B', opacity: 1 }
    if (status === 'incomplete' || status === 'not_completed')
      return { background: '#64748B', opacity: 0.4 }
    return { background: 'transparent', opacity: 1 }
  }

  return (
    <div className="cs-card">
      {/* ── Day rail ── */}
      <div className="cs-rail-wrap">
        <div className="cs-rail">
          {days.map((d, i) => {
            const key = dateKey(d)
            const isToday = key === today
            const isSelected = key === selected && !isToday
            const status = getDotStatus(key)
            const dotStyle = dotStyleFor(status)
            const hasActivity = status === 'completed' || status === 'in_progress'

            return (
              <motion.button
                key={key}
                onClick={() => setSelected(key)}
                className={`cs-day ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                title={`${key} • ${status.replace('_', ' ')}`}
                aria-current={isToday ? 'date' : undefined}
                initial={{ opacity: 0, scale: reduce ? 1 : 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: Math.min(i, 13) * 0.03, ease: EASE }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
              >
                <span className="cs-day-dow">{DOW_LETTERS[d.getDay()]}</span>
                <span className="cs-day-num">{d.getDate()}</span>
                <span
                  className="cs-day-dot"
                  style={dotStyle}
                  aria-hidden
                />
                {hasActivity && <span className="cs-day-glow" aria-hidden />}
              </motion.button>
            )
          })}
        </div>
        {/* Edge fade masks signalling more content on both sides */}
        <span className="cs-fade cs-fade--left" aria-hidden />
        <span className="cs-fade cs-fade--right" aria-hidden />
      </div>

      {/* ── Day summary ── */}
      <div className="cs-summary-wrap">
        <DaySummary
          date={selected}
          context={context}
          sessions={sessions}
          matches={matches}
          onTodayAction={onTodayAction}
        />
      </div>

      <style>{styles}</style>
    </div>
  )
}

function statusBadge(status) {
  if (status === 'completed')   return { cls: 'cs-badge cs-badge--green', label: 'Completed' }
  if (status === 'in_progress') return { cls: 'cs-badge cs-badge--amber', label: 'In Progress' }
  if (status === 'incomplete')  return { cls: 'cs-badge cs-badge--amber', label: 'Incomplete' }
  if (status === 'not_completed') return { cls: 'cs-badge', label: 'Missed' }
  return { cls: 'cs-badge', label: 'Not Started' }
}

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

  const headerStatus = context === 'training' ? sStatus : mStatus
  const badge = statusBadge(headerStatus)

  const mood = sEntry?.mood ? SESSION_MOODS.find(m => m.id === sEntry.mood) : null
  const performance = mEntry?.performance
    ? MATCH_PERFORMANCES.find(p => p.id === mEntry.performance)
    : null

  return (
    <div>
      <div className="cs-summary-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <CalendarIcon size={14} style={{ color: '#2563FF', flexShrink: 0 }} />
          <span className="cs-summary-date">{formatDateFull(date)}</span>
        </div>
        <span className={badge.cls}>{badge.label}</span>
      </div>

      {/* Split panels — vertical divider on desktop, stacked on mobile */}
      <div className="cs-panels">
        <SummaryPanel
          icon={<Activity size={15} />}
          tint="#EAF2FF"
          color="#2563FF"
          title="Training"
          empty={sActivity.drillCount === 0 ? 'No drills logged yet — your next rep starts the day.' : null}
          cta={isToday && headerStatus !== 'completed' && onTodayAction && context === 'training' ? (
            <motion.button
              onClick={onTodayAction}
              className="cs-cta"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <Sparkles size={13} /> Start a Drill
            </motion.button>
          ) : null}
        >
          {sActivity.drillCount > 0 && (
            <>
              <Row label="Drills" value={`${sActivity.drillCount} · ${formatDuration(sActivity.totalDuration)}`} />
              {mood && <Row label="Mood" value={<>{mood.emoji} {mood.label}</>} />}
              {sActivity.modulesWorked.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div className="cs-mini-label">Modules</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {sActivity.modulesWorked.map(m => (
                      <span key={m} className="cs-chip">{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </SummaryPanel>

        <span className="cs-divider" aria-hidden />

        <SummaryPanel
          icon={<Trophy size={15} />}
          tint="#FFF0F2"
          color="#EF3340"
          title="Matches"
          empty={mActivity.matchCount === 0 ? 'No matches logged yet — log one to track your form.' : null}
          cta={isToday && headerStatus !== 'completed' && onTodayAction && context !== 'training' ? (
            <motion.button
              onClick={onTodayAction}
              className="cs-cta cs-cta--red"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <Sparkles size={13} /> Log a Match
            </motion.button>
          ) : null}
        >
          {mActivity.matchCount > 0 && (
            <>
              <Row label="Logged" value={`${mActivity.matchCount}`} />
              {performance && <Row label="Performance" value={<>{performance.emoji} {performance.label}</>} />}
              {mEntry?.takeaway && (
                <div style={{ marginTop: 4 }}>
                  <div className="cs-mini-label">
                    <StickyNote size={11} /> Takeaway
                  </div>
                  <p className="cs-note-text">"{mEntry.takeaway}"</p>
                </div>
              )}
            </>
          )}
        </SummaryPanel>
      </div>

      {sEntry?.notes && (
        <div className="cs-notes">
          <div className="cs-mini-label">
            <StickyNote size={11} /> Session notes
          </div>
          <p className="cs-note-text">"{sEntry.notes}"</p>
        </div>
      )}
    </div>
  )
}

function SummaryPanel({ icon, tint, color, title, children, empty, cta }) {
  return (
    <div className="cs-panel">
      <div className="cs-panel-head">
        <span className="cs-panel-icon" style={{ background: tint, color }}>{icon}</span>
        <span className="cs-panel-title">{title}</span>
      </div>
      {empty ? (
        <p className="cs-panel-empty">{empty}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{children}</div>
      )}
      {cta && <div className="cs-panel-cta">{cta}</div>}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="cs-row">
      <span className="cs-row-label">{label}</span>
      <span className="cs-row-value">{value}</span>
    </div>
  )
}

const styles = `
  .cs-card {
    background: #FFFFFF; border: 1px solid #E5EAF3; border-radius: 16px;
    padding: 18px; box-shadow: 0 4px 20px rgba(15,23,42,0.04);
  }

  /* ── Day rail ── */
  .cs-rail-wrap { position: relative; }
  .cs-rail {
    display: flex; gap: 7px; overflow-x: auto; padding: 2px 2px 4px;
    scroll-snap-type: x proximity;
    scrollbar-width: none; -ms-overflow-style: none;
  }
  .cs-rail::-webkit-scrollbar { display: none; }

  .cs-day {
    position: relative; flex-shrink: 0; scroll-snap-align: center;
    width: 56px; height: 66px; padding: 7px 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
    background: #F8FAFD; border: 1px solid #E5EAF3; border-radius: 14px;
    cursor: pointer;
    transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .cs-day.is-selected { background: #EAF2FF; border-color: #C7D7FB; }
  .cs-day.is-today {
    background: #FFFFFF; border: 2px solid #2563FF;
    box-shadow: 0 0 0 4px rgba(37,99,255,0.08), 0 6px 18px rgba(37,99,255,0.14);
  }
  @media (hover: hover) and (pointer: fine) {
    .cs-day:not(.is-today):hover { border-color: #C7D7FB; background: #F2F7FF; }
  }

  .cs-day-dow {
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.1em; color: #94A3B8;
  }
  .cs-day.is-today .cs-day-dow { color: #2563FF; }
  .cs-day-num {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 19px;
    color: #475569; line-height: 1; font-variant-numeric: tabular-nums;
  }
  .cs-day.is-today .cs-day-num { color: #0B1224; }
  .cs-day.is-selected .cs-day-num { color: #0B1224; }
  .cs-day-dot { width: 5px; height: 5px; border-radius: 50%; display: block; }
  .cs-day-glow {
    position: absolute; inset: auto 0 6px 0; height: 2px; margin: 0 auto; width: 18px;
    border-radius: 2px; background: rgba(37,99,255,0.18); pointer-events: none;
  }

  /* Edge fade masks */
  .cs-fade {
    position: absolute; top: 0; bottom: 4px; width: 28px;
    pointer-events: none;
  }
  .cs-fade--left  { left: 0;  background: linear-gradient(90deg, #FFFFFF 0%, rgba(255,255,255,0) 100%); }
  .cs-fade--right { right: 0; background: linear-gradient(270deg, #FFFFFF 0%, rgba(255,255,255,0) 100%); }

  /* ── Summary ── */
  .cs-summary-wrap { margin-top: 16px; padding-top: 16px; border-top: 1px solid #E5EAF3; }
  .cs-summary-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px; margin-bottom: 14px; flex-wrap: wrap;
  }
  .cs-summary-date {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 17px;
    text-transform: uppercase; letter-spacing: 0.02em; color: #0B1224;
  }

  .cs-badge {
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.1em;
    background: #F1F5F9; border: 1px solid #E5EAF3; color: #64748B;
    border-radius: 999px; padding: 3px 10px; flex-shrink: 0;
  }
  .cs-badge--green { background: rgba(22,163,74,0.08); border-color: rgba(22,163,74,0.22); color: #16A34A; }
  .cs-badge--amber { background: rgba(245,158,11,0.09); border-color: rgba(245,158,11,0.25); color: #D97706; }

  /* Split panels */
  .cs-panels { display: grid; grid-template-columns: 1fr; gap: 14px; }
  .cs-divider { display: none; }
  @media (min-width: 620px) {
    .cs-panels { grid-template-columns: 1fr 1px 1fr; gap: 18px; }
    .cs-divider { display: block; background: #E5EAF3; }
  }

  .cs-panel { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .cs-panel-head { display: flex; align-items: center; gap: 9px; }
  .cs-panel-icon {
    width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .cs-panel-title {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 15px;
    text-transform: uppercase; letter-spacing: 0.04em; color: #0B1224;
  }
  .cs-panel-empty {
    margin: 0; font-family: 'Inter', sans-serif; font-size: 12.5px;
    color: #94A3B8; line-height: 1.55;
  }
  .cs-panel-cta { margin-top: auto; padding-top: 4px; display: flex; }

  .cs-cta {
    background: linear-gradient(135deg, #2563FF, #5B3DF5); color: #fff; border: none;
    border-radius: 10px; padding: 9px 18px; cursor: pointer; width: 100%;
    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    box-shadow: 0 4px 12px rgba(37,99,255,0.25);
  }
  .cs-cta--red {
    background: linear-gradient(135deg, #EF3340, #F59E0B);
    box-shadow: 0 4px 12px rgba(239,51,64,0.22);
  }
  @media (min-width: 620px) {
    .cs-cta { width: auto; margin-left: auto; }
    .cs-panel-cta { justify-content: flex-end; }
  }

  .cs-row {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .cs-row-label {
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 10.5px;
    text-transform: uppercase; letter-spacing: 0.1em; color: #64748B;
  }
  .cs-row-value {
    font-family: 'Inter', sans-serif; font-weight: 600; font-size: 13px; color: #0B1224;
    font-variant-numeric: tabular-nums; text-align: right;
  }

  .cs-mini-label {
    display: inline-flex; align-items: center; gap: 4px; margin-bottom: 6px;
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.1em; color: #64748B;
  }
  .cs-chip {
    background: #F8FAFD; border: 1px solid #E5EAF3; color: #475569;
    border-radius: 999px; padding: 2px 9px;
    font-family: 'Inter', sans-serif; font-size: 11px;
  }
  .cs-note-text {
    margin: 0; font-family: 'Inter', sans-serif; font-size: 12.5px;
    color: #475569; font-style: italic; line-height: 1.6;
  }
  .cs-notes {
    background: #F8FAFD; border: 1px solid #E5EAF3; border-radius: 12px;
    padding: 12px 14px; margin-top: 14px;
  }
`
