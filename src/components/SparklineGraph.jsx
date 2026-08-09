import { useMemo, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { STORAGE_KEYS } from '../utils/constants.js'

/**
 * Kill-trend sparkline — last 10 scrim/tournament matches by individual kills.
 * Pure inline SVG, no chart library. Hover dots reveal a tooltip.
 */
export default function SparklineGraph() {
  const [matches] = useLocalStorage(STORAGE_KEYS.MATCHES, [])
  const [hover, setHover] = useState(null)

  const scrims = useMemo(() => {
    return (Array.isArray(matches) ? matches : [])
      .filter(m => m.type === 'Scrims' || m.type === 'Tournament')
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-10)
      .map((m, i) => ({
        idx: i + 1,
        kills: Number(m.individualKills) || 0,
        ts: m.timestamp,
      }))
  }, [matches])

  if (scrims.length < 3) {
    return (
      <div className="text-center text-text-muted text-xs py-6">
        Log more scrims to see trend
      </div>
    )
  }

  /* Trend = compare first-3 vs last-3 averages. */
  const firstAvg =
    scrims.slice(0, 3).reduce((s, d) => s + d.kills, 0) / 3
  const lastAvg =
    scrims.slice(-3).reduce((s, d) => s + d.kills, 0) / 3
  const diff = lastAvg - firstAvg
  const trend = Math.abs(diff) < 0.5 ? 'flat' : diff > 0 ? 'up' : 'down'
  const color = trend === 'up' ? '#00E676' : trend === 'down' ? '#FF3D44' : '#9999AA'
  const arrow = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'
  const label =
    trend === 'up' ? 'Trending up' : trend === 'down' ? 'Trending down' : 'Consistent'

  const max = Math.max(...scrims.map(s => s.kills), 1)
  const W = 100
  const H = 100
  const pad = 6
  const innerW = W - pad * 2
  const innerH = H - pad * 2
  const pts = scrims.map((s, i) => {
    const x =
      scrims.length === 1
        ? pad + innerW / 2
        : pad + (i / (scrims.length - 1)) * innerW
    const y = pad + innerH - (s.kills / max) * innerH
    return { x, y, idx: s.idx, kills: s.kills }
  })
  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(2)} ${H - pad} L ${pts[0].x.toFixed(
    2
  )} ${H - pad} Z`

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height="48"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="ee-spark-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#ee-spark-grad)" stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="2"
            fill={color}
            stroke="#0A0A0F"
            strokeWidth="0.5"
            onMouseEnter={() => setHover(p)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: 'pointer' }}
          />
        ))}
      </svg>

      {hover && (
        <div
          className="absolute mono text-[10px] px-2 py-1 rounded-md shadow-xl pointer-events-none whitespace-nowrap"
          style={{
            left: `${hover.x}%`,
            top: 0,
            transform: 'translate(-50%, -120%)',
            background: 'rgba(17,17,24,0.95)',
            border: `1px solid ${color}`,
            color,
          }}
        >
          Match {hover.idx}: {hover.kills} kills
        </div>
      )}

      <div
        className="text-xs heading uppercase tracking-widest mt-2 flex items-center gap-1.5"
        style={{ color }}
      >
        <span>{arrow}</span> {label}
      </div>
    </div>
  )
}
