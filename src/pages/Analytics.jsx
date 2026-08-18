import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import {
  LineChart, Line, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Swords, Target, Activity, Trophy, MapPin, Zap, TrendingUp,
  AlertTriangle, ArrowRight, Download, BarChart2, Info,
  ChevronRight, Filter,
} from 'lucide-react'
import { db } from '../utils/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { DEFAULT_SUGGESTIONS } from '../utils/constants.js'

/* ── palette ── */
const C = {
  blue:   '#3B82F6',
  cyan:   '#22D3EE',
  violet: '#7C3AED',
  green:  '#22C55E',
  red:    '#EF4444',
  amber:  '#F59E0B',
  card:   '#0D1528',
  border: '#1B2A45',
  text:   '#F8FAFC',
  muted:  '#94A3B8',
  subtle: '#64748B',
}

const MODE_COLORS = { Classic: C.blue, Scrims: C.amber, Tournament: C.violet }
const PIE_COLORS  = [C.blue, C.amber, C.violet]

const MAP_META = {
  Erangel: { emoji: '🌿', color: C.green  },
  Miramar: { emoji: '🏜', color: C.amber  },
  Sanhok:  { emoji: '🌴', color: '#10B981' },
  Vikendi: { emoji: '❄',  color: '#60A5FA' },
  Livik:   { emoji: '🏔', color: '#A78BFA' },
  Rondo:   { emoji: '🌊', color: C.cyan   },
  Nusa:    { emoji: '🏝', color: '#F97316' },
}

const WEAKNESS_TIPS = {
  spray:    'Practice Spray Training module daily for 15 min',
  close:    'Work on Close Range module drills',
  decision: 'Review every rotation call after the match',
  rotation: 'Study zone movement and ring timing',
  position: 'Focus on early-game drop and end-game setup',
  aim:      'Daily ADS drills — focus on flick shots',
  recoil:   'Burst control drills in Spray Training module',
  vehicle:  'Car Spray drills improve vehicle combat',
  team:     'Record scrims to review team sync',
  sound:    'Use headphones and practice mini-map audio cues',
}

/* resolve weakness IDs → display names */
const SUGGESTION_MAP = Object.fromEntries(
  DEFAULT_SUGGESTIONS.map(s => [s.id, s.name])
)

const DATE_OPTIONS = [
  { id: '7d',  label: 'Last 7 Days',  days: 7  },
  { id: '14d', label: 'Last 14 Days', days: 14 },
  { id: '30d', label: 'Last 30 Days', days: 30 },
  { id: '90d', label: 'Last 90 Days', days: 90 },
  { id: 'all', label: 'All Time',     days: null },
]

const ALL_MAPS = ['All Maps', 'Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Livik', 'Rondo', 'Nusa']
const ALL_MODES = ['All Modes', 'Classic', 'Scrims', 'Tournament']

/* ================================================================
   PAGE ROOT
   ================================================================ */
export default function Analytics() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [allMatches, setAllMatches] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  /* filters */
  const [dateRange, setDateRange] = useState('30d')
  const [modeFilter, setModeFilter] = useState('All Modes')
  const [mapFilter, setMapFilter]   = useState('All Maps')

  /* ── fetch all matches once (no orderBy — avoids silent exclusion) ── */
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user?.uid) { setLoading(false); return }
      setLoading(true); setError('')
      try {
        const snap = await getDocs(collection(db, 'users', user.uid, 'matches'))
        if (cancelled) return
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => tsOf(a) - tsOf(b))
        setAllMatches(list)
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load matches.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user?.uid])

  /* ── filtered set ── */
  const filtered = useMemo(() => {
    const opt = DATE_OPTIONS.find(o => o.id === dateRange)
    const cutoff = opt?.days ? Date.now() - opt.days * 86400000 : 0
    return allMatches.filter(m => {
      if (cutoff && tsOf(m) < cutoff) return false
      if (modeFilter !== 'All Modes' && modeOf(m) !== modeFilter) return false
      if (mapFilter  !== 'All Maps'  && (m.map || '') !== mapFilter) return false
      return true
    })
  }, [allMatches, dateRange, modeFilter, mapFilter])

  /* ── prior period (equal-length window before current) ── */
  const priorPeriod = useMemo(() => {
    const opt = DATE_OPTIONS.find(o => o.id === dateRange)
    if (!opt?.days) return []
    const endCutoff   = Date.now() - opt.days * 86400000
    const startCutoff = endCutoff  - opt.days * 86400000
    return allMatches.filter(m => {
      const ts = tsOf(m)
      return ts >= startCutoff && ts < endCutoff
    })
  }, [allMatches, dateRange])

  function exportReport() {
    const stats = {
      totalMatches: filtered.length,
      totalKills:   filtered.reduce((s, m) => s + killsOf(m), 0),
      avgKills:     filtered.length ? (filtered.reduce((s, m) => s + killsOf(m), 0) / filtered.length).toFixed(2) : 0,
      avgPlacement: filtered.length ? (filtered.reduce((s, m) => s + (placementOf(m) || 0), 0) / filtered.length).toFixed(1) : 0,
      winRate:      filtered.length ? ((filtered.filter(m => isWin(m)).length / filtered.length) * 100).toFixed(1) + '%' : '—',
      avgDamage:    filtered.length ? Math.round(filtered.reduce((s, m) => s + damageOf(m), 0) / filtered.length) : 0,
    }
    const payload = { exportedAt: new Date().toISOString(), filters: { dateRange, modeFilter, mapFilter }, stats, matchCount: filtered.length }
    const json = JSON.stringify(payload, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `esports-elite-analytics-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={18} style={{ color: C.red, flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontFamily: 'Oxanium, sans-serif', fontWeight: 600, color: C.text }}>
              Couldn't load analytics
            </div>
            <div style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 13, color: C.muted, marginTop: 4 }}>
              {error}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (allMatches.length === 0) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px' }}>
        <BarChart2 size={48} style={{ color: C.muted, opacity: 0.4, margin: '0 auto 16px' }} />
        <div style={{ fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 20, color: C.text, marginBottom: 8 }}>
          No match data yet
        </div>
        <div style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 13, color: C.muted, marginBottom: 20 }}>
          Log matches in Training Center to see your performance analytics here.
        </div>
        <button
          onClick={() => navigate('/training')}
          style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontFamily: 'Oxanium, sans-serif', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          Log a Match <ArrowRight size={13} />
        </button>
      </div>
    )
  }

  return (
    <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 26, color: C.text, margin: 0, marginBottom: 4, letterSpacing: '0.01em' }}>
            Analytics Overview
          </h1>
          <div style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 13, color: C.muted }}>
            Track your performance. Identify weaknesses. Improve every day.
          </div>
        </div>
        <button
          onClick={exportReport}
          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontFamily: 'Inter, sans-serif', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
        >
          <Download size={13} /> Export Report
        </button>
      </div>

      {/* Filter row */}
      <FilterRow
        dateRange={dateRange} onDateRange={setDateRange}
        modeFilter={modeFilter} onModeFilter={setModeFilter}
        mapFilter={mapFilter}  onMapFilter={setMapFilter}
        total={allMatches.length} filtered={filtered.length}
      />

      {filtered.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '36px 24px' }}>
          <Filter size={32} style={{ color: C.muted, opacity: 0.3, margin: '0 auto 12px' }} />
          <div style={{ fontFamily: 'Oxanium, sans-serif', fontWeight: 600, fontSize: 16, color: C.text, marginBottom: 6 }}>
            No matches in this filter window
          </div>
          <div style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 13, color: C.muted }}>
            Widen the date range or change the mode/map filter.
          </div>
        </div>
      ) : (
        <>
          <SummaryRow filtered={filtered} prior={priorPeriod} />
          <TrendAndModeRow filtered={filtered} />
          <MapPerformanceRow filtered={filtered} />
          <CombatAnalysisRow filtered={filtered} />
          <WeaknessAndWeaponsRow filtered={filtered} />
        </>
      )}

      <AnalyticsStyles />
    </div>
  )
}

/* ================================================================
   FILTER ROW
   ================================================================ */
function FilterRow({ dateRange, onDateRange, modeFilter, onModeFilter, mapFilter, onMapFilter, total, filtered }) {
  const selectStyle = {
    background: C.card, border: `1px solid ${C.border}`, color: C.text,
    borderRadius: 8, padding: '8px 12px', fontSize: 13,
    fontFamily: 'Inter, DM Sans, sans-serif', cursor: 'pointer', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <select value={dateRange} onChange={e => onDateRange(e.target.value)} style={selectStyle}>
        {DATE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <select value={modeFilter} onChange={e => onModeFilter(e.target.value)} style={selectStyle}>
        {ALL_MODES.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <select value={mapFilter} onChange={e => onMapFilter(e.target.value)} style={selectStyle}>
        {ALL_MAPS.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <div style={{ marginLeft: 'auto', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 12, color: C.subtle }}>
        {filtered} of {total} match{total === 1 ? '' : 'es'}
      </div>
    </div>
  )
}

/* ================================================================
   ROW 1 — 6 SUMMARY CARDS
   ================================================================ */
function SummaryRow({ filtered, prior }) {
  const total    = filtered.length
  const pTotal   = prior.length

  const totalKills   = filtered.reduce((s, m) => s + killsOf(m), 0)
  const pTotalKills  = prior.reduce((s, m) => s + killsOf(m), 0)

  const avgKills  = total  ? totalKills  / total  : 0
  const pAvgKills = pTotal ? pTotalKills / pTotal : 0

  const wins       = filtered.filter(m => isWin(m)).length
  const pWins      = prior.filter(m => isWin(m)).length
  const winRate    = total  ? (wins  / total)  * 100 : 0
  const pWinRate   = pTotal ? (pWins / pTotal) * 100 : 0

  const placed    = filtered.filter(m => placementOf(m) > 0)
  const pPlaced   = prior.filter(m => placementOf(m) > 0)
  const avgPlace  = placed.length  ? placed.reduce((s, m) => s + placementOf(m), 0)  / placed.length  : 0
  const pAvgPlace = pPlaced.length ? pPlaced.reduce((s, m) => s + placementOf(m), 0) / pPlaced.length : 0

  const totalDmg = filtered.reduce((s, m) => s + damageOf(m), 0)
  const pTotalDmg = prior.reduce((s, m) => s + damageOf(m), 0)
  const avgDmg   = total  ? Math.round(totalDmg  / total)  : 0
  const pAvgDmg  = pTotal ? Math.round(pTotalDmg / pTotal) : 0

  return (
    <div className="analytics-6col">
      <SummaryCard
        icon={<Swords size={18} />} iconColor={C.violet}
        label="Total Matches" value={total}
        trend={pTotal > 0 ? { delta: total - pTotal, higher: true } : null}
      />
      <SummaryCard
        icon={<Target size={18} />} iconColor={C.blue}
        label="Total Kills" value={totalKills}
        trend={pTotalKills > 0 ? { delta: totalKills - pTotalKills, higher: true } : null}
      />
      <SummaryCard
        icon={<Activity size={18} />} iconColor={C.green}
        label="Avg Kills / Match" value={avgKills.toFixed(2)}
        trend={pAvgKills > 0 ? { delta: +(avgKills - pAvgKills).toFixed(2), higher: true } : null}
      />
      <SummaryCard
        icon={<Trophy size={18} />} iconColor={C.amber}
        label="Win Rate" value={`${winRate.toFixed(1)}%`}
        trend={pWinRate > 0 ? { delta: +(winRate - pWinRate).toFixed(1), higher: true, suffix: '%' } : null}
      />
      <SummaryCard
        icon={<MapPin size={18} />} iconColor={C.red}
        label="Avg Placement" value={avgPlace > 0 ? `#${avgPlace.toFixed(1)}` : '—'}
        trend={pAvgPlace > 0 ? { delta: +(pAvgPlace - avgPlace).toFixed(1), higher: true, prefix: '#', reversed: true } : null}
      />
      <SummaryCard
        icon={<Zap size={18} />} iconColor={C.cyan}
        label="Avg Damage" value={avgDmg > 0 ? avgDmg.toLocaleString() : '—'}
        trend={pAvgDmg > 0 ? { delta: avgDmg - pAvgDmg, higher: true } : null}
      />
    </div>
  )
}

function SummaryCard({ icon, iconColor, label, value, trend }) {
  const improving = trend ? (trend.reversed ? trend.delta > 0 : trend.delta > 0) : null
  const trendColor = improving === null ? null : improving ? C.green : C.red
  const arrow = improving === null ? null : improving ? '↑' : '↓'

  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${iconColor}18`, border: `1px solid ${iconColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 26, color: C.text, lineHeight: 1 }}>
          {value}
        </div>
        {trend && arrow && (
          <div style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 11, color: trendColor, marginTop: 4 }}>
            {arrow} {Math.abs(trend.delta)}{trend.suffix || ''} vs last period
          </div>
        )}
      </div>
    </div>
  )
}

/* ================================================================
   ROW 2 — PERFORMANCE TREND + MATCHES BY MODE
   ================================================================ */
function TrendAndModeRow({ filtered }) {
  const trendData = useMemo(() => {
    return [...filtered].slice(-30).map((m, i) => ({
      idx: i + 1,
      date: fmtDate(tsOf(m)),
      kills: killsOf(m),
      placement: placementOf(m) > 0 ? Math.max(0, 25 - placementOf(m)) : null,
    }))
  }, [filtered])

  const modeData = useMemo(() => {
    const counts = {}
    filtered.forEach(m => {
      const mode = modeOf(m) || 'Other'
      counts[mode] = (counts[mode] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [filtered])

  const modeTotal = modeData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="analytics-trend-row">
      {/* Performance trend */}
      <div style={cardStyle}>
        <SectionHeader label="Performance Trend" sub="Last 30 matches · kills and placement" icon={<TrendingUp size={14} />} />
        {trendData.length < 2 ? (
          <ChartEmpty msg="Log more matches to see trends" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" {...axisProps} interval="preserveStartEnd" />
              <YAxis {...axisProps} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: C.muted, strokeOpacity: 0.3 }} />
              <Legend formatter={v => <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: C.muted }}>{v}</span>} />
              <Line type="monotone" dataKey="kills" name="Kills" stroke={C.green} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="placement" name="Placement Score (25–pos)" stroke={C.blue} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Matches by mode — donut */}
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
        <SectionHeader label="Matches by Mode" icon={<BarChart2 size={14} />} />
        {modeData.length === 0 ? <ChartEmpty msg="No matches logged yet" /> : (
          <>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={modeData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={80} innerRadius={50}
                    paddingAngle={3} stroke="transparent"
                  >
                    {modeData.map((d, i) => (
                      <Cell key={d.name} fill={MODE_COLORS[d.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 22, color: C.text }}>{modeTotal}</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: C.muted }}>matches</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {modeData.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: MODE_COLORS[d.name] || PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: C.text, flex: 1 }}>{d.name}</span>
                  <span style={{ fontFamily: 'Oxanium, sans-serif', fontSize: 13, color: C.muted }}>{d.value}</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: C.subtle }}>{modeTotal > 0 ? `${Math.round((d.value / modeTotal) * 100)}%` : '—'}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ================================================================
   ROW 3 — MAP PERFORMANCE
   ================================================================ */
function MapPerformanceRow({ filtered }) {
  const mapData = useMemo(() => {
    const byMap = {}
    filtered.forEach(m => {
      const map = m.map || 'Unknown'
      if (!byMap[map]) byMap[map] = { map, count: 0, kills: 0, wins: 0 }
      byMap[map].count++
      byMap[map].kills += killsOf(m)
      if (isWin(m)) byMap[map].wins++
    })
    return Object.values(byMap)
      .map(d => ({
        ...d,
        avgKills: (d.kills / d.count).toFixed(1),
        winRate:  Math.round((d.wins / d.count) * 100),
      }))
      .sort((a, b) => b.count - a.count)
  }, [filtered])

  if (mapData.length === 0) return null

  return (
    <div style={cardStyle}>
      <SectionHeader label="Map Performance" sub="Sorted by match count" icon={<MapPin size={14} />} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginTop: 4 }}>
        {mapData.map(d => {
          const meta = MAP_META[d.map] || { emoji: '🗺', color: C.muted }
          const winColor = d.winRate >= 50 ? C.green : d.winRate >= 25 ? C.amber : C.red
          return (
            <div key={d.map} style={{ background: '#0A1220', border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: `${meta.color}18`, border: `1px solid ${meta.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {meta.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Oxanium, sans-serif', fontWeight: 600, fontSize: 15, color: C.text, marginBottom: 4 }}>{d.map}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Stat label="Matches" value={d.count} />
                  <Stat label="Avg Kills" value={d.avgKills} />
                  <Stat label="Win Rate" value={`${d.winRate}%`} color={winColor} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ================================================================
   ROW 4 — COMBAT ANALYSIS (RADAR)
   ================================================================ */
function CombatAnalysisRow({ filtered }) {
  const scores = useMemo(() => {
    if (filtered.length === 0) return null

    const avgKills = filtered.reduce((s, m) => s + killsOf(m), 0) / filtered.length
    const avgPlace = filtered.filter(m => placementOf(m) > 0).reduce((s, m, _, a) => s + placementOf(m) / a.length, 0) || 25
    const avgDmg   = filtered.reduce((s, m) => s + damageOf(m), 0) / filtered.length

    const allW = filtered.flatMap(m => weaknessOf(m).map(w => w.toLowerCase()))
    const wFreq = (kw) => allW.filter(w => w.includes(kw)).length / Math.max(1, filtered.length)

    const aim          = Math.round(Math.min(100, avgKills * 10))
    const sprayCtrl    = Math.round(Math.max(0, 100 - wFreq('spray') * 300 - wFreq('recoil') * 300))
    const closeRange   = Math.round(Math.max(0, 100 - wFreq('close') * 300))
    const positioning  = Math.round(Math.max(0, 100 - (avgPlace - 1) * 4))
    const gameSense    = Math.round(Math.max(0, 100 - wFreq('decision') * 400 - wFreq('rotation') * 300 - wFreq('sound') * 200))
    const survival     = Math.round(Math.max(0, 100 - (avgPlace - 1) * 3))

    return [
      { axis: 'Aim',          value: aim         },
      { axis: 'Spray Control',value: sprayCtrl   },
      { axis: 'Close Range',  value: closeRange  },
      { axis: 'Positioning',  value: positioning },
      { axis: 'Game Sense',   value: gameSense   },
      { axis: 'Survival',     value: survival    },
    ]
  }, [filtered])

  const lowDataOverlay = filtered.length > 0 && filtered.length < 5

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <SectionHeader label="Combat Analysis" sub="Estimated from your match data" icon={<Activity size={14} />} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: `${C.amber}12`, border: `1px solid ${C.amber}30`, borderRadius: 6 }}>
          <Info size={11} style={{ color: C.amber }} />
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: C.amber }}>Derived scores — not directly tracked</span>
        </div>
      </div>

      {!scores ? (
        <ChartEmpty msg="No match data to analyse" />
      ) : (
        <div className="analytics-radar-row">
          {/* Radar chart */}
          <div style={{ position: 'relative' }}>
            {lowDataOverlay && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,8,22,0.65)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, padding: '0 16px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: C.muted }}>
                  Log at least 5 matches for accurate combat analysis
                  <span style={{ display: 'block', color: C.subtle, fontSize: 11, marginTop: 4 }}>({filtered.length}/5 logged)</span>
                </div>
              </div>
            )}
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={scores} margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fill: C.muted, fontSize: 11, fontFamily: 'Inter, DM Sans, sans-serif' }}
                />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  dataKey="value" name="Score"
                  stroke={C.blue} fill={C.blue} fillOpacity={0.2}
                  dot={{ r: 3, fill: C.blue }}
                />
                <Tooltip content={<CustomTooltip suffix="/100" />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Score list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
            {scores.map(s => (
              <div key={s.axis}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: C.text }}>{s.axis}</span>
                  <span style={{ fontFamily: 'Oxanium, sans-serif', fontSize: 13, fontWeight: 600, color: scoreColor(s.value) }}>{s.value}/100</span>
                </div>
                <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${s.value}%`, background: scoreColor(s.value), borderRadius: 2, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ================================================================
   ROW 5 — WEAKNESS BREAKDOWN + BEST WEAPONS
   ================================================================ */
function WeaknessAndWeaponsRow({ filtered }) {
  const weaknessData = useMemo(() => {
    const counts = {}
    filtered.forEach(m => {
      weaknessOf(m).forEach(w => { counts[w] = (counts[w] || 0) + 1 })
    })
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({
        name, count,
        pct: filtered.length > 0 ? (count / filtered.length) * 100 : 0,
      }))
  }, [filtered])

  const weaponData = useMemo(() => {
    const byWeapon = {}
    filtered.forEach(m => {
      const weapon = m.weaponUsed || ''
      if (!weapon) return
      if (!byWeapon[weapon]) byWeapon[weapon] = { weapon, kills: 0, matches: 0 }
      byWeapon[weapon].kills   += killsOf(m)
      byWeapon[weapon].matches++
    })
    return Object.values(byWeapon)
      .sort((a, b) => b.kills - a.kills)
      .slice(0, 5)
      .map(d => ({ ...d, avgKills: d.matches > 0 ? (d.kills / d.matches).toFixed(1) : '—' }))
  }, [filtered])

  return (
    <div className="analytics-2col">
      {/* Weakness breakdown */}
      <div style={cardStyle}>
        <SectionHeader label="Weakness Breakdown" sub="Top 5 recurring weak areas" icon={<AlertTriangle size={14} />} />
        {weaknessData.length === 0 ? (
          <EmptyState
            msg="No weakness data logged"
            sub="Tag weaknesses when logging matches to see this breakdown"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            {weaknessData.map((d, i) => {
              const pctColor = d.pct >= 50 ? C.red : d.pct >= 30 ? C.amber : C.blue
              const tip = getTip(d.name)
              return (
                <div key={d.name} style={{ background: '#0A1220', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: tip ? 6 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 4, background: `${pctColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: 'Oxanium, sans-serif', color: pctColor }}>
                        {i + 1}
                      </span>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: C.text }}>{d.name}</span>
                    </div>
                    <span style={{ background: `${pctColor}18`, border: `1px solid ${pctColor}30`, color: pctColor, borderRadius: 5, padding: '2px 8px', fontSize: 11, fontFamily: 'Oxanium, sans-serif', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {d.pct.toFixed(0)}% ({d.count})
                    </span>
                  </div>
                  {tip && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
                      <ChevronRight size={11} style={{ color: C.blue, flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{tip}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Best weapons */}
      <div style={cardStyle}>
        <SectionHeader label="Best Performing Weapons" sub="From matches with weapon logged" icon={<Target size={14} />} />
        {weaponData.length === 0 ? (
          <EmptyState
            msg="No weapon data yet"
            sub="Select 'Primary Weapon Used' when logging matches to see this report"
          />
        ) : (
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '8px 16px', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
              {['Weapon', 'Kills', 'Matches', 'Avg K'].map(h => (
                <span key={h} style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.subtle }}>{h}</span>
              ))}
            </div>
            {weaponData.map((d, i) => {
              const isTop = i === 0
              return (
                <div key={d.weapon} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '6px 16px', alignItems: 'center', padding: '8px 0', borderBottom: i < weaponData.length - 1 ? `1px solid ${C.border}30` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {isTop && <span style={{ fontSize: 12 }}>🏆</span>}
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: isTop ? C.text : C.muted, fontWeight: isTop ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.weapon}</span>
                  </div>
                  <span style={{ fontFamily: 'Oxanium, sans-serif', fontSize: 14, fontWeight: 600, color: C.text, textAlign: 'right' }}>{d.kills}</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: C.muted, textAlign: 'right' }}>{d.matches}</span>
                  <span style={{ fontFamily: 'Oxanium, sans-serif', fontSize: 13, color: C.green, textAlign: 'right' }}>{d.avgKills}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ================================================================
   BUILDING BLOCKS
   ================================================================ */
function SectionHeader({ label, sub, icon }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted, marginBottom: sub ? 3 : 0 }}>
        {icon}
        <span style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: C.muted }}>
          {label}
        </span>
      </div>
      {sub && (
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: C.subtle }}>{sub}</div>
      )}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: C.subtle, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontFamily: 'Oxanium, sans-serif', fontWeight: 600, fontSize: 14, color: color || C.text }}>{value}</div>
    </div>
  )
}

function ChartEmpty({ msg }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 13, color: C.subtle }}>
      {msg}
    </div>
  )
}

function EmptyState({ msg, sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', gap: 8, textAlign: 'center' }}>
      <div style={{ fontFamily: 'Oxanium, sans-serif', fontWeight: 600, fontSize: 14, color: C.text }}>{msg}</div>
      {sub && <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  )
}

const axisProps = {
  stroke: C.border,
  tickLine: false,
  tick: { fill: C.subtle, fontSize: 11, fontFamily: 'Inter, DM Sans, sans-serif' },
}

function CustomTooltip({ active, payload, label, suffix }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 12, color: C.text }}>
      {label && <div style={{ color: C.subtle, marginBottom: 4, fontSize: 11 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.text, fontWeight: 600 }}>
          {p.name}: {p.value}{suffix || ''}
        </div>
      ))}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="analytics-6col">
        {[0,1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />)}
      </div>
      <div className="analytics-2col">
        {[0,1].map(i => <div key={i} className="skeleton" style={{ height: 280, borderRadius: 12 }} />)}
      </div>
    </div>
  )
}

/* ================================================================
   HELPERS — normalise fields across different match schemas
   ================================================================ */
function tsOf(m) {
  if (!m) return 0
  /* Firestore Timestamp */
  if (m.createdAt?.toMillis) return m.createdAt.toMillis()
  /* MatchLogger: timestamp = Date.now() */
  if (typeof m.timestamp === 'number') return m.timestamp
  /* Seed data: loggedAt = ISO string */
  if (typeof m.loggedAt === 'string') {
    const t = new Date(m.loggedAt).getTime()
    if (!isNaN(t)) return t
  }
  /* Fallback: createdAt as string */
  if (typeof m.createdAt === 'string') {
    const t = new Date(m.createdAt).getTime()
    if (!isNaN(t)) return t
  }
  return 0
}

function fmtDate(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function killsOf(m) {
  if (!m) return 0
  /* Classic + seed: m.kills */
  if (m.kills != null) return Number(m.kills) || 0
  /* Scrims/Tournament: m.individualKills */
  if (m.individualKills != null) return Number(m.individualKills) || 0
  return 0
}

function placementOf(m) {
  if (!m) return 0
  /* seed data: placement */
  if (m.placement != null) return Number(m.placement) || 0
  /* Classic: position */
  if (m.position != null) return Number(m.position) || 0
  /* Scrims/Tournament: teamPosition */
  if (m.teamPosition != null) return Number(m.teamPosition) || 0
  return 0
}

function damageOf(m) {
  return Number(m?.damage || 0)
}

function modeOf(m) {
  const raw = (m?.mode || m?.type || '').trim().toLowerCase()
  if (raw === 'classic')    return 'Classic'
  if (raw === 'scrims')     return 'Scrims'
  if (raw === 'tournament') return 'Tournament'
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Classic'
}

function isWin(m) {
  if (!m) return false
  if (m.result === true || m.result === 'won' || m.result === 'win') return true
  if (m.result === false || m.result === 'lost' || m.result === 'loss') return false
  const p = placementOf(m)
  return p >= 1 && p <= 3
}

function weaknessOf(m) {
  if (!m) return []
  /* MatchLogger: weakestPoints = [suggestionId, ...] */
  if (Array.isArray(m.weakestPoints) && m.weakestPoints.length > 0) {
    return m.weakestPoints.map(id => SUGGESTION_MAP[id] || id).filter(Boolean)
  }
  if (Array.isArray(m.weaknesses) && m.weaknesses.length > 0) {
    return m.weaknesses.map(id => SUGGESTION_MAP[id] || id).filter(Boolean)
  }
  /* seed data: weakness = plain string, or comma-separated */
  const raw = m.weakness || m.weakestPoint || ''
  if (!raw) return []
  return String(raw).split(/[,;]/).map(s => s.trim()).filter(Boolean)
}

function scoreColor(v) {
  if (v >= 70) return C.green
  if (v >= 40) return C.amber
  return C.red
}

function getTip(name) {
  const lower = name.toLowerCase()
  for (const [kw, tip] of Object.entries(WEAKNESS_TIPS)) {
    if (lower.includes(kw)) return tip
  }
  return null
}

/* ================================================================
   STYLES
   ================================================================ */
const cardStyle = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20,
}

function AnalyticsStyles() {
  return (
    <style>{`
      .analytics-6col {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      @media (min-width: 640px)  { .analytics-6col { grid-template-columns: repeat(3, 1fr); } }
      @media (min-width: 1100px) { .analytics-6col { grid-template-columns: repeat(6, 1fr); } }

      .analytics-2col {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
      }
      @media (min-width: 900px) { .analytics-2col { grid-template-columns: 1fr 1fr; } }

      .analytics-trend-row {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
      }
      @media (min-width: 900px) { .analytics-trend-row { grid-template-columns: 2fr 1fr; } }

      .analytics-radar-row {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
      }
      @media (min-width: 700px) { .analytics-radar-row { grid-template-columns: 1fr 1fr; align-items: center; } }
    `}</style>
  )
}
