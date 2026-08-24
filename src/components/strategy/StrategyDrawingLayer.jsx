import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet'
import {
  MARKER_TYPES, ROTATION_TYPES, ZONE_TYPES, LAYER_GROUPS, NEUTRAL_ROTATION_COLOR,
} from '../../utils/strategyDataSchema.js'
import { getSpawnReference } from '../../utils/spawnReferenceData.js'
import {
  useStrategyStore, addObject, updateObject,
  selectObject, setDrafting, setMeasurePoints,
} from './strategyStore.js'

const ALL_TYPE_LOOKUPS = {
  marker: MARKER_TYPES, rotation: ROTATION_TYPES, zone: ZONE_TYPES,
}

function resolveColor(cssVarOrColor) {
  if (!cssVarOrColor?.startsWith('var(')) return cssVarOrColor || '#3B82F6'
  if (typeof document === 'undefined') return '#3B82F6'
  const varName = cssVarOrColor.slice(4, -1)
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return val || '#3B82F6'
}

function typeInfo(tool, category) {
  const list = ALL_TYPE_LOOKUPS[tool]
  return list?.find(t => t.key === category) || { label: category, color: '#3B82F6' }
}

/* ---- icon factories ---- */
function objectIcon(obj, isSelected) {
  const color = resolveColor(obj.color)
  const size = isSelected ? 18 : 14
  return L.divIcon({
    className: 'strat-obj-marker',
    html: `<div style="
      width:${size}px; height:${size}px; background:${color};
      border:2px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.8)'};
      border-radius:50%;
      box-shadow:${isSelected ? '0 0 0 3px rgba(255,255,255,0.25), 0 1px 4px rgba(0,0,0,0.6)' : '0 1px 4px rgba(0,0,0,0.6)'};
      cursor:pointer;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
  })
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
  /* Cached singleton, not rebuilt per render: handles are dragged via a
     continuous 'drag' handler that updates state on every mousemove, and a
     fresh L.divIcon() each render would make react-leaflet call marker.setIcon()
     mid-gesture, tearing down the DOM node Leaflet's own Draggable is tracking. */
  if (!_handleIconInstance) {
    _handleIconInstance = L.divIcon({
      className: 'strat-handle-marker',
      html: `<div style="
        width:10px; height:10px; background:#fff;
        border:2px solid #3B82F6; border-radius:50%;
        box-shadow:0 1px 3px rgba(0,0,0,0.7); cursor:grab;
      "></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    })
  }
  return _handleIconInstance
}
function playerLabelIcon(text, color, vehiclePickup) {
  const safe = String(text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return L.divIcon({
    className: 'strat-player-label',
    html: `<div style="
      color:#fff; background:rgba(5,8,22,0.85); border:1px solid ${resolveColor(color)};
      padding:1px 6px; border-radius:4px; font-family:'DM Sans',sans-serif;
      font-size:10px; font-weight:600; white-space:nowrap; pointer-events:none;
      margin-top:16px; display:flex; align-items:center; gap:3px;
    ">${safe}${vehiclePickup ? ' <span title="Vehicle pickup here">🚗</span>' : ''}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

export default function StrategyDrawingLayer({ mapId }) {
  const st = useStrategyStore()
  const [zoneDraftRadius, setZoneDraftRadius] = useState(0)
  const [freehandDraft, setFreehandDraft] = useState(null)
  const isFreehandDrawing = useRef(false)
  const map = useMap()

  /* Freehand strokes are captured by drag (mousedown -> mousemove ->
     mouseup), unlike every other tool here which is click/click — so
     Leaflet's own pan-by-drag has to be switched off for the duration
     of the tool being active, or a drag would pan the map under the
     stroke instead of drawing on it. Re-enabled the instant the tool
     changes or the layer unmounts. */
  useEffect(() => {
    if (st.tool === 'draw') map.dragging.disable()
    else map.dragging.enable()
    return () => { map.dragging.enable() }
  }, [st.tool, map])

  const activeGroupKeys = LAYER_GROUPS.filter(g => st.visibleLayerGroups.has(g.key))
  const visibleObjects = st.objects.filter(o => {
    if (o.phase !== st.activePhase) return false
    const matchedGroups = LAYER_GROUPS.filter(g => g.match(o))
    if (matchedGroups.length === 0) return true /* no named group covers it — always show */
    return matchedGroups.some(g => activeGroupKeys.includes(g))
  })

  const spawnVehiclePositions = st.showSpawnRefVehicle ? getSpawnReference(mapId, 'vehicle') : null
  const spawnBoatPositions    = st.showSpawnRefBoat    ? getSpawnReference(mapId, 'boat')    : null

  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng
      const pos = [lat, lng]
      const tool = st.tool

      if (tool === 'marker') {
        const info = typeInfo('marker', st.activeType.marker)
        const player = st.players.find(p => p.id === st.activePlayerId)
        addObject({
          type: 'marker', category: st.activeType.marker, position: pos,
          color: player?.color || info.color, label: info.label,
          vehiclePickup: st.activeVehiclePickup,
        })
        return
      }

      if (tool === 'rotation') {
        if (!st.drafting) {
          setDrafting({ kind: 'rotation', waypoints: [pos] })
        } else {
          setDrafting({ ...st.drafting, waypoints: [...st.drafting.waypoints, pos] })
        }
        return
      }

      if (tool === 'zone') {
        if (!st.drafting) {
          setDrafting({ kind: 'zone', center: pos, radius: 0 })
        } else {
          const info = typeInfo('zone', st.activeType.zone)
          addObject({
            type: 'zone', category: st.activeType.zone, position: st.drafting.center,
            radius: Math.max(2, zoneDraftRadius), color: info.color, label: info.label,
          })
        }
        return
      }

      if (tool === 'measure') {
        if (!st.measureFrom) setMeasurePoints(pos, null)
        else setMeasurePoints(st.measureFrom, pos)
        return
      }
    },
    dblclick: () => {
      if (st.tool === 'rotation' && st.drafting?.kind === 'rotation') {
        const waypoints = st.drafting.waypoints
        if (waypoints.length >= 2) {
          const info = typeInfo('rotation', st.activeType.rotation)
          const player = st.players.find(p => p.id === st.activePlayerId)
          addObject({
            type: 'rotation', category: st.activeType.rotation, waypoints,
            color: player?.color || NEUTRAL_ROTATION_COLOR, label: info.label,
          })
        } else {
          setDrafting(null)
        }
      }
    },
    mousedown: (e) => {
      if (st.tool !== 'draw') return
      /* Disabled here too, not just in the useEffect above: a mousedown
         that starts a stroke has to shut off Leaflet's own pan-by-drag
         handler before its FIRST mousemove is processed, not after the
         next render commits — otherwise Leaflet's native drag machinery
         and this handler both react to the same gesture. */
      map.dragging.disable()
      isFreehandDrawing.current = true
      setFreehandDraft([[e.latlng.lat, e.latlng.lng]])
    },
    mousemove: (e) => {
      if (st.tool === 'draw' && isFreehandDrawing.current) {
        const { lat, lng } = e.latlng
        setFreehandDraft(prev => {
          if (!prev) return [[lat, lng]]
          const [lastLat, lastLng] = prev[prev.length - 1]
          /* Skip points closer than this to the last one so a fast
             stroke doesn't balloon into thousands of near-duplicate
             waypoints — imperceptible visually, meaningfully smaller
             saved payload. */
          if (Math.hypot(lat - lastLat, lng - lastLng) < 0.15) return prev
          return [...prev, [lat, lng]]
        })
        return
      }
      if (!st.drafting) return
      const { lat, lng } = e.latlng
      if (st.drafting.kind === 'zone') {
        const dx = lat - st.drafting.center[0]
        const dy = lng - st.drafting.center[1]
        setZoneDraftRadius(Math.max(2, Math.hypot(dx, dy)))
      }
    },
    mouseup: () => {
      if (st.tool !== 'draw' || !isFreehandDrawing.current) return
      isFreehandDrawing.current = false
      setFreehandDraft(current => {
        if (current && current.length >= 2) {
          addObject({ type: 'freehand', category: 'freehand', waypoints: current, color: st.activeFreehandColor, label: 'Freehand' })
        }
        return null
      })
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
        <StrategyObjectRender
          key={obj.id} obj={obj} players={st.players}
          isSelected={obj.id === st.selectedObjectId}
        />
      ))}

      {/* ---- in-progress freehand stroke ---- */}
      {freehandDraft && freehandDraft.length >= 2 && (
        <Polyline
          positions={freehandDraft}
          pathOptions={{ color: resolveColor(st.activeFreehandColor), weight: 3, opacity: 0.9 }}
        />
      )}

      {/* ---- in-progress drafts ---- */}
      {st.drafting?.kind === 'rotation' && (
        <Polyline
          positions={st.drafting.waypoints}
          pathOptions={{ color: '#ffffff', weight: 2, opacity: 0.6, dashArray: '4 4' }}
        />
      )}
      {st.drafting?.kind === 'zone' && (
        <Circle
          center={st.drafting.center} radius={zoneDraftRadius}
          pathOptions={{ color: '#4A9EFF', fillColor: '#4A9EFF', fillOpacity: 0.12, weight: 1, dashArray: '4 4' }}
        />
      )}

      {/* ---- measure tool ---- */}
      {st.measureFrom && (
        <Marker position={st.measureFrom} icon={handleIcon()} interactive={false} />
      )}
      {st.measureFrom && st.measureTo && (
        <>
          <Polyline positions={[st.measureFrom, st.measureTo]} pathOptions={{ color: '#F8FAFC', weight: 2, dashArray: '3 5' }} />
          <Marker position={st.measureTo} icon={handleIcon()} interactive={false} />
        </>
      )}
    </>
  )
}

function StrategyObjectRender({ obj, isSelected, players }) {
  const draggable = true

  function commonMarkerProps(pos) {
    return {
      position: pos,
      icon: objectIcon(obj, isSelected),
      draggable,
      eventHandlers: {
        click: () => selectObject(obj.id),
        dragend: (e) => updateObject(obj.id, { position: [e.target.getLatLng().lat, e.target.getLatLng().lng] }),
      },
    }
  }

  /* 'vehicle' is a legacy object type from before the standalone
     Vehicle tool was removed — still rendered (via the same branch as
     marker) so old saved strategies don't lose data, just no longer
     creatable. Any other now-removed type (combat/utility/vision/
     formation) falls through to `return null` below: skipped
     silently rather than crashing, per Prompt 2. */
  if (obj.type === 'marker' || obj.type === 'vehicle') {
    const assignedPlayer = obj.player ? players.find(p => p.id === obj.player) : null
    return (
      <>
        <Marker {...commonMarkerProps(obj.position)}>
          <Popup>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{obj.label}</div>
            {assignedPlayer && <div style={{ fontSize: 12, marginTop: 2 }}>Assigned: {assignedPlayer.name}</div>}
            {obj.vehiclePickup && <div style={{ fontSize: 12, marginTop: 2 }}>🚗 Vehicle pickup here</div>}
            {obj.description && <div style={{ fontSize: 12, marginTop: 2 }}>{obj.description}</div>}
          </Popup>
        </Marker>
        {(assignedPlayer || obj.vehiclePickup) && (
          <Marker
            position={obj.position}
            icon={playerLabelIcon(assignedPlayer ? assignedPlayer.name : obj.label, obj.color, obj.vehiclePickup)}
            interactive={false}
          />
        )}
      </>
    )
  }

  if (obj.type === 'freehand') {
    return (
      <Polyline
        positions={obj.waypoints}
        pathOptions={{ color: resolveColor(obj.color), weight: isSelected ? 4 : 3, opacity: 0.9 }}
        eventHandlers={{ click: () => selectObject(obj.id) }}
      />
    )
  }

  if (obj.type === 'rotation') {
    return (
      <>
        <Polyline
          positions={obj.waypoints}
          pathOptions={{
            color: resolveColor(obj.color), weight: isSelected ? 4 : 3, opacity: 0.85,
            dashArray: ROTATION_TYPES.find(t => t.key === obj.category)?.dash || null,
          }}
          eventHandlers={{ click: () => selectObject(obj.id) }}
        />
        {isSelected && obj.waypoints.map((wp, i) => (
          <Marker
            key={i}
            position={wp}
            icon={handleIcon()}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const next = obj.waypoints.slice()
                next[i] = [e.target.getLatLng().lat, e.target.getLatLng().lng]
                updateObject(obj.id, { waypoints: next })
              },
            }}
          />
        ))}
      </>
    )
  }

  if (obj.type === 'zone') {
    return (
      <>
        <Circle
          center={obj.position} radius={obj.radius}
          pathOptions={{ color: resolveColor(obj.color), fillColor: resolveColor(obj.color), fillOpacity: 0.15, weight: isSelected ? 3 : 2 }}
          eventHandlers={{ click: () => selectObject(obj.id) }}
        />
        <Marker {...commonMarkerProps(obj.position)}>
          <Popup>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{obj.label}</div>
            {obj.description && <div style={{ fontSize: 12, marginTop: 2 }}>{obj.description}</div>}
          </Popup>
        </Marker>
        {isSelected && (
          <Marker
            position={[obj.position[0], obj.position[1] + obj.radius]}
            icon={handleIcon()}
            draggable
            eventHandlers={{
              drag: (e) => {
                const p = e.target.getLatLng()
                const r = Math.max(2, Math.hypot(p.lat - obj.position[0], p.lng - obj.position[1]))
                updateObject(obj.id, { radius: r }, { silent: true })
              },
              dragend: (e) => {
                const p = e.target.getLatLng()
                const r = Math.max(2, Math.hypot(p.lat - obj.position[0], p.lng - obj.position[1]))
                updateObject(obj.id, { radius: r })
              },
            }}
          />
        )}
      </>
    )
  }

  return null
}
