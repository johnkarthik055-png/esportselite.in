import { useState } from 'react'
import { ChevronRight, ChevronLeft, PanelRightClose } from 'lucide-react'

/* Floating overlay panel for the mobile full-bleed map layout (Map
   Knowledge — View Map's Layers, Strategy Maker's tools, Player
   Mode's briefing, Dev Editor). Unlike the old bottom-sheet drawer
   this replaced, this NEVER affects the map's own size — it just
   floats on top of it (position:fixed, its own background/blur/
   border), so there's nothing for the map to "leave room" for and no
   height math needed at all. Collapsing it down to an icon (matching
   the reference app's pattern) is purely cosmetic here, not a layout
   operation. */
export default function FloatingToolsPanel({ title, children, style }) {
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="mk-floating-panel mk-floating-panel-collapsed"
        aria-label={`Show ${title}`}
        title={`Show ${title}`}
        style={style}
      >
        <ChevronLeft size={16} />
      </button>
    )
  }

  return (
    <div className="mk-floating-panel" style={style}>
      <button
        className="mk-floating-panel-toggle"
        onClick={() => setCollapsed(true)}
        aria-expanded="true"
      >
        <span>{title}</span>
        <PanelRightClose size={14} />
      </button>
      <div className="mk-floating-panel-body">
        {children}
      </div>
    </div>
  )
}
