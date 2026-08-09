import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  doc, getDoc, collection, getDocs, query, orderBy,
} from 'firebase/firestore'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, Flame, Award, Zap, Trophy, ArrowRight,
  AlertTriangle, Check, Clock, Star,
} from 'lucide-react'
import { db } from '../utils/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'

const RED   = '#E8001C'
const BLUE  = '#4A9EFF'
const MUTED = '#8888A8'

/* 7-level system used across the app. Names + XP thresholds must match
   the definitions in utils/db.js so the progress bar and Dashboard
   agree on where each user sits. */
const LEVELS = [
  { level: 0, name: 'Rookie',   threshold: 0    },
  { level: 1, name: 'Bronze',   threshold: 500  },
  { level: 2, name: 'Silver',   threshold: 1000 },
  { level: 3, name: 'Gold',     threshold: 2000 },
  { level: 4, name: 'Platinum', threshold: 3500 },
  { level: 5, name: 'Diamond',  threshold: 5000 },
  { level: 6, name: 'Elite',    threshold: 7500 },
]

function levelForXp(xp) {
  const n = Number(xp) || 0
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (n >= LEVELS[i].threshold) return LEVELS[i]
  }
  return LEVELS[0]
}
function nextLevelFor(current) {
  const idx = LEVELS.findIndex(l => l.level === current.level)
  return LEVELS[idx + 1] || null
}

/* ============================================================
   PAGE ROOT
   ============================================================ */
export default function Progress() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [dailySessions, setDailySessions] = useState({})   /* {date: {completed, count}} */
  const [profile, setProfile] = useState(null)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user?.uid) { setLoading(false); return }
      setLoading(true); setError('')
      try {
        const [sessSnap, profileSnap, dailySnap, matchesSnap] = await Promise.all([
          getDocs(query(collection(db, 'users', user.uid, 'sessions'), orderBy('createdAt', 'asc')))
            .catch(async () => getDocs(collection(db, 'users', user.uid, 'sessions'))),
          getDoc(doc(db, 'users', user.uid)),
          getDocs(collection(db, 'users', user.uid, 'daily_sessions')),
          getDocs(collection(db, 'users', user.uid, 'matches'))
            .catch(() => ({ docs: [] })),
        ])
        if (cancelled) return

        const sess = sessSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        sess.sort((a, b) => tsOf(a) - tsOf(b))
        setSessions(sess)

        setProfile(profileSnap.exists() ? profileSnap.data() : {})

        const map = {}
        dailySnap.docs.forEach(d => {
          const data = d.data() || {}
          map[d.id] = {
            completed: !!data.completed || data.status === 'completed',
            count: Number(data.count || data.drillCount || 1) || 1,
          }
        })
        setDailySessions(map)

        setMatches((matchesSnap.docs || []).map(d => ({ id: d.id, ...d.data() })))
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load progress data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user?.uid])

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <AlertTriangle size={18} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, color: 'var(--text-primary)' }}>
            Couldn't load progress
          </div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {error}
          </div>
        </div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="card empty-state">
        <TrendingUp size={48} className="empty-state-icon" />
        <div className="empty-state-title">No training data yet</div>
        <div className="empty-state-desc">
          Complete training sessions to track your progress over time.
        </div>
        <button
          onClick={() => navigate('/training')}
          className="btn btn-primary btn-sm"
          style={{ marginTop: 12 }}
        >
          Start Training <ArrowRight size={13} />
        </button>
      </div>
    )
  }

  const xp = Number(profile?.xp) || 0
  const currentLevel = levelForXp(xp)
  const nextLevel = nextLevelFor(currentLevel)
  const streakCount = Number(profile?.streak?.count ?? profile?.streak ?? 0) || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-transition">
      {/* Header */}
      <div>
        <h1
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontWeight: 400,
            fontSize: 28,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Progress
        </h1>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Your training journey so far
        </div>
      </div>

      <TopStatsRow
        currentLevel={currentLevel}
        nextLevel={nextLevel}
        xp={xp}
        streakCount={streakCount}
        sessionCount={sessions.length}
      />

      <XpProgressCard
        xp={xp}
        currentLevel={currentLevel}
        nextLevel={nextLevel}
      />

      <ActivityHeatmapCard dailySessions={dailySessions} />

      <ChartsRow sessions={sessions} />

      <PersonalBestsCard sessions={sessions} matches={matches} streakCount={streakCount} />

      <LevelJourneyCard xp={xp} currentLevel={currentLevel} />

      <RecentSessionsCard sessions={sessions} />
    </div>
  )
}

/* ============================================================
   ROW 1 — TOP STATS
   ============================================================ */
function TopStatsRow({ currentLevel, nextLevel, xp, streakCount, sessionCount }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14,
      }}
    >
      <StatTile
        icon={<Award size={18} />}
        value={currentLevel.level}
        label="Current Level"
        sub={currentLevel.name}
        valueColor="var(--gold)"
      />
      <StatTile
        icon={<Zap size={18} />}
        value={Number(xp).toLocaleString()}
        label="Total XP"
        sub={nextLevel
          ? `${(nextLevel.threshold - xp).toLocaleString()} to next`
          : 'Max level reached'}
      />
      <StatTile
        icon={<Flame size={18} />}
        value={`${streakCount}d`}
        label="Current Streak"
        valueColor={streakCount > 0 ? 'var(--amber)' : 'var(--text-primary)'}
      />
      <StatTile
        icon={<TrendingUp size={18} />}
        value={sessionCount}
        label="Total Sessions"
      />
    </div>
  )
}

/* ============================================================
   ROW 2 — XP PROGRESS BAR + MILESTONES
   ============================================================ */
function XpProgressCard({ xp, currentLevel, nextLevel }) {
  const floor = currentLevel.threshold
  const ceil = nextLevel ? nextLevel.threshold : xp
  const pct = ceil > floor ? Math.min(100, Math.round(((xp - floor) / (ceil - floor)) * 100)) : 100
  const remaining = nextLevel ? Math.max(0, nextLevel.threshold - xp) : 0

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">XP Progress</div>
        <div className="label">
          {currentLevel.name}{nextLevel ? ` → ${nextLevel.name}` : ' · Max'}
        </div>
      </div>

      <div
        style={{
          height: 12,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'var(--red)',
            transition: 'width 0.5s ease',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 10,
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 12,
          color: 'var(--text-muted)',
          gap: 8,
        }}
      >
        <span>{floor.toLocaleString()} XP · {currentLevel.name}</span>
        <span style={{ color: 'var(--text-primary)' }}>
          {Number(xp).toLocaleString()} / {ceil.toLocaleString()} XP
        </span>
        <span>{nextLevel ? `${nextLevel.name} · ${nextLevel.threshold.toLocaleString()} XP` : 'Max'}</span>
      </div>

      {nextLevel && (
        <div
          style={{
            textAlign: 'center',
            marginTop: 8,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 12,
            color: 'var(--text-subtle)',
          }}
        >
          {remaining.toLocaleString()} XP to {nextLevel.name}
        </div>
      )}

      {/* Level milestones */}
      <div
        style={{
          marginTop: 22,
          display: 'grid',
          gridTemplateColumns: `repeat(${LEVELS.length}, 1fr)`,
          gap: 6,
        }}
      >
        {LEVELS.map(l => {
          const isCurrent = l.level === currentLevel.level
          const isDone = l.level < currentLevel.level
          const border = isCurrent
            ? 'var(--red)'
            : isDone
              ? 'var(--green)'
              : 'var(--border)'
          const bg = isCurrent
            ? 'var(--red)'
            : isDone
              ? 'var(--green)'
              : 'transparent'
          return (
            <div key={l.level} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 16, height: 16,
                  borderRadius: '50%',
                  background: bg,
                  border: `2px solid ${border}`,
                  margin: '0 auto',
                }}
              />
              <div
                style={{
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 10,
                  color: isCurrent ? 'var(--text-primary)' : 'var(--text-subtle)',
                  marginTop: 6,
                  fontWeight: isCurrent ? 600 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {l.name}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ============================================================
   ROW 3 — ACTIVITY HEATMAP
   ============================================================ */
function ActivityHeatmapCard({ dailySessions }) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768
  )

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const weeks = isMobile ? 16 : 52
  const totalDays = weeks * 7

  /* Build a totalDays-long array ending today. Track which columns
     should carry a month label (first cell of each new month). */
  const { grid, monthLabels, totalSessions } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    /* Walk back so that the last column is today's week. */
    const start = new Date(today)
    /* Line up "start" to a Sunday `weeks-1` weeks ago so grid is clean. */
    start.setDate(start.getDate() - (weeks * 7 - 1))
    /* Shift start back to prior Sunday to align rows to weekdays. */
    const startDow = start.getDay()
    start.setDate(start.getDate() - startDow)

    const days = []
    const labels = []
    let lastMonth = -1
    let total = 0

    const cursor = new Date(start)
    for (let col = 0; col < weeks; col++) {
      for (let row = 0; row < 7; row++) {
        const iso = cursor.toISOString().split('T')[0]
        const rec = dailySessions[iso]
        const count = rec?.completed ? (rec.count || 1) : 0
        if (count > 0) total++
        days.push({
          date: iso,
          count,
          col,
          row,
          inFuture: cursor > today,
        })
        cursor.setDate(cursor.getDate() + 1)
      }
      /* Month label = the month showing on the first day of this column */
      const colStart = new Date(start)
      colStart.setDate(colStart.getDate() + col * 7)
      const m = colStart.getMonth()
      if (m !== lastMonth) {
        labels.push({ col, label: colStart.toLocaleDateString('en-GB', { month: 'short' }) })
        lastMonth = m
      }
    }

    return { grid: days, monthLabels: labels, totalSessions: total }
  }, [dailySessions, weeks])

  const cellSize = 12
  const cellGap = 3
  const dayLabelWidth = 24
  const gridWidth = weeks * (cellSize + cellGap) - cellGap
  const gridHeight = 7 * (cellSize + cellGap) - cellGap

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Training Activity</div>
        <div className="label">
          {totalSessions} session{totalSessions === 1 ? '' : 's'} in the last {isMobile ? '16 weeks' : 'year'}
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
        <div style={{ minWidth: dayLabelWidth + gridWidth + 8 }}>
          {/* Month labels row */}
          <div style={{ display: 'flex', paddingLeft: dayLabelWidth, marginBottom: 4, height: 14 }}>
            <div style={{ position: 'relative', width: gridWidth, height: 12 }}>
              {monthLabels.map(({ col, label }) => (
                <div
                  key={col}
                  style={{
                    position: 'absolute',
                    left: col * (cellSize + cellGap),
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 10,
                    color: 'var(--text-subtle)',
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Grid + day labels */}
          <div style={{ display: 'flex', gap: 4 }}>
            {/* Day-of-week labels */}
            <div
              style={{
                width: dayLabelWidth,
                display: 'grid',
                gridTemplateRows: `repeat(7, ${cellSize}px)`,
                rowGap: cellGap,
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 10,
                color: 'var(--text-subtle)',
                alignItems: 'center',
                paddingRight: 4,
              }}
            >
              {[0, 1, 2, 3, 4, 5, 6].map(d => (
                <div key={d} style={{ height: cellSize, display: 'flex', alignItems: 'center' }}>
                  {d === 1 ? 'Mon' : d === 3 ? 'Wed' : d === 5 ? 'Fri' : ''}
                </div>
              ))}
            </div>

            {/* Cells */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${weeks}, ${cellSize}px)`,
                gridTemplateRows: `repeat(7, ${cellSize}px)`,
                columnGap: cellGap,
                rowGap: cellGap,
              }}
            >
              {grid.map((d, i) => {
                const opacity =
                  d.count >= 3 ? 1 :
                  d.count === 2 ? 0.7 :
                  d.count === 1 ? 0.4 :
                  0
                const hasActivity = d.count > 0
                const label = d.inFuture
                  ? d.date
                  : `${d.date} · ${hasActivity ? `${d.count} session${d.count === 1 ? '' : 's'}` : 'No activity'}`
                return (
                  <div
                    key={i}
                    title={label}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: 2,
                      background: hasActivity
                        ? `rgba(0, 201, 110, ${opacity})`
                        : 'var(--bg-elevated)',
                      border: hasActivity ? 'none' : '1px solid var(--border)',
                      gridColumn: d.col + 1,
                      gridRow: d.row + 1,
                    }}
                  />
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 6,
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 11,
              color: 'var(--text-subtle)',
            }}
          >
            <span>Less</span>
            {[0, 0.4, 0.7, 1].map((op, i) => (
              <span
                key={i}
                style={{
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 2,
                  background: op === 0 ? 'var(--bg-elevated)' : `rgba(0, 201, 110, ${op})`,
                  border: op === 0 ? '1px solid var(--border)' : 'none',
                }}
              />
            ))}
            <span
              style={{
                width: cellSize,
                height: cellSize,
                borderRadius: 2,
                background: 'rgba(0, 201, 110, 1)',
              }}
            />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   ROW 4 — XP GROWTH + SESSIONS PER WEEK
   ============================================================ */
function ChartsRow({ sessions }) {
  /* XP growth — cumulative sum of session-derived XP over time. If
     sessions carry an explicit `xpAwarded` use it; otherwise treat
     each session as ~50 XP (matches DrillTimer defaults). */
  const xpData = useMemo(() => {
    let running = 0
    return sessions
      .filter(s => tsOf(s) > 0)
      .map(s => {
        const gain = Number(s.xp ?? s.xpAwarded ?? 50) || 50
        running += gain
        return { date: fmtDate(s), xp: running }
      })
  }, [sessions])

  /* Sessions grouped by ISO-week label ("Jun W1"). Show last 12 weeks. */
  const weeksData = useMemo(() => groupByWeek(sessions).slice(-12), [sessions])

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}
      className="progress-2col"
    >
      <ChartCard title="XP Growth">
        {xpData.length === 0 ? <ChartEmpty msg="No dated sessions yet" /> : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={xpData} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: MUTED, strokeOpacity: 0.3 }} />
              <Area type="monotone" dataKey="xp" name="Cumulative XP" stroke={RED} strokeWidth={2} fill="rgba(232,0,28,0.1)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Sessions per Week">
        {weeksData.length === 0 ? <ChartEmpty msg="No sessions yet" /> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeksData} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval={0} />
              <YAxis {...axisProps} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(74,158,255,0.05)' }} />
              <Bar dataKey="count" name="Sessions" fill={BLUE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <style>{`
        @media (min-width: 900px) {
          .progress-2col { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  )
}

/* ============================================================
   ROW 5 — PERSONAL BESTS
   ============================================================ */
function PersonalBestsCard({ sessions, matches, streakCount }) {
  const bests = useMemo(() => {
    const bestKills = matches.reduce((max, m) => {
      const k = Number(m.kills ?? m.individualKills ?? 0)
      return k > max ? k : max
    }, 0)

    const highestDamage = matches.reduce((max, m) => {
      const d = Number(m.damage || 0)
      return d > max ? d : max
    }, 0)

    const bestPlacement = matches.reduce((best, m) => {
      const p = Number(m.placement || m.position || m.teamPosition || 0)
      if (!p) return best
      if (best === null || p < best) return p
      return best
    }, null)

    /* Sessions per calendar week — pick the max */
    const weekBuckets = {}
    sessions.forEach(s => {
      const ms = tsOf(s)
      if (!ms) return
      const key = weekKey(new Date(ms))
      weekBuckets[key] = (weekBuckets[key] || 0) + 1
    })
    const mostSessionsInWeek = Object.values(weekBuckets).reduce((max, n) => Math.max(max, n), 0)

    const totalMinutes = sessions.reduce(
      (s, x) => s + Number(x.duration ?? x.durationSeconds ? (x.durationSeconds || 0) / 60 : 0) + Number(x.duration || 0),
      0,
    )
    /* Above line double-counts if both fields exist; recompute cleanly. */
    const trueMinutes = sessions.reduce((s, x) => {
      if (typeof x.duration === 'number') return s + x.duration
      if (typeof x.durationSeconds === 'number') return s + x.durationSeconds / 60
      return s
    }, 0)

    return {
      bestKills,
      highestDamage,
      bestPlacement,
      mostSessionsInWeek,
      totalMinutes: trueMinutes,
    }
  }, [sessions, matches])

  const items = [
    { icon: <Trophy size={14} />, label: 'Best K/D (single match)', value: bests.bestKills > 0 ? `${bests.bestKills} kills` : '—' },
    { icon: <Zap size={14} />,    label: 'Highest damage',          value: bests.highestDamage > 0 ? bests.highestDamage.toLocaleString() : '—' },
    { icon: <Award size={14} />,  label: 'Best placement',          value: bests.bestPlacement ? `#${bests.bestPlacement}` : '—' },
    { icon: <Flame size={14} />,  label: 'Longest streak',          value: `${streakCount}d` },
    { icon: <TrendingUp size={14} />, label: 'Most sessions in a week', value: bests.mostSessionsInWeek || 0 },
    { icon: <Clock size={14} />,  label: 'Total practice time',     value: fmtDuration(bests.totalMinutes) },
  ]

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Personal Bests</div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <span style={{ color: 'var(--gold)', display: 'inline-flex' }}>{it.icon}</span>
            <span
              style={{
                fontFamily: 'Bebas Neue, sans-serif',
                fontSize: 28,
                letterSpacing: '0.04em',
                color: 'var(--text-primary)',
                lineHeight: 1,
              }}
            >
              {it.value}
            </span>
            <span
              style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 11,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
              }}
            >
              {it.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   ROW 6 — LEVEL JOURNEY
   ============================================================ */
function LevelJourneyCard({ xp, currentLevel }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Level Journey</div>
        <div className="label">
          {currentLevel.name} · {Number(xp).toLocaleString()} XP
        </div>
      </div>

      <div className="level-journey" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {LEVELS.map((l, i) => {
          const isCurrent = l.level === currentLevel.level
          const isDone = l.level < currentLevel.level
          const nextLevelInList = LEVELS[i + 1]
          const segmentDone = nextLevelInList && nextLevelInList.level <= currentLevel.level
          const nodeBg = isCurrent ? 'var(--red)' : isDone ? 'var(--green)' : 'transparent'
          const nodeBorder = isCurrent ? 'var(--red)' : isDone ? 'var(--green)' : 'var(--border)'
          const nodeColor = isDone || isCurrent ? '#fff' : 'var(--text-subtle)'

          return (
            <div
              key={l.level}
              className="level-journey-node"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                position: 'relative',
              }}
            >
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    width: 40, height: 40,
                    borderRadius: '50%',
                    background: nodeBg,
                    border: `2px solid ${nodeBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: nodeColor,
                    fontFamily: 'Bebas Neue, sans-serif',
                    fontSize: 16,
                    letterSpacing: '0.04em',
                    flexShrink: 0,
                  }}
                >
                  {isDone ? <Check size={16} strokeWidth={3} /> : l.level}
                </div>
                {i < LEVELS.length - 1 && (
                  <span
                    className="level-journey-line"
                    style={{
                      position: 'absolute',
                      left: 19,
                      top: 40,
                      width: 2,
                      height: 24,
                      background: segmentDone ? 'var(--green)' : 'var(--border)',
                    }}
                  />
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    fontSize: 18,
                    letterSpacing: '0.04em',
                    color: isCurrent ? 'var(--text-primary)' : isDone ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {l.name}
                </div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-subtle)' }}>
                  {l.threshold.toLocaleString()} XP
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        @media (min-width: 900px) {
          .level-journey {
            flex-direction: row !important;
            justify-content: space-between;
            align-items: flex-start !important;
            gap: 8px !important;
          }
          .level-journey-node {
            flex: 1;
            flex-direction: column !important;
            text-align: center;
            gap: 8px !important;
          }
          .level-journey-node > div:last-child {
            text-align: center;
          }
          .level-journey-line {
            left: 40px !important;
            top: 19px !important;
            width: calc(100% - 40px) !important;
            height: 2px !important;
          }
        }
      `}</style>
    </div>
  )
}

/* ============================================================
   ROW 7 — RECENT SESSIONS TABLE
   ============================================================ */
function RecentSessionsCard({ sessions }) {
  const recent = [...sessions].slice(-10).reverse()

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Recent Sessions</div>
        <div className="label">Last {recent.length}</div>
      </div>
      {recent.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No sessions yet</div>
          <div className="empty-state-desc">Complete drills in the Training Center to see them here.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Module</th>
                <th>Drills</th>
                <th>Duration</th>
                <th>Rating</th>
                <th>Weapons</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(s => {
                const rating = Number(s.rating) || 0
                const durationMin =
                  typeof s.duration === 'number' ? s.duration :
                  typeof s.durationSeconds === 'number' ? Math.round(s.durationSeconds / 60) :
                  0
                const weapons = Array.isArray(s.weapons) ? s.weapons.join(', ') : ''
                return (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{fmtDate(s)}</td>
                    <td>{s.moduleName || s.module || '—'}</td>
                    <td className="mono">{Number(s.drillCount || 0)}</td>
                    <td className="mono">{durationMin > 0 ? `${durationMin}m` : '—'}</td>
                    <td>
                      {rating > 0 ? (
                        <span style={{ color: 'var(--gold)', letterSpacing: '2px' }}>
                          {'★'.repeat(rating)}{'☆'.repeat(Math.max(0, 5 - rating))}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-subtle)' }}>—</span>
                      )}
                    </td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {weapons || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   BUILDING BLOCKS
   ============================================================ */
function StatTile({ icon, value, label, sub, valueColor }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          width: 34, height: 34,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <div className="stat-number" style={{ color: valueColor || 'var(--text-primary)' }}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
      {sub && (
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-subtle)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{title}</div>
      </div>
      {children}
    </div>
  )
}

function ChartEmpty({ msg }) {
  return (
    <div className="empty-state" style={{ padding: '30px 12px' }}>
      <div className="empty-state-title">{msg || 'Not enough data'}</div>
      <div className="empty-state-desc">Keep training to unlock this chart.</div>
    </div>
  )
}

const axisProps = {
  stroke: 'var(--border)',
  tickLine: false,
  tick: {
    fill: 'var(--text-subtle)',
    fontSize: 11,
    fontFamily: 'DM Sans, sans-serif',
  },
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 14px',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 12,
        color: 'var(--text-primary)',
      }}
    >
      <p style={{ color: 'var(--text-subtle)', margin: 0, marginBottom: 4, fontSize: 11 }}>
        {label}
      </p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || 'var(--text-primary)', fontWeight: 600, margin: 0 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

/* ============================================================
   LOADING SKELETON
   ============================================================ */
function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
        }}
      >
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="card skeleton" style={{ height: 100 }} />
        ))}
      </div>
      <div className="card skeleton" style={{ height: 160 }} />
      <div className="card skeleton" style={{ height: 220 }} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {[0, 1].map(i => (
          <div key={i} className="card skeleton" style={{ height: 220 }} />
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   HELPERS
   ============================================================ */
function tsOf(x) {
  if (x?.createdAt?.toMillis) return x.createdAt.toMillis()
  if (typeof x?.timestamp === 'number') return x.timestamp
  if (typeof x?.createdAt === 'string') {
    const t = new Date(x.createdAt).getTime()
    return isNaN(t) ? 0 : t
  }
  if (x?.createdAt instanceof Date) return x.createdAt.getTime()
  return 0
}

function fmtDate(x) {
  const ms = tsOf(x)
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function fmtDuration(minutes) {
  const total = Math.round(Number(minutes) || 0)
  if (total <= 0) return '0m'
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function weekKey(d) {
  /* Local-year + week-of-year, e.g. "2026-W12". Uses Monday as week start
     so labels group Mon–Sun. */
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  const monday = new Date(day)
  monday.setDate(day.getDate() - ((day.getDay() + 6) % 7))
  const jan1 = new Date(monday.getFullYear(), 0, 1)
  const daysSince = Math.round((monday - jan1) / 86400000)
  const week = Math.floor(daysSince / 7) + 1
  return `${monday.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function groupByWeek(sessions) {
  const buckets = {}
  sessions.forEach(s => {
    const ms = tsOf(s)
    if (!ms) return
    const d = new Date(ms)
    const key = weekKey(d)
    if (!buckets[key]) {
      const label = `${d.toLocaleDateString('en-GB', { month: 'short' })} W${Math.floor((d.getDate() - 1) / 7) + 1}`
      buckets[key] = { key, label, count: 0, at: ms }
    }
    buckets[key].count++
    if (ms < buckets[key].at) buckets[key].at = ms
  })
  return Object.values(buckets).sort((a, b) => a.at - b.at)
}
