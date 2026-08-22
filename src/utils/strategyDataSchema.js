/* ============================================================
   STRATEGY MAKER — DATA SCHEMA
   ------------------------------------------------------------
   Every tactical object placed on the map is stored with the
   same structured shape, regardless of tool:

     {
       id, type, category, player, phase, priority,
       position,      // [lat, lng] — single-point objects
       waypoints,      // [[lat,lng], ...] — multi-point objects (rotations)
       target,         // [lat, lng] — combat/utility target point
       radius,         // circle-shaped objects (zone, vision cone range)
       angle,          // vision cone facing, degrees (0 = north)
       spread,         // vision cone width, degrees
       color, description, createdAt,
     }

   This is deliberately NOT a flattened drawing layer (a single
   array of generic shapes) — `type`/`category`/`player`/`phase`
   are first-class fields specifically so a future Coach AI pass
   can query "every rotation in phase 3" or "every combat action
   assigned to the IGL" without re-parsing SVG paths.
   ============================================================ */

export const TOOLS = [
  { key: 'select',    label: 'Select',    shortcut: 'V' },
  { key: 'marker',    label: 'Marker',    shortcut: 'M' },
  { key: 'rotation',  label: 'Rotation',  shortcut: 'R' },
  { key: 'combat',    label: 'Combat',    shortcut: 'C' },
  { key: 'utility',   label: 'Utility',   shortcut: 'U' },
  { key: 'vision',    label: 'Vision',    shortcut: 'I' },
  { key: 'zone',      label: 'Zone',      shortcut: 'Z' },
  { key: 'vehicle',   label: 'Vehicle',   shortcut: 'H' },
  { key: 'formation', label: 'Formation', shortcut: 'F' },
  { key: 'measure',   label: 'Measure',   shortcut: 'N' },
  { key: 'layers',    label: 'Layers',    shortcut: 'L' },
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

export const COMBAT_TYPES = [
  { key: 'attack',       label: 'Attack',       color: 'var(--danger)' },
  { key: 'push',         label: 'Push',         color: '#FF2D44' },
  { key: 'hold',         label: 'Hold',         color: 'var(--green)' },
  { key: 'flank',        label: 'Flank',        color: 'var(--violet)' },
  { key: 'split',        label: 'Split',        color: 'var(--cyan)' },
  { key: 'collapse',     label: 'Collapse',     color: 'var(--amber)' },
  { key: 'retreat',      label: 'Retreat',      color: 'var(--text-subtle)' },
  { key: 'third_party',  label: 'Third Party',  color: '#A855F7' },
  { key: 'crossfire',    label: 'Crossfire',    color: 'var(--gold)' },
  { key: 'bait',         label: 'Bait',         color: 'var(--blue)' },
  { key: 'trade',        label: 'Trade',        color: 'var(--danger)' },
]

export const UTILITY_TYPES = [
  { key: 'smoke',     label: 'Smoke',            color: '#CBD5E1' },
  { key: 'frag',      label: 'Frag',             color: 'var(--danger)' },
  { key: 'molotov',   label: 'Molotov',          color: 'var(--amber)' },
  { key: 'stun',      label: 'Stun',             color: 'var(--gold)' },
  { key: 'airstrike', label: 'Airstrike / Danger', color: '#FF2D44' },
]

export const VISION_TYPES = [
  { key: 'line_of_sight',        label: 'Line of Sight',        color: 'var(--blue)' },
  { key: 'firing_line',          label: 'Firing Line',          color: 'var(--danger)' },
  { key: 'scout_direction',      label: 'Scout Direction',      color: 'var(--cyan)' },
  { key: 'watch_angle',          label: 'Watch Angle',          color: 'var(--green)' },
  { key: 'blind_spot',           label: 'Blind Spot',           color: 'var(--text-subtle)' },
  { key: 'crossfire_cone',       label: 'Crossfire Cone',       color: 'var(--gold)' },
  { key: 'enemy_visibility_area', label: 'Enemy Visibility Area', color: 'var(--danger)' },
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

/* VEHICLE SPAWN is a reference to the real, verified static spawn
   datasets (see mapVehicleDataAvailability below) — not a
   user-placeable annotation. The other six are pure tactical
   annotations the player places manually, available on every map
   regardless of spawn-data availability (Issue 9). */
export const VEHICLE_ANNOTATION_TYPES = [
  { key: 'vehicle_pickup',   label: 'Vehicle Pickup',   color: 'var(--gold)' },
  { key: 'vehicle_parking',  label: 'Vehicle Parking',  color: 'var(--blue)' },
  { key: 'vehicle_rotation', label: 'Vehicle Rotation', color: 'var(--violet)' },
  { key: 'vehicle_block',    label: 'Vehicle Block',    color: 'var(--danger)' },
  { key: 'vehicle_crash',    label: 'Vehicle Crash Point', color: '#FF2D44' },
  { key: 'vehicle_recovery', label: 'Vehicle Recovery', color: 'var(--green)' },
]

/* Real, verified spawn datasets by map — see mapCoordinates.js and
   erangel_vehicle_boat_spawns.json / miramar_boat_spawns.json for
   how these were empirically derived. Anything not listed here has
   NO verified data; the Layers panel must show "Data unavailable"
   for it rather than a toggle, and nothing may fall back to
   another map's coordinates (Issue 9 / Issue 17). */
export const VERIFIED_SPAWN_DATA = {
  erangel: { vehicle: true, boat: true },
  miramar: { vehicle: true, boat: true },
  rondo:   { vehicle: false, boat: false },
}

export const FORMATIONS = [
  {
    key: '4man_tight', group: '4-Man', label: 'Tight',
    offsets: [[0, 0], [0.4, 0.4], [-0.4, 0.4], [0, 0.8]],
  },
  {
    key: '4man_wide', group: '4-Man', label: 'Wide',
    offsets: [[-1.2, 0], [-0.4, 0], [0.4, 0], [1.2, 0]],
  },
  {
    key: '4man_line', group: '4-Man', label: 'Line',
    offsets: [[0, -1.2], [0, -0.4], [0, 0.4], [0, 1.2]],
  },
  {
    key: '4man_diamond', group: '4-Man', label: 'Diamond',
    offsets: [[0, -0.8], [-0.8, 0], [0.8, 0], [0, 0.8]],
  },
  {
    key: '3man_triangle', group: '3-Man', label: 'Triangle',
    offsets: [[0, -0.6], [-0.6, 0.5], [0.6, 0.5]],
  },
  {
    key: '3man_2plus1', group: '3-Man', label: '2+1',
    offsets: [[-0.5, 0.3], [0.5, 0.3], [0, -0.8]],
  },
  {
    key: '2plus2_crossfire', group: '2+2', label: 'Crossfire',
    offsets: [[-1, -0.6], [-1, 0.6], [1, -0.6], [1, 0.6]],
  },
  {
    key: '2plus2_split', group: '2+2', label: 'Split',
    offsets: [[-1.4, 0], [-0.6, 0], [0.6, 0], [1.4, 0]],
  },
  {
    key: '1plus1plus2_scout', group: '1+1+2', label: 'Scout',
    offsets: [[0, -1.4], [0, -0.5], [-0.5, 0.5], [0.5, 0.5]],
  },
  {
    key: '1plus1plus2_igl_support', group: '1+1+2', label: 'IGL + Support',
    offsets: [[-0.8, -0.6], [0.8, -0.6], [-0.4, 0.6], [0.4, 0.6]],
  },
  {
    key: '1plus1plus2_entry_pair', group: '1+1+2', label: 'Entry Pair',
    offsets: [[-1.2, -0.4], [1.2, -0.4], [-0.3, 0.6], [0.3, 0.6]],
  },
]

/* Distance in Leaflet [lat,lng] "world units" (0..256) between an
   offset pair and the formation anchor, converted to real map
   units for placement — see applyFormationOffsets below. Offsets
   above are expressed in a small abstract unit (~ "player spacing")
   independent of any specific map's scale. */
export const FORMATION_SPACING_WORLD_UNITS = 3

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

/* Issue 12's eleven named layers don't map 1:1 onto object `type`
   (several are sub-slices of `marker` by category) so each layer
   is a predicate over an object rather than a plain type lookup.
   Any object that doesn't match ANY group here (e.g. a marker
   category not called out by name, like Watch Point or Rally
   Point) is always rendered rather than becoming permanently
   hidden with no toggle able to reach it. */
export const LAYER_GROUPS = [
  { key: 'squad',     label: 'Squad Positions',  match: o => o.type === 'marker' && o.category === 'player_position' },
  { key: 'enemy',     label: 'Enemy Positions',  match: o => o.type === 'marker' && o.category === 'enemy_position' },
  { key: 'rotations', label: 'Rotations',        match: o => o.type === 'rotation' },
  { key: 'combat',    label: 'Combat',           match: o => o.type === 'combat' },
  { key: 'vehicles',  label: 'Vehicles',         match: o => o.type === 'vehicle' },
  { key: 'compounds', label: 'Compounds',        match: o => o.type === 'marker' && o.category === 'compound' },
  { key: 'utilities', label: 'Utilities',        match: o => o.type === 'utility' },
  { key: 'vision',    label: 'Vision',           match: o => o.type === 'vision' },
  { key: 'danger',    label: 'Danger Areas',     match: o => (o.type === 'marker' && o.category === 'danger') || (o.type === 'zone' && o.category === 'danger_area') },
  { key: 'loot',      label: 'Loot',             match: o => o.type === 'marker' && o.category === 'loot_priority' },
  { key: 'zones',     label: 'Zones',            match: o => o.type === 'zone' },
]
export const DEFAULT_VISIBLE_LAYER_GROUPS = LAYER_GROUPS.map(g => g.key)

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
    target: partial.target ?? null,
    radius: partial.radius ?? null,
    angle: partial.angle ?? null,
    spread: partial.spread ?? null,
    color: partial.color ?? '#3B82F6',
    label: partial.label ?? '',
    description: partial.description ?? '',
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
   GEOMETRY HELPERS (measure tool, formation placement)
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

/* Place a formation's offsets around an anchor point, in the
   map's [lat,lng] world-unit space. Offsets are small abstract
   units (see FORMATIONS above); scaled by FORMATION_SPACING_WORLD_UNITS
   so a formation always covers a sensible on-map footprint
   regardless of current zoom. */
export function applyFormationOffsets(anchor, offsets) {
  return offsets.map(([dx, dy]) => [
    anchor[0] + dy * FORMATION_SPACING_WORLD_UNITS,
    anchor[1] + dx * FORMATION_SPACING_WORLD_UNITS,
  ])
}
