import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, query, orderBy, getDocs,
} from 'firebase/firestore'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, ReferenceLine,
} from 'recharts'
import {
  BarChart2, Activity, Crosshair, Percent, Trophy, PieChart as PieIcon,
  AlertTriangle, TrendingUp, ArrowRight,
} from 'lucide-react'
import { db } from '../utils/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'

const RED   = '#E8001C'
const BLUE  = '#4A9EFF'
const GREEN = '#00C96E'
const AMBER = '#F59E0B'
const GOLD  = '#FFD700'
const MUTED = '#8888A8'
const PIE_COLORS = [RED, BLUE, GREEN, AMBER, GOLD, MUTED]

const TIME_FILTERS = [
  { id: 'all', label: 'All Time' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '7d',  label: 'Last 7 Days' },
]

/* ============================================================
   PAGE ROOT
   ============================================================ */
export default function Analytics() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterId, setFilterId] = useState('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user?.uid) { setLoading(false); return }
      setLoading(true); setError('')
      try {
        const q = query(
          collection(db, 'users', user.uid, 'matches'),
          orderBy('createdAt', 'asc'),
        )
        const snap = await getDocs(q).catch(async () => {
          /* Older records may lack createdAt — fall back to unordered fetch. */
          return getDocs(collection(db, 'users', user.uid, 'matches'))
        })
        if (cancelled) return
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => tsOf(a) - tsOf(b))
        setMatches(list)
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load matches.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user?.uid])

  const filtered = useMemo(() => {
    if (filterId === 'all') return matches
    const now = Date.now()
    const cutoff = now - (filterId === '30d' ? 30 : 7) * 86400000
    return matches.filter(m => tsOf(m) >= cutoff)
  }, [matches, filterId])

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <AlertTriangle size={18} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, color: 'var(--text-primary)' }}>
            Couldn't load analytics
          </div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {error}
          </div>
        </div>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="card empty-state">
        <BarChart2 size={48} className="empty-state-icon" />
        <div className="empty-state-title">No match data yet</div>
        <div className="empty-state-desc">
          Log matches in Training Center to see your performance analytics here.
        </div>
        <button
          onClick={() => navigate('/training')}
          className="btn btn-primary btn-sm"
          style={{ marginTop: 12 }}
        >
          Log a Match <ArrowRight size={13} />
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-transition">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
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
            Analytics
          </h1>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Based on {matches.length} match{matches.length === 1 ? '' : 'es'} logged
            {filterId !== 'all' && ` · ${filtered.length} in view`}
          </div>
        </div>
        <div className="seg">
          {TIME_FILTERS.map(f => (
            <button
              key={f.id}
              className={`seg-btn ${filterId === f.id ? 'active' : ''}`}
              onClick={() => setFilterId(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <SummaryRow matches={filtered} />
      <TrendRow matches={filtered} />
      <PlacementAndModeRow matches={filtered} />
      <WeaponAndWeaknessRow matches={filtered} />
      <ModeBreakdownRow matches={filtered} />
      <RecentMatchesRow matches={filtered.length > 0 ? filtered : matches} />
    </div>
  )
}

/* ============================================================
   ROW 1 — SUMMARY CARDS
   ============================================================ */
function SummaryRow({ matches }) {
  const total = matches.length
  const totalKills = matches.reduce((s, m) => s + killsOf(m), 0)
  const totalDamage = matches.reduce((s, m) => s + Number(m.damage || 0), 0)
  const wins = matches.filter(m => isWin(m)).length
  const decided = matches.filter(m => m.result != null || placementOf(m) > 0).length
  const kd = total > 0 ? totalKills / total : 0
  const avgDamage = total > 0 ? Math.round(totalDamage / total) : 0
  const winRate = decided > 0 ? (wins / decided) * 100 : 0

  const kdColor = kd >= 2 ? 'var(--green)' : kd >= 1 ? 'var(--amber)' : 'var(--red)'
  const winColor = winRate >= 50 ? 'var(--green)' : winRate >= 30 ? 'var(--amber)' : 'var(--red)'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14,
      }}
    >
      <StatTile icon={<BarChart2 size={18} />} value={total} label="Total Matches" />
      <StatTile icon={<Crosshair size={18} />} value={kd.toFixed(2)} label="Avg K/D" valueColor={kdColor} />
      <StatTile icon={<Activity size={18} />}  value={avgDamage.toLocaleString()} label="Avg Damage" />
      <StatTile icon={<Percent size={18} />}   value={`${winRate.toFixed(1)}%`} label="Win Rate" valueColor={winColor} />
    </div>
  )
}

/* ============================================================
   ROW 2 — KD + DAMAGE TREND
   ============================================================ */
function TrendRow({ matches }) {
  const last20 = matches.slice(-20)
  const kdData = last20.map((m, i) => ({
    idx: i + 1,
    date: fmtDate(m),
    kd: killsOf(m),
  }))
  const dmgData = last20.map((m, i) => ({
    idx: i + 1,
    date: fmtDate(m),
    damage: Number(m.damage || 0),
  }))

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}
      className="analytics-2col"
    >
      <ChartCard title="K/D Trend" icon={<TrendingUp size={15} />}>
        {kdData.length === 0 ? <ChartEmpty /> : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={kdData} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: MUTED, strokeOpacity: 0.3 }} />
              <Area type="monotone" dataKey="kd" name="Kills" stroke={RED} strokeWidth={2} fill="rgba(232,0,28,0.1)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Damage per Match" icon={<Activity size={15} />}>
        {dmgData.length === 0 ? <ChartEmpty /> : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dmgData} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: MUTED, strokeOpacity: 0.3 }} />
              <Area type="monotone" dataKey="damage" name="Damage" stroke={BLUE} strokeWidth={2} fill="rgba(74,158,255,0.1)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <style>{`
        @media (min-width: 900px) {
          .analytics-2col { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  )
}

/* ============================================================
   ROW 3 — PLACEMENT + WIN RATE BY MODE
   ============================================================ */
function PlacementAndModeRow({ matches }) {
  const placementData = matches
    .map((m, i) => ({ idx: i + 1, placement: placementOf(m) }))
    .filter(d => d.placement > 0)
    .slice(-25)

  const modes = ['Classic', 'Scrims', 'Tournament']
  const winData = modes.map(mode => {
    const modeMatches = matches.filter(m => modeOf(m) === mode)
    const decided = modeMatches.filter(m => m.result != null || placementOf(m) > 0)
    const wins = modeMatches.filter(m => isWin(m)).length
    const winRate = decided.length > 0 ? Math.round((wins / decided.length) * 100) : 0
    return { mode, winRate, count: modeMatches.length }
  })

  return (
    <div
      className="analytics-6040"
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}
    >
      <ChartCard title="Placement Trend" icon={<Trophy size={15} />}>
        {placementData.length === 0 ? <ChartEmpty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={placementData} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="idx" {...axisProps} tickFormatter={(v) => `#${v}`} />
              <YAxis {...axisProps} domain={[25, 1]} reversed={false} />
              <Tooltip content={<CustomTooltip labelPrefix="Match" placementMode />} cursor={{ stroke: MUTED, strokeOpacity: 0.3 }} />
              <ReferenceLine
                y={10}
                stroke="var(--border)"
                strokeDasharray="4 4"
                label={{ value: 'Top 10', position: 'insideTopRight', fill: MUTED, fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}
              />
              <Line type="monotone" dataKey="placement" name="Placement" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Win Rate by Mode" icon={<Percent size={15} />}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={winData} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="mode" {...axisProps} />
            <YAxis {...axisProps} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<CustomTooltip suffix="%" secondaryKey="count" secondaryLabel="Matches" />} cursor={{ fill: 'rgba(232,0,28,0.05)' }} />
            <Bar dataKey="winRate" name="Win Rate" fill={RED} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <style>{`
        @media (min-width: 900px) {
          .analytics-6040 { grid-template-columns: 3fr 2fr !important; }
        }
      `}</style>
    </div>
  )
}

/* ============================================================
   ROW 4 — WEAPON USAGE + WEAKNESS BREAKDOWN
   ============================================================ */
function WeaponAndWeaknessRow({ matches }) {
  /* Weapon usage — count occurrences across matches[i].weapons arrays. */
  const weaponCounts = {}
  matches.forEach(m => {
    const list = Array.isArray(m.weapons) ? m.weapons
      : Array.isArray(m.gunsSelected) ? m.gunsSelected
      : []
    list.forEach(w => {
      const name = String(w || '').trim()
      if (!name) return
      weaponCounts[name] = (weaponCounts[name] || 0) + 1
    })
  })
  const weaponTotal = Object.values(weaponCounts).reduce((s, n) => s + n, 0)
  const weaponData = Object.entries(weaponCounts)
    .map(([name, count]) => ({ name, count, pct: weaponTotal > 0 ? (count / weaponTotal) * 100 : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  /* Weakness frequency */
  const weaknessCounts = {}
  matches.forEach(m => {
    const raw =
      Array.isArray(m.weaknesses) ? m.weaknesses
      : Array.isArray(m.weakestPoints) ? m.weakestPoints
      : (m.weakness || m.weakestPoint || '')
    const parts = Array.isArray(raw) ? raw : String(raw).split(/[,;]/)
    parts
      .map(p => String(p).trim())
      .filter(Boolean)
      .forEach(p => { weaknessCounts[p] = (weaknessCounts[p] || 0) + 1 })
  })
  const weaknessData = Object.entries(weaknessCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const weaknessColorFor = (count) =>
    count >= 5 ? RED :
    count >= 3 ? AMBER :
    BLUE

  return (
    <div
      className="analytics-2col"
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}
    >
      <ChartCard title="Weapon Usage" icon={<PieIcon size={15} />}>
        {weaponData.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px 12px' }}>
            <div className="empty-state-title">No weapon data</div>
            <div className="empty-state-desc">Weapons picked during drills appear once logged with matches.</div>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={weaponData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  paddingAngle={2}
                  stroke="var(--bg-surface)"
                  strokeWidth={2}
                >
                  {weaponData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 6,
                marginTop: 8,
              }}
            >
              {weaponData.map((w, i) => (
                <div
                  key={w.name}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      width: 10, height: 10, borderRadius: 2,
                      background: PIE_COLORS[i % PIE_COLORS.length],
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                    {w.name}
                  </span>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-subtle)' }}>
                    {w.pct.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </ChartCard>

      <ChartCard title="Weakness Breakdown" icon={<AlertTriangle size={15} />}>
        {weaknessData.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px 12px' }}>
            <div className="empty-state-title">No weaknesses logged</div>
            <div className="empty-state-desc">Weaknesses recorded per match appear here.</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, weaknessData.length * 34)}>
            <BarChart
              data={weaknessData}
              layout="vertical"
              margin={{ top: 6, right: 20, left: 0, bottom: 6 }}
            >
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" {...axisProps} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                {...axisProps}
                tick={{ ...axisProps.tick, textAnchor: 'end' }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="count" name="Occurrences" radius={[0, 4, 4, 0]}>
                {weaknessData.map((row, i) => (
                  <Cell key={i} fill={weaknessColorFor(row.count)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  )
}

/* ============================================================
   ROW 5 — MODE BREAKDOWN CARDS
   ============================================================ */
function ModeBreakdownRow({ matches }) {
  const modes = [
    { name: 'Classic',    badge: 'badge badge-blue'  },
    { name: 'Scrims',     badge: 'badge badge-amber' },
    { name: 'Tournament', badge: 'badge badge-red'   },
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
      }}
    >
      {modes.map(({ name, badge }) => {
        const list = matches.filter(m => modeOf(m) === name)
        const count = list.length
        const kills = list.reduce((s, m) => s + killsOf(m), 0)
        const damage = list.reduce((s, m) => s + Number(m.damage || 0), 0)
        const decided = list.filter(m => m.result != null || placementOf(m) > 0)
        const wins = list.filter(m => isWin(m)).length
        const kd = count > 0 ? (kills / count).toFixed(2) : '0.00'
        const avgDamage = count > 0 ? Math.round(damage / count) : 0
        const winRate = decided.length > 0 ? `${Math.round((wins / decided.length) * 100)}%` : '—'

        return (
          <div key={name} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  fontFamily: 'Bebas Neue, sans-serif',
                  fontSize: 18,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--text-primary)',
                }}
              >
                {name}
              </div>
              <span className={badge}>{count} match{count === 1 ? '' : 'es'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <MiniStat label="Count"    value={count} />
              <MiniStat label="Avg K/D"  value={kd} />
              <MiniStat label="Avg Dmg"  value={avgDamage.toLocaleString()} />
              <MiniStat label="Win Rate" value={winRate} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ============================================================
   ROW 6 — RECENT MATCHES TABLE
   ============================================================ */
function RecentMatchesRow({ matches }) {
  const recent = [...matches].slice(-10).reverse()

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Recent Matches</div>
        <div className="label">Last {recent.length}</div>
      </div>
      {recent.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No matches in the current window</div>
          <div className="empty-state-desc">Widen the time filter to see more.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mode</th>
                <th>Kills</th>
                <th>Damage</th>
                <th>Placement</th>
                <th>Weakness</th>
                <th style={{ textAlign: 'right' }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(m => {
                const p = placementOf(m)
                const placeColor =
                  p >= 1 && p <= 3 ? 'var(--gold)' :
                  p >= 4 && p <= 10 ? 'var(--green)' :
                  p > 10 ? 'var(--text-muted)' : 'var(--text-subtle)'
                const won = isWin(m)
                const lost = m.result === false || m.result === 'lost' || m.result === 'loss'
                const weakness =
                  Array.isArray(m.weaknesses) ? m.weaknesses.join(', ')
                  : Array.isArray(m.weakestPoints) ? m.weakestPoints.join(', ')
                  : (m.weakness || m.weakestPoint || '')
                return (
                  <tr key={m.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{fmtDate(m)}</td>
                    <td>{modeOf(m) || '—'}</td>
                    <td className="mono">{killsOf(m)}</td>
                    <td className="mono">{Number(m.damage || 0).toLocaleString()}</td>
                    <td className="mono" style={{ color: placeColor }}>
                      {p > 0 ? `#${p}` : '—'}
                    </td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {weakness || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {won
                        ? <span className="badge badge-green">WIN</span>
                        : lost
                        ? <span className="badge badge-red">LOSS</span>
                        : <span className="badge">—</span>}
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
function StatTile({ icon, value, label, valueColor }) {
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
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 10px',
      }}
    >
      <div
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: 18,
          letterSpacing: '0.04em',
          color: 'var(--text-primary)',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div className="stat-label" style={{ marginTop: 4 }}>{label}</div>
    </div>
  )
}

function ChartCard({ title, icon, children }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{title}</div>
        {icon && <span style={{ color: 'var(--text-subtle)' }}>{icon}</span>}
      </div>
      {children}
    </div>
  )
}

function ChartEmpty() {
  return (
    <div className="empty-state" style={{ padding: '30px 12px' }}>
      <div className="empty-state-title">Not enough data</div>
      <div className="empty-state-desc">Log more matches to see this chart.</div>
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

function CustomTooltip({
  active, payload, label,
  labelPrefix, suffix, secondaryKey, secondaryLabel, placementMode,
}) {
  if (!active || !payload?.length) return null
  const primary = payload[0]
  const value = primary?.value
  const displayValue = suffix ? `${value}${suffix}` : value

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
        {labelPrefix ? `${labelPrefix} #${label}` : label}
      </p>
      <p style={{ color: primary.color || 'var(--text-primary)', fontWeight: 600, margin: 0 }}>
        {placementMode
          ? `${primary.name}: #${value}`
          : `${primary.name}: ${displayValue}`}
      </p>
      {secondaryKey && payload[0]?.payload?.[secondaryKey] != null && (
        <p style={{ color: 'var(--text-subtle)', margin: 0, marginTop: 4 }}>
          {secondaryLabel || secondaryKey}: {payload[0].payload[secondaryKey]}
        </p>
      )}
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
   HELPERS — normalise fields across older/newer match records
   ============================================================ */
function tsOf(m) {
  if (m?.createdAt?.toMillis) return m.createdAt.toMillis()
  if (typeof m?.timestamp === 'number') return m.timestamp
  if (typeof m?.createdAt === 'string') {
    const t = new Date(m.createdAt).getTime()
    return isNaN(t) ? 0 : t
  }
  if (m?.createdAt instanceof Date) return m.createdAt.getTime()
  return 0
}

function fmtDate(m) {
  const ms = tsOf(m)
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function killsOf(m) {
  if (m == null) return 0
  if (m.kills != null) return Number(m.kills) || 0
  if (m.individualKills != null) return Number(m.individualKills) || 0
  return 0
}

function placementOf(m) {
  if (m == null) return 0
  return Number(m.placement || m.position || m.teamPosition || 0) || 0
}

function modeOf(m) {
  const raw = (m?.mode || m?.type || '').trim()
  if (!raw) return ''
  const lower = raw.toLowerCase()
  if (lower === 'classic')    return 'Classic'
  if (lower === 'scrims')     return 'Scrims'
  if (lower === 'tournament') return 'Tournament'
  return raw
}

function isWin(m) {
  if (m == null) return false
  if (m.result === true || m.result === 'won' || m.result === 'win') return true
  if (m.result === false || m.result === 'lost' || m.result === 'loss') return false
  const p = placementOf(m)
  return p >= 1 && p <= 3
}
