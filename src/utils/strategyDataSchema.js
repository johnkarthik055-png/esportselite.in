/* ============================================================
   STRATEGY MAKER — DATA SCHEMA
   ------------------------------------------------------------
   Every tactical object placed on the map is stored with the
   same structured shape, regardless of tool:

     {
       id, type, category, player, phase, priority,
       position,      // [lat, lng] — single-point objects
       waypoints,      // [[lat,lng], ...] — multi-point objects (rotations, freehand)
       radius,         // circle-shaped objects (zone)
       color, description, vehiclePickup, createdAt,
     }

   This is deliberately NOT a flattened drawing layer (a single
   array of generic shapes) — `type`/`category`/`player`/`phase`
   are first-class fields specifically so a future Coach AI pass
   can query "every rotation in phase 3" or "every marker assigned
   to the IGL" without re-parsing SVG paths.

   Tool set simplified to Select/Marker/Rotation/Zone/Draw/Measure
   (Prompt 2) — Formation/Combat/Utility/Vision and Coach/Player Mode
   were removed entirely, not just hidden. Old saved objects of those
   removed types don't crash on load; StrategyDrawingLayer just skips
   rendering anything it no longer recognizes.
   ============================================================ */

export const TOOLS = [
  { key: 'select',   label: 'Select',   shortcut: 'V' },
  { key: 'marker',   label: 'Marker',   shortcut: 'M' },
  { key: 'rotation', label: 'Rotation', shortcut: 'R' },
  { key: 'zone',     label: 'Zone',     shortcut: 'Z' },
  { key: 'draw',     label: 'Draw',     shortcut: 'D' },
  { key: 'measure',  label: 'Measure',  shortcut: 'N' },
]

/* Freehand Draw tool preset palette. Distinct from the structured-
   tool category colors below — freehand strokes have no "type", so
   the color IS the only classification, picked directly by whoever's
   sketching rather than implied by a marker category. */
export const FREEHAND_COLORS = [
  { key: 'blue',   value: '#3B82F6' },
  { key: 'cyan',   value: '#00D4FF' },
  { key: 'amber',  value: '#F59E0B' },
  { key: 'red',    value: '#EF4444' },
  { key: 'green',  value: '#22C55E' },
  { key: 'violet', value: '#7C3AED' },
  { key: 'white',  value: '#FFFFFF' },
]

export const MARKER_TYPES = [
  { key: 'player_position', label: 'Player Position', color: 'var(--blue)' },
  { key: 'enemy_position',  label: 'Enemy Position',  color: 'var(--danger)' },
  { key: 'drop_spot',       label: 'Drop Spot',       color: 'var(--gold)' },
  { key: 'loot_priority',   label: 'Loot Priority',   color: 'var(--amber)' },
  { key: 'compound',        label: 'Compound',        color: 'var(--cyan)' },
  { key: 'watch_point',     label: 'Watch Point',     color: 'var(--violet)' },
  { key: 'hold_point',      label: 'Hold Point',      color: 'var(--green)' },
  { key: 'rally_point',     label: 'Rally Point',     color: 'var(--blue)' },
  { key: 'danger',          label: 'Danger',          color: 'var(--danger)' },
  { key: 'knock_finish',    label: 'Knock / Finish',  color: '#FF2D44' },
  { key: 'scout_point',     label: 'Scout Point',     color: 'var(--cyan)' },
]

export const ROTATION_TYPES = [
  { key: 'early_rotation', label: 'Early Rotation', color: 'var(--green)',  dash: null },
  { key: 'late_rotation',  label: 'Late Rotation',  color: 'var(--amber)',  dash: null },
  { key: 'safe_rotation',  label: 'Safe Rotation',  color: 'var(--blue)',   dash: null },
  { key: 'risky_rotation', label: 'Risky Rotation', color: 'var(--danger)', dash: '6,4' },
  { key: 'foot_rotation',  label: 'Foot Rotation',  color: 'var(--cyan)',   dash: '2,4' },
  { key: 'vehicle_rotation', label: 'Vehicle Rotation', color: 'var(--violet)', dash: null },
]

export const ZONE_TYPES = [
  { key: 'zone',            label: 'Zone',             color: 'var(--blue)' },
  { key: 'hard_cover',      label: 'Hard Cover Area',  color: 'var(--green)' },
  { key: 'soft_cover',      label: 'Soft Cover Area',  color: 'var(--cyan)' },
  { key: 'dead_zone',       label: 'Dead Zone',        color: 'var(--text-subtle)' },
  { key: 'priority_area',   label: 'Priority Area',    color: 'var(--gold)' },
  { key: 'end_game_area',   label: 'End Game Area',    color: 'var(--violet)' },
  { key: 'danger_area',     label: 'Danger Area',      color: 'var(--danger)' },
]

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
   true red, so IGL uses that instead; the rest map straightforwardly. */
export const DEFAULT_ROLES = [
  { key: 'igl',        label: 'IGL',              color: 'var(--danger)' },
  { key: 'assaulter1', label: 'Assaulter 1',      color: 'var(--blue)' },
  { key: 'assaulter2', label: 'Assaulter 2',      color: 'var(--green)' },
  { key: 'support',    label: 'Support / Filter',  color: 'var(--gold)' },
  { key: 'freeman',    label: 'Freeman / Scout',  color: 'var(--violet)' },
]

export const GAME_MODES = ['Scrim', 'Tournament', 'Ranked', 'Custom']

/* Each layer is a predicate over an object rather than a plain type
   lookup, since several rows are sub-slices of `marker` by category.
   Any object that doesn't match ANY group here (e.g. a marker
   category not called out by name, like Watch Point or Rally Point)
   is always rendered rather than becoming permanently hidden with no
   toggle able to reach it. 'vehicles' stays even though the standalone
   Vehicle tool was removed (Prompt 2) — it's still how legacy
   vehicle-type objects from before that removal get shown/hidden. */
export const LAYER_GROUPS = [
  { key: 'squad',     label: 'Squad Positions',  match: o => o.type === 'marker' && o.category === 'player_position' },
  { key: 'enemy',     label: 'Enemy Positions',  match: o => o.type === 'marker' && o.category === 'enemy_position' },
  { key: 'rotations', label: 'Rotations',        match: o => o.type === 'rotation' },
  { key: 'vehicles',  label: 'Vehicles',         match: o => o.type === 'vehicle' },
  { key: 'compounds', label: 'Compounds',        match: o => o.type === 'marker' && o.category === 'compound' },
  { key: 'danger',    label: 'Danger Areas',     match: o => (o.type === 'marker' && o.category === 'danger') || (o.type === 'zone' && o.category === 'danger_area') },
  { key: 'loot',      label: 'Loot',             match: o => o.type === 'marker' && o.category === 'loot_priority' },
  { key: 'zones',     label: 'Zones',            match: o => o.type === 'zone' },
  { key: 'freehand',  label: 'Freehand Drawings', match: o => o.type === 'freehand' },
]
export const DEFAULT_VISIBLE_LAYER_GROUPS = LAYER_GROUPS.map(g => g.key)

/* Rotations with no player assigned render in this fixed neutral
   gray rather than falling back to the category's semantic color
   (early/late/safe/risky/foot/vehicle) — unassigned rotations must be
   visually distinct from every player color, and reusing a category
   color risks coincidentally matching one. */
export const NEUTRAL_ROTATION_COLOR = '#94A3B8'

const TYPE_LOOKUP_BY_TOOL = {
  marker: MARKER_TYPES, rotation: ROTATION_TYPES, zone: ZONE_TYPES,
}

/* Default color for a given (type, category) pair — used to restore
   an object's category color when a player is unassigned from it
   (SelectedItemPanel), so color always reflects current assignment
   instead of drifting to whatever a prior player left behind. */
export function categoryColor(type, category) {
  return TYPE_LOOKUP_BY_TOOL[type]?.find(t => t.key === category)?.color ?? '#3B82F6'
}

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
    category: partial.category,
    player: partial.player ?? null,
    phase: partial.phase ?? 'phase-1',
    priority: partial.priority ?? 'normal',
    position: partial.position ?? null,
    waypoints: partial.waypoints ?? null,
    radius: partial.radius ?? null,
    color: partial.color ?? '#3B82F6',
    label: partial.label ?? '',
    description: partial.description ?? '',
    /* Compound/Loot Priority markers only — folds into the existing
       marker object instead of a duplicate Vehicle annotation at the
       same spot. Harmless no-op field on every other object type. */
    vehiclePickup: partial.vehiclePickup ?? false,
    createdAt: partial.createdAt ?? Date.now(),
  }
}

/* ============================================================
   BACKWARD COMPATIBILITY
   ------------------------------------------------------------
   Strategies saved before this rebuild used a flat
   { pins, arrows, zones } shape (no phases/players/structured
   metadata). Loading one of those must not crash or silently
   drop the user's saved work — convert it into the new object
   schema on load instead. New saves always use the new shape;
   this only ever runs on read.
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
      id: p.id, type: 'marker', category: 'player_position',
      position: [p.lat, p.lng], color: p.color, label: p.name,
      description: p.name,
    }))
  })
  ;(doc.arrows || []).forEach(a => {
    objects.push(createStrategyObject({
      id: a.id, type: 'rotation', category: 'safe_rotation',
      waypoints: [a.from, a.to], color: a.color, label: a.label,
      description: a.label,
    }))
  })
  ;(doc.zones || []).forEach(z => {
    objects.push(createStrategyObject({
      id: z.id, type: 'zone', category: 'zone',
      position: z.center, radius: z.radius, color: z.color, label: z.label,
      description: z.label,
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
   GEOMETRY HELPERS (measure tool)
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
