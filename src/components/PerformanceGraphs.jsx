import { useState, useMemo } from 'react'
import {
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { STORAGE_KEYS } from '../utils/constants.js'

/* ============================================================
   FILTER OPTIONS
   ============================================================ */
const TYPE_FILTERS = [
  { id: 'All', label: 'All' },
  { id: 'Classic', label: 'Classic' },
  { id: 'Scrims', label: 'Scrims' },
  { id: 'Tournament', label: 'Tournament' },
]

const TIME_FILTERS = [
  { id: '7', label: '7 Days', days: 7 },
  { id: '14', label: '14 Days', days: 14 },
  { id: '30', label: '30 Days', days: 30 },
  { id: 'all', label: 'All Time', days: null },
]

/* ============================================================
   HELPERS
   ============================================================ */
function formatDayMonth(ts) {
  const d = new Date(ts)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Resolve a match's headline kills depending on its type. */
function matchKills(m) {
  if (m.type === 'Classic') return Number(m.kills) || 0
  return Number(m.individualKills) || 0
}

/** Resolve a match's headline placement depending on its type. */
function matchPosition(m) {
  if (m.type === 'Classic') return m.position != null ? Number(m.position) : null
  return m.teamPosition != null ? Number(m.teamPosition) : null
}

/* ============================================================
   TOOLTIPS
   Recharts content render-prop with a glassmorphism popup.
   ============================================================ */
function makeTooltip(accent, formatValue) {
  return function CustomTip({ active, payload, label }) {
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
          Match on {label}
        </div>
        <div className="mono text-sm mt-0.5" style={{ color: accent }}>
          {formatValue(payload[0].value)}
        </div>
      </div>
    )
  }
}

const KillsTooltip = makeTooltip(
  '#E8001C',
  v => `${v} ${Number(v) === 1 ? 'kill' : 'kills'}`
)
const PlacementTooltip = makeTooltip('#4A9EFF', v => `Position #${v}`)
const DamageTooltip = makeTooltip('#FF2D44', v => `${v} damage`)

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
export default function PerformanceGraphs() {
  const [matches] = useLocalStorage(STORAGE_KEYS.MATCHES, [])
  const [typeFilter, setTypeFilter] = useState('All')
  const [timeFilter, setTimeFilter] = useState('all')

  const filteredMatches = useMemo(() => {
    let list = Array.isArray(matches) ? matches.slice() : []
    if (typeFilter !== 'All') list = list.filter(m => m.type === typeFilter)
    const tf = TIME_FILTERS.find(f => f.id === timeFilter)
    if (tf?.days != null) {
      const cutoff = Date.now() - tf.days * 24 * 60 * 60 * 1000
      list = list.filter(m => Number(m.timestamp) >= cutoff)
    }
    return list.sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
  }, [matches, typeFilter, timeFilter])

  /* Series ----------------------------------------------------- */
  const killsData = useMemo(
    () =>
      filteredMatches.map(m => ({
        date: formatDayMonth(m.timestamp),
        kills: matchKills(m),
      })),
    [filteredMatches]
  )

  const placementData = useMemo(
    () =>
      filteredMatches
        .map(m => {
          const pos = matchPosition(m)
          if (pos == null) return null
          return {
            date: formatDayMonth(m.timestamp),
            position: pos,
            type: m.type,
          }
        })
        .filter(Boolean),
    [filteredMatches]
  )

  /* Damage series — pulls m.damage if a numeric value is present.
     The match-logger form does not currently capture damage, so the
     series will be empty until that field gets logged. The chart still
     renders so the structure is in place per spec. */
  const damageData = useMemo(
    () =>
      filteredMatches
        .filter(m => Number.isFinite(Number(m.damage)) && Number(m.damage) > 0)
        .map(m => ({
          date: formatDayMonth(m.timestamp),
          damage: Number(m.damage),
        })),
    [filteredMatches]
  )

  /* Aggregates ------------------------------------------------- */
  const totalKills = killsData.reduce((s, d) => s + (d.kills || 0), 0)
  const matchCount = killsData.length
  const avgKills = matchCount > 0 ? totalKills / matchCount : 0
  const avgKillsLabel = matchCount > 0 ? avgKills.toFixed(1) : '0.0'
  const kdRatioLabel = matchCount > 0 ? avgKills.toFixed(1) : '0.0'

  const avgPosition =
    placementData.length > 0
      ? placementData.reduce((s, d) => s + d.position, 0) / placementData.length
      : 0

  /* Cap the placement Y axis intelligently. Classic = up to 100, scrims/
     tournament = 16. Auto-trim if actual max is much lower. */
  const placementMax = useMemo(() => {
    if (placementData.length === 0) return 16
    const dataMax = Math.max(...placementData.map(d => d.position))
    const hasClassic = placementData.some(d => d.type === 'Classic')
    const cap = hasClassic ? 100 : 16
    return Math.max(Math.min(cap, Math.ceil(dataMax / 4) * 4), 4)
  }, [placementData])

  const hasAnyMatches = Array.isArray(matches) && matches.length > 0

  if (!hasAnyMatches) {
    return <EmptyMatchData />
  }

  return (
    <div className="glass clip-corner-sm p-6 lg:p-7 space-y-6 relative overflow-hidden animate-fade-in">
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-accent-primary opacity-[0.08] blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="heading text-xl text-white tracking-wide flex items-center gap-2">
            <BarChart3 size={20} className="text-accent-secondary" /> MATCH PERFORMANCE
          </h3>
          <p className="text-xs text-text-secondary mt-1 uppercase tracking-widest">
            Trends across the matches you've logged
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="relative z-10 space-y-3">
        <FilterRow
          label="Filter"
          options={TYPE_FILTERS}
          value={typeFilter}
          onChange={setTypeFilter}
        />
        <FilterRow
          label="Time"
          options={TIME_FILTERS}
          value={timeFilter}
          onChange={setTimeFilter}
        />
      </div>

      {/* Kills Trend */}
      <ChartCard title="KILLS TREND" accent="#E8001C">
        {killsData.length === 0 ? (
          <EmptyChart message="No matches in this range yet." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={killsData}
              margin={{ top: 10, right: 16, bottom: 4, left: 0 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#9999AA', fontSize: 11, fontFamily: 'Share Tech Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#9999AA', fontSize: 11, fontFamily: 'Share Tech Mono' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                content={<KillsTooltip />}
                cursor={{ stroke: 'rgba(232,0,28,0.2)', strokeWidth: 1 }}
              />
              <ReferenceLine
                y={avgKills}
                stroke="#FFD700"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
              <Line
                type="monotone"
                dataKey="kills"
                stroke="#E8001C"
                strokeWidth={2.5}
                dot={{ fill: '#E8001C', stroke: '#E8001C', r: 4 }}
                activeDot={{ r: 6, fill: '#FF2D44', stroke: '#fff', strokeWidth: 1.5 }}
                isAnimationActive
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Placement Trend */}
      <ChartCard title="PLACEMENT TREND" accent="#4A9EFF">
        {placementData.length === 0 ? (
          <EmptyChart message="Log placements to see this trend." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={placementData}
              margin={{ top: 10, right: 16, bottom: 4, left: 0 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#9999AA', fontSize: 11, fontFamily: 'Share Tech Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                reversed
                domain={[1, placementMax]}
                tick={{ fill: '#9999AA', fontSize: 11, fontFamily: 'Share Tech Mono' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                content={<PlacementTooltip />}
                cursor={{ stroke: 'rgba(74,158,255,0.2)', strokeWidth: 1 }}
              />
              <ReferenceLine
                y={avgPosition}
                stroke="#FFD700"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
              <Line
                type="monotone"
                dataKey="position"
                stroke="#4A9EFF"
                strokeWidth={2.5}
                dot={{ fill: '#4A9EFF', stroke: '#4A9EFF', r: 4 }}
                activeDot={{ r: 6, fill: '#4A9EFF', stroke: '#fff', strokeWidth: 1.5 }}
                isAnimationActive
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* K/D Ratio + Avg Kills */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        <StatTile value={kdRatioLabel} label="Kill / Death Ratio" accent="red" />
        <StatTile
          value={avgKillsLabel}
          label="Average Kills per Match"
          accent="white"
        />
      </div>

      {/* Damage Trend */}
      <ChartCard title="DAMAGE TREND" accent="#FF2D44">
        {damageData.length === 0 ? (
          <EmptyChart message="No damage logged yet for this range." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={damageData}
              margin={{ top: 10, right: 16, bottom: 4, left: 0 }}
            >
              <defs>
                <linearGradient id="ee-damage-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF2D44" />
                  <stop offset="100%" stopColor="#E8001C" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#9999AA', fontSize: 11, fontFamily: 'Share Tech Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#9999AA', fontSize: 11, fontFamily: 'Share Tech Mono' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={40}
              />
              <Tooltip
                content={<DamageTooltip />}
                cursor={{ fill: 'rgba(232,0,28,0.06)' }}
              />
              <Bar
                dataKey="damage"
                fill="url(#ee-damage-gradient)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  )
}

/* ============================================================
   SUB-COMPONENTS
   ============================================================ */
function FilterRow({ label, options, value, onChange }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[10px] uppercase tracking-[0.15em] text-text-muted heading min-w-[44px]">
        {label}
      </span>
      <div className="flex gap-2 flex-wrap">
        {options.map(opt => {
          const active = value === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className={
                'px-3 py-1.5 rounded-full text-xs uppercase tracking-widest heading transition-all ' +
                (active
                  ? 'bg-red-gradient text-white shadow-red-glow'
                  : 'bg-bg-elevated/60 border border-border text-text-secondary hover:text-white hover:border-accent-primary')
              }
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ChartCard({ title, accent, children }) {
  return (
    <div
      className="rounded-md border border-border bg-bg-elevated/40 p-4 sm:p-5"
      style={{ boxShadow: `inset 0 1px 0 ${accent}10` }}
    >
      <div className="text-xs uppercase tracking-[0.15em] heading text-text-secondary mb-3">
        {title}
      </div>
      <div className="h-[160px] sm:h-[220px] w-full">{children}</div>
    </div>
  )
}

function StatTile({ value, label, accent }) {
  return (
    <div className="rounded-md border border-border bg-bg-elevated/40 p-4 sm:p-5 text-center">
      <div
        className={`heading mono text-4xl lg:text-5xl tracking-wide ${
          accent === 'red' ? 'text-accent-secondary' : 'text-white'
        }`}
      >
        {value}
      </div>
      <div className="heading text-[10px] uppercase tracking-[0.18em] text-text-secondary mt-2">
        {label}
      </div>
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

function EmptyMatchData() {
  return (
    <div className="glass clip-corner-sm p-10 text-center animate-fade-in">
      <div className="text-5xl mb-3 opacity-70">📊</div>
      <h4 className="heading text-lg text-white tracking-wide">No match data yet</h4>
      <p className="text-text-secondary text-sm mt-2 max-w-md mx-auto">
        Log matches to see your performance graphs.
      </p>
    </div>
  )
}
