import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { Marker, Polyline, Polygon, Rectangle, Circle, useMap, useMapEvents } from 'react-leaflet'
import { LAYER_GROUPS, PAN_LOCKING_TOOLS, DRAG_DRAW_TOOLS, bearingBetween, DEFAULT_THICKNESS, DEFAULT_OPACITY, DEFAULT_DRAW_COLOR } from '../../utils/strategyDataSchema.js'
import { TACTICAL_TOOLS_BY_KEY, TACTICAL_PATH_TOOLS, TACTICAL_POINT_TOOLS, TACTICAL_CIRCLE_TOOLS } from '../../utils/tacticalToolsSchema.js'
import { getSpawnReference } from '../../utils/spawnReferenceData.js'
import {
  useStrategyStore, addObject, selectObject, setDrafting, setMeasurePoints,
  startTacticalPathPoint, startTacticalPointForm, startTacticalCircleForm, finishTacticalPathDraft,
} from './strategyStore.js'

const PATH_DASH_ARRAY = {
  teamRotation: null,
  attackPath: null,
  retreatPath: '6 4',
  scoutPath: '2 6',
}

const DANGER_FILL_OPACITY = { Low: 0.08, Medium: 0.16, High: 0.26, Critical: 0.4 }

function tacticalBadgeIcon(tool, obj, isSelected) {
  const color = obj.color || tool.defaultColor
  return L.divIcon({
    className: 'strat-tactical-badge',
    html: `<div style="
      display:flex; align-items:center; justify-content:center;
      min-width:22px; height:22px; padding:0 4px; box-sizing:border-box;
      background:${color}; opacity:${obj.opacity ?? DEFAULT_OPACITY};
      border-radius:5px; border:2px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.5)'};
      color:#fff; font-family:'DM Sans',sans-serif; font-weight:800; font-size:9px;
      white-space:nowrap; cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,0.6);
    ">${tool.badge}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

/* Every interactive vector shape below sets bubblingMouseEvents:false —
   Leaflet's Path layers bubble their click up into the map's own
   'click' event by default, which would immediately fire the Select
   tool's "clicked empty map -> deselect" handler right after a shape
   click selected it. Markers (arrowheads, text) don't have this
   bubbling behavior in Leaflet, so they don't need the flag. */
const NO_BUBBLE = { bubblingMouseEvents: false }

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

function textIcon(text, color, opacity, thickness, isSelected) {
  const fontSize = thickness <= 2 ? 12 : thickness <= 4 ? 15 : 20
  const safe = String(text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return L.divIcon({
    className: 'strat-text-obj',
    html: `<div style="
      display:inline-block; color:${color}; opacity:${opacity};
      font-family:'DM Sans',sans-serif; font-weight:700; font-size:${fontSize}px;
      white-space:nowrap; cursor:pointer;
      text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;
      ${isSelected ? 'outline:2px dashed #fff; outline-offset:3px; padding:2px 4px; border-radius:3px;' : ''}
    ">${safe}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/* ---- legacy objects from the previous toolkit generation ----
   Marker (with player assignment), Rotation (player color-coding),
   Zone and the old freehand-only Draw are gone as creatable tools,
   but any strategy already saved with one of those types must still
   load without crashing. Freehand/rotation/zone map naturally onto a
   visually equivalent new shape; marker/vehicle (and anything even
   older — combat/utility/vision/formation) have no shape equivalent
   here and are skipped silently, same precedent as the prior
   tool-set removal. */
function renderLegacyObject(obj, isSelected) {
  if (obj.type === 'freehand' && Array.isArray(obj.waypoints)) {
    return (
      <Polyline
        positions={obj.waypoints}
        pathOptions={{ ...NO_BUBBLE, color: obj.color || DEFAULT_DRAW_COLOR, weight: isSelected ? DEFAULT_THICKNESS + 3 : DEFAULT_THICKNESS, opacity: DEFAULT_OPACITY }}
        eventHandlers={{ click: () => selectObject(obj.id) }}
      />
    )
  }
  if (obj.type === 'rotation' && Array.isArray(obj.waypoints)) {
    return (
      <Polyline
        positions={obj.waypoints}
        pathOptions={{ ...NO_BUBBLE, color: obj.color || DEFAULT_DRAW_COLOR, weight: isSelected ? DEFAULT_THICKNESS + 3 : DEFAULT_THICKNESS, opacity: DEFAULT_OPACITY }}
        eventHandlers={{ click: () => selectObject(obj.id) }}
      />
    )
  }
  if (obj.type === 'zone' && Array.isArray(obj.position)) {
    return (
      <Circle
        center={obj.position} radius={obj.radius || 5}
        pathOptions={{ ...NO_BUBBLE, color: obj.color || DEFAULT_DRAW_COLOR, weight: isSelected ? 4 : 2, opacity: DEFAULT_OPACITY, fillOpacity: 0.1 }}
        eventHandlers={{ click: () => selectObject(obj.id) }}
      />
    )
  }
  return null
}

function ObjectRender({ obj, isSelected, tool }) {
  function select() {
    if (tool === 'select') selectObject(obj.id)
  }
  const haloOptions = { ...NO_BUBBLE, color: '#fff', opacity: 0.85, fill: false, dashArray: '6 4', interactive: false }

  if (obj.type === 'pencil' || obj.type === 'line' || obj.type === 'arrow') {
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
    return (
      <>
        {isSelected && <Polyline positions={pts} pathOptions={{ ...haloOptions, weight: obj.thickness + 5 }} />}
        <Polyline positions={pts} pathOptions={{ color: obj.color, weight: obj.thickness, opacity: obj.opacity, interactive: false }} />
        <Polyline positions={pts} pathOptions={hitOptions} eventHandlers={{ click: select }} />
        {head}
      </>
    )
  }

  if (obj.type === 'polygon') {
    return (
      <>
        <Polygon
          positions={obj.points}
          pathOptions={{
            ...NO_BUBBLE, color: obj.color, weight: obj.thickness, opacity: obj.opacity,
            fillColor: obj.color, fillOpacity: Math.max(obj.opacity * 0.18, 0.04),
          }}
          eventHandlers={{ click: select }}
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
            fillColor: obj.color, fillOpacity: Math.max(obj.opacity * 0.18, 0.04),
          }}
          eventHandlers={{ click: select }}
        />
        {isSelected && <Rectangle bounds={obj.points} pathOptions={{ ...haloOptions, weight: obj.thickness + 3 }} />}
      </>
    )
  }

  if (obj.type === 'circle') {
    return (
      <>
        <Circle
          center={obj.points[0]} radius={obj.radius || 1}
          pathOptions={{
            ...NO_BUBBLE, color: obj.color, weight: obj.thickness, opacity: obj.opacity,
            fillColor: obj.color, fillOpacity: Math.max(obj.opacity * 0.18, 0.04),
          }}
          eventHandlers={{ click: select }}
        />
        {isSelected && <Circle center={obj.points[0]} radius={obj.radius || 1} pathOptions={{ ...haloOptions, weight: obj.thickness + 3 }} />}
      </>
    )
  }

  if (obj.type === 'text') {
    return (
      <Marker
        position={obj.points[0]}
        icon={textIcon(obj.text, obj.color, obj.opacity, obj.thickness, isSelected)}
        eventHandlers={{ click: select }}
      />
    )
  }

  const tacticalTool = TACTICAL_TOOLS_BY_KEY[obj.type]
  if (tacticalTool) {
    if (tacticalTool.geometry === 'point') {
      return (
        <Marker
          position={obj.points[0]}
          icon={tacticalBadgeIcon(tacticalTool, obj, isSelected)}
          eventHandlers={{ click: select }}
        />
      )
    }
    if (tacticalTool.geometry === 'path') {
      const pts = obj.points
      const hitOptions = { ...NO_BUBBLE, color: obj.color, weight: Math.max(obj.thickness + 14, 18), opacity: 0 }
      const last = pts[pts.length - 1]
      const prev = pts[pts.length - 2]
      const bearing = prev ? bearingBetween(prev, last) : 0
      const headSize = Math.max(10, obj.thickness * 3)
      return (
        <>
          {isSelected && <Polyline positions={pts} pathOptions={{ ...haloOptions, weight: obj.thickness + 5 }} />}
          <Polyline positions={pts} pathOptions={{ color: obj.color, weight: obj.thickness, opacity: obj.opacity, dashArray: PATH_DASH_ARRAY[obj.type] || undefined, interactive: false }} />
          <Polyline positions={pts} pathOptions={hitOptions} eventHandlers={{ click: select }} />
          <Marker position={last} icon={arrowHeadIcon(obj.color, bearing, headSize, obj.opacity)} interactive={false} />
        </>
      )
    }
    if (tacticalTool.geometry === 'circle') {
      const fillOpacity = DANGER_FILL_OPACITY[obj.fields?.dangerLevel] ?? Math.max(obj.opacity * 0.18, 0.04)
      return (
        <>
          <Circle
            center={obj.points[0]} radius={obj.radius || 1}
            pathOptions={{
              ...NO_BUBBLE, color: obj.color, weight: obj.thickness, opacity: obj.opacity,
              fillColor: obj.color, fillOpacity,
            }}
            eventHandlers={{ click: select }}
          />
          {isSelected && <Circle center={obj.points[0]} radius={obj.radius || 1} pathOptions={{ ...haloOptions, weight: obj.thickness + 3 }} />}
        </>
      )
    }
  }

  return renderLegacyObject(obj, isSelected)
}

/* Inline text-entry input for the Text tool. A real <input> inside a
   Leaflet divIcon, wired with vanilla DOM listeners on Leaflet's own
   'add' event (fired once the marker's element is actually in the
   DOM) rather than a portal/overlay — Leaflet repositions this marker
   for free on pan/zoom exactly like any other marker, which a manual
   HTML overlay would have to reimplement by hand. */
function TextDraftLayer({ draft, st }) {
  const committedRef = useRef(false)
  useEffect(() => { committedRef.current = false }, [draft])

  /* Memoized so the SAME L.divIcon instance survives every re-render
     of this component (the draft's [lat,lng] moving, an unrelated
     store change ticking useStrategyStore, StrictMode's double-render
     in dev, ...). A fresh divIcon object each render made react-leaflet
     call marker.setIcon() on every one of those, which tears down and
     rebuilds the <input>'s DOM node — firing a 'blur' on the just-
     focused input before the user could type anything, which
     immediately committed an empty draft and silently discarded it.
     The icon's HTML never actually depends on anything per-render, so
     building it once and reusing it is correct, not just a perf
     nicety. Hooks must run unconditionally, so this sits above the
     early return below. */
  const icon = useMemo(() => L.divIcon({
    className: 'strat-text-draft-icon',
    html: `<input type="text" class="strat-text-draft-input" placeholder="Type and press Enter…" maxlength="60" />`,
    iconSize: [180, 30],
    iconAnchor: [0, 15],
  }), [])

  if (!draft || draft.kind !== 'text') return null

  function commit(value) {
    if (committedRef.current) return
    committedRef.current = true
    const text = value.trim()
    setDrafting(null)
    if (text) {
      addObject({
        type: 'text', points: [draft.latlng], text,
        color: st.drawColor, thickness: st.drawThickness, opacity: st.drawOpacity,
      })
    }
  }
  function cancel() {
    if (committedRef.current) return
    committedRef.current = true
    setDrafting(null)
  }

  return (
    <Marker
      position={draft.latlng}
      icon={icon}
      interactive
      eventHandlers={{
        add: (e) => {
          const el = e.target.getElement()
          const input = el?.querySelector('input')
          if (!input) return
          L.DomEvent.disableClickPropagation(el)
          L.DomEvent.disableScrollPropagation(el)
          setTimeout(() => input.focus(), 0)
          input.addEventListener('keydown', (ev) => {
            ev.stopPropagation()
            if (ev.key === 'Enter') { ev.preventDefault(); commit(input.value) }
            else if (ev.key === 'Escape') { ev.preventDefault(); cancel() }
          })
          input.addEventListener('blur', () => commit(input.value))
        },
      }}
    />
  )
}

export default function DrawingCanvas({ mapId }) {
  const st = useStrategyStore()
  const map = useMap()

  /* Live-preview state for drag-based tools lives ENTIRELY outside
     React (refs + a raw, imperatively-managed Leaflet layer) — Issue
     3(b): pushing every touchmove point into React state was what
     caused the mobile "screen shake" bug (a full React re-render per
     point, dozens of times a second, fighting the browser's own
     touch handling). The finished shape is committed to the store
     with a single addObject() call on release — one React update per
     gesture, not one per pixel. */
  const isDrawingRef = useRef(false)
  const draftRef = useRef(null)       // raw points/geometry accumulated during the current drag
  const draftLayerRef = useRef(null)  // the imperative Leaflet layer showing the live preview

  function removeDraftLayer() {
    if (draftLayerRef.current) {
      map.removeLayer(draftLayerRef.current)
      draftLayerRef.current = null
    }
  }
  /* Clean up any in-progress preview layer immediately when the tool
     changes (e.g. the user switches tools mid-gesture via keyboard
     shortcut) or this layer unmounts (switching Erangel/Miramar/Rondo
     remounts the whole map, mode switches away from Strategy). */
  useEffect(() => {
    return () => { isDrawingRef.current = false; removeDraftLayer() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.tool, mapId])

  /* Map pan/zoom/tap gestures are disabled for exactly the tools that
     use a drag gesture to draw (Issue 3.3) — otherwise Leaflet's own
     pan-by-drag and pinch-zoom compete with the draw gesture for the
     same touch input. Re-enabled the instant the tool changes away
     from one of these, or this layer unmounts. */
  useEffect(() => {
    const locked = PAN_LOCKING_TOOLS.includes(st.tool)
    if (locked) {
      map.dragging.disable()
      map.touchZoom.disable()
      map.doubleClickZoom.disable()
      map.tap?.disable()
    } else {
      map.dragging.enable()
      map.touchZoom.enable()
      map.doubleClickZoom.enable()
      map.tap?.enable()
    }
    return () => {
      map.dragging.enable()
      map.touchZoom.enable()
      map.doubleClickZoom.enable()
      map.tap?.enable()
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
      draftLayerRef.current = L.rectangle(draftRef.current, { ...style, fillOpacity: 0.05 }).addTo(map)
    } else if (st.tool === 'circle' || TACTICAL_CIRCLE_TOOLS.includes(st.tool)) {
      draftRef.current = { center: start, radius: 0.0001 }
      draftLayerRef.current = L.circle(start, { ...style, radius: 0.0001, fillOpacity: 0.05 }).addTo(map)
    }
  }

  function updateDrag(latlng) {
    if (!isDrawingRef.current || !draftLayerRef.current) return
    const cur = [latlng.lat, latlng.lng]
    if (st.tool === 'pencil') {
      const pts = draftRef.current
      const [lastLat, lastLng] = pts[pts.length - 1]
      /* Skip points closer than this to the last one so a fast
         stroke doesn't balloon into thousands of near-duplicate
         waypoints — imperceptible visually, meaningfully smaller
         saved payload. */
      if (Math.hypot(cur[0] - lastLat, cur[1] - lastLng) < 0.15) return
      pts.push(cur)
      draftLayerRef.current.setLatLngs(pts)
    } else if (st.tool === 'line' || st.tool === 'arrow') {
      draftRef.current[1] = cur
      draftLayerRef.current.setLatLngs(draftRef.current)
    } else if (st.tool === 'rectangle') {
      draftRef.current[1] = cur
      draftLayerRef.current.setBounds(draftRef.current)
    } else if (st.tool === 'circle' || TACTICAL_CIRCLE_TOOLS.includes(st.tool)) {
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

    if (tool === 'pencil' && finished && finished.length >= 2) {
      addObject({ type: 'pencil', points: finished, color: st.drawColor, thickness: st.drawThickness, opacity: st.drawOpacity })
    } else if ((tool === 'line' || tool === 'arrow') && finished) {
      const [a, b] = finished
      if (a[0] !== b[0] || a[1] !== b[1]) {
        addObject({ type: tool, points: finished, color: st.drawColor, thickness: st.drawThickness, opacity: st.drawOpacity })
      }
    } else if (tool === 'rectangle' && finished) {
      const [a, b] = finished
      if (a[0] !== b[0] && a[1] !== b[1]) {
        addObject({ type: 'rectangle', points: finished, color: st.drawColor, thickness: st.drawThickness, opacity: st.drawOpacity })
      }
    } else if (tool === 'circle' && finished && finished.radius > 0.5) {
      addObject({ type: 'circle', points: [finished.center], radius: finished.radius, color: st.drawColor, thickness: st.drawThickness, opacity: st.drawOpacity })
    } else if (TACTICAL_CIRCLE_TOOLS.includes(tool) && finished && finished.radius > 0.5) {
      startTacticalCircleForm(tool, finished.center, finished.radius)
    }
  }

  const activeGroupKeys = st.visibleLayerGroups
  const visibleObjects = st.objects.filter(o => {
    if (o.phase !== st.activePhase) return false
    /* Matched by predicate, not a key===type lookup — entryMarker and
       exitMarker are two distinct types that share one layer group
       ("Entry/Exit Markers", key 'entryExit'), so a plain key===type
       check would never find their group. */
    const group = LAYER_GROUPS.find(g => g.match(o))
    if (group) return activeGroupKeys.has(group.key)
    return true /* legacy types — no toggle can reach them, always show */
  })

  const spawnVehiclePositions = st.showSpawnRefVehicle ? getSpawnReference(mapId, 'vehicle') : null
  const spawnBoatPositions    = st.showSpawnRefBoat    ? getSpawnReference(mapId, 'boat')    : null

  useMapEvents({
    click: (e) => {
      const tool = st.tool
      const pos = [e.latlng.lat, e.latlng.lng]

      if (tool === 'select') { selectObject(null); return }

      if (tool === 'polygon') {
        const cur = st.drafting?.kind === 'polygon' ? st.drafting.points : []
        setDrafting({ kind: 'polygon', points: [...cur, pos] })
        return
      }

      if (tool === 'text') {
        setDrafting({ kind: 'text', latlng: pos })
        return
      }

      if (tool === 'measure') {
        if (!st.measureFrom) setMeasurePoints(pos, null)
        else setMeasurePoints(st.measureFrom, pos)
        return
      }

      if (TACTICAL_POINT_TOOLS.includes(tool)) {
        startTacticalPointForm(tool, pos)
        return
      }

      if (TACTICAL_PATH_TOOLS.includes(tool)) {
        startTacticalPathPoint(tool, pos)
        return
      }
    },
    dblclick: () => {
      if (st.tool === 'polygon' && st.drafting?.kind === 'polygon') {
        const points = st.drafting.points
        if (points.length >= 3) {
          addObject({ type: 'polygon', points, color: st.drawColor, thickness: st.drawThickness, opacity: st.drawOpacity })
        } else {
          setDrafting(null)
        }
      }
      if (TACTICAL_PATH_TOOLS.includes(st.tool) && st.drafting?.kind === 'tactical-path') {
        finishTacticalPathDraft()
      }
    },
    mousedown: (e) => {
      if (!DRAG_DRAW_TOOLS.includes(st.tool)) return
      /* Disabled here too, not just in the useEffect above: a mousedown
         that starts a stroke has to shut off Leaflet's own pan-by-drag
         handler before its FIRST mousemove is processed, not after the
         next render commits — otherwise Leaflet's native drag machinery
         and this handler both react to the same gesture. preventDefault
         on the raw touch/mouse event is the other half of Issue 3.1: it
         stops the browser's own scroll/zoom gesture from ever starting
         alongside ours. */
      e.originalEvent?.preventDefault?.()
      beginDrag(e.latlng)
    },
    mousemove: (e) => {
      if (!isDrawingRef.current) return
      e.originalEvent?.preventDefault?.()
      updateDrag(e.latlng)
    },
    mouseup: () => {
      endDrag()
    },
  })

  return (
    <>
      {/* ---- verified spawn data reference overlay (Issue 9/17) ---- */}
      {spawnVehiclePositions && spawnVehiclePositions.map((pos, i) => (
        <Marker key={`ref-veh-${i}`} position={pos} icon={referenceIcon('#F59E0B')} interactive={false} />
      ))}
      {spawnBoatPositions && spawnBoatPositions.map((pos, i) => (
        <Marker key={`ref-boat-${i}`} position={pos} icon={referenceIcon('#3B82F6')} interactive={false} />
      ))}

      {/* ---- committed objects ---- */}
      {visibleObjects.map(obj => (
        <ObjectRender key={obj.id} obj={obj} isSelected={obj.id === st.selectedObjectId} tool={st.tool} />
      ))}

      {/* ---- in-progress polygon ---- */}
      {st.drafting?.kind === 'polygon' && (
        <Polyline
          positions={st.drafting.points}
          pathOptions={{ color: st.drawColor, weight: 2, opacity: 0.7, dashArray: '4 4', interactive: false }}
        />
      )}

      {/* ---- in-progress tactical path ---- */}
      {st.drafting?.kind === 'tactical-path' && (
        <Polyline
          positions={st.drafting.points}
          pathOptions={{ color: st.drawColor, weight: 2, opacity: 0.7, dashArray: '4 4', interactive: false }}
        />
      )}

      {/* ---- in-progress text input ---- */}
      <TextDraftLayer draft={st.drafting} st={st} />

      {/* ---- measure tool (unchanged) ---- */}
      {st.measureFrom && (
        <Marker position={st.measureFrom} icon={handleIcon()} interactive={false} />
      )}
      {st.measureFrom && st.measureTo && (
        <>
          <Polyline positions={[st.measureFrom, st.measureTo]} pathOptions={{ color: '#F8FAFC', weight: 2, dashArray: '3 5', interactive: false }} />
          <Marker position={st.measureTo} icon={handleIcon()} interactive={false} />
        </>
      )}
    </>
  )
}

function referenceIcon(color) {
  return L.divIcon({
    className: 'strat-ref-marker',
    html: `<div style="width:7px;height:7px;background:${color};opacity:0.55;border-radius:50%;box-shadow:0 0 0 1px rgba(255,255,255,0.3);"></div>`,
    iconSize: [7, 7],
    iconAnchor: [3.5, 3.5],
  })
}

let _handleIconInstance = null
function handleIcon() {
  /* Cached singleton, not rebuilt per render — a fresh L.divIcon()
     each render would make react-leaflet call marker.setIcon() every
     time, which is unnecessary churn for a static measure-tool
     endpoint marker. */
  if (!_handleIconInstance) {
    _handleIconInstance = L.divIcon({
      className: 'strat-handle-marker',
      html: `<div style="
        width:10px; height:10px; background:#fff;
        border:2px solid #3B82F6; border-radius:50%;
        box-shadow:0 1px 3px rgba(0,0,0,0.7);
      "></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    })
  }
  return _handleIconInstance
}
