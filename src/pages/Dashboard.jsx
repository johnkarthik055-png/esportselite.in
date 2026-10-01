import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Flame, AlertTriangle, Crosshair, Target, ChevronRight,
  Clock, Calendar, Activity, ArrowRight, Brain, Shield,
  BarChart2, Zap, Star, Trophy, Sparkles, TrendingUp,
  Plus, MapPin, Car, Settings, X, BookOpen, Map,
} from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription.js'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Area, AreaChart,
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
    if      (count >= 5) { status = 'High Priority'; color = '#EF3340'; percentage = 90 }
    else if (count >= 3) { status = 'High Priority'; color = '#EF3340'; percentage = 75 }
    else if (count >= 2) { status = 'Weak';          color = '#F59E0B'; percentage = 55 }
    else if (count === 1){ status = 'Improving';     color = '#F59E0B'; percentage = 30 }
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
   ANIMATION VARIANTS
   Strong ease-out per Emil Kowalski — cubic-bezier(0.23,1,0.32,1).
   Reduced-motion variants keep opacity, drop transform.
   ============================================================ */
const EO = [0.23, 1, 0.32, 1]

const ANIM = {
  hero: {
    hidden:  { opacity: 0, transform: 'translateY(20px)' },
    visible: { opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.5, ease: EO } },
  },
  heroReduced: {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
  },
  statsContainer: {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
  },
  statsContainerReduced: {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.04 } },
  },
  statsItem: {
    hidden:  { opacity: 0, transform: 'translateY(16px)' },
    visible: { opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.35, ease: EO } },
  },
  statsItemReduced: {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.15 } },
  },
}

/* ============================================================
   DASHBOARD
   ============================================================ */
export default function Dashboard() {
  const reduce = useReducedMotion()

  const [sessionsRaw] = useLocalStorage(STORAGE_KEYS.SESSIONS, [])
  const [lsMatches]   = useLocalStorage(STORAGE_KEYS.MATCHES, [])
  const [suggestions] = useLocalStorage(STORAGE_KEYS.SUGGESTIONS, [])
  const stats         = useStats()
  const streak        = useStreak()
  const { modules }   = useModules()
  const navigate      = useNavigate()
  const { user: authUser } = useAuth()

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
    const avgPlacement = activeMatches.length > 0
      ? (activeMatches.reduce((s, m) => s + (Number(m.teamPosition) || 0), 0) / activeMatches.length).toFixed(1)
      : '—'
    return { winRate, kd, scrimCount: total, hsPct, avgPlacement }
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

  const { isActive, loading: subLoading } = useSubscription()
  const [bannerDismissed, setBannerDismissed] = useState(
    () => localStorage.getItem('upgrade_banner_dismissed') === '1'
  )

  function dismissBanner() {
    localStorage.setItem('upgrade_banner_dismissed', '1')
    setBannerDismissed(true)
  }

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

  const weeklyChartData = useMemo(() => {
    const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    return activityGrid.slice(-7).map((d, i) => ({
      day: dayLabels[i] || d.dayLabel,
      value: Math.min(100, d.drills * 20 + d.matches * 15 + (d.duration > 0 ? 10 : 0)),
    }))
  }, [activityGrid])

  const mapsThisWeek = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
    const maps = new Set()
    activeMatches.forEach(m => {
      if (m.timestamp && new Date(m.timestamp) > cutoff && m.mapName) maps.add(m.mapName)
    })
    return maps.size
  }, [activeMatches])

  const sessionsThisWeek = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
    return activeSessions.filter(s => s.timestamp && new Date(s.timestamp) > cutoff).length
  }, [activeSessions])

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

  const matchesThisWeek = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
    return activeMatches.filter(m => m.timestamp && new Date(m.timestamp) > cutoff).length
  }, [activeMatches])

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

  /* Greeting time */
  const greetingUpper = (greeting() + ',').toUpperCase()

  if (dataLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="splash-bar-track" style={{ width: 200 }}><div className="splash-bar-fill" /></div>
      </div>
    )
  }

  /* Username split: all but last char normal, last char gradient */
  const nameUpper = (displayName || 'PLAYER').toUpperCase()
  const nameFront = nameUpper.slice(0, -1)
  const nameLast  = nameUpper.slice(-1)

  return (
    <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ══ HERO BANNER ══════════════════════════════════════════ */}
      <motion.div
        initial="hidden" animate="visible"
        variants={reduce ? ANIM.heroReduced : ANIM.hero}
        style={{
          width: '100%', height: 275, borderRadius: 18,
          position: 'relative', overflow: 'hidden',
          background: '#EAF2FF',
        }}
      >
        <img
          src="/assets/hero-banner.png"
          alt=""
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center center',
            display: 'block',
          }}
        />
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, rgba(248,250,255,0.92) 0%, rgba(248,250,255,0.6) 40%, transparent 70%)',
        }} />

        {/* Left hero content */}
        <div style={{
          position: 'absolute', left: 32, top: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <div style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 13,
            color: '#64748B', letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            {greetingUpper}
          </div>

          <div style={{
            fontFamily: 'Anton, sans-serif', fontSize: 64,
            color: '#0B1224', letterSpacing: '-1px', lineHeight: 1,
            textTransform: 'uppercase', marginBottom: 8,
          }}>
            {nameFront}
            <span style={{
              background: 'linear-gradient(90deg, #2563FF, #EF3340)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              {nameLast}
            </span>
          </div>

          <div style={{
            fontFamily: 'Inter, sans-serif', fontSize: 15,
            color: '#475569', marginBottom: 20,
          }}>
            Keep grinding. Consistency builds greatness.
          </div>

          {/* Stat pills */}
          <div className="hero-pills" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <HeroPill color="#16A34A" label={`Top 18% this week`} />
            <HeroPill color="#2563FF" label={`+${xpToday} XP today`} />
            <HeroPill color="#EF3340" label={`${displayStreak} day streak`} />
          </div>
        </div>
      </motion.div>

      {/* ══ QUICK STATS (4 cards) ════════════════════════════════ */}
      <motion.div
        className="stats-grid"
        initial="hidden" animate="visible"
        variants={reduce ? ANIM.statsContainerReduced : ANIM.statsContainer}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}
      >
        <QuickStatCard
          iconBg="#EAF2FF" icon={<Clock size={22} color="#2563FF" />}
          title="Practice Time" value={practiceTimeWeek} sub="This week"
          cardVariants={reduce ? ANIM.statsItemReduced : ANIM.statsItem}
        />
        <QuickStatCard
          iconBg="#FFF0F2" icon={<Calendar size={22} color="#EF3340" />}
          title="Sessions" value={sessionsThisWeek} sub="This week"
          cardVariants={reduce ? ANIM.statsItemReduced : ANIM.statsItem}
        />
        <QuickStatCard
          iconBg="#EAF2FF" icon={<BarChart2 size={22} color="#2563FF" />}
          title="Matches Logged" value={matchesThisWeek} sub="This week"
          cardVariants={reduce ? ANIM.statsItemReduced : ANIM.statsItem}
        />
        <QuickStatCard
          iconBg="#FFF0F2" icon={<Trophy size={22} color="#EF3340" />}
          title="Current Streak" value={`${displayStreak} days`} sub="Keep it going!"
          cardVariants={reduce ? ANIM.statsItemReduced : ANIM.statsItem}
        />
      </motion.div>

      {/* ══ MAIN 2-COL GRID ══════════════════════════════════════ */}
      <div className="main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

        {/* ── LEFT COLUMN ─────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

          {/* Performance Overview */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 20, color: '#0B1224' }}>
                Performance Overview
              </span>
              <select style={{
                background: '#F8FAFD', border: '1px solid #E3E9F3',
                borderRadius: 8, padding: '6px 10px',
                fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#475569',
                cursor: 'pointer', outline: 'none',
              }}>
                <option>This Week</option>
                <option>Last Week</option>
              </select>
            </div>

            <div style={{ height: 240, marginBottom: 16 }}>
              {weeklyChartData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563FF" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#2563FF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F7" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontFamily: 'Inter', fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={v => `${v}%`} tick={{ fontFamily: 'Inter', fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#FFFFFF', border: '1px solid #E5EAF3', borderRadius: 10, fontFamily: 'Inter', fontSize: 13 }}
                      formatter={v => [`${v}%`, 'Activity']}
                      labelStyle={{ color: '#64748B' }}
                      itemStyle={{ color: '#2563FF' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#2563FF" strokeWidth={2.5} fill="url(#blueGrad)" dot={{ fill: '#2563FF', r: 4, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#EF3340' }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{
                  height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#F8FAFF', borderRadius: 12,
                }}>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#64748B', textAlign: 'center' }}>
                    Start training to build your performance history.
                  </p>
                </div>
              )}
            </div>

            {/* 4 metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              <MetricCard label="K/D RATIO"     value={scrimStats.kd}                color="#2563FF" />
              <MetricCard label="WIN RATE"      value={`${scrimStats.winRate}%`}     color="#F59E0B" />
              <MetricCard label="AVG PLACEMENT" value={scrimStats.avgPlacement || '—'} color="#EF3340" />
              <MetricCard label="HEADSHOT RATE" value={`${scrimStats.hsPct}%`}       color="#2563FF" />
            </div>
          </div>

          {/* Recent Activity */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EAF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Activity size={15} color="#2563FF" />
                </div>
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: '#0B1224' }}>Recent Activity</span>
              </div>
              <Link to="/training" style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#2563FF', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                View All <ArrowRight size={14} />
              </Link>
            </div>

            {recentActivity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#64748B' }}>
                  Your activity will appear here once you start training.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {recentActivity.map((item, i) => (
                  <div key={item.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      background: item.type === 'session' ? '#EAF2FF' : '#F0EDFF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {item.type === 'session'
                        ? <Target size={18} color="#2563FF" />
                        : <Crosshair size={18} color="#5B3DF5" />
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 14, color: '#0B1224', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </div>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#64748B' }}>
                        {item.sub}{item.duration ? ` · ${formatDuration(item.duration)}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {item.type === 'session' ? (
                        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: '#16A34A' }}>+{item.xp} XP</div>
                      ) : (
                        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: '#2563FF' }}>#{item.position || '—'}/{item.kills || 0}K</div>
                      )}
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#94A3B8' }}>{formatRelative(item.timestamp)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Today's Focus */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EAF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={15} color="#2563FF" />
                </div>
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: '#0B1224' }}>Today's Focus</span>
              </div>
              <Link to="/training" style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#2563FF', textDecoration: 'none' }}>View All →</Link>
            </div>

            {/* Focus icon + title */}
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#EAF2FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 12,
            }}>
              <Target size={28} color="#2563FF" />
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: '#0B1224', marginBottom: 8 }}>
              {priorityFocus ? priorityFocus.name : 'Log Matches'}
            </div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#64748B', lineHeight: 1.6, marginBottom: 16 }}>
              {priorityFocus
                ? `Flagged ${priorityFocus.count}× in matches. Drill it to improve.`
                : 'Log a few matches to unlock AI-powered focus recommendations.'}
            </p>

            <button
              onClick={() => navigate('/training')}
              style={{
                width: '100%', height: 46,
                background: 'linear-gradient(90deg, #2563FF, #1677FF, #EF3340)',
                color: '#FFFFFF',
                fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14,
                border: 'none', borderRadius: 9, cursor: 'pointer',
                transition: 'opacity 0.2s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Start Training →
            </button>
          </div>

          {/* Activity Calendar */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EAF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={15} color="#2563FF" />
                </div>
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: '#0B1224' }}>Activity Calendar</span>
              </div>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#64748B' }}>14-Day Activity</span>
            </div>

            {/* Day labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
              {['M','T','W','T','F','S','S'].map((l, i) => (
                <div key={i} style={{
                  textAlign: 'center',
                  fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11,
                  color: '#64748B', textTransform: 'uppercase',
                }}>
                  {l}
                </div>
              ))}
            </div>

            {/* 7×2 grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
              {activityGrid.map((d, idx) => {
                const total = d.drills + d.matches
                const isToday = d.key === new Date().toISOString().split('T')[0]
                let bg = '#F1F4F9'
                if (total >= 2) bg = 'linear-gradient(135deg, #2563FF, #5B3DF5)'
                else if (total === 1) bg = 'rgba(37,99,255,0.25)'
                return (
                  <div
                    key={d.key}
                    title={`${d.key}: ${total} activities`}
                    style={{
                      width: '100%', aspectRatio: '1/1',
                      borderRadius: 9,
                      background: bg,
                      border: isToday ? '2px solid #2563FF' : '2px solid transparent',
                      cursor: 'default',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12, fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#64748B' }}>
              {[['linear-gradient(135deg,#2563FF,#5B3DF5)', 'Training'], ['rgba(37,99,255,0.25)', 'Low'], ['#F1F4F9', 'None']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                  {l}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EAF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={15} color="#2563FF" />
              </div>
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: '#0B1224' }}>Quick Actions</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Start Training',  icon: <Target size={20} color="#2563FF" />,  to: '/training' },
                { label: 'Log Match',       icon: <Crosshair size={20} color="#EF3340" />, to: '/match-logger' },
                { label: 'View Roadmap',    icon: <Map size={20} color="#5B3DF5" />,     to: '/roadmap' },
                { label: 'Ask AI Coach',    icon: <Brain size={20} color="#F59E0B" />,    to: '/ai-coach' },
              ].map(({ label, icon, to }) => (
                <button
                  key={label}
                  onClick={() => navigate(to)}
                  style={{
                    height: 52,
                    border: '1px solid #E5EAF3',
                    borderRadius: 12,
                    padding: '0 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    width: '100%',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#2563FF'
                    e.currentTarget.style.background = '#EEF4FF'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#E5EAF3'
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {icon}
                  <span style={{ flex: 1, fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, color: '#0B1224' }}>
                    {label}
                  </span>
                  <ChevronRight size={16} color="#64748B" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .main-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 700px) {
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 420px) {
          .stats-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .hero-pills {
            flex-wrap: nowrap !important;
            overflow-x: auto;
            scroll-snap-type: x proximity;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .hero-pills::-webkit-scrollbar { display: none; }
          .hero-pills > * { scroll-snap-align: start; flex-shrink: 0; }
        }
      `}</style>
    </div>
  )
}

/* ── Card style constant ──────────────────────────────────── */
const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E5EAF3',
  borderRadius: 16,
  padding: 24,
  boxShadow: '0 4px 18px rgba(31,41,55,0.04)',
  transition: 'box-shadow 0.2s ease',
}

/* ── Sub-components ──────────────────────────────────────── */
function HeroPill({ color, label }) {
  return (
    <div style={{
      height: 38,
      padding: '0 14px',
      borderRadius: 999,
      background: 'rgba(255,255,255,0.85)',
      border: '1px solid #DCE5F4',
      backdropFilter: 'blur(8px)',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 13,
      color: '#0B1224', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </div>
  )
}

function QuickStatCard({ iconBg, icon, title, value, sub, cardVariants }) {
  return (
    <motion.div
      variants={cardVariants}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5EAF3',
        borderRadius: 14,
        padding: 20,
        boxShadow: '0 4px 18px rgba(31,41,55,0.04)',
        cursor: 'default',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 8px 30px rgba(37,99,255,0.08)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 4px 18px rgba(31,41,55,0.04)'
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
      }}>
        {icon}
      </div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, color: '#0B1224', marginBottom: 6 }}>{title}</div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 28, color: '#0B1224', lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 13, color: '#64748B' }}>{sub}</div>
    </motion.div>
  )
}

function MetricCard({ label, value, color }) {
  return (
    <div style={{
      border: '1px solid #E5EAF3',
      borderRadius: 12,
      padding: 16,
      textAlign: 'center',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.10em' }}>{label}</span>
      </div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 24, color: '#0B1224', lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#94A3B8' }}>—</div>
    </div>
  )
}
