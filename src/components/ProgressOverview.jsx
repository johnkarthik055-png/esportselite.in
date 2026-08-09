import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { STORAGE_KEYS } from '../utils/constants.js'
import { dateKey, normalizeSessions } from '../utils/helpers.js'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/* ============================================================
   WINDOW BUILDERS
   ============================================================ */
function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Last 7 days (oldest first), each with a Mon/Tue/… label. */
function lastSevenDays() {
  const today = startOfDay(new Date())
  const out = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    out.push({
      key: dateKey(d),
      label: DAY_NAMES[d.getDay()],
      date: d,
    })
  }
  return out
}

/** Last 4 weeks (oldest first), each with a Week N label. */
function lastFourWeeks() {
  const today = startOfDay(new Date())
  const out = []
  for (let i = 3; i >= 0; i--) {
    const end = new Date(today)
    end.setDate(end.getDate() - i * 7)
    const start = new Date(end)
    start.setDate(start.getDate() - 6)
    out.push({
      label: `Week ${4 - i}`,
      start,
      end,
    })
  }
  return out
}

/* ============================================================
   TOOLTIP CONTENT FACTORY
   Returns a render function suitable for recharts <Tooltip content={...}>.
   ============================================================ */
function tooltipContent(accent, unit) {
  return function Tip({ active, payload, label }) {
    if (!active || !payload?.length || payload[0].value == null) return null
    return (
      <div
        className="px-3 py-2 rounded-md shadow-xl"
        style={{
          background: 'rgba(17, 17, 24, 0.95)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: `1px solid ${accent}`,
        }}
      >
        <div className="text-[10px] uppercase tracking-widest text-text-muted heading">
          {label}
        </div>
        <div className="mono text-sm mt-0.5" style={{ color: accent }}>
          {payload[0].value} {unit}
        </div>
      </div>
    )
  }
}

/* ============================================================
   MAIN
   ============================================================ */
export default function ProgressOverview() {
  const [sessionsRaw] = useLocalStorage(STORAGE_KEYS.SESSIONS, [])
  const [matches] = useLocalStorage(STORAGE_KEYS.MATCHES, [])
  const [view, setView] = useState('weekly')

  const sessions = useMemo(() => normalizeSessions(sessionsRaw), [sessionsRaw])
  const isWeekly = view === 'weekly'

  const { sessionsData, killsData, practiceData } = useMemo(() => {
    if (isWeekly) {
      const days = lastSevenDays()
      const sessByDay = {}
      const killsByDay = {}
      const minsByDay = {}

      sessions.forEach(s => {
        const k = dateKey(s.timestamp)
        sessByDay[k] = (sessByDay[k] || 0) + 1
        minsByDay[k] =
          (minsByDay[k] || 0) + Math.floor((Number(s.durationSeconds) || 0) / 60)
      })

      matches.forEach(m => {
        const k = dateKey(m.timestamp)
        const kills =
          m.type === 'Classic'
            ? Number(m.kills) || 0
            : Number(m.individualKills) || 0
        killsByDay[k] = (killsByDay[k] || 0) + kills
      })

      return {
        sessionsData: days.map(d => ({ label: d.label, value: sessByDay[d.key] || 0 })),
        killsData: days.map(d => ({ label: d.label, value: killsByDay[d.key] || 0 })),
        practiceData: days.map(d => ({ label: d.label, value: minsByDay[d.key] || 0 })),
      }
    }

    /* Monthly view */
    const weeks = lastFourWeeks()
    const inRange = (ts, start, end) => {
      const t = Number(ts)
      return (
        t >= start.getTime() &&
        t <= end.getTime() + 24 * 60 * 60 * 1000 - 1
      )
    }

    const sessionsBucket = weeks.map(w => ({
      label: w.label,
      value: sessions.filter(s => inRange(s.timestamp, w.start, w.end)).length,
    }))

    const killsBucket = weeks.map(w => {
      const wMatches = matches.filter(m => inRange(m.timestamp, w.start, w.end))
      const totalKills = wMatches.reduce(
        (acc, m) =>
          acc +
          (m.type === 'Classic'
            ? Number(m.kills) || 0
            : Number(m.individualKills) || 0),
        0
      )
      return { label: w.label, value: totalKills }
    })

    const practiceBucket = weeks.map(w => {
      const wSess = sessions.filter(s => inRange(s.timestamp, w.start, w.end))
      const totalHours = wSess.reduce(
        (acc, x) => acc + (Number(x.durationSeconds) || 0) / 3600,
        0
      )
      return { label: w.label, value: Number(totalHours.toFixed(1)) }
    })

    return {
      sessionsData: sessionsBucket,
      killsData: killsBucket,
      practiceData: practiceBucket,
    }
  }, [sessions, matches, isWeekly])

  const sessionsTooltip = useMemo(
    () => tooltipContent('#E8001C', 'sessions'),
    []
  )
  const killsTooltip = useMemo(() => tooltipContent('#4A9EFF', 'kills'), [])
  const practiceTooltip = useMemo(
    () => tooltipContent('#00E676', isWeekly ? 'min' : 'hrs'),
    [isWeekly]
  )

  const hasSessions = sessions.length > 0
  const hasMatches = matches.length > 0

  return (
    <section className="glass clip-corner-sm p-6 lg:p-7 relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-accent-primary opacity-[0.08] blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="heading text-xl text-white tracking-wide flex items-center gap-2">
            <TrendingUp size={20} className="text-accent-secondary" /> PROGRESS OVERVIEW
          </h3>
          <p className="text-xs text-text-secondary mt-1 uppercase tracking-widest">
            How you're trending {isWeekly ? 'this week' : 'this month'}
          </p>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.15em] text-text-muted heading">
          View
        </span>
        <div className="flex gap-2 flex-wrap">
          <ToggleBtn active={isWeekly} onClick={() => setView('weekly')}>
            Weekly
          </ToggleBtn>
          <ToggleBtn active={!isWeekly} onClick={() => setView('monthly')}>
            Monthly
          </ToggleBtn>
        </div>
      </div>

      <div className="relative z-10 space-y-6">
        {/* Training Sessions — full width */}
        <ProgressCard title="TRAINING SESSIONS" accent="#E8001C" height="h-[180px]">
          {!hasSessions || sessionsData.every(d => !d.value) ? (
            <EmptyChart message="Log sessions to see your progress." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sessionsData}
                margin={{ top: 10, right: 12, bottom: 4, left: 0 }}
              >
                <defs>
                  <linearGradient id="ee-sess-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF2D44" />
                    <stop offset="100%" stopColor="#E8001C" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#9999AA', fontSize: 11, fontFamily: 'Share Tech Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#9999AA', fontSize: 11, fontFamily: 'Share Tech Mono' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip content={sessionsTooltip} cursor={{ fill: 'rgba(232,0,28,0.06)' }} />
                <Bar
                  dataKey="value"
                  fill="url(#ee-sess-gradient)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ProgressCard>

        {/* Kills + Practice Time — 2 col on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProgressCard
            title={isWeekly ? 'KILLS PER DAY' : 'KILLS PER WEEK'}
            accent="#4A9EFF"
            height="h-[160px]"
          >
            {!hasMatches || killsData.every(d => !d.value) ? (
              <EmptyChart message="Log matches to see your kills trend." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={killsData}
                  margin={{ top: 10, right: 12, bottom: 4, left: 0 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#9999AA', fontSize: 11, fontFamily: 'Share Tech Mono' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#9999AA', fontSize: 11, fontFamily: 'Share Tech Mono' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={28}
                  />
                  <Tooltip content={killsTooltip} cursor={{ fill: 'rgba(74,158,255,0.08)' }} />
                  <Bar dataKey="value" fill="#4A9EFF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ProgressCard>

          <ProgressCard
            title={isWeekly ? 'PRACTICE TIME (MIN)' : 'PRACTICE TIME (HOURS)'}
            accent="#00E676"
            height="h-[160px]"
          >
            {!hasSessions || practiceData.every(d => !d.value) ? (
              <EmptyChart message="Log sessions to see your practice time." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={practiceData}
                  margin={{ top: 10, right: 12, bottom: 4, left: 0 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#9999AA', fontSize: 11, fontFamily: 'Share Tech Mono' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#9999AA', fontSize: 11, fontFamily: 'Share Tech Mono' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={!isWeekly}
                    width={28}
                  />
                  <Tooltip content={practiceTooltip} cursor={{ fill: 'rgba(0,230,118,0.08)' }} />
                  <Bar dataKey="value" fill="#00E676" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ProgressCard>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   SUB-COMPONENTS
   ============================================================ */
function ToggleBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        'px-4 py-1.5 rounded-full text-xs uppercase tracking-widest heading transition-all ' +
        (active
          ? 'bg-red-gradient text-white shadow-red-glow'
          : 'bg-bg-elevated/60 border border-border text-text-secondary hover:text-white hover:border-accent-primary')
      }
    >
      {children}
    </button>
  )
}

function ProgressCard({ title, accent, height = 'h-[180px]', children }) {
  return (
    <div
      className="rounded-md border border-border bg-bg-elevated/40 p-4 sm:p-5"
      style={{ boxShadow: `inset 0 1px 0 ${accent}10` }}
    >
      <div className="text-xs uppercase tracking-[0.15em] heading text-text-secondary mb-3">
        {title}
      </div>
      <div className={`${height} w-full`}>{children}</div>
    </div>
  )
}

function EmptyChart({ message }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-center px-4">
      <p className="text-text-muted text-xs sm:text-sm">{message}</p>
    </div>
  )
}
