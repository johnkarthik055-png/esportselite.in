import { distanceBetween, bearingBetween, estimateTravelSeconds } from '../../utils/strategyDataSchema.js'
import { useStrategyStore } from './strategyStore.js'
import { SectionLabel } from './strategyUI.jsx'

function formatSeconds(s) {
  if (s == null) return '—'
  if (s < 60) return `${Math.round(s)}s`
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}

export default function MeasureReadout({ mapId }) {
  const st = useStrategyStore()
  if (!st.measureFrom) {
    return (
      <div className="card">
        <SectionLabel small>Measure</SectionLabel>
        <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Click two points on the map.</div>
      </div>
    )
  }
  if (!st.measureTo) {
    return (
      <div className="card">
        <SectionLabel small>Measure</SectionLabel>
        <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Click the second point.</div>
      </div>
    )
  }

  const { meters, worldUnits } = distanceBetween(st.measureFrom, st.measureTo, mapId)
  const bearing = bearingBetween(st.measureFrom, st.measureTo)
  const seconds = estimateTravelSeconds(meters)

  return (
    <div className="card">
      <SectionLabel small>Measure</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
        <Row label="Distance" value={meters != null ? `${Math.round(meters)} m` : `${worldUnits.toFixed(2)} world units`} />
        {meters == null && (
          <div style={{ fontSize: 10, color: 'var(--text-subtle)', fontStyle: 'italic' }}>
            No verified real-world scale for this map yet — showing straight-line world units instead of meters.
          </div>
        )}
        <Row label="Bearing" value={`${Math.round(bearing)}°`} />
        <Row label="Est. travel time (on foot)" value={formatSeconds(seconds)} />
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-subtle)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
    </div>
  )
}
