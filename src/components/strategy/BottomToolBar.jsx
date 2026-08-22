import { useState } from 'react'
import {
  MousePointer2, MapPin, Route, Swords, CircleDot, Users2, Ruler,
  MoreHorizontal, FlaskConical, Eye, Car,
} from 'lucide-react'
import { useStrategyStore, setTool } from './strategyStore.js'

const PRIMARY_TOOLS = [
  { key: 'select',    label: 'Select',    icon: MousePointer2 },
  { key: 'marker',    label: 'Marker',    icon: MapPin },
  { key: 'rotation',  label: 'Rotation',  icon: Route },
  { key: 'combat',    label: 'Combat',    icon: Swords },
  { key: 'zone',      label: 'Zone',      icon: CircleDot },
  { key: 'formation', label: 'Formation', icon: Users2 },
  { key: 'measure',   label: 'Measure',   icon: Ruler },
]
const MORE_TOOLS = [
  { key: 'utility', label: 'Utility', icon: FlaskConical },
  { key: 'vision',  label: 'Vision',  icon: Eye },
  { key: 'vehicle', label: 'Vehicle', icon: Car },
]

const HINTS = {
  select:    'Select a tool and click anywhere on the map to start.',
  marker:    'Click the map to place a marker.',
  rotation:  'Click to add waypoints, double-click to finish the route.',
  combat:    'Click a start point, then click the target point.',
  utility:   'Click the throw point, then click the target point.',
  vision:    'Click the origin, then click to set facing direction.',
  zone:      'Click the center, then click to set the radius.',
  vehicle:   'Click the map to place a tactical vehicle annotation.',
  formation: 'Pick a preset below, then click the map to place the squad.',
  measure:   'Click two points on the map to measure distance.',
}

export default function BottomToolBar() {
  const st = useStrategyStore()
  const [moreOpen, setMoreOpen] = useState(false)
  const activeInMore = MORE_TOOLS.some(t => t.key === st.tool)

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {PRIMARY_TOOLS.map(t => (
          <ToolButton key={t.key} tool={t} active={st.tool === t.key} onClick={() => { setTool(t.key); setMoreOpen(false) }} />
        ))}
        <div style={{ position: 'relative' }}>
          <ToolButton
            tool={{ key: 'more', label: 'More', icon: MoreHorizontal }}
            active={activeInMore}
            onClick={() => setMoreOpen(v => !v)}
          />
          {moreOpen && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, marginBottom: 6,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
              minWidth: 140, zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {MORE_TOOLS.map(t => {
                const Icon = t.icon
                const active = st.tool === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => { setTool(t.key); setMoreOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px',
                      background: active ? 'var(--blue)' : 'transparent',
                      color: active ? '#fff' : 'var(--text-primary)',
                      border: 'none', borderRadius: 6, cursor: 'pointer',
                      fontFamily: 'DM Sans, sans-serif', fontSize: 12, textAlign: 'left',
                    }}
                  >
                    <Icon size={13} /> {t.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
        {HINTS[st.tool] || HINTS.select}
      </div>
    </div>
  )
}

function ToolButton({ tool, active, onClick }) {
  const Icon = tool.icon
  return (
    <button
      onClick={onClick}
      title={tool.label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '8px 14px', minWidth: 64,
        background: active ? 'var(--blue)' : 'var(--bg-elevated)',
        border: `1px solid ${active ? 'var(--blue)' : 'var(--border)'}`,
        borderRadius: 8, cursor: 'pointer',
        color: active ? '#fff' : 'var(--text-primary)',
        fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600,
      }}
    >
      <Icon size={16} />
      {tool.label}
    </button>
  )
}
