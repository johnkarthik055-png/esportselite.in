import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Flame, AlertTriangle, AlertCircle, Crosshair, Target, ChevronRight,
  Clock, Calendar, Activity, ArrowRight, Bot, Shield,
} from 'lucide-react'
import StatCard from '../components/StatCard.jsx'
import FeaturedTournamentCard from '../components/dashboard/FeaturedTournamentCard.jsx'
import TodaysScheduleCard from '../components/dashboard/TodaysScheduleCard.jsx'
import { useStats } from '../hooks/useStats.js'
import { useStreak } from '../hooks/useStreak.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useModules } from '../hooks/useModules.js'
import { useAuth } from '../context/AuthContext.jsx'
import { STORAGE_KEYS } from '../utils/constants.js'
import {
  greeting, formatRelative, formatDuration, dateKey, normalizeSessions,
} from '../utils/helpers.js'
import { getDisplayName } from '../utils/storage.js'
import { getTrialStatus } from '../utils/trial.js'
import { useUserData } from '../hooks/useUserData.js'
import { getLevelName, XP_PER_LEVEL } from '../utils/db.js'

/* ============================================================
   DATA HELPERS (logic preserved)
   ============================================================ */
function calculateWeeklyConsistency(sessions) {
  if (!sessions || sessions.length === 0) return { percentage: 0, days: 0 }
  const last7Days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    last7Days.push(d.toISOString().split('T')[0])
  }
  const activeDays = new Set()
  sessions.forEach(session => {
    if (!session.timestamp) return
    const sd = new Date(session.timestamp).toISOString().split('T')[0]
    if (last7Days.includes(sd)) activeDays.add(sd)
  })
  const days = activeDays.size
  return { percentage: Math.round((days / 7) * 100), days }
}

const HEATMAP_SKILLS = [
  { name: 'Spray Control', keywords: ['spray', 'recoil', 'burst', 'auto'] },
  { name: 'Close Range',   keywords: ['close', 'tdm', 'hipfire', 'jiggle', 'peek', 'rush'] },
  { name: 'Mid Range',     keywords: ['mid', 'medium', '2x', '3x'] },
  { name: 'Long Range',    keywords: ['long', 'snipe', 'scope', '6x', '8x'] },
  { name: 'Movement',      keywords: ['movement', 'rotate', 'position', 'zone', 'jump'] },
  { name: 'Rotations',     keywords: ['rotation', 'zone', 'circle', 'ring', 'third'] },
  { name: 'Team Play',     keywords: ['callout', 'squad', 'team', 'sync', 'revive', 'communication'] },
  { name: 'Survival',      keywords: ['survive', 'heal', 'loot', 'placement', 'endgame', 'zone'] },
]

function resolveWeaknessText(match, suggestions) {
  if (Array.isArray(match.weakestPoints) && match.weakestPoints.length > 0) {
    return match.weakestPoints
      .map(id => (Array.isArray(suggestions) ? suggestions : []).find(s => s.id === id)?.name || '')
      .filter(Boolean).join(' ').toLowerCase()
  }
  const w = match.weaknesses || match.weakestPoint || match.weakness || ''
  return (Array.isArray(w) ? w.join(' ') : String(w)).toLowerCase()
}

function calculateHeatmap(matches, suggestions) {
  if (!matches || matches.length === 0) return []
  const counts = {}
  HEATMAP_SKILLS.forEach(s => { counts[s.name] = 0 })
  matches.forEach(match => {
    const str = resolveWeaknessText(match, suggestions)
    if (!str) return
    HEATMAP_SKILLS.forEach(skill => {
      if (skill.keywords.some(kw => str.includes(kw))) counts[skill.name]++
    })
  })
  return HEATMAP_SKILLS.map(skill => {
    const count = counts[skill.name]
    let status, color, percentage
    if      (count >= 5) { status = 'High Priority'; color = 'var(--red)';   percentage = 90 }
    else if (count >= 3) { status = 'High Priority'; color = 'var(--red)';   percentage = 75 }
    else if (count >= 2) { status = 'Weak';          color = 'var(--amber)'; percentage = 55 }
    else if (count === 1){ status = 'Improving';     color = 'var(--gold)';  percentage = 30 }
    else                 { return null }
    return { name: skill.name, count, status, color, percentage }
  }).filter(Boolean).sort((a, b) => b.count - a.count)
}

function getWeaknessFrequency(matches, suggestions) {
  if (!matches || matches.length === 0) return []
  const freq = {}
  matches.forEach(match => {
    if (Array.isArray(match.weakestPoints) && match.weakestPoints.length > 0) {
      match.weakestPoints.forEach(id => {
        const sug = (Array.isArray(suggestions) ? suggestions : []).find(s => s.id === id)
        if (sug?.name) freq[sug.name] = (freq[sug.name] || 0) + 1
      })
    } else {
      const w = match.weaknesses || match.weakestPoint || match.weakness || ''
      const items = Array.isArray(w) ? w : [w]
      items.forEach(item => {
        const str = String(item).trim()
        if (str) freq[str] = (freq[str] || 0) + 1
      })
    }
  })
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
}

/* ============================================================
   DASHBOARD
   ============================================================ */
export default function Dashboard() {
  const [sessionsRaw] = useLocalStorage(STORAGE_KEYS.SESSIONS, [])
  const [lsMatches]   = useLocalStorage(STORAGE_KEYS.MATCHES, [])
  const [suggestions] = useLocalStorage(STORAGE_KEYS.SUGGESTIONS, [])
  const stats         = useStats()
  const streak        = useStreak()
  const { modules }   = useModules()
  const navigate      = useNavigate()
  const { user: authUser } = useAuth()

  const [trial, setTrial] = useState(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!authUser?.uid) { if (!cancelled) setTrial(null); return }
      const status = await getTrialStatus(authUser.uid)
      if (!cancelled) setTrial(status)
    })()
    return () => { cancelled = true }
  }, [authUser?.uid])

  const displayName = getDisplayName()
  const {
    sessions: fsSessions,
    matches:  fsMatches,
    profile:  fsProfile,
    level:    fsLevel,
    xp:       fsXP,
    loading:  dataLoading,
    refreshData,
  } = useUserData()

  useEffect(() => { refreshData(); /* eslint-disable-next-line */ }, [])

  const activeMatches = (Array.isArray(fsMatches) && fsMatches.length > 0)
    ? fsMatches : (Array.isArray(lsMatches) ? lsMatches : [])

  const activeSessions = (Array.isArray(fsSessions) && fsSessions.length > 0)
    ? fsSessions : normalizeSessions(sessionsRaw)

  const fsStreakCount = fsProfile?.streak?.count ?? 0
  const displayStreak = fsStreakCount > 0 ? fsStreakCount : (streak.current || 0)

  const weeklyConsistency = useMemo(() => calculateWeeklyConsistency(activeSessions), [activeSessions])
  const heatmapData = useMemo(() => calculateHeatmap(activeMatches, suggestions), [activeMatches, suggestions])
  const weaknessFreq = useMemo(() => getWeaknessFrequency(activeMatches, suggestions), [activeMatches, suggestions])
  const priorityFocus = weaknessFreq[0] || null
  const focusTomorrow = weaknessFreq.slice(1, 4)

  const priorityModule = useMemo(() => {
    if (!priorityFocus) return null
    const pName = priorityFocus.name.toLowerCase()
    return modules.find(m =>
      m.name.toLowerCase().includes(pName) ||
      pName.includes(m.name.toLowerCase()) ||
      (m.short && (m.short.toLowerCase().includes(pName) || pName.includes(m.short.toLowerCase())))
    ) || null
  }, [priorityFocus, modules])

  function startPriorityDrill() {
    if (priorityModule) navigate(`/training?focus=${priorityModule.id}`)
    else navigate('/training')
  }

  const scrimStats = useMemo(() => {
    const list = activeMatches.filter(m => m.type === 'Scrims' || m.type === 'Tournament')
    const total = list.length
    const top3 = list.filter(m => Number(m.teamPosition) > 0 && Number(m.teamPosition) <= 3).length
    const winRate = total > 0 ? Math.round((top3 / total) * 100) : 0
    const totalKills = activeMatches.reduce((s, m) =>
      s + (m.type === 'Classic' ? Number(m.kills) || 0 : Number(m.individualKills) || 0), 0)
    const kd = activeMatches.length > 0 ? (totalKills / activeMatches.length).toFixed(2) : '0.00'
    return { winRate, kd, scrimCount: total }
  }, [activeMatches])

  const calendar = useMemo(() => {
    const out = []
    const sessionDates = new Set(activeSessions.map(s => dateKey(s.timestamp)))
    for (let i = -3; i <= 3; i++) {
      const d = new Date(); d.setDate(d.getDate() + i)
      const k = dateKey(d.getTime())
      out.push({
        key: k,
        num: d.getDate(),
        day: ['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()],
        today: i === 0,
        hasSession: sessionDates.has(k),
      })
    }
    return out
  }, [activeSessions])

  function formatTotal(sessions) {
    if (!sessions || sessions.length === 0) return '0m'
    const total = sessions.reduce((sum, s) => sum + (Number(s.durationSeconds) || 0), 0)
    if (total === 0) return '0m'
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60)
    if (h > 0 && m > 0) return `${h}h ${m}m`
    if (h > 0) return `${h}h`
    return `${m}m`
  }
  const practiceTime = formatTotal(fsSessions)

  const xp = fsXP ?? 0
  /* Levels are 0-indexed (0 = Rookie … 6 = Elite). XP_PER_LEVEL[N]
     is the threshold for level N, so [levelNum] is this level's
     floor and [levelNum + 1] is the ceiling / next-level threshold. */
  const levelNum = fsLevel ?? 0
  const levelName = getLevelName(levelNum)
  const floor = XP_PER_LEVEL[levelNum] ?? 0
  const ceil  = XP_PER_LEVEL[levelNum + 1] ?? floor
  const xpPct = ceil > floor ? Math.round(Math.min(1, (xp - floor) / (ceil - floor)) * 100) : 100
  const xpToNext = Math.max(0, ceil - xp)
  const nextLevelName = getLevelName(levelNum + 1)

  const avgDamage = useMemo(() => {
    const list = activeMatches.filter(m => Number(m.damage) > 0)
    if (list.length === 0) return 0
    return Math.round(list.reduce((s, m) => s + Number(m.damage), 0) / list.length)
  }, [activeMatches])

  if (dataLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="splash-bar-track"><div className="splash-bar-fill" /></div>
      </div>
    )
  }

  return (
    <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Trial expired banner */}
      {trial?.expired && trial?.endDate && (
        <div
          className="card"
          style={{ display: 'flex', gap: 12, alignItems: 'center' }}
        >
          <AlertTriangle size={18} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <div>
            <div className="heading" style={{ fontSize: 15 }}>Your free trial has ended.</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
              All your data is safe. Premium plan coming soon.
            </div>
          </div>
        </div>
      )}

      {/* Greeting */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-subtle)' }}>{greeting()},</div>
          <h1 style={{
            fontFamily: 'Oxanium, Bebas Neue, sans-serif',
            fontWeight: 700,
            fontSize: 32,
            letterSpacing: '0.02em',
            color: 'var(--text-primary)',
            margin: 0,
            marginTop: 2,
          }}>{displayName}</h1>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Level {levelNum} — <span style={{ color: 'var(--gold)' }}>{levelName}</span>
          </div>
        </div>
        <button onClick={() => navigate('/training')} className="btn btn-primary">
          <Target size={14} /> Start Training
        </button>
      </div>

      {/* XP card */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div className="label">XP PROGRESS — {levelName.toUpperCase()}</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
            {xp.toLocaleString()} / {(ceil || xp).toLocaleString()}
          </div>
        </div>
        <div className="xp-bar-track"><div className="xp-bar-fill" style={{ width: `${xpPct}%` }} /></div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-subtle)' }}>
          {xpToNext.toLocaleString()} XP to {nextLevelName}
        </div>
      </div>

      {/* Today's Schedule (renders itself null if no active schedule).
          Placed here so it sits directly under the XP card per spec. */}
      <TodaysScheduleCard />

      {/* Stat tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 14,
        }}
      >
        <StatCard
          icon={<Flame size={18} />}
          value={`${displayStreak}d`}
          label="Streak"
          accent="amber"
        />
        <StatCard
          icon={<Clock size={18} />}
          value={practiceTime}
          label="Practice"
        />
        <StatCard
          icon={<Calendar size={18} />}
          value={stats.totalSessions}
          label="Sessions"
        />
        <StatCard
          icon={<Crosshair size={18} />}
          value={activeMatches.length}
          label="Matches"
        />
      </div>

      {/* Activity calendar */}
      <div className="card">
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={15} style={{ color: 'var(--text-subtle)' }} /> Activity
          </div>
          <div className="label">{weeklyConsistency.days} / 7 days</div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
          }}
        >
          {calendar.map(d => {
            const isToday = d.today
            const cellStyle = {
              width: 38, height: 54, flexShrink: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '4px 0',
              borderRadius: 'var(--radius-sm)',
              background: isToday ? 'var(--red-tint)' : 'var(--bg-elevated)',
              border: `1px solid ${isToday ? 'var(--red)' : 'var(--border)'}`,
            }
            return (
              <div key={d.key} style={cellStyle}>
                <span
                  style={{
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--text-subtle)',
                    letterSpacing: '0.06em',
                  }}
                >
                  {d.day}
                </span>
                <span
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    fontWeight: 400,
                    fontSize: 18,
                    letterSpacing: '0.04em',
                    color: isToday ? 'var(--text-primary)' : 'var(--text-muted)',
                    lineHeight: 1,
                  }}
                >
                  {d.num}
                </span>
                <span
                  style={{
                    width: 4, height: 4, borderRadius: '50%',
                    background: d.hasSession ? 'var(--green)' : 'transparent',
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Two column */}
      <div
        className="dashboard-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 340px',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* Coach AI */}
          <div
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              cursor: priorityFocus ? 'pointer' : 'default',
            }}
            onClick={() => priorityFocus && startPriorityDrill()}
          >
            <div
              style={{
                width: 40, height: 40,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--blue-tint)',
                border: '1px solid rgba(74,158,255,0.25)',
                color: 'var(--blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Bot size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Coach AI</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                {priorityFocus
                  ? <>Focus on <span style={{ color: 'var(--text-primary)' }}>{priorityFocus.name}</span> — flagged {priorityFocus.count} time{priorityFocus.count === 1 ? '' : 's'}.</>
                  : 'Log matches to unlock personalised training suggestions.'}
              </div>
            </div>
            {priorityFocus && <ChevronRight size={16} style={{ color: 'var(--text-subtle)' }} />}
          </div>

          {/* Featured Tournament (renders itself null if none) */}
          <FeaturedTournamentCard />

          {/* Heatmap */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={15} style={{ color: 'var(--text-subtle)' }} />
                Weakness Heatmap
              </div>
              <div className="label">From match logs</div>
            </div>
            {heatmapData.length === 0 ? (
              <div className="empty-state">
                <Shield size={26} className="empty-state-icon" />
                <div className="empty-state-title">No weakness data yet</div>
                <div className="empty-state-desc">
                  Log matches with weakest points to see your skill breakdown here.
                </div>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {heatmapData.map(skill => (
                  <li key={skill.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{skill.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: skill.color }}>{skill.status}</span>
                    </div>
                    <div className="xp-bar-track">
                      <div className="xp-bar-fill" style={{ width: `${skill.percentage}%`, background: skill.color }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent sessions table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={15} style={{ color: 'var(--text-subtle)' }} />
                Recent Sessions
              </div>
              <Link
                to="/training"
                style={{
                  fontSize: 12, color: 'var(--text-muted)',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                View all <ChevronRight size={12} />
              </Link>
            </div>
            {stats.recentSessions.length === 0 ? (
              <div className="empty-state">
                <Crosshair size={26} className="empty-state-icon" />
                <div className="empty-state-title">No sessions logged</div>
                <div className="empty-state-desc">Start a drill in the Training Center to see it here.</div>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Drill</th><th>Module</th><th>Duration</th><th style={{ textAlign: 'right' }}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentSessions.map(s => {
                    const mod = modules.find(m => m.id === s.moduleId)
                    return (
                      <tr key={s.id}>
                        <td>{s.drillName}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{mod?.short || s.module || 'Training'}</td>
                        <td className="mono">{formatDuration(s.durationSeconds)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>
                          {formatRelative(s.timestamp)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* Priority focus */}
          <div className="card" style={{ borderLeft: '3px solid var(--red)' }}>
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={15} style={{ color: 'var(--text-subtle)' }} />
                Priority Focus
              </div>
              <span className="badge badge-red">Top</span>
            </div>
            {!priorityFocus ? (
              <div className="empty-state">
                <div className="empty-state-title">No patterns yet</div>
                <div className="empty-state-desc">Log 3+ matches to surface your priority area.</div>
              </div>
            ) : (
              <>
                <div className="heading" style={{ fontSize: 18, marginBottom: 6 }}>{priorityFocus.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>
                  Logged {priorityFocus.count} time{priorityFocus.count === 1 ? '' : 's'}
                </div>
                <button onClick={startPriorityDrill} className="btn btn-primary btn-sm">
                  Start drill <ArrowRight size={13} />
                </button>
              </>
            )}
          </div>

          {/* Focus Tomorrow */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={15} style={{ color: 'var(--text-subtle)' }} />
                Focus Tomorrow
              </div>
            </div>
            {focusTomorrow.length === 0 ? (
              <div className="empty-state">
                <AlertCircle size={26} className="empty-state-icon" />
                <div className="empty-state-title">No insights yet</div>
                <div className="empty-state-desc">Log more matches to surface secondary patterns.</div>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {focusTomorrow.map((item, i) => (
                  <li
                    key={item.name}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{i + 2}. {item.name}</span>
                    <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>×{item.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Scrim performance */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={15} style={{ color: 'var(--text-subtle)' }} />
                Scrim Performance
              </div>
            </div>
            {scrimStats.scrimCount === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No scrims logged</div>
                <div className="empty-state-desc">Track scrim and tournament matches to see win rate and K/D.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                <Mini label="Win rate" value={`${scrimStats.winRate}%`} />
                <Mini label="K/D" value={scrimStats.kd} />
                <Mini label="Scrims" value={scrimStats.scrimCount} />
                <Mini label="Avg dmg" value={avgDamage || '—'} />
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function Mini({ label, value }) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 12px',
      }}
    >
      <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontWeight: 400, fontSize: 22, letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
