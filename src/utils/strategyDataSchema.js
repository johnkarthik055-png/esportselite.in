/* ============================================================
   STRATEGY MAKER — DATA SCHEMA
   ------------------------------------------------------------
   Every drawn object shares one generic shape, regardless of tool:

     {
       id, type,      // 'pencil'|'line'|'arrow'|'polygon'|'rectangle'|'circle'|'text'
       points,         // [[lat,lng], ...] — meaning depends on type:
                        //   pencil/line/arrow/polygon: the full path/outline
                        //   rectangle: [corner1, corner2] (opposite corners)
                        //   circle: [center]
                        //   text:   [position]
       radius,         // circle only, world units
       text,           // text tool only, the typed label
       color, thickness, opacity,
       phase, createdAt,
     }

   This replaces the previous tool-specific schema (Marker with
   player assignment, Rotation with player color-coding, Zone,
   old freehand-only Draw) with one uniform drawing-object shape,
   so Undo/Redo/Delete/Clear/color-thickness-opacity editing work
   identically across every tool instead of needing per-type logic.

   Old saved objects of the removed types (marker/rotation/zone/
   vehicle/freehand) don't crash on load — DrawingCanvas renders
   them best-effort (freehand/rotation/zone map onto a visually
   equivalent new shape; marker/vehicle are skipped) via
   renderLegacyObject(), but the toolkit no longer exposes any UI
   to create new ones.
   ============================================================ */

export const DRAW_TOOLS = [
  { key: 'select',    label: 'Select',    shortcut: 'V' },
  { key: 'pencil',    label: 'Pencil',    shortcut: 'P' },
  { key: 'line',      label: 'Line',      shortcut: 'L' },
  { key: 'arrow',     label: 'Arrow',     shortcut: 'A' },
  { key: 'polygon',   label: 'Polygon',   shortcut: 'G' },
  { key: 'rectangle', label: 'Rectangle', shortcut: 'R' },
  { key: 'circle',    label: 'Circle',    shortcut: 'C' },
  { key: 'text',      label: 'Text',      shortcut: 'T' },
  { key: 'measure',   label: 'Measure',   shortcut: 'M' },
]

/* Tools whose interaction is a drag gesture (mousedown -> move ->
   mouseup) rather than discrete clicks — these are the ones whose
   live preview is built with beginDrag/updateDrag/endDrag in
   DrawingCanvas.jsx. Polygon is deliberately NOT in this list (it's
   click-to-place-a-vertex, not a drag). */
export const DRAG_DRAW_TOOLS = ['pencil', 'line', 'arrow', 'rectangle', 'circle']

/* Tools that fight with a touchscreen's native pan/pinch-zoom/scroll
   gesture and so need it locked out while active. This is
   DRAG_DRAW_TOOLS plus Polygon: polygon isn't a drag gesture, but
   placing several vertices with quick successive taps is still
   double-tap-zoom-prone, so it gets the same touch-action:none /
   disabled map-gesture treatment even though it never calls
   beginDrag(). This single list drives both which tools get map
   dragging/tap/pinch-zoom disabled (DrawingCanvas.jsx) and which get
   touch-action:none applied to the Leaflet container (MapKnowledge.jsx
   toggles the .mk-drawing-active class) — kept in sync by construction
   instead of two independently-maintained lists. */
export const PAN_LOCKING_TOOLS = [...DRAG_DRAW_TOOLS, 'polygon']

/* Preset palette for the "current pen" color picker — used by every
   tool, since these shapes have no semantic type (unlike the old
   marker categories), so color is the only classification, picked
   directly by whoever's drawing. */
export const DRAW_COLORS = [
  { key: 'blue',   value: '#3B82F6' },
  { key: 'cyan',   value: '#00D4FF' },
  { key: 'amber',  value: '#F59E0B' },
  { key: 'red',    value: '#EF4444' },
  { key: 'green',  value: '#22C55E' },
  { key: 'violet', value: '#7C3AED' },
  { key: 'white',  value: '#FFFFFF' },
]

export const THICKNESS_PRESETS = [
  { key: 'thin',   label: 'Thin',   value: 2 },
  { key: 'medium', label: 'Medium', value: 4 },
  { key: 'thick',  label: 'Thick',  value: 7 },
]

export const OPACITY_PRESETS = [
  { key: 'faint',  label: '30%',  value: 0.3 },
  { key: 'medium', label: '55%',  value: 0.55 },
  { key: 'strong', label: '80%',  value: 0.8 },
  { key: 'solid',  label: '100%', value: 1 },
]

export const DEFAULT_DRAW_COLOR = '#3B82F6'
export const DEFAULT_THICKNESS = 4
export const DEFAULT_OPACITY = 0.8

/* Each layer is a predicate over an object rather than a plain type
   lookup — kept for forward-compatibility even though every group
   here is currently a 1:1 type match, so a future sub-classification
   (e.g. splitting polygons by fill) doesn't need a LayersPanel.jsx
   change. Any object that doesn't match ANY group (legacy types from
   the previous toolkit generation) is always rendered rather than
   becoming permanently hidden with no toggle able to reach it. */
export const LAYER_GROUPS = [
  { key: 'pencil',    label: 'Pencil / Freehand', match: o => o.type === 'pencil' },
  { key: 'line',      label: 'Lines',             match: o => o.type === 'line' },
  { key: 'arrow',     label: 'Arrows',            match: o => o.type === 'arrow' },
  { key: 'polygon',   label: 'Polygons',          match: o => o.type === 'polygon' },
  { key: 'rectangle', label: 'Rectangles',        match: o => o.type === 'rectangle' },
  { key: 'circle',    label: 'Circles',           match: o => o.type === 'circle' },
  { key: 'text',      label: 'Text',              match: o => o.type === 'text' },
]
export const DEFAULT_VISIBLE_LAYER_GROUPS = LAYER_GROUPS.map(g => g.key)

/* Real, verified spawn datasets by map — see mapCoordinates.js and
   erangel_vehicle_boat_spawns.json / miramar_boat_spawns.json for
   how these were empirically derived. Every map/kind pair is one of
   three distinct states, not a plain available/unavailable boolean:
     - VERIFIED       — real coordinates exist and are wired in.
     - PENDING         — the spawn kind exists in-game on this map, but
       no verified coordinate data has been wired in yet (may arrive
       later). The Layers panel shows "Data unavailable" for this.
     - NOT_APPLICABLE  — confirmed the spawn kind does not exist on
       this map at all (e.g. Rondo has no navigable water, so it has
       no boat spawns to ever find). This is a permanent fact about
       the map, not a missing-data gap, so it must read differently
       from PENDING — conflating the two would wrongly imply boat data
       is still coming for a map that will never have any.
   Nothing may fall back to another map's coordinates for a PENDING or
   NOT_APPLICABLE entry (Issue 9 / Issue 17). */
export const SPAWN_STATUS = {
  VERIFIED: 'verified',
  PENDING: 'pending',
  NOT_APPLICABLE: 'not_applicable',
}

export const VERIFIED_SPAWN_DATA = {
  erangel: { vehicle: SPAWN_STATUS.VERIFIED, boat: SPAWN_STATUS.VERIFIED },
  miramar: { vehicle: SPAWN_STATUS.VERIFIED, boat: SPAWN_STATUS.VERIFIED },
  rondo:   { vehicle: SPAWN_STATUS.VERIFIED, boat: SPAWN_STATUS.NOT_APPLICABLE },
}

export const PHASES = [
  { id: 'phase-1', name: 'DROP',        order: 1 },
  { id: 'phase-2', name: 'LOOT',        order: 2 },
  { id: 'phase-3', name: 'ROTATION',    order: 3 },
  { id: 'phase-4', name: 'POSITIONING', order: 4 },
  { id: 'phase-5', name: 'FIGHT',       order: 5 },
  { id: 'phase-6', name: 'END GAME',    order: 6 },
]

/* Role colors deliberately map to REAL, visually distinct design
   tokens rather than the literal "red/blue/green/yellow/purple"
   request verbatim — this app's --red token was rebranded to alias
   --blue (see index.css), so using it for IGL would make IGL and
   Assaulter 1 the same color. --danger is the app's one remaining
   true red, so IGL uses that instead; the rest map straightforwardly.
   The squad roster (players/roles) is independent of the drawing
   toolkit — it's still used by SaveStrategyPanel to name a strategy's
   squad, just no longer linked to any specific drawn object. */
export const DEFAULT_ROLES = [
  { key: 'igl',        label: 'IGL',              color: 'var(--danger)' },
  { key: 'assaulter1', label: 'Assaulter 1',      color: 'var(--blue)' },
  { key: 'assaulter2', label: 'Assaulter 2',      color: 'var(--green)' },
  { key: 'support',    label: 'Support / Filter',  color: 'var(--gold)' },
  { key: 'freeman',    label: 'Freeman / Scout',  color: 'var(--violet)' },
]

export const GAME_MODES = ['Scrim', 'Tournament', 'Ranked', 'Custom']

export function createDefaultPlayers() {
  return DEFAULT_ROLES.map((r, i) => ({
    id: `p${i + 1}`, name: r.label, role: r.key, color: r.color,
  }))
}

export function createEmptyStrategy(mapId) {
  return {
    strategyId: null,
    name: '',
    description: '',
    map: mapId,
    mode: 'Scrim',
    tags: [],
    phases: PHASES.map(p => ({ id: p.id, name: p.name })),
    players: createDefaultPlayers(),
    objects: [],
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
    phase: partial.phase ?? 'phase-1',
    createdAt: partial.createdAt ?? Date.now(),
  }
}

/* ============================================================
   BACKWARD COMPATIBILITY
   ------------------------------------------------------------
   Strategies saved before the very first rebuild used a flat
   { pins, arrows, zones } shape (no phases/players/structured
   metadata). Loading one of those must not crash or silently
   drop the user's saved work — convert it into the current object
   schema on load instead. New saves always use the current shape;
   this only ever runs on read. Old pins have no equivalent shape
   in the new toolkit (no more point-marker tool), so they migrate
   to a Text object using the pin's name as the label; arrows/zones
   map onto Arrow/Circle directly.
   ============================================================ */
export function isLegacyStrategyDoc(doc) {
  return doc && !Array.isArray(doc.objects) && (
    Array.isArray(doc.pins) || Array.isArray(doc.arrows) || Array.isArray(doc.zones)
  )
}

export function migrateLegacyStrategy(doc) {
  const objects = []
  ;(doc.pins || []).forEach(p => {
    objects.push(createStrategyObject({
      id: p.id, type: 'text', points: [[p.lat, p.lng]],
      text: p.name || '', color: p.color,
    }))
  })
  ;(doc.arrows || []).forEach(a => {
    objects.push(createStrategyObject({
      id: a.id, type: 'arrow', points: [a.from, a.to], color: a.color,
    }))
  })
  ;(doc.zones || []).forEach(z => {
    objects.push(createStrategyObject({
      id: z.id, type: 'circle', points: [z.center], radius: z.radius, color: z.color,
    }))
  })
  return {
    strategyId: doc.id || null,
    name: doc.name || 'Untitled Strategy',
    description: doc.description || '',
    map: doc.map || null,
    mode: 'Scrim',
    tags: [],
    phases: PHASES.map(p => ({ id: p.id, name: p.name })),
    players: createDefaultPlayers(),
    objects,
  }
}

/* ============================================================
   GEOMETRY HELPERS (measure tool, arrow heading)
   ------------------------------------------------------------
   All in the map's own [lat, lng] world-unit space (0..256, see
   mapCoordinates.js) — MAP_WORLD_METERS converts that to real
   in-game meters for the maps with a known physical size. Rondo
   has no verified game-world-size constant yet (see
   mapCoordinates.js), so distance there is reported in world
   units, not meters, rather than guessing a conversion.
   ============================================================ */
const MAP_WORLD_METERS = {
  erangel: 8000,
  miramar: 8000,
}

export function distanceBetween(posA, posB, mapId) {
  const dLat = posB[0] - posA[0]
  const dLng = posB[1] - posA[1]
  const worldUnits = Math.hypot(dLat, dLng)
  const metersPerWorldUnit = MAP_WORLD_METERS[mapId] ? MAP_WORLD_METERS[mapId] / 256 : null
  return {
    worldUnits,
    meters: metersPerWorldUnit ? worldUnits * metersPerWorldUnit : null,
  }
}

export function bearingBetween(posA, posB) {
  const dLat = posB[0] - posA[0]
  const dLng = posB[1] - posA[1]
  /* 0deg = north (up on the map, +lat), clockwise, matching
     standard map bearing convention. */
  let deg = Math.atan2(dLng, dLat) * (180 / Math.PI)
  if (deg < 0) deg += 360
  return deg
}

/* Rough BGMI on-foot pace ~ 5.7 m/s (matches common community
   estimates for jogging); only meaningful where we have a real
   meters figure. */
const WALK_SPEED_MPS = 5.7
export function estimateTravelSeconds(meters) {
  if (meters == null) return null
  return meters / WALK_SPEED_MPS
}
