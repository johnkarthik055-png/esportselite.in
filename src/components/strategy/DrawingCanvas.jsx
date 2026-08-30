import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { Marker, Polyline, Polygon, Rectangle, Circle, useMap, useMapEvents } from 'react-leaflet'
import { SquarePen, Copy, Trash2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import {
  DRAG_DRAW_TOOLS, VERTEX_TOOLS, PAN_LOCKING_TOOLS,
  TACTICAL_TOOLS_BY_KEY, PATH_TACTICAL_TYPES, POINT_TACTICAL_TYPES,
  DEFAULT_OPACITY, mapInstanceRef,
  bearingBetween, schematicZoneCircle, schematicFlightPath, ZONE_NUMBERS,
} from '../../utils/strategyDataSchema.js'
import {
  useStrategyStore, addObject, updateObject, selectObject, setDrafting,
  addDraftPoint, finishDraft, duplicateObject, deleteObject,
} from '../../utils/strategyDataSchema.js'

/* bubblingMouseEvents:false — stop a press/click on an object (or its
   resize handle) from ALSO reaching the map as a Leaflet map event.
   This is one of two layers that stop "map pans while I drag the
   shape": this kills the Leaflet-level bubble, and beginObjectMove/
   beginObjectHandle additionally kill the native DOM bubble AND
   disable map.dragging for the duration of the gesture. */
const NO_BUBBLE = { bubblingMouseEvents: false }
const LONG_PRESS_MS = 500
const TAP_MOVE_THRESHOLD = 8 /* px — beyond this a touch is a drag, not a long-press */

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
function textIcon(text, color, opacity, bold, fontSize, isSelected) {
  const safe = String(text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return L.divIcon({
    className: 'strat-text-obj',
    html: `<div style="
      display:inline-block; color:${color}; opacity:${opacity};
      font-family:'DM Sans',sans-serif; font-weight:${bold ? 800 : 600}; font-size:${fontSize}px;
      white-space:nowrap; cursor:pointer;
      text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;
      ${isSelected ? 'outline:2px dashed #fff; outline-offset:3px; padding:2px 4px; border-radius:3px;' : ''}
    ">${safe}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
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
      border-radius:5px; border:2px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.5)'};
      color:#fff; font-family:'DM Sans',sans-serif; font-weight:800; font-size:9px;
      white-space:nowrap; cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,0.6);
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
      border-radius:50%; box-shadow:0 1px 3px rgba(0,0,0,0.7); cursor:${cursor};
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
   instead of the viewport, the same clipping-adjacent class of bug
   this app has hit before). Rendering into document.body via a real
   React portal — not a second manually-managed root — sidesteps that
   entirely while staying part of the normal React tree (event
   bubbling, automatic unmount, no extra reconciler instance). */
function ContextMenuPortal(props) {
  return createPortal(<ContextMenu {...props} />, document.body)
}

function ObjectRender({ obj, isSelected, tool, onSelect, onBeginMove, onBeginHandle, onContextMenu, onErase }) {
  const haloOptions = { ...NO_BUBBLE, color: '#fff', opacity: 0.85, fill: false, dashArray: '6 4', interactive: false }
  const selectable = tool === 'select'
  const erasing = tool === 'eraser'

  function select(e) {
    if (erasing) { killDomEvent(e); onErase(obj.id); return }
    if (!selectable) return
    onSelect(obj.id)
  }
  function bodyDown(e) {
    if (erasing) { killDomEvent(e); return } /* eraser acts on click, not on a drag */
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
    const dashArray = obj.type === 'arrow' && obj.arrowStyle === 'dashed' ? '8 6'
      : tacticalTool?.key === 'pathZone' ? '3 7' : undefined
    return (
      <>
        {tacticalTool?.key === 'pathZone' && pts.length >= 3 && (
          <Polygon positions={pts} pathOptions={{ ...NO_BUBBLE, color: obj.color, weight: 0, fillColor: obj.color, fillOpacity: Math.max(obj.opacity * 0.15, 0.05), interactive: false }} />
        )}
        {/* Selection feedback is a dashed halo only — NO per-point
            vertex dots for Pencil / Line / Arrow / Team Rotation /
            Draw Path & Zone. These move as a whole (drag the body). */}
        {isSelected && <Polyline positions={pts} pathOptions={{ ...haloOptions, weight: obj.thickness + 5 }} />}
        <Polyline positions={pts} pathOptions={{ color: obj.color, weight: obj.thickness, opacity: obj.opacity, dashArray, interactive: false }} />
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
      <>
        <Polygon
          positions={obj.points}
          pathOptions={{
            ...NO_BUBBLE, color: obj.color, weight: obj.thickness, opacity: obj.opacity,
            fillColor: obj.color, fillOpacity: obj.fill ? Math.max(obj.opacity * 0.2, 0.05) : 0,
          }}
          eventHandlers={{ mousedown: bodyDown, click: select, contextmenu: ctxMenu }}
        />
        {isSelected && <Polygon positions={obj.points} pathOptions={{ ...haloOptions, weight: obj.thickness + 3 }} />}
      </>
    )
  }

  if (obj.type === 'rectangle') {
    return (
      <>
        <Rectangle
          bounds={obj.points}
          pathOptions={{
            ...NO_BUBBLE, color: obj.color, weight: obj.thickness, opacity: obj.opacity,
            fillColor: obj.color, fillOpacity: obj.fill ? Math.max(obj.opacity * 0.2, 0.05) : 0,
          }}
          eventHandlers={{ mousedown: bodyDown, click: select, contextmenu: ctxMenu }}
        />
        {isSelected && <Rectangle bounds={obj.points} pathOptions={{ ...haloOptions, weight: obj.thickness + 3 }} />}
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
            ...NO_BUBBLE, color: obj.color, weight: obj.thickness, opacity: obj.opacity,
            fillColor: obj.color, fillOpacity: obj.fill ? Math.max(obj.opacity * 0.2, 0.05) : 0,
          }}
          eventHandlers={{ mousedown: bodyDown, click: select, contextmenu: ctxMenu }}
        />
        {isSelected && <Circle center={center} radius={obj.radius || 1} pathOptions={{ ...haloOptions, weight: obj.thickness + 3 }} />}
        {isSelected && (
          <Marker position={radiusHandlePos} icon={handleIconFor('ns-resize')} bubblingMouseEvents={false}
            eventHandlers={{ mousedown: (e) => onBeginHandle(e, obj, 'radius') }} />
        )}
      </>
    )
  }

  if (obj.type === 'text') {
    return (
      <Marker
        position={obj.points[0]}
        icon={textIcon(obj.text, obj.color, obj.opacity, obj.bold, obj.fontSize, isSelected)}
        bubblingMouseEvents={false}
        eventHandlers={{ mousedown: bodyDown, click: select, contextmenu: ctxMenu }}
      />
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
     - commit()/cancel() are single-shot (committedRef latch),
     - both ALWAYS call onFinishEdit() so the parent's editingTextObj
       state is cleared — the missing half of this was the actual
       "text gets stuck / invisible on the 2nd edit" bug: the existing-
       object branch reset `drafting` but never told the parent to stop
       hiding + editing the object, so it stayed filtered out of the
       render forever and its dead input sat inert on the map.
     - the committed latch resets on every fresh session (new draft, or
       a different existing object id),
     - a Marker 'remove' fires a deferred safety commit if the layer is
       torn down some other way (tool switch, etc.) without a blur. */
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

  /* apiRef keeps commit/cancel stable for the vanilla DOM listeners
     and the unmount safety net while still closing over the current
     session's values on every render. */
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
  const map = useMap()

  /* Expose the live Leaflet map instance to MapControls.jsx, which
     renders as a floating panel OUTSIDE <MapContainer> and so has no
     other way to reach it (see mapInstanceRef's own comment). */
  useEffect(() => {
    mapInstanceRef.current = map
    return () => { if (mapInstanceRef.current === map) mapInstanceRef.current = null }
  }, [map])

  const isDrawingRef = useRef(false)
  const draftRef = useRef(null)
  const draftLayerRef = useRef(null)

  /* Select-tool move/handle-drag state — separate ref from the
     drag-draw draft above since these two interactions never overlap
     (mutually exclusive tools) but share the same map-level mousemove/
     mouseup wiring below. */
  const editDragRef = useRef(null) /* { obj, mode:'move'|'vertex'|'radius', handleIndex, startLatLng, originalPoints, originalRadius } */

  /* "Am I currently moving/resizing an object?" — the second layer of
     the anti-pan fix requested in the bug report. The map's own
     mousedown handler bails early when this is set, and map.dragging is
     disabled outright for the duration of the gesture. */
  const manipulatingRef = useRef(false)

  const [ctxMenu, setCtxMenuState] = useState(null) /* { x, y, obj } */
  const [editingTextObj, setEditingTextObj] = useState(null)
  const longPressRef = useRef(null) /* { obj, startX, startY, timer } */

  function removeDraftLayer() {
    if (draftLayerRef.current) {
      map.removeLayer(draftLayerRef.current)
      draftLayerRef.current = null
    }
  }
  useEffect(() => {
    return () => { isDrawingRef.current = false; removeDraftLayer() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.tool, mapId])

  /* Switching tools always closes any open text editor so it can never
     strand the object hidden-and-uneditable (see TextDraftLayer). The
     input's blur commits its value first in every normal flow. */
  useEffect(() => { setEditingTextObj(null) }, [st.tool])

  useEffect(() => {
    const locked = PAN_LOCKING_TOOLS.includes(st.tool)
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

  function beginDrag(latlng) {
    isDrawingRef.current = true
    removeDraftLayer()
    const start = [latlng.lat, latlng.lng]
    const style = { color: st.drawColor, weight: st.drawThickness, opacity: st.drawOpacity, interactive: false }
    if (st.tool === 'pencil') {
      draftRef.current = [start]
      draftLayerRef.current = L.polyline(draftRef.current, style).addTo(map)
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
      if (Math.hypot(cur[0] - lastLat, cur[1] - lastLng) < 0.15) return
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

  /* ---- select-tool move / handle drag (imperative, same reasoning
     as beginDrag/updateDrag above: pushing every intermediate point
     into React state would repaint the whole tree on every pixel of
     movement — instead we mutate the target Leaflet layer directly
     via the object's own React-rendered layer through re-render only
     at 60fps-cheap granularity using a local ref, and commit ONE
     store update on release. ---- */
  function startManipulation(e) {
    /* Kill the DOM event so Leaflet's pan-drag (L.Draggable on the map
       container) never sees this press, AND disable map dragging for
       the whole gesture as an explicit second guard. Re-enabled in
       endObjectManipulation(). */
    killDomEvent(e)
    manipulatingRef.current = true
    if (map.dragging.enabled()) map.dragging.disable()
  }
  function endObjectManipulation() {
    manipulatingRef.current = false
    /* Object manipulation only ever starts under the Select tool, which
       always wants panning available again once the gesture ends. */
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

    /* Touch: a press-and-hold should open the context menu (Edit/
       Duplicate/Delete) rather than silently start moving the shape.
       Arm a timer alongside the move above; if the pointer moves past
       TAP_MOVE_THRESHOLD before the timer fires (see updateObjectDrag),
       it's cancelled and the gesture continues as a normal move —
       exactly like a real long-press-vs-drag disambiguation. */
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
      /* Real pixel distance (not a lat/lng-unit approximation, which
         would drift with zoom level) — a long-press must tolerate a
         little finger jitter without misfiring as a drag. */
      const p1 = map.latLngToContainerPoint(L.latLng(d.startLatLng[0], d.startLatLng[1]))
      const p2 = map.latLngToContainerPoint(L.latLng(cur[0], cur[1]))
      if (p1.distanceTo(p2) > TAP_MOVE_THRESHOLD) {
        clearTimeout(longPressRef.current.timer)
        longPressRef.current = null
      }
    }
    /* Push the ONE history entry (pre-drag snapshot) lazily, on the
       first pixel of actual movement — not in begin*() above, which
       fires on every mousedown including a plain click-to-select that
       never turns into a drag. That would otherwise create a no-op
       history entry (and mark the strategy dirty) just from selecting
       something. */
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
    const d = editDragRef.current
    if (longPressRef.current) {
      clearTimeout(longPressRef.current.timer)
      longPressRef.current = null
    }
    editDragRef.current = null
    if (d) endObjectManipulation()

    /* A press on a text object that never turned into a drag = the
       user wants to (re)edit it. Open its inline editor with the
       current text pre-filled. Dragging it instead (historyPushed)
       just moves it, same as any other object. */
    if (d && d.mode === 'move' && !d.historyPushed && d.obj?.type === 'text' && st.tool === 'select') {
      const latest = st.objects.find(o => o.id === d.obj.id) || d.obj
      setEditingTextObj(latest)
    }
  }

  /* Safety net: if the pointer is released (or cancelled) outside the
     map container, Leaflet's map-level 'mouseup' never fires — without
     this the drag state and the disabled map.dragging would both stay
     stuck. Handlers are re-read via refs so they never go stale. */
  const liveRef = useRef({})
  liveRef.current.endDrag = endDrag
  liveRef.current.endObjectDrag = endObjectDrag
  useEffect(() => {
    function onUp() {
      liveRef.current.endObjectDrag()
      liveRef.current.endDrag()
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const visibleObjects = st.objects.filter(o => {
    if (PATH_TACTICAL_TYPES.includes(o.type) && !st.showPaths) return false
    if (editingTextObj && o.id === editingTextObj.id) return false /* stands in via TextDraftLayer instead */
    return true
  })

  useMapEvents({
    click: (e) => {
      const tool = st.tool
      const pos = [e.latlng.lat, e.latlng.lng]
      if (tool === 'select') { selectObject(null); return }
      if (tool === 'eraser') return /* eraser only acts on objects, not empty map */
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
    mousedown: (e) => {
      if (manipulatingRef.current || editDragRef.current) return
      if (DRAG_DRAW_TOOLS.includes(st.tool)) {
        e.originalEvent?.preventDefault?.()
        beginDrag(e.latlng)
      }
    },
    mousemove: (e) => {
      if (isDrawingRef.current) { e.originalEvent?.preventDefault?.(); updateDrag(e.latlng); return }
      if (editDragRef.current) { e.originalEvent?.preventDefault?.(); updateObjectDrag(e.latlng) }
    },
    mouseup: () => {
      endDrag()
      endObjectDrag()
    },
  })

  function openContextMenu(nativeEvent, obj) {
    if (st.tool !== 'select') return
    selectObject(obj.id)
    setCtxMenuState({ x: nativeEvent.clientX, y: nativeEvent.clientY, obj })
  }

  function eraseObject(id) {
    deleteObject(id) /* pushes history → Undo restores it, same as Select+Delete */
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
          onErase={eraseObject}
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
