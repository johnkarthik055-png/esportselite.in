import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { useStrategyStore } from './strategyStore.js'

const TOOL_LABELS = {
  select: 'Select', marker: 'Marker', rotation: 'Rotation', combat: 'Combat',
  utility: 'Utility', vision: 'Vision', zone: 'Zone', vehicle: 'Vehicle',
  formation: 'Formation', measure: 'Measure',
}

/* Mobile-only collapsible bottom sheet for Strategy Maker's Coach
   Mode controls (tool bar + Mode/Actions/Layers/Selected Item/Save).
   Rendered as position:fixed so it floats OVER the map instead of
   pushing it into flex-column flow — that flow-squeeze (map column
   shrinking to fit whatever sits below it) is exactly what produced
   the "map crushed to a sliver" bug, so the fix is to take this
   content out of flow entirely on mobile, not just resize it.
   Defaults to collapsed (just the active tool + a handle to expand)
   so the map stays dominant until the user actually wants the full
   tool grid — desktop's always-visible sidebar is untouched, this
   component only ever mounts on mobile. */
export default function MobileToolDrawer({ children }) {
  const st = useStrategyStore()
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="strategy-mobile-drawer"
      style={{
        position: 'fixed', left: 0, right: 0,
        /* Bottom offset (clearing the fixed bottom nav bar, which
           itself only renders <=768px) is defined in MapStyles()'s
           .strategy-mobile-drawer media query rather than here —
           needs its own breakpoint distinct from the drawer's own
           <=900px "should this drawer render at all" threshold, so
           tablet widths (769-900px, no bottom nav) don't reserve
           space for a nav bar that isn't actually on screen. */
        zIndex: 30, /* above the map canvas, below ConfirmModal (50) and the bottom-nav "More" drawer (1999) */
        display: 'flex', flexDirection: 'column',
        background: 'var(--sidebar)',
        borderTop: '1px solid var(--border)',
        borderRadius: '16px 16px 0 0',
        boxShadow: '0 -12px 32px rgba(0,0,0,0.55)',
        maxHeight: expanded ? '62vh' : 'auto',
      }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '12px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <span style={{ width: 32, height: 3, borderRadius: 999, background: 'var(--border)', position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)' }} />
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0 }} />
        <span style={{
          flex: 1, textAlign: 'left', fontFamily: 'DM Sans, sans-serif',
          fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
        }}>
          {TOOL_LABELS[st.tool] || 'Tools'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {expanded ? 'Collapse' : 'Tools'}
        </span>
        {expanded ? <ChevronDown size={16} color="var(--text-subtle)" /> : <ChevronUp size={16} color="var(--text-subtle)" />}
      </button>

      {expanded && (
        <div style={{
          overflowY: 'auto',
          padding: '0 12px calc(20px + env(safe-area-inset-bottom, 0px))',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {children}
        </div>
      )}
    </div>
  )
}
