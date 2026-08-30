import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  MousePointer2, Pencil, Minus, ArrowUpRight, Square, Circle as CircleIcon, Type, Eraser,
  Route, Flag, Shapes, Wrench, Layers, LayoutGrid, Eye, Plane, Boxes, MoreHorizontal,
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
import { useViewport } from '../../utils/viewport.js'
import { toggleLayersPanel, useLayersStore } from './LayersPanel.jsx'

const ICONS = {
  MousePointer2, Pencil, Minus, ArrowUpRight, Square, CircleIcon, Type, Eraser,
  Route, Flag, Shapes, Wrench, Layers, LayoutGrid, Eye, Plane, Boxes, MoreHorizontal,
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

/* ============================================================
   FLOATING TOOLBAR
   ------------------------------------------------------------
   Desktop / tablet: the original compact palette (collapsible
   to an icon rail) — untouched. Mobile: a dedicated compact
   icon-only strip that fits on screen without scrolling (see
   <MobileToolbar>).
   ============================================================ */
export default function FloatingToolbar() {
  const viewport = useViewport()
  if (viewport === 'mobile') return <MobileToolbar />
  return <DesktopToolbar />
}

function DesktopToolbar() {
  const st = useStrategyStore()
  const ls = useLayersStore()
  const { confirm, confirmModalProps } = useConfirm()
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 720
  })

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
        <Row key="layers" icon="Boxes" label="Layers" collapsed={collapsed}
          active={ls.open} onClick={toggleLayersPanel} />

        {!collapsed && <div className="sft-group-label">Edit</div>}
        <Row icon="Undo2" label="Undo" collapsed={collapsed} active={false} onClick={undo} />
        <Row icon="Redo2" label="Redo" collapsed={collapsed} active={false} onClick={redo} />
        <Row icon="Trash2" label="Clear All" collapsed={collapsed} active={false} onClick={handleClearAll} />
      </div>

      {createPortal(<ConfirmModal {...confirmModalProps} />, document.body)}
    </div>
  )
}

/* ---- mobile: compact icon-only strip, no scroll ---- */
function MiniBtn({ icon, label, active, onClick }) {
  const Icon = ICONS[icon]
  return (
    <button
      className={`sftm-btn${active ? ' sftm-btn-active' : ''}`}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Icon size={16} />
    </button>
  )
}

function MobileToolbar() {
  const st = useStrategyStore()
  const ls = useLayersStore()
  const { confirm, confirmModalProps } = useConfirm()
  const [more, setMore] = useState(false)

  async function handleClearAll() {
    if (st.objects.length === 0) { setMore(false); return }
    if (!await confirm('Clear every drawing on this map?', { title: 'Clear all drawings' })) return
    clearAllObjects()
  }

  /* Everything the user reaches most often — a single non-scrolling
     column. The rarer tactical/zone/flight toggles live behind "More"
     so even a short landscape phone never needs a scroll. */
  const PRIMARY = [
    { key: 'select', label: 'Select', icon: 'MousePointer2' },
    { key: 'pencil', label: 'Pencil', icon: 'Pencil' },
    { key: 'line', label: 'Line', icon: 'Minus' },
    { key: 'arrow', label: 'Arrow', icon: 'ArrowUpRight' },
    { key: 'rectangle', label: 'Rectangle', icon: 'Square' },
    { key: 'circle', label: 'Circle', icon: 'CircleIcon' },
    { key: 'text', label: 'Text', icon: 'Type' },
    { key: 'eraser', label: 'Eraser', icon: 'Eraser' },
    { key: 'teamRotation', label: 'Team Rotation', icon: 'Route' },
    { key: 'teamDrop', label: 'Team Drop', icon: 'Flag' },
  ]

  return (
    <div className="sftm-panel">
      <div className="sftm-strip">
        {PRIMARY.map(t => (
          <MiniBtn key={t.key} icon={t.icon} label={t.label}
            active={st.tool === t.key} onClick={() => setTool(t.key)} />
        ))}
        <MiniBtn icon="Boxes" label="Layers" active={ls.open} onClick={toggleLayersPanel} />
        <MiniBtn icon="Undo2" label="Undo" onClick={undo} />
        <MiniBtn icon="Redo2" label="Redo" onClick={redo} />
        <MiniBtn icon="Trash2" label="Clear All" onClick={handleClearAll} />
        <MiniBtn icon="MoreHorizontal" label="More tools" active={more} onClick={() => setMore(v => !v)} />
      </div>

      {more && (
        <div className="sftm-strip sftm-more">
          <MiniBtn icon="Shapes" label="Draw Path & Zone"
            active={st.tool === 'pathZone'} onClick={() => { setTool('pathZone'); setMore(false) }} />
          <MiniBtn icon="Wrench" label="Utility Markers"
            active={st.tool === 'utilityMarker'} onClick={() => { setTool('utilityMarker'); setMore(false) }} />
          <MiniBtn icon="Layers" label="Zone 1–8"
            active={st.tool === 'zone' && st.selectedZone !== 'all'}
            onClick={() => { setTool('zone'); setSelectedZone(st.selectedZone === 'all' || st.selectedZone == null ? 1 : st.selectedZone); setMore(false) }} />
          <MiniBtn icon="LayoutGrid" label="All Zones"
            active={st.tool === 'zone' && st.selectedZone === 'all'}
            onClick={() => { setTool('zone'); setSelectedZone('all'); setMore(false) }} />
          <MiniBtn icon="Eye" label="Show Paths" active={st.showPaths} onClick={toggleShowPaths} />
          <MiniBtn icon="Plane" label="Flight Path" active={st.flightPathVisible} onClick={toggleFlightPath} />
        </div>
      )}

      {createPortal(<ConfirmModal {...confirmModalProps} />, document.body)}
    </div>
  )
}
