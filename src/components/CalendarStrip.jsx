import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Calendar as CalendarIcon, Activity, Trophy, StickyNote, Sparkles,
} from 'lucide-react'
import { SESSION_MOODS, MATCH_PERFORMANCES } from '../utils/constants.js'
import {
  dateKey, todayKey, formatDateFull, formatDuration,
} from '../utils/helpers.js'
import { useDailySessions, useDailyMatches } from '../hooks/useDailySessions.js'

const DOW_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * 14-day calendar strip. Logic unchanged.
 * Selection styling fixed so missed days never look highlighted.
 */
export default function CalendarStrip({ context = 'training', onTodayAction }) {
  const sessions = useDailySessions()
  const matches = useDailyMatches()

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
       missed      → very faint text-subtle (40% opacity), NEVER red
       none/future → transparent (still rendered so layout doesn't shift) */
  function dotStyleFor(status) {
    if (status === 'completed')   return { background: 'var(--green)',       opacity: 1 }
    if (status === 'in_progress') return { background: 'var(--amber)',       opacity: 1 }
    if (status === 'incomplete' || status === 'not_completed')
      return { background: 'var(--text-subtle)', opacity: 0.4 }
    return { background: 'transparent', opacity: 1 }
  }

  return (
    <div className="card">
      {/* Day strip */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {days.map(d => {
          const key = dateKey(d)
          const isToday = key === today
          const isSelected = key === selected && !isToday
          const status = getDotStatus(key)
          const dotStyle = dotStyleFor(status)

          /* Resolve cell visuals. Only TODAY gets red. Only the CURRENTLY
             clicked non-today cell gets the subtle "selected" outline.
             Everything else, regardless of status, uses the plain border so
             missed days don't look highlighted. */
          let borderColor, background, dayNumberColor, dayNumberWeight
          if (isToday) {
            borderColor = 'var(--red)'
            background = 'var(--red-tint)'
            dayNumberColor = 'var(--text-primary)'
            dayNumberWeight = 800
          } else if (isSelected) {
            borderColor = 'var(--text-subtle)'
            background = 'var(--bg-surface)'
            dayNumberColor = 'var(--text-primary)'
            dayNumberWeight = 700
          } else {
            borderColor = 'var(--border)'
            background = 'var(--bg-elevated)'
            dayNumberColor = 'var(--text-muted)'
            dayNumberWeight = 700
          }

          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              style={{
                width: 38,
                height: 54,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                padding: '4px 0',
                borderRadius: 'var(--radius-sm)',
                background,
                border: `1px solid ${borderColor}`,
                cursor: 'pointer',
                transition: 'border-color 0.15s ease, background 0.15s ease',
              }}
              title={`${key} • ${status.replace('_', ' ')}`}
            >
              <span
                style={{
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-subtle)',
                }}
              >
                {DOW_LETTERS[d.getDay()]}
              </span>
              <span
                style={{
                  fontFamily: 'Bebas Neue, sans-serif',
                  fontWeight: dayNumberWeight,
                  fontSize: 15,
                  color: dayNumberColor,
                  lineHeight: 1,
                }}
              >
                {d.getDate()}
              </span>
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  display: 'block',
                  ...dotStyle,
                }}
              />
            </button>
          )
        })}
      </div>

      {/* Day summary */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
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

function statusBadge(status) {
  if (status === 'completed')   return { className: 'badge badge-green', label: 'Completed' }
  if (status === 'in_progress') return { className: 'badge badge-amber', label: 'In Progress' }
  if (status === 'incomplete')  return { className: 'badge badge-amber', label: 'Incomplete' }
  if (status === 'not_completed') return { className: 'badge', label: 'Missed' }
  return { className: 'badge', label: 'Not Started' }
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarIcon size={14} style={{ color: 'var(--text-subtle)' }} />
          <span
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--text-primary)',
            }}
          >
            {formatDateFull(date)}
          </span>
        </div>
        <span className={badge.className}>{badge.label}</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
        }}
      >
        <SummaryBlock
          icon={<Activity size={14} style={{ color: 'var(--text-subtle)' }} />}
          title="Training"
          empty={sActivity.drillCount === 0 ? 'No drills logged' : null}
        >
          {sActivity.drillCount > 0 && (
            <>
              <Row label="Drills" value={`${sActivity.drillCount} • ${formatDuration(sActivity.totalDuration)}`} />
              {mood && <Row label="Mood" value={<>{mood.emoji} {mood.label}</>} />}
              {sActivity.modulesWorked.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div className="label" style={{ marginBottom: 6 }}>Modules</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {sActivity.modulesWorked.map(m => (
                      <span key={m} className="badge">{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </SummaryBlock>

        <SummaryBlock
          icon={<Trophy size={14} style={{ color: 'var(--text-subtle)' }} />}
          title="Matches"
          empty={mActivity.matchCount === 0 ? 'No matches logged' : null}
        >
          {mActivity.matchCount > 0 && (
            <>
              <Row label="Logged" value={`${mActivity.matchCount}`} />
              {performance && <Row label="Performance" value={<>{performance.emoji} {performance.label}</>} />}
              {mEntry?.takeaway && (
                <div style={{ marginTop: 6 }}>
                  <div className="label" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                    <StickyNote size={11} /> Takeaway
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6 }}>
                    "{mEntry.takeaway}"
                  </p>
                </div>
              )}
            </>
          )}
        </SummaryBlock>
      </div>

      {sEntry?.notes && (
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            marginTop: 10,
          }}
        >
          <div className="label" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
            <StickyNote size={11} /> Session notes
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6 }}>
            "{sEntry.notes}"
          </p>
        </div>
      )}

      {isToday && headerStatus !== 'completed' && onTodayAction && (
        <div style={{ marginTop: 12 }}>
          <button onClick={onTodayAction} className="btn btn-primary btn-sm">
            <Sparkles size={13} />
            {context === 'training' ? 'Start a Drill' : 'Log a Match'}
          </button>
        </div>
      )}
    </div>
  )
}

function SummaryBlock({ icon, title, children, empty }) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}
        <span className="label">{title}</span>
      </div>
      {empty ? (
        <p style={{ fontSize: 12, color: 'var(--text-subtle)', fontStyle: 'italic' }}>{empty}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
      <span className="label">{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}
