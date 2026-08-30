import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { Marker, Polyline, Polygon, Rectangle, Circle, useMap, useMapEvents } from 'react-leaflet'
import { SquarePen, Copy, Trash2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import {
  DRAG_DRAW_TOOLS, VERTEX_TOOLS, PAN_LOCKING_TOOLS,
  TACTICAL_TOOLS_BY_KEY, PATH_TACTICAL_TYPES, POINT_TACTICAL_TYPES,
  DEFAULT_OPACITY, mapInstanceRef, strategyStore,
  bearingBetween, schematicZoneCircle, schematicFlightPath, ZONE_NUMBERS,
} from '../../utils/strategyDataSchema.js'
import {
  useStrategyStore, addObject, updateObject, selectObject, setDrafting,
  addDraftPoint, finishDraft, duplicateObject, deleteObject,
} from '../../utils/strategyDataSchema.js'
import { useLayersStore, isTypeHidden, resetLayerVisibility } from './LayersPanel.jsx'

/* bubblingMouseEvents:false — stop a press/click on an object (or its
   resize handle) from ALSO reaching the map as a Leaflet map event.
   This is one of two layers that stop "map pans while I drag the
   shape": this kills the Leaflet-level bubble, and beginObjectMove/
   beginObjectHandle additionally kill the native DOM bubble AND
   disable map.dragging for the duration of the gesture. */
const NO_BUBBLE = { bubblingMouseEvents: false }
const LONG_PRESS_MS = 500
const TAP_MOVE_THRESHOLD = 8 /* px — beyond this a touch is a drag, not a long-press */
const ERASE_RADIUS_PX = 20   /* eraser "brush" radius in screen pixels */

/* ---- icon factories ---- */
function arrowHeadIcon(color, bearingDeg, size, opacity) {
  return L.divIcon({
    className: 'strat-arrowhead',
    html: `<div style="
      width:0; height:0; opacity:${opacity};
      border-left:${size / 2}px solid transparent;
      border-right:${size / 2}px solid transparent;
      border-bottom:${size}px solid ${color};
      transform: rotate(${bearingDeg}deg);
      transform-origin: 50% 100%;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  })
}
/* IMPORTANT: this icon must NOT depend on selection state. If it did,
   selecting the text would swap out the underlying DOM element, and a
   double-click (which requires both clicks to land on the SAME
   element) would never register. Selection is shown by a separate
   overlay (textSelIcon) + the edit badge instead. */
function textIcon(text, color, opacity, bold, fontSize) {
  const safe = String(text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return L.divIcon({
    className: 'strat-text-obj',
    html: `<div class="strat-text-inner" style="
      color:${color}; opacity:${opacity};
      font-weight:${bold ? 800 : 600}; font-size:${fontSize}px;
    ">${safe}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}
/* A same-metrics, transparent copy of the text with a dashed outline —
   rendered as its own non-interactive marker while the text is
   selected so the real text element stays untouched. */
function textSelIcon(text, bold, fontSize) {
  const safe = String(text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return L.divIcon({
    className: 'strat-text-obj',
    html: `<div class="strat-text-inner strat-text-sel" style="
      font-weight:${bold ? 800 : 600}; font-size:${fontSize}px;
    ">${safe}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}
function editBadgeIcon() {
  return L.divIcon({
    className: 'strat-edit-badge',
    html: `<div class="strat-edit-badge-inner" title="Edit text">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [26, 24],
  })
}
function tacticalBadgeIcon(tool, obj, isSelected) {
  const color = obj.color || tool.defaultColor
  const badge = tool.key === 'teamDrop' ? 'TD' : 'UT'
  return L.divIcon({
    className: 'strat-tactical-badge',
    html: `<div style="
      display:flex; align-items:center; justify-content:center;
      min-width:22px; height:22px; padding:0 4px; box-sizing:border-box;
      background:${color}; opacity:${obj.opacity ?? DEFAULT_OPACITY};
      border-radius:5px; border:2px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.55)'};
      color:#fff; font-family:'DM Sans',sans-serif; font-weight:800; font-size:9px;
      white-space:nowrap; cursor:pointer;
    ">${badge}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}
/* Resize handles are shown ONLY for Circle and Rectangle while that
   object is selected (see ObjectRender). Pencil / Line / Arrow / Text /
   Team Rotation deliberately render with NO vertex markers — they're
   repositioned by dragging the body, not by per-point editing. */
function handleIconFor(cursor) {
  return L.divIcon({
    className: 'strat-edit-handle',
    html: `<div style="
      width:12px; height:12px; background:#fff; border:2px solid #3B82F6;
      border-radius:50%; cursor:${cursor};
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  })
}

/* Stop a Leaflet layer-event's underlying DOM event from continuing on
   to the map container, where Leaflet's own pan-drag listener
   (L.Draggable._onDown) lives as a sibling listener that plain
   stopPropagation() can't reach. stopImmediatePropagation() is what
   actually prevents that pan from starting alongside our own drag. */
function killDomEvent(e) {
  const oe = e?.originalEvent
  if (!oe) return
  if (oe.preventDefault) oe.preventDefault()
  if (oe.stopPropagation) oe.stopPropagation()
  if (oe.stopImmediatePropagation) oe.stopImmediatePropagation()
  L.DomEvent.stopPropagation(e)
}

/* px distance from point p to segment a-b (all L.Point). */
function distPointToSeg(p, a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return p.distanceTo(a)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/* ---- right-click / long-press context menu (Edit / Duplicate / Delete) ---- */
function ContextMenu({ x, y, onEdit, onDuplicate, onDelete, onClose }) {
  useEffect(() => {
    function onDown(e) {
      if (!e.target.closest?.('.strat-ctx-menu')) onClose()
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [onClose])

  const style = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 160),
    top: Math.min(y, window.innerHeight - 140),
    zIndex: 10050,
  }
  return (
    <div className="strat-ctx-menu" style={style}>
      {onEdit && <button onClick={onEdit}><SquarePen size={13} /> Edit</button>}
      <button onClick={onDuplicate}><Copy size={13} /> Duplicate</button>
      <button onClick={onDelete} className="strat-ctx-danger"><Trash2 size={13} /> Delete</button>
    </div>
  )
}

/* Portals ContextMenu straight into document.body — Leaflet's own
   panes (.leaflet-map-pane etc.) are CSS-transformed for panning, and
   a transformed ancestor creates a new containing block that breaks
   position:fixed (it would resolve relative to that transformed pane
   instead of the viewport). Rendering into document.body via a real
   React portal sidesteps that entirely while staying part of the
   normal React tree (event bubbling, automatic unmount). */
function ContextMenuPortal(props) {
  return createPortal(<ContextMenu {...props} />, document.body)
}

function ObjectRender({ obj, isSelected, tool, onSelect, onBeginMove, onBeginHandle, onContextMenu, onEditText }) {
  const selectable = tool === 'select'
  /* Stable across selection changes (see textIcon comment). */
  const stableTextIcon = useMemo(
    () => (obj.type === 'text' ? textIcon(obj.text, obj.color, obj.opacity, obj.bold, obj.fontSize) : null),
    [obj.type, obj.text, obj.color, obj.opacity, obj.bold, obj.fontSize],
  )

  function select(e) {
    if (!selectable) return
    onSelect(obj.id)
  }
  function bodyDown(e) {
    if (!selectable) return
    onSelect(obj.id)
    onBeginMove(e, obj)
  }
  function ctxMenu(e) {
    if (e.originalEvent) { e.originalEvent.preventDefault(); e.originalEvent.stopPropagation() }
    onContextMenu(e.originalEvent || e, obj)
  }

  const tacticalTool = TACTICAL_TOOLS_BY_KEY[obj.type]

  if (obj.type === 'pencil' || obj.type === 'line' || obj.type === 'arrow' ||
      (tacticalTool && tacticalTool.geometry === 'path')) {
    const pts = obj.points
    const hitOptions = { ...NO_BUBBLE, color: obj.color, weight: Math.max(obj.thickness + 14, 18), opacity: 0 }
    let head = null
    if (obj.type === 'arrow' && pts.length >= 2) {
      const last = pts[pts.length - 1]
      const prev = pts[pts.length - 2]
      const bearing = bearingBetween(prev, last)
      const headSize = Math.max(10, obj.thickness * 3)
      head = <Marker position={last} icon={arrowHeadIcon(obj.color, bearing, headSize, obj.opacity)} interactive={false} />
    }
    /* Selection feedback = the stroke itself goes dashed + a touch
       thicker. NO wide translucent halo (that read as a glow). */
    const ownDash = obj.type === 'arrow' && obj.arrowStyle === 'dashed' ? '8 6'
      : tacticalTool?.key === 'pathZone' ? '3 7' : undefined
    const dashArray = isSelected ? '9 7' : ownDash
    const weight = isSelected ? obj.thickness + 2 : obj.thickness
    return (
      <>
        {tacticalTool?.key === 'pathZone' && pts.length >= 3 && (
          <Polygon positions={pts} pathOptions={{ ...NO_BUBBLE, color: obj.color, weight: 0, fillColor: obj.color, fillOpacity: Math.max(obj.opacity * 0.15, 0.05), interactive: false }} />
        )}
        <Polyline positions={pts} pathOptions={{ color: obj.color, weight, opacity: obj.opacity, dashArray, lineCap: 'round', lineJoin: 'round', interactive: false }} />
        <Polyline positions={pts} pathOptions={hitOptions} eventHandlers={{ mousedown: bodyDown, click: select, contextmenu: ctxMenu }} />
        {head}
      </>
    )
  }

  /* Legacy: the Polygon tool was removed, but previously-saved polygon
     objects still render (and stay movable) so old strategies don't
     break on load. No vertex handles, no way to create new ones. */
  if (obj.type === 'polygon') {
    return (
      <Polygon
        positions={obj.points}
        pathOptions={{
          ...NO_BUBBLE, color: obj.color, weight: isSelected ? obj.thickness + 1 : obj.thickness,
          opacity: obj.opacity, dashArray: isSelected ? '8 5' : undefined,
          fillColor: obj.color, fillOpacity: obj.fill ? Math.max(obj.opacity * 0.2, 0.05) : 0,
        }}
        eventHandlers={{ mousedown: bodyDown, click: select, contextmenu: ctxMenu }}
      />
    )
  }

  if (obj.type === 'rectangle') {
    return (
      <>
        <Rectangle
          bounds={obj.points}
          pathOptions={{
            ...NO_BUBBLE, color: obj.color, weight: isSelected ? obj.thickness + 1 : obj.thickness,
            opacity: obj.opacity, dashArray: isSelected ? '8 5' : undefined,
            fillColor: obj.color, fillOpacity: obj.fill ? Math.max(obj.opacity * 0.2, 0.05) : 0,
          }}
          eventHandlers={{ mousedown: bodyDown, click: select, contextmenu: ctxMenu }}
        />
        {isSelected && obj.points.map((p, i) => (
          <Marker key={i} position={p} icon={handleIconFor('nwse-resize')} bubblingMouseEvents={false}
            eventHandlers={{ mousedown: (e) => onBeginHandle(e, obj, i) }} />
        ))}
      </>
    )
  }

  if (obj.type === 'circle') {
    const center = obj.points[0]
    const radiusHandlePos = [center[0], center[1] + (obj.radius || 1)]
    return (
      <>
        <Circle
          center={center} radius={obj.radius || 1}
          pathOptions={{
            ...NO_BUBBLE, color: obj.color, weight: isSelected ? obj.thickness + 1 : obj.thickness,
            opacity: obj.opacity, dashArray: isSelected ? '8 5' : undefined,
            fillColor: obj.color, fillOpacity: obj.fill ? Math.max(obj.opacity * 0.2, 0.05) : 0,
          }}
          eventHandlers={{ mousedown: bodyDown, click: select, contextmenu: ctxMenu }}
        />
        {isSelected && (
          <Marker position={radiusHandlePos} icon={handleIconFor('ns-resize')} bubblingMouseEvents={false}
            eventHandlers={{ mousedown: (e) => onBeginHandle(e, obj, 'radius') }} />
        )}
      </>
    )
  }

  if (obj.type === 'text') {
    return (
      <>
        <Marker
          position={obj.points[0]}
          icon={stableTextIcon}
          bubblingMouseEvents={false}
          eventHandlers={{
            mousedown: bodyDown,
            click: select,
            dblclick: () => { if (selectable) onEditText(obj) },
            contextmenu: ctxMenu,
          }}
        />
        {isSelected && selectable && (
          <Marker
            position={obj.points[0]}
            icon={textSelIcon(obj.text, obj.bold, obj.fontSize)}
            interactive={false}
          />
        )}
        {isSelected && selectable && (
          <Marker
            position={obj.points[0]}
            icon={editBadgeIcon()}
            bubblingMouseEvents={false}
            eventHandlers={{
              mousedown: (e) => killDomEvent(e),
              click: (e) => { killDomEvent(e); onEditText(obj) },
            }}
          />
        )}
      </>
    )
  }

  if (tacticalTool && tacticalTool.geometry === 'point') {
    return (
      <Marker
        position={obj.points[0]}
        icon={tacticalBadgeIcon(tacticalTool, obj, isSelected)}
        bubblingMouseEvents={false}
        eventHandlers={{ mousedown: bodyDown, click: select, contextmenu: ctxMenu }}
      />
    )
  }

  return null
}

/* Inline text-entry input — a real <input> inside a Leaflet divIcon,
   wired with vanilla DOM listeners on Leaflet's own 'add' event.
   Entering/leaving edit mode is a clean idempotent transition:
   commit()/cancel() are single-shot and ALWAYS call onFinishEdit()
   so the parent's editingTextObj state is cleared. */
function TextDraftLayer({ draft, st, editingObj, onFinishEdit }) {
  const committedRef = useRef(false)
  const inputElRef = useRef(null)

  const isEditingExisting = !!editingObj
  const editingId = editingObj?.id ?? null
  const draftKey = draft ? draft.latlng.join(',') : null

  useEffect(() => { committedRef.current = false }, [draftKey, editingId])

  const icon = useMemo(() => L.divIcon({
    className: 'strat-text-draft-icon',
    html: `<input type="text" class="strat-text-draft-input" placeholder="Type and press Enter…" maxlength="80" />`,
    iconSize: [180, 30],
    iconAnchor: [0, 15],
  }), [])

  const apiRef = useRef({})
  apiRef.current.commit = (value) => {
    if (committedRef.current) return
    committedRef.current = true
    const text = String(value ?? '').trim()
    if (isEditingExisting) {
      if (text && text !== editingObj.text) updateObject(editingObj.id, { text })
    } else if (draft) {
      if (text) {
        addObject({
          type: 'text', points: [draft.latlng], text,
          color: st.drawColor, thickness: st.drawThickness, opacity: st.drawOpacity,
          fontSize: st.drawFontSize, bold: st.drawBold,
        })
      }
    }
    setDrafting(null)
    onFinishEdit?.()
  }
  apiRef.current.cancel = () => {
    if (committedRef.current) return
    committedRef.current = true
    setDrafting(null)
    onFinishEdit?.()
  }

  if (!draft && !isEditingExisting) return null
  const latlng = isEditingExisting ? editingObj.points[0] : draft.latlng
  const initialValue = isEditingExisting ? (editingObj.text || '') : ''

  return (
    <Marker
      position={latlng}
      icon={icon}
      interactive
      bubblingMouseEvents={false}
      eventHandlers={{
        add: (e) => {
          const el = e.target.getElement()
          const input = el?.querySelector('input')
          if (!input) return
          inputElRef.current = input
          input.value = initialValue
          L.DomEvent.disableClickPropagation(el)
          L.DomEvent.disableScrollPropagation(el)
          setTimeout(() => { input.focus(); input.select() }, 0)
          input.addEventListener('keydown', (ev) => {
            ev.stopPropagation()
            if (ev.key === 'Enter') { ev.preventDefault(); apiRef.current.commit(input.value) }
            else if (ev.key === 'Escape') { ev.preventDefault(); apiRef.current.cancel() }
          })
          input.addEventListener('blur', () => apiRef.current.commit(input.value))
        },
        remove: () => {
          const input = inputElRef.current
          inputElRef.current = null
          if (input && !committedRef.current) {
            const val = input.value
            setTimeout(() => apiRef.current.commit(val), 0)
          }
        },
      }}
    />
  )
}

export default function DrawingCanvas({ mapId }) {
  const st = useStrategyStore()
  useLayersStore() /* re-render this canvas when per-type visibility changes */
  const map = useMap()

  useEffect(() => {
    mapInstanceRef.current = map
    return () => { if (mapInstanceRef.current === map) mapInstanceRef.current = null }
  }, [map])

  /* New map -> clear any per-layer hides carried over from the last one. */
  useEffect(() => { resetLayerVisibility() }, [mapId])

  const isDrawingRef = useRef(false)
  const draftRef = useRef(null)
  const draftLayerRef = useRef(null)
  const eraseRef = useRef(null) /* { pts: [[lat,lng]...], cursor: L.Layer } */

  const editDragRef = useRef(null)
  const manipulatingRef = useRef(false)

  const [ctxMenu, setCtxMenuState] = useState(null)
  const [editingTextObj, setEditingTextObj] = useState(null)
  const longPressRef = useRef(null)

  function removeDraftLayer() {
    if (draftLayerRef.current) {
      map.removeLayer(draftLayerRef.current)
      draftLayerRef.current = null
    }
  }
  function removeEraseCursor() {
    if (eraseRef.current?.cursor) {
      map.removeLayer(eraseRef.current.cursor)
    }
  }
  useEffect(() => {
    return () => { isDrawingRef.current = false; removeDraftLayer(); removeEraseCursor() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.tool, mapId])

  /* Switching tools always closes any open text editor. */
  useEffect(() => { setEditingTextObj(null) }, [st.tool])

  /* Pan / native-gesture lock. Same set as before PLUS the eraser —
     while dragging the eraser the map must not pan and the browser
     must not steal the touchmoves (touch-action:none via the
     .strat-draw-locked class). */
  useEffect(() => {
    const locked = PAN_LOCKING_TOOLS.includes(st.tool) || st.tool === 'eraser'
    const container = map.getContainer()
    if (locked) {
      map.dragging.disable(); map.touchZoom.disable(); map.doubleClickZoom.disable(); map.tap?.disable()
      container?.classList.add('strat-draw-locked')
    } else {
      map.dragging.enable(); map.touchZoom.enable(); map.doubleClickZoom.enable(); map.tap?.enable()
      container?.classList.remove('strat-draw-locked')
    }
    return () => {
      map.dragging.enable(); map.touchZoom.enable(); map.doubleClickZoom.enable(); map.tap?.enable()
      container?.classList.remove('strat-draw-locked')
    }
  }, [st.tool, map])

  /* ---- drag-to-draw (Pencil/Line/Arrow/Rectangle/Circle) + Eraser ----
     Driven by POINTER events on the map container, not Leaflet's map
     mousedown/mousemove/mouseup — Leaflet does not synthesise those
     from touch, which is exactly why every drag-based tool silently
     did nothing on mobile. Pointer events fire for mouse AND touch, so
     this one path serves both. */
  useEffect(() => {
    const drawTool = DRAG_DRAW_TOOLS.includes(st.tool)
    const eraseTool = st.tool === 'eraser'
    if (!drawTool && !eraseTool) return
    const container = map.getContainer()
    let active = false

    const toLatLng = (ev) => map.mouseEventToLatLng(ev)
    function onMove(ev) {
      if (!active) return
      if (ev.cancelable) ev.preventDefault()
      const ll = toLatLng(ev)
      if (eraseTool) updateErase(ll); else updateDrag(ll)
    }
    function onUp() {
      if (!active) return
      active = false
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (eraseTool) endErase(); else endDrag()
    }
    function onDown(ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return
      if (manipulatingRef.current || editDragRef.current) return
      /* ignore presses that land on a marker / handle / floating control */
      if (ev.target?.closest?.('.leaflet-marker-pane, .strat-ctx-menu, .leaflet-control, .leaflet-popup')) return
      active = true
      if (ev.cancelable) ev.preventDefault()
      const ll = toLatLng(ev)
      if (eraseTool) beginErase(ll); else beginDrag(ll)
      window.addEventListener('pointermove', onMove, { passive: false })
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    }
    container.addEventListener('pointerdown', onDown, { passive: false })
    return () => {
      container.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (active) { if (eraseTool) endErase(); else endDrag() }
    }
  }, [st.tool, map])

  function beginDrag(latlng) {
    isDrawingRef.current = true
    removeDraftLayer()
    const start = [latlng.lat, latlng.lng]
    const style = { color: st.drawColor, weight: st.drawThickness, opacity: st.drawOpacity, interactive: false }
    if (st.tool === 'pencil') {
      draftRef.current = [start]
      draftLayerRef.current = L.polyline(draftRef.current, { ...style, lineCap: 'round', lineJoin: 'round' }).addTo(map)
    } else if (st.tool === 'line' || st.tool === 'arrow') {
      draftRef.current = [start, start]
      draftLayerRef.current = L.polyline(draftRef.current, style).addTo(map)
    } else if (st.tool === 'rectangle') {
      draftRef.current = [start, start]
      draftLayerRef.current = L.rectangle(draftRef.current, { ...style, fillOpacity: st.drawFill ? 0.12 : 0 }).addTo(map)
    } else if (st.tool === 'circle') {
      draftRef.current = { center: start, radius: 0.0001 }
      draftLayerRef.current = L.circle(start, { ...style, radius: 0.0001, fillOpacity: st.drawFill ? 0.12 : 0 }).addTo(map)
    }
  }
  function updateDrag(latlng) {
    if (!isDrawingRef.current || !draftLayerRef.current) return
    const cur = [latlng.lat, latlng.lng]
    if (st.tool === 'pencil') {
      const pts = draftRef.current
      const [lastLat, lastLng] = pts[pts.length - 1]
      if (Math.hypot(cur[0] - lastLat, cur[1] - lastLng) < 0.12) return
      pts.push(cur)
      draftLayerRef.current.setLatLngs(pts)
    } else if (st.tool === 'line' || st.tool === 'arrow') {
      draftRef.current[1] = cur
      draftLayerRef.current.setLatLngs(draftRef.current)
    } else if (st.tool === 'rectangle') {
      draftRef.current[1] = cur
      draftLayerRef.current.setBounds(draftRef.current)
    } else if (st.tool === 'circle') {
      const { center } = draftRef.current
      const r = Math.max(0.5, Math.hypot(cur[0] - center[0], cur[1] - center[1]))
      draftRef.current.radius = r
      draftLayerRef.current.setRadius(r)
    }
  }
  function endDrag() {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const tool = st.tool
    const finished = draftRef.current
    draftRef.current = null
    removeDraftLayer()

    const common = { color: st.drawColor, thickness: st.drawThickness, opacity: st.drawOpacity, fill: st.drawFill }
    if (tool === 'pencil' && finished && finished.length >= 2) {
      addObject({ type: 'pencil', points: finished, ...common })
    } else if ((tool === 'line' || tool === 'arrow') && finished) {
      const [a, b] = finished
      if (a[0] !== b[0] || a[1] !== b[1]) addObject({ type: tool, points: finished, ...common, arrowStyle: st.drawArrowStyle })
    } else if (tool === 'rectangle' && finished) {
      const [a, b] = finished
      if (a[0] !== b[0] && a[1] !== b[1]) addObject({ type: 'rectangle', points: finished, ...common })
    } else if (tool === 'circle' && finished && finished.radius > 0.5) {
      addObject({ type: 'circle', points: [finished.center], radius: finished.radius, ...common })
    }
  }

  /* ---- eraser (a real eraser) ----
     Freehand strokes are erased in PART — the points the brush passes
     over are cut and the stroke splits into the surviving runs. Every
     other object type (line/arrow/shape/text/marker) is deleted whole
     when the brush touches it. The whole drag commits as ONE undo
     step. */
  function beginErase(latlng) {
    removeEraseCursor()
    eraseRef.current = {
      pts: [[latlng.lat, latlng.lng]],
      cursor: L.circleMarker(latlng, {
        radius: ERASE_RADIUS_PX, color: '#fff', weight: 1.5, opacity: 0.9,
        fillColor: '#fff', fillOpacity: 0.12, interactive: false, className: 'strat-erase-cursor',
      }).addTo(map),
    }
  }
  function updateErase(latlng) {
    const er = eraseRef.current
    if (!er) return
    er.pts.push([latlng.lat, latlng.lng])
    er.cursor?.setLatLng(latlng)
  }
  function endErase() {
    const er = eraseRef.current
    eraseRef.current = null
    if (er?.cursor) map.removeLayer(er.cursor)
    if (er) applyErase(er.pts)
  }
  function applyErase(eraserPts) {
    const objs = strategyStore.objects
    if (!objs.length || !eraserPts.length) return
    const toCP = (pt) => map.latLngToContainerPoint(L.latLng(pt[0], pt[1]))
    const eraserCP = eraserPts.map(p => toCP(p))
    const R = ERASE_RADIUS_PX
    const nearPt = (cp) => eraserCP.some(ep => ep.distanceTo(cp) <= R)
    const nearSeg = (a, b) => eraserCP.some(ep => distPointToSeg(ep, a, b) <= R)

    let changed = false
    const next = []

    for (const o of objs) {
      if (o.type === 'pencil') {
        const cps = o.points.map(toCP)
        const keep = cps.map(cp => !nearPt(cp))
        for (let i = 0; i < cps.length - 1; i++) {
          if (keep[i] && keep[i + 1] && nearSeg(cps[i], cps[i + 1])) { keep[i] = false; keep[i + 1] = false }
        }
        if (keep.every(Boolean)) { next.push(o); continue }
        changed = true
        let run = []
        const runs = []
        for (let i = 0; i < o.points.length; i++) {
          if (keep[i]) run.push(o.points[i])
          else { if (run.length >= 2) runs.push(run); run = [] }
        }
        if (run.length >= 2) runs.push(run)
        runs.forEach((r, idx) => {
          next.push(idx === 0
            ? { ...o, points: r }
            : { ...o, id: `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${idx}`, points: r })
        })
        continue
      }

      let hit = false
      if (o.type === 'line' || o.type === 'arrow' || o.type === 'teamRotation' || o.type === 'pathZone' || o.type === 'polygon') {
        const cps = o.points.map(toCP)
        hit = cps.some(nearPt)
        for (let i = 0; i < cps.length - 1 && !hit; i++) hit = nearSeg(cps[i], cps[i + 1])
      } else if (o.type === 'rectangle') {
        const [a, b] = o.points.map(toCP)
        const minX = Math.min(a.x, b.x) - R, maxX = Math.max(a.x, b.x) + R
        const minY = Math.min(a.y, b.y) - R, maxY = Math.max(a.y, b.y) + R
        hit = eraserCP.some(ep => ep.x >= minX && ep.x <= maxX && ep.y >= minY && ep.y <= maxY)
      } else if (o.type === 'circle') {
        const c = toCP(o.points[0])
        const edge = toCP([o.points[0][0], o.points[0][1] + (o.radius || 1)])
        const rPx = c.distanceTo(edge)
        hit = eraserCP.some(ep => ep.distanceTo(c) <= rPx + R)
      } else if (o.type === 'text' || TACTICAL_TOOLS_BY_KEY[o.type]?.geometry === 'point') {
        const c = toCP(o.points[0])
        hit = eraserCP.some(ep => ep.distanceTo(c) <= R + 10)
      }

      if (hit) { changed = true; continue }
      next.push(o)
    }

    if (!changed) return
    /* ONE undo step: push a history baseline via a no-op update (which
       snapshots the pre-erase objects), then swap in the new list. */
    updateObject(objs[0].id, {}, { silent: false })
    strategyStore.objects = next
    strategyStore.dirty = true
    selectObject(null) /* fires a re-render + clears any selection */
  }

  /* ---- select-tool move / resize drag (unchanged desktop path) ---- */
  function startManipulation(e) {
    killDomEvent(e)
    manipulatingRef.current = true
    if (map.dragging.enabled()) map.dragging.disable()
  }
  function endObjectManipulation() {
    manipulatingRef.current = false
    if (st.tool === 'select' && !map.dragging.enabled()) map.dragging.enable()
  }

  function beginObjectMove(e, obj) {
    if (st.tool !== 'select') return
    startManipulation(e)
    editDragRef.current = {
      obj, mode: 'move', historyPushed: false,
      startLatLng: [e.latlng.lat, e.latlng.lng],
      originalPoints: obj.points.map(p => [...p]),
    }
    const isTouch = e.originalEvent?.pointerType === 'touch' || e.originalEvent?.touches
    if (isTouch) {
      const clientX = e.originalEvent.touches?.[0]?.clientX ?? e.originalEvent.clientX
      const clientY = e.originalEvent.touches?.[0]?.clientY ?? e.originalEvent.clientY
      longPressRef.current = {
        timer: setTimeout(() => {
          if (!longPressRef.current) return
          longPressRef.current = null
          editDragRef.current = null
          endObjectManipulation()
          setCtxMenuState({ x: clientX, y: clientY, obj })
        }, LONG_PRESS_MS),
      }
    }
  }
  function beginObjectHandle(e, obj, handleIndex) {
    if (st.tool !== 'select') return
    startManipulation(e)
    selectObject(obj.id)
    editDragRef.current = {
      obj, mode: handleIndex === 'radius' ? 'radius' : 'vertex', handleIndex, historyPushed: false,
      startLatLng: [e.latlng.lat, e.latlng.lng],
      originalPoints: obj.points.map(p => [...p]),
      originalRadius: obj.radius,
    }
  }
  function updateObjectDrag(latlng) {
    const d = editDragRef.current
    if (!d) return
    const cur = [latlng.lat, latlng.lng]
    const dLat = cur[0] - d.startLatLng[0]
    const dLng = cur[1] - d.startLatLng[1]
    if (longPressRef.current) {
      const p1 = map.latLngToContainerPoint(L.latLng(d.startLatLng[0], d.startLatLng[1]))
      const p2 = map.latLngToContainerPoint(L.latLng(cur[0], cur[1]))
      if (p1.distanceTo(p2) > TAP_MOVE_THRESHOLD) {
        clearTimeout(longPressRef.current.timer)
        longPressRef.current = null
      }
    }
    if (!d.historyPushed) {
      d.historyPushed = true
      updateObject(d.obj.id, {}, { silent: false })
    }
    if (d.mode === 'move') {
      const nextPoints = d.originalPoints.map(([la, ln]) => [la + dLat, ln + dLng])
      updateObject(d.obj.id, { points: nextPoints }, { silent: true })
    } else if (d.mode === 'vertex') {
      const nextPoints = d.originalPoints.map((p, i) => i === d.handleIndex ? [p[0] + dLat, p[1] + dLng] : p)
      updateObject(d.obj.id, { points: nextPoints }, { silent: true })
    } else if (d.mode === 'radius') {
      const center = d.originalPoints[0]
      const r = Math.max(0.5, Math.hypot(cur[0] - center[0], cur[1] - center[1]))
      updateObject(d.obj.id, { radius: r }, { silent: true })
    }
  }
  function endObjectDrag() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current.timer)
      longPressRef.current = null
    }
    const d = editDragRef.current
    editDragRef.current = null
    if (d) endObjectManipulation()
  }

  /* Safety net for a release outside the map container. */
  const liveRef = useRef({})
  liveRef.current.endObjectDrag = endObjectDrag
  liveRef.current.endDrag = endDrag
  liveRef.current.endErase = endErase
  useEffect(() => {
    function onUp() {
      liveRef.current.endObjectDrag()
      liveRef.current.endDrag()
      if (eraseRef.current) liveRef.current.endErase()
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const visibleObjects = st.objects.filter(o => {
    if (isTypeHidden(o.type)) return false
    if (PATH_TACTICAL_TYPES.includes(o.type) && !st.showPaths) return false
    if (editingTextObj && o.id === editingTextObj.id) return false
    return true
  })

  useMapEvents({
    click: (e) => {
      const tool = st.tool
      const pos = [e.latlng.lat, e.latlng.lng]
      if (tool === 'select') { selectObject(null); return }
      if (tool === 'text') { setDrafting({ kind: 'text', latlng: pos }); return }
      if (POINT_TACTICAL_TYPES.includes(tool)) {
        addObject({ type: tool, points: [pos], color: st.drawColor, thickness: st.drawThickness, opacity: st.drawOpacity })
        return
      }
      if (VERTEX_TOOLS.includes(tool)) { addDraftPoint(tool, pos); return }
    },
    dblclick: () => {
      if (VERTEX_TOOLS.includes(st.tool) && st.drafting?.kind === 'path') finishDraft()
    },
    contextmenu: (e) => { e.originalEvent?.preventDefault?.() },
    mousemove: (e) => {
      if (editDragRef.current) { e.originalEvent?.preventDefault?.(); updateObjectDrag(e.latlng) }
    },
    mouseup: () => { endObjectDrag() },
  })

  function openContextMenu(nativeEvent, obj) {
    if (st.tool !== 'select') return
    selectObject(obj.id)
    setCtxMenuState({ x: nativeEvent.clientX, y: nativeEvent.clientY, obj })
  }

  return (
    <>
      {visibleObjects.map(obj => (
        <ObjectRender
          key={obj.id}
          obj={obj}
          isSelected={obj.id === st.selectedObjectId}
          tool={st.tool}
          onSelect={selectObject}
          onBeginMove={beginObjectMove}
          onBeginHandle={beginObjectHandle}
          onContextMenu={openContextMenu}
          onEditText={setEditingTextObj}
        />
      ))}

      {/* ---- in-progress vertex draft (Team Rotation / Draw Path & Zone) ---- */}
      {st.drafting?.kind === 'path' && (
        <Polyline
          positions={st.drafting.points}
          pathOptions={{ color: st.drawColor, weight: 2, opacity: 0.7, dashArray: '4 4', interactive: false }}
        />
      )}

      {/* ---- inline text input (new or editing existing) ---- */}
      <TextDraftLayer
        draft={st.drafting?.kind === 'text' ? st.drafting : null}
        st={st}
        editingObj={editingTextObj}
        onFinishEdit={() => setEditingTextObj(null)}
      />

      {/* ---- schematic zone overlay ---- */}
      {st.selectedZone === 'all'
        ? ZONE_NUMBERS.map(n => {
            const { center, radius } = schematicZoneCircle(n)
            return (
              <Circle key={n} center={center} radius={radius} interactive={false}
                pathOptions={{ color: '#3B82F6', weight: 1.5, opacity: 0.5 - n * 0.03, fill: false, dashArray: '5 5' }} />
            )
          })
        : typeof st.selectedZone === 'number' && (() => {
            const { center, radius } = schematicZoneCircle(st.selectedZone)
            return (
              <Circle center={center} radius={radius} interactive={false}
                pathOptions={{ color: '#3B82F6', weight: 2, opacity: 0.75, fillColor: '#3B82F6', fillOpacity: 0.06, dashArray: '6 4' }} />
            )
          })()}

      {/* ---- schematic flight path ---- */}
      {st.flightPathVisible && (
        <Polyline positions={schematicFlightPath()} interactive={false}
          pathOptions={{ color: '#00D4FF', weight: 3, opacity: 0.85, dashArray: '2 10' }} />
      )}

      {/* ---- context menu (right-click / long-press) ---- */}
      {ctxMenu && (
        <ContextMenuPortal
          x={ctxMenu.x} y={ctxMenu.y}
          onEdit={ctxMenu.obj.type === 'text' ? () => { setEditingTextObj(ctxMenu.obj); setCtxMenuState(null) } : null}
          onDuplicate={() => { duplicateObject(ctxMenu.obj.id); setCtxMenuState(null) }}
          onDelete={() => { deleteObject(ctxMenu.obj.id); setCtxMenuState(null) }}
          onClose={() => setCtxMenuState(null)}
        />
      )}
    </>
  )
}
