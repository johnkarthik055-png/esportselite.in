/* ============================================================
   STRATEGY MAKER — DATA SCHEMA + STORE
   ------------------------------------------------------------
   Fresh rebuild (previous attempts were removed entirely after
   repeated layout bugs). Deliberately simple: every drawn/placed
   object — whether a plain shape or a "tactical" one (Team
   Rotation/Team Drop/Draw Path & Zone/Utility Markers) — shares ONE
   generic shape. There is no per-tool structured-fields system this
   time (that was a major source of past complexity); tactical tools
   are just drawing tools with a different icon/geometry default.

   State lives in a module-scoped object + a tiny EventTarget bus
   (same pattern the rest of this app's Dev Editor uses), subscribed
   to via useStrategyStore(), which just forces a re-render on
   change. This is intentionally NOT React Context — DrawingCanvas
   mounts INSIDE react-leaflet's <MapContainer> (owned by
   MapKnowledge.jsx's MapPanel) while the floating toolbar UI mounts
   OUTSIDE it as a sibling; a plain module store means both sides
   read/write the exact same state without needing a Provider to
   span two different subtrees.
   ============================================================ */
import { useEffect, useState } from 'react'

/* Real world-unit space this app's maps use (see MapKnowledge.jsx's
   own CRS.Simple setup) — 0..256 on both axes regardless of which
   map is active. Only used here for the procedural flight-path line
   and the schematic zone circles below; every real drawn object's
   points are plain [lat, lng] pairs in this same space, exactly like
   Leaflet already hands them to us, so no coordinate conversion is
   needed for anything the user draws. */
export const WORLD_SIZE = 256
export const WORLD_BOUNDS = [[0, 0], [WORLD_SIZE, WORLD_SIZE]]
export const WORLD_CENTER = [WORLD_SIZE / 2, WORLD_SIZE / 2]

/* Plain mutable ref, NOT React state — MapControls.jsx renders as a
   floating panel OUTSIDE react-leaflet's <MapContainer> (a sibling in
   MapKnowledge.jsx, same as the toolbar), so it can't call useMap().
   DrawingCanvas.jsx (which DOES mount inside <MapContainer>) sets
   this once on mount; MapControls just reads it imperatively when a
   button is clicked, same pattern as the module store itself. */
export const mapInstanceRef = { current: null }

/* ---- tool groups (drives FloatingToolbar) ---- */
/* Polygon was removed intentionally — freehand/line/arrow/shapes cover
   the same need without its multi-click vertex workflow. Pre-existing
   saved 'polygon' objects still render (see DrawingCanvas.jsx); there
   is just no tool to create new ones. */
export const DRAWING_TOOLS = [
  { key: 'select',    label: 'Select',    icon: 'MousePointer2' },
  { key: 'pencil',    label: 'Pencil',    icon: 'Pencil' },
  { key: 'line',      label: 'Line',      icon: 'Minus' },
  { key: 'arrow',     label: 'Arrow',     icon: 'ArrowUpRight' },
  { key: 'rectangle', label: 'Rectangle', icon: 'Square' },
  { key: 'circle',    label: 'Circle',    icon: 'CircleIcon' },
  { key: 'text',      label: 'Text',      icon: 'Type' },
]

export const TACTICAL_TOOLS = [
  { key: 'teamRotation',   label: 'Team Rotation',   icon: 'Route',     geometry: 'path',  defaultColor: '#3B82F6' },
  { key: 'teamDrop',       label: 'Team Drop',       icon: 'Flag',      geometry: 'point', defaultColor: '#F59E0B' },
  { key: 'pathZone',       label: 'Draw Path & Zone', icon: 'Shapes',   geometry: 'path',  defaultColor: '#00D4FF' },
  { key: 'utilityMarker',  label: 'Utility Markers', icon: 'Wrench',    geometry: 'point', defaultColor: '#7C3AED' },
]

/* Zone group entries are toolbar buttons, not drawing tools — they
   drive st.tool='zone' (opens ZoneSelector) or toggle a boolean view
   flag directly. No object is ever added to st.objects for any of
   these. */
export const ZONE_GROUP = [
  { key: 'zone',        label: 'Zone 1–8',   icon: 'Layers',    kind: 'zone-mode' },
  { key: 'allZones',    label: 'All Zones',  icon: 'LayoutGrid', kind: 'zone-mode' },
  { key: 'showPaths',   label: 'Show Paths', icon: 'Eye',       kind: 'toggle' },
  { key: 'flightPath',  label: 'Flight Path', icon: 'Plane',    kind: 'toggle' },
]

export const ZONE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8]

export const TACTICAL_TOOLS_BY_KEY = Object.fromEntries(TACTICAL_TOOLS.map(t => [t.key, t]))
export const PATH_TACTICAL_TYPES = TACTICAL_TOOLS.filter(t => t.geometry === 'path').map(t => t.key)
export const POINT_TACTICAL_TYPES = TACTICAL_TOOLS.filter(t => t.geometry === 'point').map(t => t.key)

/* Tools whose interaction is a drag gesture (mousedown -> move ->
   mouseup). */
export const DRAG_DRAW_TOOLS = ['pencil', 'line', 'arrow', 'rectangle', 'circle']
/* Tools that accumulate vertices via successive clicks, finished
   explicitly (double-click). Team Rotation + Draw Path & Zone only —
   the Polygon tool that also used this flow was removed. */
export const VERTEX_TOOLS = [...PATH_TACTICAL_TYPES]
/* Every tool above (plus vertex tools) fights a touchscreen's native
   pan/pinch-zoom/double-tap-zoom gesture, so map gestures + the
   browser's own touch-action get locked out while any of them is
   active. */
export const PAN_LOCKING_TOOLS = [...DRAG_DRAW_TOOLS, ...VERTEX_TOOLS]

export const DRAW_COLORS = [
  { key: 'blue',   value: '#3B82F6' },
  { key: 'cyan',   value: '#00D4FF' },
  { key: 'amber',  value: '#F59E0B' },
  { key: 'red',    value: '#EF4444' },
  { key: 'green',  value: '#22C55E' },
  { key: 'violet', value: '#7C3AED' },
  { key: 'white',  value: '#FFFFFF' },
]
export const THICKNESS_PRESETS = [2, 3, 4, 6, 9]
export const DEFAULT_DRAW_COLOR = '#3B82F6'
export const DEFAULT_THICKNESS = 4
export const DEFAULT_OPACITY = 0.9
export const DEFAULT_FONT_SIZE = 15

export function createEmptyStrategy(mapId) {
  return {
    strategyId: null,
    name: '',
    description: '',
    map: mapId,
    objects: [],
    selectedZone: null,
    showPaths: true,
    flightPathVisible: false,
  }
}

export function createStrategyObject(partial) {
  return {
    id: partial.id || `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type: partial.type,
    points: partial.points ?? [],
    radius: partial.radius ?? null,
    text: partial.text ?? '',
    color: partial.color ?? DEFAULT_DRAW_COLOR,
    thickness: partial.thickness ?? DEFAULT_THICKNESS,
    opacity: partial.opacity ?? DEFAULT_OPACITY,
    fill: partial.fill ?? true,
    fontSize: partial.fontSize ?? DEFAULT_FONT_SIZE,
    bold: partial.bold ?? false,
    arrowStyle: partial.arrowStyle ?? 'solid',
    createdAt: partial.createdAt ?? Date.now(),
  }
}

/* ============================================================
   GEOMETRY HELPERS
   ============================================================ */
export function bearingBetween(posA, posB) {
  const dLat = posB[0] - posA[0]
  const dLng = posB[1] - posA[1]
  let deg = Math.atan2(dLng, dLat) * (180 / Math.PI)
  if (deg < 0) deg += 360
  return deg
}

/* Schematic zone-circle geometry — there is no verified real BR-zone
   boundary dataset for these maps (unlike the vehicle/boat spawn
   data, which is real and verified), so Zone 1-8 is a deterministic,
   illustrative shrinking-circle representation centered on the map,
   not per-match data. Zone 1 is largest, Zone 8 smallest, each
   concentric with the last — the standard shrinking-circle shape a
   BR match's play area follows, even though these particular numbers
   are illustrative rather than measured. */
export function schematicZoneCircle(zoneNumber) {
  const center = [WORLD_SIZE / 2, WORLD_SIZE / 2]
  const maxRadius = WORLD_SIZE * 0.46
  const shrink = Math.pow(0.72, zoneNumber - 1)
  return { center, radius: maxRadius * shrink }
}

/* Single illustrative flight path line (plane's flight line reference
   teams plan drops around) — corner-to-corner across the map bounds,
   same reasoning as the zone circles above: no verified per-match
   data exists, so this is a fixed schematic reference line, not
   drawn/stored per object. */
export function schematicFlightPath() {
  return [[WORLD_SIZE * 0.08, WORLD_SIZE * 0.08], [WORLD_SIZE * 0.92, WORLD_SIZE * 0.92]]
}

/* ============================================================
   STORE
   ============================================================ */
const bus = new EventTarget()
function fire() { bus.dispatchEvent(new Event('change')) }
const MAX_HISTORY = 50

export const strategyStore = {
  mapId: null,
  tool: 'select',

  drawColor: DEFAULT_DRAW_COLOR,
  drawThickness: DEFAULT_THICKNESS,
  drawOpacity: DEFAULT_OPACITY,
  drawFill: true,
  drawFontSize: DEFAULT_FONT_SIZE,
  drawBold: false,
  drawArrowStyle: 'solid',

  selectedObjectId: null,
  drafting: null, /* { kind:'path', toolKey, points } | { kind:'text', latlng } */

  selectedZone: null,       /* 1-8 | 'all' | null */
  showPaths: true,
  flightPathVisible: false,

  strategyDocId: null,
  name: '',
  description: '',
  objects: [],

  history: [],
  future: [],
  dirty: false,

  /* UI-only, not part of saved content — lives here (rather than as
     local component state) so MapKnowledge.jsx's header "Save
     Strategy" button (a sibling of StrategyMaker, not a descendant)
     can open it without prop-drilling or a ref. */
  saveModalOpen: false,
  /* Unsaved-changes-on-leave prompt: MapKnowledge.jsx routes every
     map/mode-switch tab click through requestLeaveWithUnsavedCheck()
     below instead of changing its own state directly, so the switch
     only actually happens after the user resolves the prompt (or
     immediately, if nothing is dirty). pendingLeaveAction is a plain
     function reference held in this runtime-only object — never
     touched by snapshot()/JSON.stringify, which only ever serializes
     the content fields above. */
  unsavedPromptOpen: false,
  pendingLeaveAction: null,
}

export function useStrategyStore() {
  const [, tick] = useState(0)
  useEffect(() => {
    function onChange() { tick(v => v + 1) }
    bus.addEventListener('change', onChange)
    return () => bus.removeEventListener('change', onChange)
  }, [])
  return strategyStore
}

/* ---- map isolation ---- */
export function resetForMap(mapId) {
  if (strategyStore.mapId === mapId) return
  strategyStore.mapId = mapId
  const fresh = createEmptyStrategy(mapId)
  strategyStore.strategyDocId = null
  strategyStore.name = fresh.name
  strategyStore.description = fresh.description
  strategyStore.objects = fresh.objects
  strategyStore.selectedZone = fresh.selectedZone
  strategyStore.showPaths = fresh.showPaths
  strategyStore.flightPathVisible = fresh.flightPathVisible
  strategyStore.selectedObjectId = null
  strategyStore.drafting = null
  strategyStore.history = []
  strategyStore.future = []
  strategyStore.dirty = false
  fire()
}

/* ---- undo/redo ----
   Snapshots cover every content-affecting field (objects + the zone/
   path/flight-path view state), so "Every modification (draw, move,
   delete, color change, add rotation, etc.) supports Undo/Redo"
   holds for view-state toggles too, not just drawn objects. */
function snapshot() {
  return JSON.stringify({
    objects: strategyStore.objects,
    selectedZone: strategyStore.selectedZone,
    showPaths: strategyStore.showPaths,
    flightPathVisible: strategyStore.flightPathVisible,
  })
}
function restore(snap) {
  const s = JSON.parse(snap)
  strategyStore.objects = s.objects
  strategyStore.selectedZone = s.selectedZone
  strategyStore.showPaths = s.showPaths
  strategyStore.flightPathVisible = s.flightPathVisible
}
function pushHistory() {
  strategyStore.history.push(snapshot())
  if (strategyStore.history.length > MAX_HISTORY) strategyStore.history.shift()
  strategyStore.future = []
  strategyStore.dirty = true
}
export function undo() {
  if (strategyStore.history.length === 0) return
  strategyStore.future.push(snapshot())
  restore(strategyStore.history.pop())
  strategyStore.selectedObjectId = null
  strategyStore.dirty = true
  fire()
}
export function redo() {
  if (strategyStore.future.length === 0) return
  strategyStore.history.push(snapshot())
  restore(strategyStore.future.pop())
  strategyStore.selectedObjectId = null
  strategyStore.dirty = true
  fire()
}

/* ---- tool / selection ---- */
export function setTool(tool) {
  strategyStore.tool = tool
  strategyStore.drafting = null
  if (tool !== 'select') strategyStore.selectedObjectId = null
  fire()
}
export function selectObject(id) {
  strategyStore.selectedObjectId = id
  fire()
}
export function setDrafting(drafting) {
  strategyStore.drafting = drafting
  fire()
}

/* ---- current pen settings ----
   Each setter updates the "current pen" default AND, if something is
   selected, applies the same change retroactively to it. */
const PEN_FIELD_NAMES = {
  drawColor: 'color', drawThickness: 'thickness', drawOpacity: 'opacity',
  drawFill: 'fill', drawFontSize: 'fontSize', drawBold: 'bold', drawArrowStyle: 'arrowStyle',
}
function applyToSelectedOrPen(key, value) {
  strategyStore[key] = value
  if (strategyStore.selectedObjectId) {
    updateObject(strategyStore.selectedObjectId, { [PEN_FIELD_NAMES[key]]: value })
  } else {
    fire()
  }
}
export function setDrawColor(v) { applyToSelectedOrPen('drawColor', v) }
export function setDrawThickness(v) { applyToSelectedOrPen('drawThickness', v) }
export function setDrawOpacity(v) { applyToSelectedOrPen('drawOpacity', v) }
export function setDrawFill(v) { applyToSelectedOrPen('drawFill', v) }
export function setDrawFontSize(v) { applyToSelectedOrPen('drawFontSize', v) }
export function setDrawBold(v) { applyToSelectedOrPen('drawBold', v) }
export function setDrawArrowStyle(v) { applyToSelectedOrPen('drawArrowStyle', v) }

/* ---- object CRUD ---- */
export function addObject(partial) {
  pushHistory()
  const obj = createStrategyObject(partial)
  strategyStore.objects = [...strategyStore.objects, obj]
  strategyStore.selectedObjectId = obj.id
  strategyStore.drafting = null
  fire()
  return obj
}
export function updateObject(id, patch, { silent } = {}) {
  if (!silent) pushHistory()
  strategyStore.objects = strategyStore.objects.map(o => o.id === id ? { ...o, ...patch } : o)
  fire()
}
export function deleteObject(id) {
  pushHistory()
  strategyStore.objects = strategyStore.objects.filter(o => o.id !== id)
  if (strategyStore.selectedObjectId === id) strategyStore.selectedObjectId = null
  fire()
}
export function deleteSelected() {
  if (!strategyStore.selectedObjectId) return
  deleteObject(strategyStore.selectedObjectId)
}
export function clearAllObjects() {
  pushHistory()
  strategyStore.objects = []
  strategyStore.selectedObjectId = null
  fire()
}
const DUPLICATE_OFFSET = 3
export function duplicateObject(id) {
  const src = strategyStore.objects.find(o => o.id === id)
  if (!src) return
  pushHistory()
  const copy = createStrategyObject({
    ...src,
    id: undefined,
    createdAt: undefined,
    points: (src.points || []).map(([lat, lng]) => [lat + DUPLICATE_OFFSET, lng + DUPLICATE_OFFSET]),
  })
  strategyStore.objects = [...strategyStore.objects, copy]
  strategyStore.selectedObjectId = copy.id
  fire()
  return copy
}
export function duplicateSelected() {
  if (!strategyStore.selectedObjectId) return
  return duplicateObject(strategyStore.selectedObjectId)
}

/* ---- vertex-drafting (polygon / team rotation / draw path&zone) ---- */
export function addDraftPoint(toolKey, pos) {
  const cur = strategyStore.drafting?.kind === 'path' && strategyStore.drafting.toolKey === toolKey
    ? strategyStore.drafting.points
    : []
  strategyStore.drafting = { kind: 'path', toolKey, points: [...cur, pos] }
  fire()
}
export function finishDraft() {
  const d = strategyStore.drafting
  if (!d || d.kind !== 'path') return
  const minPoints = d.toolKey === 'pathZone' ? 3 : 2
  if (d.points.length < minPoints) { fire(); return }
  addObject({
    type: d.toolKey, points: d.points,
    color: strategyStore.drawColor, thickness: strategyStore.drawThickness,
    opacity: strategyStore.drawOpacity, fill: strategyStore.drawFill,
  })
}
export function cancelDraft() {
  strategyStore.drafting = null
  fire()
}

/* ---- zone / paths / flight path ---- */
export function setSelectedZone(z) {
  pushHistory()
  strategyStore.selectedZone = z
  fire()
}
export function toggleShowPaths() {
  pushHistory()
  strategyStore.showPaths = !strategyStore.showPaths
  fire()
}
export function toggleFlightPath() {
  pushHistory()
  strategyStore.flightPathVisible = !strategyStore.flightPathVisible
  fire()
}

/* ---- metadata / save-load ---- */
export function setName(name) { strategyStore.name = name; strategyStore.dirty = true; fire() }
export function setDescription(description) { strategyStore.description = description; strategyStore.dirty = true; fire() }
export function setStrategyDocId(id) { strategyStore.strategyDocId = id; fire() }
export function markSaved() { strategyStore.dirty = false; fire() }
export function openSaveModal() { strategyStore.saveModalOpen = true; fire() }
export function closeSaveModal() { strategyStore.saveModalOpen = false; fire() }

/* ---- unsaved-changes-on-leave guard ---- */
export function requestLeaveWithUnsavedCheck(action) {
  if (strategyStore.dirty) {
    strategyStore.pendingLeaveAction = action
    strategyStore.unsavedPromptOpen = true
    fire()
  } else {
    action()
  }
}
export function resolveUnsavedPrompt(kind) {
  const action = strategyStore.pendingLeaveAction
  strategyStore.pendingLeaveAction = null
  strategyStore.unsavedPromptOpen = false
  fire()
  if (kind === 'discard' && action) action()
}

export function toSaveableDoc() {
  return {
    name: strategyStore.name.trim(),
    description: strategyStore.description.trim(),
    map: strategyStore.mapId,
    objects: strategyStore.objects,
    selectedZone: strategyStore.selectedZone,
    showPaths: strategyStore.showPaths,
    flightPathVisible: strategyStore.flightPathVisible,
    isPublic: false,
  }
}
export function loadStrategyData(data) {
  strategyStore.strategyDocId = data.strategyId ?? data.id ?? null
  strategyStore.name = data.name || ''
  strategyStore.description = data.description || ''
  strategyStore.objects = Array.isArray(data.objects) ? data.objects : []
  strategyStore.selectedZone = data.selectedZone ?? null
  strategyStore.showPaths = data.showPaths ?? true
  strategyStore.flightPathVisible = data.flightPathVisible ?? false
  strategyStore.selectedObjectId = null
  strategyStore.drafting = null
  strategyStore.history = []
  strategyStore.future = []
  strategyStore.dirty = false
  fire()
}
