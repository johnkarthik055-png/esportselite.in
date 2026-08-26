import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Wrench, MousePointer2, Pencil, Minus, ArrowUpRight, Hexagon, Square,
  Circle as CircleIcon, Type, Ruler, Undo2, Redo2, Trash2, Check, X as XIcon, Copy, SquarePen,
  Flag, Route, Swords, LogOut, Eye, Shield, ChevronsUp, Skull, AlertTriangle,
  Car, Milestone, LogIn, Crosshair, Focus,
} from 'lucide-react'
import {
  DRAW_TOOLS, DRAW_COLORS, THICKNESS_PRESETS, OPACITY_PRESETS,
} from '../../utils/strategyDataSchema.js'
import { TACTICAL_TOOLS, TACTICAL_PATH_TOOLS, isTacticalType } from '../../utils/tacticalToolsSchema.js'
import {
  useStrategyStore, setTool, undo, redo, deleteSelected, clearAllObjects,
  setDrawColor, setDrawThickness, setDrawOpacity, finishPolygonDraft, finishTacticalPathDraft,
  setDrafting, duplicateSelected, startTacticalEdit,
} from './strategyStore.js'
import { useConfirm } from '../../hooks/useConfirm.js'
import ConfirmModal from '../ConfirmModal.jsx'
import { SectionLabel, SwatchButton } from './strategyUI.jsx'
import TacticalPropertyPanel from './TacticalPropertyPanel.jsx'

const TOOL_ICONS = {
  select: MousePointer2, pencil: Pencil, line: Minus, arrow: ArrowUpRight,
  polygon: Hexagon, rectangle: Square, circle: CircleIcon, text: Type, measure: Ruler,
  teamRotation: Route, attackPath: Swords, retreatPath: LogOut, scoutPath: Eye,
  teamDrop: Flag, holdPosition: Shield, pushPosition: ChevronsUp, enemyPosition: Skull,
  vehicleMarker: Car, chokePoint: Milestone, entryMarker: LogIn, exitMarker: LogOut,
  sniperPosition: Crosshair, headglitchPosition: Focus, dangerZone: AlertTriangle,
}

const HINTS = {
  select:    'Click a shape to select it, then edit its color/thickness/opacity or delete it.',
  pencil:    'Click and drag (or touch and drag) to sketch a freehand line.',
  line:      'Click and drag from the start point to the end point.',
  arrow:     'Click and drag from the start point to the end point — an arrowhead is added at the end.',
  polygon:   'Click to place each vertex. Double-click, or press Finish, to close the shape.',
  rectangle: 'Click and drag to draw a rectangle.',
  circle:    'Click and drag from the center outward to set the radius.',
  text:      'Click a point on the map, then type your label and press Enter.',
  measure:   'Click two points on the map to measure distance.',
}
const TACTICAL_HINTS = Object.fromEntries(TACTICAL_TOOLS.map(t => [t.key, t.shortcutHint]))
const PATH_TOOL_GROUP = TACTICAL_TOOLS.filter(t => t.group === 'paths')
const MARKER_TOOL_GROUP = TACTICAL_TOOLS.filter(t => t.group === 'markers')

/* ============================================================
   DRAG / SNAP GEOMETRY
   ------------------------------------------------------------
   Plain screen pixels only — no viewport-bucket ('mobile'/'tablet'/
   'desktop'), no sidebar width, no container query. That independence
   is the entire point: the button's position can never drift out of
   sync with a breakpoint calculation again because there is no
   breakpoint calculation for it to drift out of sync with.
   ============================================================ */
const BUTTON_SIZE = 52
const EDGE_MARGIN = 20
/* Clears the app TopBar (always present) and a mobile bottom nav bar
   (when present) respectively. These are fixed, generous constants
   rather than measured/device-detected values on purpose — on desktop
   (no bottom nav) the extra bottom clearance is just unused padding,
   which is harmless, whereas under-clamping risks the button landing
   under real fixed UI on some device this wasn't tested on. */
const TOP_CLEARANCE = 76
const BOTTOM_CLEARANCE = 96
const DRAG_THRESHOLD = 6
const STORAGE_KEY = 'esportselite_strategy_assistive_pos'
const POPUP_GAP = 10
const POPUP_EDGE_MARGIN = 10

function clamp(v, min, max) { return Math.min(Math.max(v, min), max) }

function clampToViewport(pos) {
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - EDGE_MARGIN - BUTTON_SIZE)
  const maxY = Math.max(TOP_CLEARANCE, window.innerHeight - BOTTOM_CLEARANCE - BUTTON_SIZE)
  return {
    x: clamp(pos.x, EDGE_MARGIN, maxX),
    y: clamp(pos.y, TOP_CLEARANCE, maxY),
  }
}

function defaultPosition() {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  return clampToViewport({
    x: window.innerWidth - EDGE_MARGIN - BUTTON_SIZE,
    y: window.innerHeight - BOTTOM_CLEARANCE - BUTTON_SIZE,
  })
}

function loadPosition() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
        return clampToViewport(parsed)
      }
    }
  } catch { /* ignore — fall through to default */ }
  return defaultPosition()
}

function savePosition(pos) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)) } catch { /* ignore */ }
}

/* Anchors the popup near whichever edge/corner the button is
   currently docked to (button on the right half -> popup opens
   leftward; button in the bottom half -> popup opens upward), so it
   never renders starting off-screen. The post-render measurement in
   the layout effect below then corrects for the popup's REAL size
   (this heuristic only has the button's position to go on, not the
   popup's not-yet-rendered dimensions), guaranteeing full containment
   regardless of how good this first guess is. */
function initialPopupPos(pos) {
  const estWidth = 300
  const estHeight = 420
  const dockedRight = pos.x + BUTTON_SIZE / 2 > window.innerWidth / 2
  const openUpward = pos.y + BUTTON_SIZE / 2 > window.innerHeight / 2
  const left = dockedRight ? pos.x - POPUP_GAP - estWidth : pos.x + BUTTON_SIZE + POPUP_GAP
  const top = openUpward ? pos.y + BUTTON_SIZE - estHeight : pos.y
  return { left, top }
}

const TOOL_BUTTON_STYLE = (active) => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  padding: '8px 10px', minWidth: 56,
  background: active ? 'var(--blue)' : 'var(--bg-elevated)',
  border: `1px solid ${active ? 'var(--blue)' : 'var(--border)'}`,
  borderRadius: 8, cursor: 'pointer',
  color: active ? '#fff' : 'var(--text-primary)',
  fontFamily: 'DM Sans, sans-serif', fontSize: 10, fontWeight: 600,
})

function ToolGrid({ tools, activeTool, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {tools.map(t => {
        const Icon = TOOL_ICONS[t.key]
        const active = activeTool === t.key
        return (
          <button key={t.key} onClick={() => onSelect(t.key)} title={t.label} style={TOOL_BUTTON_STYLE(active)}>
            <Icon size={15} />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function PresetButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="btn btn-sm"
      style={{
        flex: 1,
        background: active ? 'var(--blue)' : 'var(--bg-elevated)',
        border: `1px solid ${active ? 'var(--blue)' : 'var(--border)'}`,
        color: active ? '#fff' : 'var(--text-primary)',
        fontSize: 11, justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}

/* AssistiveTouch-style floating button + popup for Strategy Maker.
   Replaces the old docked/floating ToolPanel entirely: instead of a
   permanently-visible panel whose size/position had to react to
   viewport width, sidebar state, and orientation (and kept breaking
   in new ways every time one of those was patched), this is a single
   draggable button anchored at a plain screen-pixel position that
   opens a compact popup on tap. Tool BEHAVIOR is unchanged — every
   tool still goes through setTool/the store exactly as before; only
   how you reach it changed. */
export default function AssistiveToolButton() {
  const st = useStrategyStore()
  const { confirm, confirmModalProps } = useConfirm()

  const [pos, setPos] = useState(loadPosition)
  const posRef = useRef(pos)
  useEffect(() => { posRef.current = pos }, [pos])

  const [dragging, setDragging] = useState(false)
  const dragStateRef = useRef(null)

  const [popupOpen, setPopupOpen] = useState(false)
  const [popupPos, setPopupPos] = useState(() => initialPopupPos(pos))
  const buttonRef = useRef(null)
  const popupRef = useRef(null)

  const selectedObj = st.selectedObjectId ? st.objects.find(o => o.id === st.selectedObjectId) : null
  const currentColor = selectedObj?.color ?? st.drawColor
  const currentThickness = selectedObj?.thickness ?? st.drawThickness
  const currentOpacity = selectedObj?.opacity ?? st.drawOpacity

  /* Re-clamp on resize/orientation change so a saved or dragged
     position from a larger screen never ends up off-screen — this is
     the only place window size is consulted at all, purely as a
     safety clamp, never as a layout/classification decision. */
  useEffect(() => {
    function onResize() {
      setPos(p => {
        const next = clampToViewport(p)
        savePosition(next)
        return next
      })
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  /* Recompute the popup's heuristic anchor whenever it opens or the
     button moves, then let the layout effect below correct it against
     the popup's real measured size. */
  useEffect(() => {
    if (popupOpen) setPopupPos(initialPopupPos(pos))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupOpen])

  useLayoutEffect(() => {
    if (!popupOpen || !popupRef.current) return
    const rect = popupRef.current.getBoundingClientRect()
    let left = rect.left
    let top = rect.top
    if (rect.right > window.innerWidth - POPUP_EDGE_MARGIN) {
      left -= (rect.right - (window.innerWidth - POPUP_EDGE_MARGIN))
    }
    if (left < POPUP_EDGE_MARGIN) left = POPUP_EDGE_MARGIN
    if (rect.bottom > window.innerHeight - POPUP_EDGE_MARGIN) {
      top -= (rect.bottom - (window.innerHeight - POPUP_EDGE_MARGIN))
    }
    if (top < POPUP_EDGE_MARGIN) top = POPUP_EDGE_MARGIN
    if (Math.round(left) !== Math.round(rect.left) || Math.round(top) !== Math.round(rect.top)) {
      setPopupPos(p => ({ left: p.left + (left - rect.left), top: p.top + (top - rect.top) }))
    }
  }, [popupOpen, popupPos.left, popupPos.top])

  /* Close the popup on an outside tap/click or Escape — a popup that
     only closes via re-tapping the button would be an obviously worse
     interaction than the thing it replaced. */
  useEffect(() => {
    if (!popupOpen) return
    function onPointerDownOutside(e) {
      if (popupRef.current?.contains(e.target)) return
      if (buttonRef.current?.contains(e.target)) return
      setPopupOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setPopupOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDownOutside)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDownOutside)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [popupOpen])

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStateRef.current = {
      pointerId: e.pointerId,
      startPointerX: e.clientX, startPointerY: e.clientY,
      startPosX: posRef.current.x, startPosY: posRef.current.y,
      moved: 0,
    }
    setDragging(true)
  }

  function onPointerMove(e) {
    const ds = dragStateRef.current
    if (!ds) return
    const dx = e.clientX - ds.startPointerX
    const dy = e.clientY - ds.startPointerY
    ds.moved = Math.max(ds.moved, Math.hypot(dx, dy))
    if (ds.moved >= DRAG_THRESHOLD && popupOpen) setPopupOpen(false)
    const next = clampToViewport({ x: ds.startPosX + dx, y: ds.startPosY + dy })
    setPos(next)
  }

  function onPointerUp() {
    const ds = dragStateRef.current
    dragStateRef.current = null
    setDragging(false)
    if (!ds) return

    if (ds.moved < DRAG_THRESHOLD) {
      setPopupOpen(v => !v)
      return
    }

    /* Snap to whichever side (left/right) the release point is
       closer to, at the release height — real AssistiveTouch
       behavior, and it keeps the button from drifting to the dead
       center of the map where it would sit over content. */
    setPos(p => {
      const center = p.x + BUTTON_SIZE / 2
      const snappedX = center < window.innerWidth / 2
        ? EDGE_MARGIN
        : window.innerWidth - EDGE_MARGIN - BUTTON_SIZE
      const snapped = clampToViewport({ x: snappedX, y: p.y })
      savePosition(snapped)
      return snapped
    })
  }

  /* Selecting a tool closes the popup and hands control back to the
     map — only the discovery/access mechanism changes here, map
     interaction (placing/drawing/forms) proceeds exactly as before. */
  function handleSelectTool(key) {
    setTool(key)
    setPopupOpen(false)
  }

  async function handleClearAll() {
    if (st.objects.length === 0) return
    if (!await confirm('Clear every drawing on this map? This cannot be undone once other actions follow.', { title: 'Clear all drawings' })) return
    clearAllObjects()
  }

  return (
    <>
      <button
        ref={buttonRef}
        className={`at-button${dragging ? ' at-dragging' : ''}`}
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Strategy Maker tools"
        title="Strategy Maker tools — drag to move, tap to open"
      >
        <Wrench size={20} />
      </button>

      {popupOpen && (
        <div
          ref={popupRef}
          className="at-popup"
          style={{
            left: popupPos.left,
            top: popupPos.top,
            width: 'min(300px, calc(100vw - 20px))',
            maxHeight: 'min(70vh, calc(100vh - 20px))',
          }}
        >
          <div className="at-popup-header">
            <span style={{
              fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 12,
              letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)',
            }}>
              Strategy Tools
            </span>
            <button
              onClick={() => setPopupOpen(false)}
              aria-label="Close tools"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', display: 'flex' }}
            >
              <XIcon size={16} />
            </button>
          </div>

          <div className="at-popup-scroll">
            <div>
              <SectionLabel small>Tools</SectionLabel>
              <ToolGrid tools={DRAW_TOOLS} activeTool={st.tool} onSelect={handleSelectTool} />
              <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 6 }}>
                {HINTS[st.tool] || TACTICAL_HINTS[st.tool] || HINTS.select}
              </div>
            </div>

            <div>
              <SectionLabel small>Tactical Paths</SectionLabel>
              <ToolGrid tools={PATH_TOOL_GROUP} activeTool={st.tool} onSelect={handleSelectTool} />
            </div>

            <div>
              <SectionLabel small>Tactical Markers</SectionLabel>
              <ToolGrid tools={MARKER_TOOL_GROUP} activeTool={st.tool} onSelect={handleSelectTool} />
            </div>

            {st.tool === 'polygon' && st.drafting?.kind === 'polygon' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '6px 8px',
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-subtle)', flex: 1 }}>
                  {st.drafting.points.length} vertex/vertices placed
                </span>
                <button
                  onClick={finishPolygonDraft}
                  disabled={st.drafting.points.length < 3}
                  className="btn btn-primary btn-sm"
                  title="Finish polygon"
                >
                  <Check size={12} /> Finish
                </button>
                <button onClick={() => setDrafting(null)} className="btn btn-secondary btn-sm" title="Cancel polygon">
                  <XIcon size={12} />
                </button>
              </div>
            )}

            {TACTICAL_PATH_TOOLS.includes(st.tool) && st.drafting?.kind === 'tactical-path' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '6px 8px',
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-subtle)', flex: 1 }}>
                  {st.drafting.points.length} point(s) placed
                </span>
                <button
                  onClick={finishTacticalPathDraft}
                  disabled={st.drafting.points.length < 2}
                  className="btn btn-primary btn-sm"
                  title="Finish route"
                >
                  <Check size={12} /> Finish
                </button>
                <button onClick={() => setDrafting(null)} className="btn btn-secondary btn-sm" title="Cancel route">
                  <XIcon size={12} />
                </button>
              </div>
            )}

            <TacticalPropertyPanel />

            <div>
              <SectionLabel small>{selectedObj ? 'Selected Object' : 'Pen Settings'}</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginBottom: 4 }}>Color</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {DRAW_COLORS.map(c => (
                      <SwatchButton
                        key={c.key} color={c.value} title={c.key}
                        active={currentColor === c.value}
                        onClick={() => setDrawColor(c.value)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginBottom: 4 }}>Thickness</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {THICKNESS_PRESETS.map(t => (
                      <PresetButton key={t.key} active={currentThickness === t.value} onClick={() => setDrawThickness(t.value)}>
                        {t.label}
                      </PresetButton>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginBottom: 4 }}>Opacity</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {OPACITY_PRESETS.map(o => (
                      <PresetButton key={o.key} active={currentOpacity === o.value} onClick={() => setDrawOpacity(o.value)}>
                        {o.label}
                      </PresetButton>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={undo} disabled={st.history.length === 0} className="btn btn-secondary btn-sm" style={{ flex: 1 }} title="Undo (Ctrl+Z)">
                <Undo2 size={12} /> Undo
              </button>
              <button onClick={redo} disabled={st.future.length === 0} className="btn btn-secondary btn-sm" style={{ flex: 1 }} title="Redo (Ctrl+Shift+Z)">
                <Redo2 size={12} /> Redo
              </button>
            </div>
            {selectedObj && isTacticalType(selectedObj.type) && (
              <button
                onClick={() => startTacticalEdit(selectedObj.type, selectedObj.id)}
                className="btn btn-secondary btn-sm"
                title="Edit this object's details"
              >
                <SquarePen size={12} /> Edit Details
              </button>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={duplicateSelected} disabled={!st.selectedObjectId} className="btn btn-secondary btn-sm" style={{ flex: 1 }} title="Duplicate selected">
                <Copy size={12} /> Duplicate
              </button>
              <button onClick={deleteSelected} disabled={!st.selectedObjectId} className="btn btn-secondary btn-sm" style={{ flex: 1 }} title="Delete selected (Del)">
                <Trash2 size={12} /> Delete
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleClearAll} className="btn btn-secondary btn-sm" style={{ flex: 1 }} title="Clear all drawings">
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal {...confirmModalProps} />
    </>
  )
}
