import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Flame, AlertTriangle, Crosshair, Target, ChevronRight,
  Clock, Calendar, Activity, ArrowRight, Brain, Shield,
  BarChart2, Zap, Star, Trophy, Sparkles,
} from 'lucide-react'
import FeaturedTournamentCard from '../components/dashboard/FeaturedTournamentCard.jsx'
import TodaysScheduleCard from '../components/dashboard/TodaysScheduleCard.jsx'
import { useStats } from '../hooks/useStats.js'
import { useStreak } from '../hooks/useStreak.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useModules } from '../hooks/useModules.js'
import { useAuth } from '../context/AuthContext.jsx'
import { STORAGE_KEYS } from '../utils/constants.js'
import {
  formatRelative, formatDuration, dateKey, normalizeSessions,
} from '../utils/helpers.js'
import { getDisplayName } from '../utils/storage.js'
import { getTrialStatus } from '../utils/trial.js'
import { useUserData } from '../hooks/useUserData.js'
import { getLevelName, XP_PER_LEVEL } from '../utils/db.js'

/* ============================================================
   DATA HELPERS (preserved — logic unchanged)
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
    if      (count >= 5) { status = 'High Priority'; color = 'var(--danger)'; percentage = 90 }
    else if (count >= 3) { status = 'High Priority'; color = 'var(--danger)'; percentage = 75 }
    else if (count >= 2) { status = 'Weak';          color = 'var(--amber)';  percentage = 55 }
    else if (count === 1){ status = 'Improving';     color = 'var(--gold)';   percentage = 30 }
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

/* Build a 14-day activity grid (3 rows: drills, matches, time) */
function buildActivityGrid(sessions, matches) {
  const days = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const key = d.toISOString().split('T')[0]
    days.push({ key, date: d, dayLabel: ['S','M','T','W','T','F','S'][d.getDay()] })
  }

  const sessionMap = {}
  ;(sessions || []).forEach(s => {
    if (!s.timestamp) return
    const k = new Date(s.timestamp).toISOString().split('T')[0]
    if (!sessionMap[k]) sessionMap[k] = { drills: 0, duration: 0 }
    sessionMap[k].drills++
    sessionMap[k].duration += Number(s.durationSeconds) || 0
  })
  const matchMap = {}
  ;(matches || []).forEach(m => {
    if (!m.timestamp) return
    const k = new Date(m.timestamp).toISOString().split('T')[0]
    matchMap[k] = (matchMap[k] || 0) + 1
  })

  return days.map(d => ({
    ...d,
    drills:   sessionMap[d.key]?.drills   || 0,
    duration: sessionMap[d.key]?.duration || 0,
    matches:  matchMap[d.key]             || 0,
  }))
}

function activityColor(value, max) {
  if (!value || value === 0) return 'var(--border)'
  const ratio = Math.min(1, value / Math.max(1, max))
  if (ratio < 0.33) return 'rgba(59,130,246,0.25)'
  if (ratio < 0.67) return 'rgba(59,130,246,0.55)'
  return '#3B82F6'
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

  const activeMatches  = (Array.isArray(fsMatches)  && fsMatches.length  > 0) ? fsMatches  : (Array.isArray(lsMatches)  ? lsMatches  : [])
  const activeSessions = (Array.isArray(fsSessions) && fsSessions.length > 0) ? fsSessions : normalizeSessions(sessionsRaw)

  const fsStreakCount  = fsProfile?.streak?.count ?? 0
  const displayStreak  = fsStreakCount > 0 ? fsStreakCount : (streak.current || 0)

  const weeklyConsistency = useMemo(() => calculateWeeklyConsistency(activeSessions), [activeSessions])
  const heatmapData    = useMemo(() => calculateHeatmap(activeMatches, suggestions),     [activeMatches, suggestions])
  const weaknessFreq   = useMemo(() => getWeaknessFrequency(activeMatches, suggestions), [activeMatches, suggestions])
  const priorityFocus  = weaknessFreq[0] || null
  const activityGrid   = useMemo(() => buildActivityGrid(activeSessions, activeMatches),  [activeSessions, activeMatches])

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

  const xp       = fsXP ?? 0
  const levelNum  = fsLevel ?? 0
  const levelName = getLevelName(levelNum)
  const floor     = XP_PER_LEVEL[levelNum] ?? 0
  const ceil      = XP_PER_LEVEL[levelNum + 1] ?? floor
  const xpPct     = ceil > floor ? Math.round(Math.min(1, (xp - floor) / (ceil - floor)) * 100) : 100
  const xpToNext  = Math.max(0, ceil - xp)
  const nextLevelName = getLevelName(levelNum + 1)

  const maxDrills   = Math.max(1, ...activityGrid.map(d => d.drills))
  const maxMatches  = Math.max(1, ...activityGrid.map(d => d.matches))
  const maxDuration = Math.max(1, ...activityGrid.map(d => d.duration))

  /* Top 3 modules as drill recommendations */
  const drillCards = useMemo(() => {
    const top = modules.slice(0, 3)
    const types = ['Recommended', 'High Priority', 'Suggested']
    const colors = ['var(--cyan)', 'var(--danger)', 'var(--green)']
    const bgColors = ['rgba(34,211,238,0.1)', 'rgba(239,68,68,0.1)', 'rgba(34,197,94,0.1)']
    return top.map((m, i) => ({
      name: m.name,
      type: types[i] || 'Suggested',
      color: colors[i] || 'var(--green)',
      bgColor: bgColors[i] || 'rgba(34,197,94,0.1)',
      duration: 15 + i * 5,
      xp: 80 - i * 10,
    }))
  }, [modules])

  if (dataLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="splash-bar-track" style={{ width: 200 }}><div className="splash-bar-fill" /></div>
      </div>
    )
  }

  return (
    <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Trial expired banner */}
      {trial?.expired && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center',
          background: 'var(--danger-tint)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 10,
          padding: '14px 18px',
        }}>
          <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
              Your free trial has ended.
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-subtle)', fontSize: 13, marginTop: 2 }}>
              All your data is safe. Premium plan coming soon.
            </div>
          </div>
        </div>
      )}

      {/* ══ HERO BANNER ══════════════════════════════════════ */}
      {/* Image is 1672x941 (16:9). Height capped at 280px per 16:9 rule. */}
      <div style={{
        width: '100%', height: '280px',
        borderRadius: 16, overflow: 'hidden',
        position: 'relative',
        border: '1px solid #1B2A45',
      }}>
        <img
          src="/assets/dashboard-hero.png"
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            display: 'block',
            opacity: 1,
          }}
        />

        {/* Corner text */}
        <div style={{
          position: 'absolute', bottom: 16, left: 20, zIndex: 10,
          fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 12,
          color: '#FFFFFF', letterSpacing: '0.12em', textTransform: 'uppercase',
          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
        }}>
          India's #1 BGMI Training Platform
        </div>
      </div>

      {/* ══ XP PROGRESS ═════════════════════════════════════ */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '20px 24px',
        display: 'flex',
        gap: 20,
        alignItems: 'stretch',
        flexWrap: 'wrap',
      }}>
        {/* Left: XP bar */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <span style={{
              fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 11,
              color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.10em',
            }}>
              XP Progress — {levelName}
            </span>
            <span style={{
              fontFamily: 'Oxanium, sans-serif', fontWeight: 600, fontSize: 13,
              color: 'var(--text-subtle)',
            }}>
              {xp.toLocaleString()} / {(ceil || xp).toLocaleString()} XP
            </span>
          </div>

          {/* Bar */}
          <div style={{
            width: '100%', height: 8,
            background: 'var(--border)', borderRadius: 4,
            overflow: 'hidden', marginBottom: 8,
          }}>
            <div style={{
              height: '100%', width: `${xpPct}%`,
              background: 'var(--blue)',
              borderRadius: 4,
              boxShadow: '0 0 12px rgba(59,130,246,0.5)',
              transition: 'width 0.5s ease',
            }} />
          </div>

          <span style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 13,
            color: 'var(--text-subtle)',
          }}>
            {xpToNext.toLocaleString()} XP to{' '}
            <span style={{ color: 'var(--blue)', fontWeight: 500 }}>{nextLevelName}</span>
          </span>
        </div>

        {/* Right: Next Reward card */}
        <div style={{
          background: 'var(--card2)',
          border: '1px solid var(--border)',
          borderRadius: 8, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          flexShrink: 0, minWidth: 200,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(245,158,11,0.15)',
            border: '1px solid rgba(245,158,11,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Star size={18} style={{ color: 'var(--gold)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 10,
              color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.10em',
              marginBottom: 2,
            }}>
              Next Reward
            </div>
            <div style={{
              fontFamily: 'Oxanium, sans-serif', fontWeight: 600, fontSize: 15,
              color: 'var(--text-primary)',
            }}>
              {nextLevelName}
            </div>
            <div style={{
              fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 11,
              color: 'var(--text-subtle)',
            }}>
              Unlock new drills
            </div>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
        </div>
      </div>

      {/* ══ 4 STAT CARDS ════════════════════════════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 14,
      }}>
        <StatCard
          icon={<Flame size={22} />}
          iconBg="rgba(245,158,11,0.12)"
          iconBorder="rgba(245,158,11,0.25)"
          iconColor="var(--amber)"
          label="Current Streak"
          value={`${displayStreak}D`}
          sub="Keep it up!"
          subColor="var(--green)"
        />
        <StatCard
          icon={<Clock size={22} />}
          iconBg="rgba(34,211,238,0.12)"
          iconBorder="rgba(34,211,238,0.25)"
          iconColor="var(--cyan)"
          label="Practice Time"
          value={practiceTime}
          sub={`${weeklyConsistency.days}/7 days active`}
          subColor="var(--text-subtle)"
        />
        <StatCard
          icon={<Calendar size={22} />}
          iconBg="rgba(59,130,246,0.12)"
          iconBorder="rgba(59,130,246,0.25)"
          iconColor="var(--blue)"
          label="Sessions"
          value={stats.totalSessions}
          sub={activeMatches.length > 0 ? `+${Math.min(stats.totalSessions, 2)} vs yesterday` : 'Start training'}
          subColor="var(--green)"
        />
        <StatCard
          icon={<Crosshair size={22} />}
          iconBg="rgba(124,58,237,0.12)"
          iconBorder="rgba(124,58,237,0.25)"
          iconColor="var(--violet)"
          label="Matches"
          value={activeMatches.length}
          sub={scrimStats.scrimCount > 0 ? `${scrimStats.winRate}% Win Rate` : 'Log your matches'}
          subColor={scrimStats.scrimCount > 0 ? 'var(--green)' : 'var(--text-subtle)'}
        />
      </div>

      {/* ══ ACTIVITY GRID + COACH AI (2-col) ════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }} className="activity-coach-grid">

        {/* Activity Grid */}
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '20px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={14} style={{ color: 'var(--blue)' }} />
              <span style={{
                fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 11,
                color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.10em',
              }}>
                Activity · Last 14 Days
              </span>
            </div>
            <Link to="/analytics" style={{
              fontFamily: 'Inter, sans-serif', fontSize: 12,
              color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              View full analytics <ChevronRight size={12} />
            </Link>
          </div>

          {/* Row labels */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <div style={{ width: 52, flexShrink: 0 }} />
            {activityGrid.map(d => (
              <div key={d.key} style={{
                flex: 1, textAlign: 'center',
                fontFamily: 'Inter, sans-serif', fontSize: 9,
                color: 'var(--text-subtle)', fontWeight: 500,
                letterSpacing: '0.04em',
              }}>
                {d.dayLabel}
              </div>
            ))}
          </div>

          {/* Grid rows: Drills, Matches, Time */}
          {[
            { label: 'DRILLS',  key: 'drills',   max: maxDrills },
            { label: 'MATCHES', key: 'matches',  max: maxMatches },
            { label: 'TIME',    key: 'duration', max: maxDuration },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
              <div style={{
                width: 52, flexShrink: 0,
                fontFamily: 'Inter, sans-serif', fontSize: 9,
                color: 'var(--text-subtle)', fontWeight: 500,
                letterSpacing: '0.06em', textAlign: 'right', paddingRight: 8,
              }}>
                {row.label}
              </div>
              {activityGrid.map(d => (
                <div
                  key={d.key}
                  title={`${d.key}: ${row.key === 'duration' ? formatDuration(d[row.key]) : d[row.key] + ' ' + row.label.toLowerCase()}`}
                  style={{
                    flex: 1, aspectRatio: '1/1',
                    minHeight: 14, maxHeight: 28,
                    borderRadius: 4,
                    background: activityColor(d[row.key], row.max),
                    transition: 'transform 0.1s ease',
                    cursor: 'default',
                  }}
                />
              ))}
            </div>
          ))}

          {/* Legend */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginTop: 10, justifyContent: 'flex-end',
          }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--text-subtle)' }}>Less</span>
            {['var(--border)', 'rgba(59,130,246,0.25)', 'rgba(59,130,246,0.55)', '#3B82F6'].map((c, i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: 2, background: c,
              }} />
            ))}
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--text-subtle)' }}>More</span>
          </div>
        </div>

        {/* Coach AI + Priority Focus */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Coach AI */}
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '18px',
            flex: 1,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={14} style={{ color: 'var(--cyan)' }} />
                <span style={{
                  fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 11,
                  color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.10em',
                }}>
                  Coach AI
                </span>
              </div>
              {heatmapData.length > 0 && (
                <span style={{
                  background: 'rgba(124,58,237,0.15)',
                  border: '1px solid rgba(124,58,237,0.3)',
                  borderRadius: 999, padding: '3px 8px',
                  fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 10,
                  color: 'var(--violet)',
                }}>
                  NEW INSIGHTS
                </span>
              )}
            </div>

            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 12,
            }}>
              <Brain size={22} style={{ color: 'var(--violet)' }} />
            </div>

            {heatmapData.length === 0 ? (
              <div>
                <div style={{
                  fontFamily: 'Oxanium, sans-serif', fontWeight: 600, fontSize: 14,
                  color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.4,
                }}>
                  Log matches to unlock AI insights.
                </div>
                <div style={{
                  fontFamily: 'Inter, sans-serif', fontSize: 13,
                  color: 'var(--text-subtle)', lineHeight: 1.6,
                }}>
                  Track your weaknesses in the Match Logger to get personalised coaching.
                </div>
              </div>
            ) : (
              <div>
                <div style={{
                  fontFamily: 'Oxanium, sans-serif', fontWeight: 600, fontSize: 14,
                  color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.4,
                }}>
                  {`Your ${heatmapData[0]?.name || 'close-range'} performance needs focus.`}
                </div>
                <ul style={{
                  listStyle: 'none', margin: 0, padding: 0,
                  display: 'flex', flexDirection: 'column', gap: 6,
                  marginBottom: 12,
                }}>
                  {heatmapData.slice(0, 3).map(skill => (
                    <li key={skill.name} style={{
                      fontFamily: 'Inter, sans-serif', fontSize: 12,
                      color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: skill.color, flexShrink: 0,
                      }} />
                      {skill.name} — flagged {skill.count}×
                    </li>
                  ))}
                </ul>
                {priorityModule && (
                  <div style={{
                    fontFamily: 'Inter, sans-serif', fontSize: 12,
                    color: 'var(--green)', marginBottom: 12,
                  }}>
                    Estimated improvement: drill {priorityModule.name}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => navigate('/training')}
              style={{
                width: '100%', padding: '10px',
                background: 'linear-gradient(135deg, var(--blue-bright) 0%, var(--blue) 100%)',
                color: '#fff',
                fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 13,
                borderRadius: 8, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              View Full Analysis <ArrowRight size={14} />
            </button>
          </div>

          {/* Priority Focus */}
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '16px',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <span style={{
                fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 11,
                color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.10em',
              }}>
                Priority Focus
              </span>
              <span style={{
                background: 'rgba(245,158,11,0.15)',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 999, padding: '2px 8px',
                fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 10,
                color: 'var(--amber)',
              }}>
                TOP
              </span>
            </div>

            {!priorityFocus ? (
              <div style={{
                fontFamily: 'Inter, sans-serif', fontSize: 13,
                color: 'var(--text-subtle)', lineHeight: 1.5,
              }}>
                Log 3+ matches to surface your priority area.
              </div>
            ) : (
              <>
                <div style={{
                  fontFamily: 'Oxanium, sans-serif', fontWeight: 600, fontSize: 15,
                  color: 'var(--text-primary)', marginBottom: 4,
                }}>
                  {priorityFocus.name}
                </div>
                <div style={{
                  fontFamily: 'Inter, sans-serif', fontSize: 12,
                  color: 'var(--text-subtle)', marginBottom: 10,
                }}>
                  Focus area for max improvement
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Impact score</span>
                    <span style={{ fontFamily: 'Oxanium, sans-serif', fontSize: 12, color: 'var(--blue)', fontWeight: 600 }}>
                      {Math.min(99, priorityFocus.count * 18)}%
                    </span>
                  </div>
                  <div style={{
                    width: '100%', height: 4, background: 'var(--border)', borderRadius: 2,
                  }}>
                    <div style={{
                      width: `${Math.min(99, priorityFocus.count * 18)}%`,
                      height: '100%', background: 'var(--blue)', borderRadius: 2,
                      boxShadow: '0 0 6px rgba(59,130,246,0.4)',
                    }} />
                  </div>
                </div>
                <button
                  onClick={startPriorityDrill}
                  style={{
                    width: '100%', padding: '8px',
                    background: 'transparent',
                    border: '1px solid var(--blue)',
                    color: 'var(--blue)',
                    fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 12,
                    borderRadius: 6, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  Start Drill <ArrowRight size={13} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══ TODAY'S TRAINING ════════════════════════════════ */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <span style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 11,
            color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.10em',
          }}>
            Today's Training Recommendations
          </span>
          <Link to="/training" style={{
            fontFamily: 'Inter, sans-serif', fontSize: 12,
            color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            View all drills <ChevronRight size={12} />
          </Link>
        </div>

        {drillCards.length === 0 ? (
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '28px',
            textAlign: 'center',
          }}>
            <Target size={28} style={{ color: 'var(--text-subtle)', opacity: 0.4, marginBottom: 8 }} />
            <div style={{
              fontFamily: 'Oxanium, sans-serif', fontWeight: 600, fontSize: 14,
              color: 'var(--text-subtle)', marginBottom: 6,
            }}>
              No modules set up yet
            </div>
            <button onClick={() => navigate('/training')} className="btn btn-primary btn-sm">
              Go to Training Center
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}>
            {drillCards.map((drill, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '16px',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease',
                }}
                onClick={() => navigate('/training')}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--divider)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: 'rgba(59,130,246,0.12)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Target size={20} style={{ color: 'var(--blue)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'Oxanium, sans-serif', fontWeight: 600, fontSize: 14,
                    color: 'var(--text-primary)', marginBottom: 6,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {drill.name}
                  </div>
                  <span style={{
                    display: 'inline-block',
                    background: drill.bgColor,
                    border: `1px solid ${drill.color}40`,
                    borderRadius: 999, padding: '2px 8px',
                    fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 10,
                    color: drill.color, marginBottom: 6,
                  }}>
                    {drill.type}
                  </span>
                  <div style={{
                    fontFamily: 'Inter, sans-serif', fontSize: 12,
                    color: 'var(--text-subtle)',
                  }}>
                    {drill.duration} min · +{drill.xp} XP
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ TODAY'S SCHEDULE ════════════════════════════════ */}
      <TodaysScheduleCard />

      {/* ══ FEATURED TOURNAMENT ══════════════════════════════ */}
      <FeaturedTournamentCard />

      {/* ══ RECENT SESSIONS ════════════════════════════════ */}
      {stats.recentSessions.length > 0 && (
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '20px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={14} style={{ color: 'var(--text-subtle)' }} />
              <span style={{
                fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 11,
                color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.10em',
              }}>
                Recent Sessions
              </span>
            </div>
            <Link to="/training" style={{
              fontFamily: 'Inter, sans-serif', fontSize: 12,
              color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Drill</th>
                <th>Module</th>
                <th>Duration</th>
                <th style={{ textAlign: 'right' }}>When</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentSessions.map(s => {
                const mod = modules.find(m => m.id === s.moduleId)
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.drillName}</td>
                    <td style={{ color: 'var(--text-subtle)' }}>{mod?.short || s.module || 'Training'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatDuration(s.durationSeconds)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-subtle)', fontSize: 12 }}>
                      {formatRelative(s.timestamp)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .activity-coach-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────── */
function StatCard({ icon, iconBg, iconBorder, iconColor, label, value, sub, subColor }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '20px',
      display: 'flex', alignItems: 'center', gap: 16,
      transition: 'border-color 0.2s ease',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: iconBg,
        border: `1px solid ${iconBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: iconColor, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 11,
          color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 4,
        }}>
          {label}
        </div>
        <div style={{
          fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 32,
          color: 'var(--text-primary)', lineHeight: 1,
          marginBottom: 4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {value}
        </div>
        <div style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 12,
          color: subColor || 'var(--text-subtle)',
        }}>
          {sub}
        </div>
      </div>
    </div>
  )
}
