import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Flame, AlertTriangle, Crosshair, Target, ChevronRight,
  Clock, Calendar, Activity, ArrowRight, Brain, Shield,
  BarChart2, Zap, Star, Trophy, Sparkles, TrendingUp,
  Plus, MapPin, Car, Settings,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import FeaturedTournamentCard from '../components/dashboard/FeaturedTournamentCard.jsx'
import TodaysScheduleCard from '../components/dashboard/TodaysScheduleCard.jsx'
import { useStats } from '../hooks/useStats.js'
import { useStreak } from '../hooks/useStreak.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useModules } from '../hooks/useModules.js'
import { useAuth } from '../context/AuthContext.jsx'
import { STORAGE_KEYS } from '../utils/constants.js'
import {
  formatRelative, formatDuration, dateKey, normalizeSessions, greeting,
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

  const scrimStats = useMemo(() => {
    const list = activeMatches.filter(m => m.type === 'Scrims' || m.type === 'Tournament')
    const total = list.length
    const top3 = list.filter(m => Number(m.teamPosition) > 0 && Number(m.teamPosition) <= 3).length
    const winRate = total > 0 ? Math.round((top3 / total) * 100) : 0
    const totalKills = activeMatches.reduce((s, m) =>
      s + (m.type === 'Classic' ? Number(m.kills) || 0 : Number(m.individualKills) || 0), 0)
    const kd = activeMatches.length > 0 ? (totalKills / activeMatches.length).toFixed(2) : '0.00'
    const hsKills = activeMatches.reduce((s, m) => s + (Number(m.headshotKills) || 0), 0)
    const hsPct = totalKills > 0 ? Math.round((hsKills / totalKills) * 100) : 0
    return { winRate, kd, scrimCount: total, hsPct }
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

  const displayName = getDisplayName()
  const xp          = fsXP ?? 0
  const xpToday     = Math.min(xp % 500, 999)
  const levelNum    = fsLevel ?? 0
  const levelName   = getLevelName(levelNum)
  const floor       = XP_PER_LEVEL[levelNum] ?? 0
  const ceil        = XP_PER_LEVEL[levelNum + 1] ?? floor
  const xpPct       = ceil > floor ? Math.round(Math.min(1, (xp - floor) / (ceil - floor)) * 100) : 100
  const xpToNext    = Math.max(0, ceil - xp)
  const nextLevelName = getLevelName(levelNum + 1)
  const xpBarPct    = Math.min(100, Math.round((xp % 500) / 500 * 100))

  /* Weekly performance chart data */
  const weeklyChartData = useMemo(() => {
    const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    return activityGrid.slice(-7).map((d, i) => ({
      day: dayLabels[i] || d.dayLabel,
      value: Math.min(100, d.drills * 20 + d.matches * 15 + (d.duration > 0 ? 10 : 0)),
    }))
  }, [activityGrid])

  /* Maps played this week */
  const mapsThisWeek = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
    const maps = new Set()
    activeMatches.forEach(m => {
      if (m.timestamp && new Date(m.timestamp) > cutoff && m.mapName) maps.add(m.mapName)
    })
    return maps.size
  }, [activeMatches])

  /* Sessions this week */
  const sessionsThisWeek = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
    return activeSessions.filter(s => s.timestamp && new Date(s.timestamp) > cutoff).length
  }, [activeSessions])

  /* Practice time this week */
  const practiceTimeWeek = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
    const secs = activeSessions
      .filter(s => s.timestamp && new Date(s.timestamp) > cutoff)
      .reduce((sum, s) => sum + (Number(s.durationSeconds) || 0), 0)
    if (secs === 0) return '0m'
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60)
    if (h > 0 && m > 0) return `${h}h ${m}m`
    if (h > 0) return `${h}h`
    return `${m}m`
  }, [activeSessions])

  /* Matches this week */
  const matchesThisWeek = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
    return activeMatches.filter(m => m.timestamp && new Date(m.timestamp) > cutoff).length
  }, [activeMatches])

  /* Recent activity: last 5 across sessions + matches */
  const recentActivity = useMemo(() => {
    const sessionItems = (activeSessions || []).map(s => ({
      type: 'session',
      id: s.id || Math.random(),
      timestamp: s.timestamp,
      title: s.drillName || 'Training Session',
      sub: s.module || 'Training',
      xp: s.xp || 80,
      duration: s.durationSeconds,
    }))
    const matchItems = (activeMatches || []).map(m => ({
      type: 'match',
      id: m.id || Math.random(),
      timestamp: m.timestamp,
      title: m.mapName || 'Match',
      sub: m.type || 'Classic',
      position: m.teamPosition,
      kills: m.kills || m.individualKills || 0,
    }))
    return [...sessionItems, ...matchItems]
      .filter(a => a.timestamp)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5)
  }, [activeSessions, activeMatches])

  if (dataLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="splash-bar-track" style={{ width: 200 }}><div className="splash-bar-fill" /></div>
      </div>
    )
  }

  return (
    <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

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

      {/* ══ TOP GREETING + STATS ══════════════════════════════ */}
      <div style={{ paddingBottom: 4 }}>
        <div style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14,
          color: '#94A3B8', marginBottom: 4,
        }}>
          {greeting()},
        </div>
        <div style={{
          fontFamily: 'Oxanium, sans-serif', fontWeight: 800,
          fontSize: 'clamp(32px, 4vw, 48px)',
          fontStyle: 'italic', textTransform: 'uppercase',
          color: '#F8FAFC', lineHeight: 1,
          marginBottom: 14,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {displayName}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <TopPill icon={<TrendingUp size={13} color="#22C55E" />} label="Top 18% this week" />
          <TopPill icon={<Zap size={13} color="#22D3EE" />} label={`+${xpToday} XP today`} />
          <TopPill icon={<Flame size={13} color="#F59E0B" />} label={`${displayStreak} day streak`} />
        </div>
      </div>

      {/* ══ ROW 1: BANNER + NEXT REWARD ══════════════════════ */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }} className="row1-grid">

        {/* Featured Banner */}
        <div style={{
          flex: 1, height: 220,
          borderRadius: 16, overflow: 'hidden',
          position: 'relative',
          border: '1px solid #1B2A45',
          background: '#0D1528',
        }}>
          <img
            src="/assets/dashboard-hero.png"
            alt=""
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center center',
              display: 'block', opacity: 1,
            }}
          />
          {/* Dark gradient + CTA button */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '20px 24px', zIndex: 10,
            background: 'linear-gradient(to top, rgba(5,8,22,0.92) 0%, rgba(5,8,22,0.4) 70%, transparent 100%)',
          }}>
            <button
              onClick={() => navigate('/training')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(13,21,40,0.85)',
                border: '1px solid #1B2A45',
                borderRadius: 8, padding: '8px 16px',
                fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 13,
                color: '#F8FAFC', cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                transition: 'border-color 0.2s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#3B82F6'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#1B2A45'}
            >
              <Target size={14} color="#3B82F6" />
              Go to Training Center
            </button>
          </div>
        </div>

        {/* Today's Focus Card */}
        <div style={{
          width: 280, flexShrink: 0, height: 220,
          background: '#0D1528', border: '1px solid #1B2A45',
          borderRadius: 16, padding: 20,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 11,
            color: '#94A3B8', letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            Today's Focus
          </div>

          {priorityFocus ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.25))',
                }}>
                  <AlertTriangle size={22} color="#EF4444" />
                </div>
                <div>
                  <div style={{
                    fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 18,
                    color: '#F8FAFC', lineHeight: 1.2,
                  }}>
                    {priorityFocus.name}
                  </div>
                  <div style={{
                    fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 12,
                    color: '#EF4444', marginTop: 2,
                  }}>
                    Flagged {priorityFocus.count}× in matches
                  </div>
                </div>
              </div>
              <div style={{
                fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 13,
                color: '#94A3B8', lineHeight: 1.5, flex: 1,
              }}>
                {priorityModule
                  ? `Drill "${priorityModule.name}" to address this weakness.`
                  : 'Hit the Training Center and run targeted drills on this area.'}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'rgba(34,211,238,0.12)',
                  border: '1px solid rgba(34,211,238,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Brain size={22} color="#22D3EE" />
                </div>
                <div style={{
                  fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 18,
                  color: '#F8FAFC', lineHeight: 1.2,
                }}>
                  Log Matches
                </div>
              </div>
              <div style={{
                fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 13,
                color: '#94A3B8', lineHeight: 1.5, flex: 1,
              }}>
                Log a few matches to unlock AI-powered focus recommendations.
              </div>
            </>
          )}

          <button
            onClick={() => navigate('/training')}
            style={{
              marginTop: 'auto', width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(34,211,238,0.15) 100%)',
              border: '1px solid rgba(59,130,246,0.4)',
              borderRadius: 8, padding: '10px',
              fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13,
              color: '#93C5FD', cursor: 'pointer',
              transition: 'border-color 0.2s ease, color 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.color = '#F8FAFC' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; e.currentTarget.style.color = '#93C5FD' }}
          >
            <Target size={14} /> Start Training
          </button>
        </div>
      </div>

      {/* ══ ROW 2: PERFORMANCE + QUICK STATS + CALENDAR ══════ */}
      <div style={{ display: 'flex', gap: 16 }} className="row2-grid">

        {/* Performance Overview */}
        <div style={{
          flex: 1.5, background: '#0D1528', border: '1px solid #1B2A45',
          borderRadius: 12, padding: 20, minWidth: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{
              fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 12,
              color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.10em',
            }}>
              Performance Overview
            </span>
            <select style={{
              background: '#101A30', border: '1px solid #1B2A45',
              borderRadius: 6, padding: '4px 8px',
              fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 12,
              color: '#CBD5E1', cursor: 'pointer', outline: 'none',
            }}>
              <option>This Week</option>
              <option>Last Week</option>
            </select>
          </div>

          <div style={{ position: 'relative', marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={weeklyChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1B2A45" />
                <XAxis
                  dataKey="day"
                  tick={{ fontFamily: 'Inter', fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={v => `${v}%`}
                  tick={{ fontFamily: 'Inter', fontSize: 10, fill: '#94A3B8' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#101A30', border: '1px solid #1B2A45',
                    borderRadius: 8, fontFamily: 'Inter', fontSize: 12,
                  }}
                  formatter={v => [`${v}%`, 'Activity']}
                  labelStyle={{ color: '#94A3B8' }}
                  itemStyle={{ color: '#3B82F6' }}
                />
                <Line
                  type="monotone" dataKey="value"
                  stroke="#3B82F6" strokeWidth={2}
                  dot={{ fill: '#3B82F6', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#22D3EE' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 4 mini stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <MiniStat label="K/D Ratio"    value={scrimStats.kd}         color="#3B82F6" />
            <MiniStat label="Accuracy"     value="—"                     color="#22D3EE" />
            <MiniStat label="Headshot %"   value={`${scrimStats.hsPct}%`} color="#7C3AED" />
            <MiniStat label="Win Rate"     value={`${scrimStats.winRate}%`} color="#22C55E" />
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{
          flex: 1, background: '#0D1528', border: '1px solid #1B2A45',
          borderRadius: 12, padding: 20, minWidth: 0,
        }}>
          <div style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 12,
            color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.10em',
            marginBottom: 16,
          }}>
            Quick Stats
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <QuickStatCard icon={<Clock size={16} color="#22D3EE" />}   label="Practice Time"   value={practiceTimeWeek} sub="This week" />
            <QuickStatCard icon={<Calendar size={16} color="#3B82F6" />} label="Sessions"        value={sessionsThisWeek} sub="This week" />
            <QuickStatCard icon={<Crosshair size={16} color="#EF4444" />} label="Matches"        value={matchesThisWeek} sub="This week" />
            <QuickStatCard icon={<MapPin size={16} color="#7C3AED" />}  label="Maps Played"     value={mapsThisWeek}    sub="This week" />
          </div>
        </div>

        {/* Activity Calendar */}
        <div style={{
          flex: 1, background: '#0D1528', border: '1px solid #1B2A45',
          borderRadius: 12, padding: 20, minWidth: 0,
        }}>
          <div style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 12,
            color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.10em',
            marginBottom: 2,
          }}>
            Activity Calendar
          </div>
          <div style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 11,
            color: '#94A3B8', marginBottom: 14,
          }}>
            14-Day Activity
          </div>

          {/* Day labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
            {['M','T','W','T','F','S','S'].map((l, i) => (
              <div key={i} style={{
                textAlign: 'center',
                fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#94A3B8',
              }}>
                {l}
              </div>
            ))}
          </div>

          {/* 7×2 grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {activityGrid.map(d => {
              const total = d.drills + d.matches
              const bg = total === 0 ? '#1B2A45' : total === 1 ? 'rgba(59,130,246,0.3)' : '#3B82F6'
              return (
                <div
                  key={d.key}
                  title={`${d.key}: ${total} activities`}
                  style={{
                    width: '100%', aspectRatio: '1/1',
                    borderRadius: 6, background: bg,
                    cursor: 'default',
                  }}
                />
              )
            })}
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex', gap: 10, marginTop: 12,
            fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#94A3B8',
          }}>
            {[['#3B82F6','Active'],['rgba(59,130,246,0.3)','Low'],['#1B2A45','None']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ ROW 3: MODULES + RECENT ACTIVITY + COACH AI ══════ */}
      <div style={{ display: 'flex', gap: 16 }} className="row3-grid">

        {/* Training Modules */}
        <div style={{
          flex: 1.5, background: '#0D1528', border: '1px solid #1B2A45',
          borderRadius: 12, padding: 20, minWidth: 0,
        }}>
          <div style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 12,
            color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.10em',
            marginBottom: 16,
          }}>
            Training Modules
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
            {[
              { name: 'ADS',         sub: 'Improve Aim',      Icon: Crosshair, color: '#3B82F6', grad: 'linear-gradient(135deg,rgba(59,130,246,0.25),rgba(59,130,246,0.08))' },
              { name: 'SPRAY',       sub: 'Control Recoil',   Icon: Flame,     color: '#22D3EE', grad: 'linear-gradient(135deg,rgba(34,211,238,0.25),rgba(34,211,238,0.08))' },
              { name: 'CAR SPRAY',   sub: 'Vehicle Spray',    Icon: Car,       color: '#7C3AED', grad: 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(124,58,237,0.08))' },
              { name: 'CLOSE RANGE', sub: 'Reflex Training',  Icon: Zap,       color: '#EF4444', grad: 'linear-gradient(135deg,rgba(239,68,68,0.25),rgba(239,68,68,0.08))' },
            ].map(({ name, sub, Icon, color, grad }) => (
              <div
                key={name}
                onClick={() => navigate('/training')}
                style={{
                  background: '#101A30', border: '1px solid #1B2A45',
                  borderRadius: 10, padding: 16,
                  textAlign: 'center', cursor: 'pointer',
                  transition: 'border-color 0.2s ease, transform 0.15s ease',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1B2A45'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: grad,
                  border: `1px solid ${color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  filter: `drop-shadow(0 2px 8px ${color}40)`,
                }}>
                  <Icon size={20} color={color} />
                </div>
                <div style={{
                  fontFamily: 'Oxanium, sans-serif', fontWeight: 600, fontSize: 13,
                  color: '#F8FAFC',
                }}>
                  {name}
                </div>
                <div style={{
                  fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 11,
                  color: '#94A3B8',
                }}>
                  {sub}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/training')}
            style={{
              width: '100%', padding: '10px',
              background: 'transparent', border: '1px dashed #1B2A45',
              borderRadius: 8, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 13,
              color: '#94A3B8',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'border-color 0.2s ease, color 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.color = '#F8FAFC' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1B2A45'; e.currentTarget.style.color = '#94A3B8' }}
          >
            <Plus size={15} /> Custom Module
          </button>
        </div>

        {/* Recent Activity */}
        <div style={{
          flex: 1, background: '#0D1528', border: '1px solid #1B2A45',
          borderRadius: 12, padding: 20, minWidth: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{
              fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 12,
              color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.10em',
            }}>
              Recent Activity
            </span>
            <Link to="/training" style={{
              fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#3B82F6',
              display: 'flex', alignItems: 'center', gap: 2, textDecoration: 'none',
            }}>
              View All <ArrowRight size={12} />
            </Link>
          </div>

          {recentActivity.length === 0 ? (
            <div style={{
              textAlign: 'center', paddingTop: 32,
              fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#94A3B8',
            }}>
              No activity yet. Start training!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recentActivity.map((item, i) => (
                <div key={item.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: item.type === 'session' ? 'rgba(59,130,246,0.12)' : 'rgba(124,58,237,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {item.type === 'session'
                      ? <Target size={16} color="#3B82F6" />
                      : <Crosshair size={16} color="#7C3AED" />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 13,
                      color: '#F8FAFC',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {item.title}
                    </div>
                    <div style={{
                      fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 12,
                      color: '#94A3B8',
                    }}>
                      {item.sub}{item.duration ? ` · ${formatDuration(item.duration)}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {item.type === 'session' ? (
                      <div style={{
                        fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 12,
                        color: '#22C55E',
                      }}>
                        +{item.xp} XP
                      </div>
                    ) : (
                      <div style={{
                        fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 12,
                        color: '#3B82F6',
                      }}>
                        #{item.position || '—'}/{item.kills || 0}K
                      </div>
                    )}
                    <div style={{
                      fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 11,
                      color: '#64748B',
                    }}>
                      {formatRelative(item.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coach AI Insights */}
        <div style={{
          flex: 1, background: '#0D1528', border: '1px solid #1B2A45',
          borderRadius: 12, padding: 20, minWidth: 0,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{
              fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 12,
              color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.10em',
            }}>
              Coach AI Insights
            </span>
            <span style={{
              background: 'rgba(124,58,237,0.2)', color: '#7C3AED',
              fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 10,
              borderRadius: 999, padding: '3px 8px',
              border: '1px solid rgba(124,58,237,0.3)',
            }}>
              BETA
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(124,58,237,0.15)',
              border: '1px solid rgba(124,58,237,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Brain size={24} color="#7C3AED" />
            </div>
            <div style={{
              fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14,
              color: heatmapData.length > 0 ? '#CBD5E1' : '#94A3B8', lineHeight: 1.6,
              flex: 1,
            }}>
              {heatmapData.length > 0
                ? `Focus on your ${heatmapData[0].name.toLowerCase()} performance. You've flagged this ${heatmapData[0].count}× — drill it consistently.`
                : 'Log matches to unlock AI insights.'
              }
            </div>
          </div>

          {heatmapData.length > 0 && (
            <div style={{
              borderTop: '1px solid #1B2A45',
              marginTop: 'auto', paddingTop: 16,
            }}>
              <div style={{
                fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 12,
                color: '#94A3B8', marginBottom: 8,
              }}>
                Recommended Drill
              </div>
              <div
                onClick={() => navigate('/training')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span style={{
                  fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14,
                  color: '#F8FAFC',
                }}>
                  {priorityModule?.name || heatmapData[0]?.name || 'Training Center'}
                </span>
                <ChevronRight size={16} color="#3B82F6" />
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .row2-grid, .row3-grid { flex-direction: column !important; }
        }
        @media (max-width: 700px) {
          .row1-grid { flex-direction: column !important; }
          .row1-grid > div:last-child { width: 100% !important; height: auto !important; }
        }
      `}</style>
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────── */
function TopPill({ icon, label }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'rgba(13,21,40,0.6)',
      border: '1px solid #1B2A45',
      borderRadius: 20, padding: '5px 12px',
      fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 13,
      color: '#CBD5E1', whiteSpace: 'nowrap',
    }}>
      {icon}{label}
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily: 'Oxanium, sans-serif', fontWeight: 600, fontSize: 18,
        color: color || '#F8FAFC', lineHeight: 1, marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 11,
        color: '#94A3B8',
      }}>
        {label}
      </div>
    </div>
  )
}

function QuickStatCard({ icon, label, value, sub }) {
  return (
    <div style={{
      background: '#101A30', border: '1px solid #1B2A45',
      borderRadius: 8, padding: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {icon}
        <span style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 11,
          color: '#94A3B8',
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 20,
        color: '#F8FAFC', lineHeight: 1, marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 11,
        color: '#94A3B8',
      }}>
        {sub}
      </div>
    </div>
  )
}
