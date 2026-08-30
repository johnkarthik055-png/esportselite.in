import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useStrategyStore } from '../../utils/strategyDataSchema.js'
import { TACTICAL_TOOLS_BY_KEY } from '../../utils/strategyDataSchema.js'

/* ============================================================
   LAYERS PANEL  (+ its own tiny module store)
   ------------------------------------------------------------
   Per-object-type visibility for Strategy Maker, plus the
   open/closed state of the panel itself. Kept here rather than
   in strategyDataSchema.js (which this pass must not touch) but
   built the same way — a module-scoped object + an EventTarget
   bus, read via useLayersStore(). DrawingCanvas filters drawn
   objects by isTypeHidden(); FloatingToolbar toggles the panel.
   ============================================================ */
const bus = new EventTarget()
const fire = () => bus.dispatchEvent(new Event('change'))
const state = { open: false, hidden: {} /* type -> true means HIDDEN */ }

export function useLayersStore() {
  const [, tick] = useState(0)
  useEffect(() => {
    const h = () => tick(v => v + 1)
    bus.addEventListener('change', h)
    return () => bus.removeEventListener('change', h)
  }, [])
  return state
}
export function toggleLayersPanel() { state.open = !state.open; fire() }
export function closeLayersPanel() { state.open = false; fire() }
export function isTypeHidden(type) { return !!state.hidden[type] }
export function toggleTypeHidden(type) {
  if (state.hidden[type]) delete state.hidden[type]
  else state.hidden[type] = true
  fire()
}
/* Called by DrawingCanvas when the active map changes so hidden
   layers from the previous map don't carry over. */
export function resetLayerVisibility() {
  if (Object.keys(state.hidden).length === 0) return
  state.hidden = {}
  fire()
}

/* Display groups — one row per object type, in a sensible order.
   Only groups that currently have at least one object are shown. */
const GROUPS = [
  { key: 'pencil',        label: 'Pencil Drawings' },
  { key: 'line',          label: 'Lines' },
  { key: 'arrow',         label: 'Arrows' },
  { key: 'rectangle',     label: 'Rectangles' },
  { key: 'circle',        label: 'Circles' },
  { key: 'text',          label: 'Text' },
  { key: 'teamRotation',  label: 'Team Rotations' },
  { key: 'teamDrop',      label: 'Team Drops' },
  { key: 'pathZone',      label: 'Draw Path & Zone' },
  { key: 'utilityMarker', label: 'Utility Markers' },
  { key: 'polygon',       label: 'Polygons (legacy)' },
]
function dotColor(type) {
  const t = TACTICAL_TOOLS_BY_KEY[type]
  if (t) return t.defaultColor
  return 'var(--blue)'
}

export default function LayersPanel() {
  const ls = useLayersStore()
  const st = useStrategyStore()
  if (!ls.open) return null

  const counts = {}
  for (const o of st.objects) counts[o.type] = (counts[o.type] || 0) + 1
  const groups = GROUPS.filter(g => counts[g.key] > 0)
  const total = st.objects.length

  return (
    <div className="slp-panel">
      <div className="slp-head">
        <span className="slp-title">Layers</span>
        <button className="slp-close" onClick={closeLayersPanel} aria-label="Close layers panel">
          <X size={13} />
        </button>
      </div>

      <div className="slp-body">
        {groups.length === 0 ? (
          <div className="slp-empty">
            Nothing drawn yet. Objects you add are grouped here by type so you can show / hide them while explaining a strategy.
          </div>
        ) : (
          groups.map(g => {
            const hidden = isTypeHidden(g.key)
            return (
              <button
                key={g.key}
                className="slp-row"
                onClick={() => toggleTypeHidden(g.key)}
                aria-pressed={!hidden}
              >
                <span className={`slp-check${hidden ? '' : ' slp-check-on'}`} aria-hidden>
                  {hidden ? '' : '✓'}
                </span>
                <span className="slp-dot" style={{ background: dotColor(g.key) }} aria-hidden />
                <span className="slp-label">{g.label}</span>
                <span className="slp-count">{counts[g.key]}</span>
              </button>
            )
          })
        )}
      </div>

      {groups.length > 0 && (
        <div className="slp-foot">{total} object{total === 1 ? '' : 's'} total</div>
      )}
    </div>
  )
}
