import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  MousePointer2, Pencil, Minus, ArrowUpRight, Square, Circle as CircleIcon, Type, Eraser,
  Route, Flag, Shapes, Wrench, Layers, LayoutGrid, Eye, Plane,
  Undo2, Redo2, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react'
import {
  DRAWING_TOOLS, TACTICAL_TOOLS, ZONE_GROUP,
} from '../../utils/strategyDataSchema.js'
import {
  useStrategyStore, setTool, setSelectedZone, toggleShowPaths, toggleFlightPath,
  undo, redo, clearAllObjects,
} from '../../utils/strategyDataSchema.js'
import { useConfirm } from '../../hooks/useConfirm.js'
import ConfirmModal from '../ConfirmModal.jsx'

const ICONS = {
  MousePointer2, Pencil, Minus, ArrowUpRight, Square, CircleIcon, Type, Eraser,
  Route, Flag, Shapes, Wrench, Layers, LayoutGrid, Eye, Plane,
  Undo2, Redo2, Trash2,
}

function Row({ icon, label, active, onClick, collapsed }) {
  const Icon = ICONS[icon]
  return (
    <button
      className={`sft-row${active ? ' sft-row-active' : ''}`}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Icon size={15} />
      {!collapsed && <span>{label}</span>}
    </button>
  )
}

/* Compact floating LEFT-side tool palette — sized to its content, not
   a permanent full-height sidebar. Collapses to an icon-only rail via
   local state (no persistence needed per spec). Every row is a small
   tappable button with a native title= tooltip, grouped exactly per
   spec: Drawing / Tactical / Zones / Edit. */
export default function FloatingToolbar() {
  const st = useStrategyStore()
  const { confirm, confirmModalProps } = useConfirm()
  /* Start collapsed on real touch devices / very narrow viewports so
     the toolbar never dominates a phone screen — matchMedia, not width
     alone, per the mobile lessons in the spec. Desktop starts expanded. */
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 720
  })

  /* On touch devices the toolbar and the context/zone toolbars share
     the top band of a small screen — collapse the toolbar back to its
     icon rail once a tool is chosen so the two never overlap. Desktop
     has the width to keep it open. */
  const isCoarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  function pickTool(key) {
    setTool(key)
    if (isCoarse) setCollapsed(true)
  }

  async function handleClearAll() {
    if (st.objects.length === 0) return
    if (!await confirm('Clear every drawing on this map? This cannot be undone once other actions follow.', { title: 'Clear all drawings' })) return
    clearAllObjects()
  }

  function handleZoneGroupClick(entry) {
    if (entry.key === 'showPaths') { toggleShowPaths(); return }
    if (entry.key === 'flightPath') { toggleFlightPath(); return }
    if (entry.key === 'zone') { pickTool('zone'); setSelectedZone(st.selectedZone === 'all' || st.selectedZone == null ? 1 : st.selectedZone); return }
    if (entry.key === 'allZones') { pickTool('zone'); setSelectedZone('all'); return }
  }
  function isZoneEntryActive(entry) {
    if (entry.key === 'showPaths') return st.showPaths
    if (entry.key === 'flightPath') return st.flightPathVisible
    if (entry.key === 'zone') return st.tool === 'zone' && st.selectedZone !== 'all'
    if (entry.key === 'allZones') return st.tool === 'zone' && st.selectedZone === 'all'
    return false
  }

  return (
    <div className={`sft-panel${collapsed ? ' sft-collapsed' : ''}`}>
      <button
        className="sft-collapse-btn"
        onClick={() => setCollapsed(v => !v)}
        title={collapsed ? 'Expand toolbar' : 'Collapse toolbar'}
        aria-label={collapsed ? 'Expand toolbar' : 'Collapse toolbar'}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className="sft-scroll">
        {!collapsed && <div className="sft-group-label">Drawing</div>}
        {DRAWING_TOOLS.map(t => (
          <Row key={t.key} icon={t.icon} label={t.label} collapsed={collapsed}
            active={st.tool === t.key} onClick={() => pickTool(t.key)} />
        ))}
        {/* Eraser — click any drawn object to remove it (undo-able).
            Kept in the schema-free layer here so strategyDataSchema.js
            stays untouched this pass; DrawingCanvas keys off tool==='eraser'. */}
        <Row key="eraser" icon="Eraser" label="Eraser" collapsed={collapsed}
          active={st.tool === 'eraser'} onClick={() => pickTool('eraser')} />

        {!collapsed && <div className="sft-group-label">Tactical</div>}
        {TACTICAL_TOOLS.map(t => (
          <Row key={t.key} icon={t.icon} label={t.label} collapsed={collapsed}
            active={st.tool === t.key} onClick={() => pickTool(t.key)} />
        ))}

        {!collapsed && <div className="sft-group-label">Zones</div>}
        {ZONE_GROUP.map(entry => (
          <Row key={entry.key} icon={entry.icon} label={entry.label} collapsed={collapsed}
            active={isZoneEntryActive(entry)} onClick={() => handleZoneGroupClick(entry)} />
        ))}

        {!collapsed && <div className="sft-group-label">Edit</div>}
        <Row icon="Undo2" label="Undo" collapsed={collapsed} active={false} onClick={undo} />
        <Row icon="Redo2" label="Redo" collapsed={collapsed} active={false} onClick={redo} />
        <Row icon="Trash2" label="Clear All" collapsed={collapsed} active={false} onClick={handleClearAll} />
      </div>

      {/* Portalled to <body> — same stacking-context reasoning as the
          modals in StrategyMaker.jsx. */}
      {createPortal(<ConfirmModal {...confirmModalProps} />, document.body)}
    </div>
  )
}
