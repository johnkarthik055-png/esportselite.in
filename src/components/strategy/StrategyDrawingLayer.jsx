import { useState } from 'react'
import L from 'leaflet'
import { Marker, Popup, Polyline, Polygon, Circle, useMapEvents } from 'react-leaflet'
import {
  MARKER_TYPES, ROTATION_TYPES, COMBAT_TYPES, UTILITY_TYPES,
  VISION_TYPES, ZONE_TYPES, VEHICLE_ANNOTATION_TYPES, LAYER_GROUPS,
  FORMATIONS, applyFormationOffsets, bearingBetween,
} from '../../utils/strategyDataSchema.js'
import { getSpawnReference } from '../../utils/spawnReferenceData.js'
import {
  strategyStore, useStrategyStore, addObject, addObjects, updateObject,
  selectObject, setDrafting, setMeasurePoints, setTool,
} from './strategyStore.js'

const ALL_TYPE_LOOKUPS = {
  marker: MARKER_TYPES, rotation: ROTATION_TYPES, combat: COMBAT_TYPES,
  utility: UTILITY_TYPES, vision: VISION_TYPES, zone: ZONE_TYPES,
  vehicle: VEHICLE_ANNOTATION_TYPES,
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
function playerLabelIcon(text, color) {
  const safe = String(text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return L.divIcon({
    className: 'strat-player-label',
    html: `<div style="
      color:#fff; background:rgba(5,8,22,0.85); border:1px solid ${resolveColor(color)};
      padding:1px 6px; border-radius:4px; font-family:'DM Sans',sans-serif;
      font-size:10px; font-weight:600; white-space:nowrap; pointer-events:none;
      margin-top:16px;
    ">${safe}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/* Compute a vision cone polygon from origin/angle/spread/radius,
   all in [lat,lng] world-unit space. angle: degrees, 0=north,
   clockwise (matches bearingBetween). radius: world units. */
function coneVertices(origin, angle, spread, radius, steps = 16) {
  const pts = [origin]
  const startDeg = angle - spread / 2
  const endDeg = angle + spread / 2
  for (let i = 0; i <= steps; i++) {
    const deg = startDeg + ((endDeg - startDeg) * i) / steps
    const rad = (deg * Math.PI) / 180
    pts.push([origin[0] + radius * Math.cos(rad), origin[1] + radius * Math.sin(rad)])
  }
  return pts
}
function pointAtBearing(origin, angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180
  return [origin[0] + radius * Math.cos(rad), origin[1] + radius * Math.sin(rad)]
}

export default function StrategyDrawingLayer({ mapId, readOnly = false }) {
  const st = useStrategyStore()
  const [zoneDraftRadius, setZoneDraftRadius] = useState(0)

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
      if (readOnly) return
      const { lat, lng } = e.latlng
      const pos = [lat, lng]
      const tool = st.tool

      if (tool === 'marker') {
        const info = typeInfo('marker', st.activeType.marker)
        addObject({ type: 'marker', category: st.activeType.marker, position: pos, color: info.color, label: info.label })
        return
      }

      if (tool === 'vehicle') {
        const info = typeInfo('vehicle', st.activeType.vehicle)
        addObject({ type: 'vehicle', category: st.activeType.vehicle, position: pos, color: info.color, label: info.label })
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

      if (tool === 'combat' || tool === 'utility') {
        if (!st.drafting) {
          setDrafting({ kind: tool, from: pos })
        } else {
          const info = typeInfo(tool, st.activeType[tool])
          addObject({ type: tool, category: st.activeType[tool], position: st.drafting.from, target: pos, color: info.color, label: info.label })
        }
        return
      }

      if (tool === 'vision') {
        if (!st.drafting) {
          setDrafting({ kind: 'vision', origin: pos })
        } else {
          const angle = bearingBetween(st.drafting.origin, pos)
          const info = typeInfo('vision', st.activeType.vision)
          addObject({
            type: 'vision', category: st.activeType.vision, position: st.drafting.origin,
            angle, spread: 50, radius: 12, color: info.color, label: info.label,
          })
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

      if (tool === 'formation' && st.activeFormationKey) {
        const formation = FORMATIONS.find(f => f.key === st.activeFormationKey)
        if (!formation) return
        const positions = applyFormationOffsets(pos, formation.offsets)
        const players = st.players
        addObjects(positions.map((p, i) => {
          const player = players[i]
          return {
            type: 'marker', category: 'player_position', position: p,
            player: player?.id ?? null, color: player?.color || '#3B82F6',
            label: player?.name || `Player ${i + 1}`,
          }
        }))
        setTool('select')
      }
    },
    dblclick: (e) => {
      if (readOnly) return
      if (st.tool === 'rotation' && st.drafting?.kind === 'rotation') {
        const waypoints = st.drafting.waypoints
        if (waypoints.length >= 2) {
          const info = typeInfo('rotation', st.activeType.rotation)
          addObject({ type: 'rotation', category: st.activeType.rotation, waypoints, color: info.color, label: info.label })
        } else {
          setDrafting(null)
        }
      }
    },
    mousemove: (e) => {
      if (readOnly || !st.drafting) return
      const { lat, lng } = e.latlng
      if (st.drafting.kind === 'zone') {
        const dx = lat - st.drafting.center[0]
        const dy = lng - st.drafting.center[1]
        setZoneDraftRadius(Math.max(2, Math.hypot(dx, dy)))
      }
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
          key={obj.id} obj={obj} mapId={mapId} readOnly={readOnly}
          isSelected={!readOnly && obj.id === st.selectedObjectId}
        />
      ))}

      {/* ---- in-progress drafts (never populated in read-only — the
          click/dblclick handlers above bail out before setDrafting) ---- */}
      {st.drafting?.kind === 'rotation' && (
        <Polyline
          positions={st.drafting.waypoints}
          pathOptions={{ color: '#ffffff', weight: 2, opacity: 0.6, dashArray: '4 4' }}
        />
      )}
      {(st.drafting?.kind === 'combat' || st.drafting?.kind === 'utility') && (
        <Marker position={st.drafting.from} icon={handleIcon()} interactive={false} />
      )}
      {st.drafting?.kind === 'vision' && (
        <Marker position={st.drafting.origin} icon={handleIcon()} interactive={false} />
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

function StrategyObjectRender({ obj, isSelected, mapId, readOnly }) {
  const draggable = !readOnly

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

  if (obj.type === 'marker' || obj.type === 'vehicle') {
    return (
      <>
        <Marker {...commonMarkerProps(obj.position)}>
          <Popup>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{obj.label}</div>
            {obj.description && <div style={{ fontSize: 12, marginTop: 2 }}>{obj.description}</div>}
          </Popup>
        </Marker>
        {obj.player && (
          <Marker position={obj.position} icon={playerLabelIcon(obj.label, obj.color)} interactive={false} />
        )}
      </>
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

  if (obj.type === 'combat' || obj.type === 'utility') {
    return (
      <>
        <Polyline
          positions={[obj.position, obj.target]}
          pathOptions={{
            color: resolveColor(obj.color), weight: isSelected ? 4 : 3, opacity: 0.85,
            dashArray: obj.type === 'utility' ? '5,5' : null,
          }}
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
            position={obj.target}
            icon={handleIcon()}
            draggable
            eventHandlers={{
              dragend: (e) => updateObject(obj.id, { target: [e.target.getLatLng().lat, e.target.getLatLng().lng] }),
            }}
          />
        )}
      </>
    )
  }

  if (obj.type === 'vision') {
    const verts = coneVertices(obj.position, obj.angle, obj.spread, obj.radius)
    const handlePos = pointAtBearing(obj.position, obj.angle, obj.radius)
    return (
      <>
        <Polygon
          positions={verts}
          pathOptions={{ color: resolveColor(obj.color), fillColor: resolveColor(obj.color), fillOpacity: 0.15, weight: isSelected ? 3 : 2 }}
          eventHandlers={{ click: () => selectObject(obj.id) }}
        />
        <Marker {...commonMarkerProps(obj.position)} />
        {isSelected && (
          <Marker
            position={handlePos}
            icon={handleIcon()}
            draggable
            eventHandlers={{
              /* Dragging the tip handle rotates (bearing from origin)
                 AND resizes (distance from origin) the cone in one
                 motion — this is the "rotatable and resizable" cone
                 interaction Issue 7 calls for. */
              drag: (e) => {
                const p = e.target.getLatLng()
                const newPos = [p.lat, p.lng]
                const angle = bearingBetween(obj.position, newPos)
                const radius = Math.max(2, Math.hypot(newPos[0] - obj.position[0], newPos[1] - obj.position[1]))
                updateObject(obj.id, { angle, radius }, { silent: true })
              },
              dragend: (e) => {
                const p = e.target.getLatLng()
                const newPos = [p.lat, p.lng]
                const angle = bearingBetween(obj.position, newPos)
                const radius = Math.max(2, Math.hypot(newPos[0] - obj.position[0], newPos[1] - obj.position[1]))
                updateObject(obj.id, { angle, radius })
              },
            }}
          />
        )}
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
