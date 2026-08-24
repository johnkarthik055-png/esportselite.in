import { MousePointer2, MapPin, Route, CircleDot, Pencil, Ruler } from 'lucide-react'
import { useStrategyStore, setTool } from './strategyStore.js'

const PRIMARY_TOOLS = [
  { key: 'select',   label: 'Select',   icon: MousePointer2 },
  { key: 'marker',   label: 'Marker',   icon: MapPin },
  { key: 'rotation', label: 'Rotation', icon: Route },
  { key: 'zone',     label: 'Zone',     icon: CircleDot },
  { key: 'draw',     label: 'Draw',     icon: Pencil },
  { key: 'measure',  label: 'Measure',  icon: Ruler },
]

const HINTS = {
  select:   'Select a tool and click anywhere on the map to start.',
  marker:   'Click the map to place a marker.',
  rotation: 'Click to add waypoints, double-click to finish the route.',
  zone:     'Click the center, then click to set the radius.',
  draw:     'Click and drag (or touch and drag) to sketch a freehand line.',
  measure:  'Click two points on the map to measure distance.',
}

export default function BottomToolBar() {
  const st = useStrategyStore()

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {PRIMARY_TOOLS.map(t => (
          <ToolButton key={t.key} tool={t} active={st.tool === t.key} onClick={() => setTool(t.key)} />
        ))}
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
