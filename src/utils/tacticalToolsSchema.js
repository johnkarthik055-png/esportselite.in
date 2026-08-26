/* ============================================================
   TACTICAL TOOLS — CONFIG-DRIVEN DEFINITIONS
   ------------------------------------------------------------
   The 14 tactical marker/path tools (Team Drop, Team Rotation,
   Attack/Retreat/Scout Path, Hold/Push Position, Enemy Position,
   Danger Zone, Vehicle Marker, Choke Point, Entry/Exit Markers,
   Sniper Position, Head-glitch Position) are defined here as DATA
   rather than as 14 hand-written tools, so ToolPanel/DrawingCanvas/
   LayersPanel/strategyStore each need only ONE generic code path
   that reads this config, instead of 14 near-duplicate branches.

   Every tactical object still uses the exact same base object shape
   as the original drawing toolkit (see strategyDataSchema.js
   createStrategyObject: id/type/points/radius/color/thickness/
   opacity/phase/createdAt) — tool-specific data (team, priority,
   notes, etc.) lives in one extra nested `fields` object so it can
   never collide with those base keys.

   geometry:
     'point'  — single click places it (Team Drop, Hold, Push, Enemy
                Position, Vehicle Marker, Choke Point, Entry, Exit,
                Sniper, Head-glitch)
     'path'   — click to place vertices, Finish to commit (Team
                Rotation, Attack/Retreat/Scout Path) — same
                interaction as the existing Polygon tool
     'circle' — drag to size, same gesture as the existing Circle
                tool (Danger Zone)

   Entry and Exit are two distinct placeable tools (different icon/
   badge/semantics) but share ONE layer toggle category
   ("Entry/Exit Markers"), matching the spec's list of 14 Layers-
   panel categories for its 14 numbered tools (#12 covers both).
   ============================================================ */

export const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

const F = (key, label, type, extra) => ({ key, label, type, ...extra })
const TEXT = (key, label) => F(key, label, 'text')
const NOTES = (key = 'notes', label = 'Notes') => F(key, label, 'textarea')
const SELECT = (key, label, options) => F(key, label, 'select', { options })
const DIRECTION = (key, label = 'Direction') => F(key, label, 'select', { options: DIRECTIONS })
const PLAYER = (key, label) => F(key, label, 'player')

export const TACTICAL_TOOLS = [
  /* ---- paths ---- */
  {
    key: 'teamRotation', label: 'Team Rotation', group: 'paths', geometry: 'path',
    layerKey: 'teamRotation', layerLabel: 'Rotations', badge: 'RT', defaultColor: '#3B82F6',
    shortcutHint: 'Click to place route points, then Finish. Fill in the rotation details.',
    fields: [
      TEXT('team', 'Team'),
      TEXT('timing', 'Timing'),
      SELECT('rotationPhase', 'Rotation Phase', ['Early', 'Mid', 'Late', 'Emergency']),
      SELECT('mode', 'Mode', ['Vehicle', 'Foot', 'Split', 'Regroup']),
      NOTES(),
    ],
  },
  {
    key: 'attackPath', label: 'Attack Path', group: 'paths', geometry: 'path',
    layerKey: 'attackPath', layerLabel: 'Attack Paths', badge: 'AT', defaultColor: '#EF4444',
    shortcutHint: 'Click to place the attack route from start to target, then Finish.',
    fields: [
      DIRECTION('entryDirection', 'Entry Direction'),
      TEXT('timing', 'Timing'),
      TEXT('assignedPlayers', 'Assigned Players'),
      NOTES(),
    ],
  },
  {
    key: 'retreatPath', label: 'Retreat Path', group: 'paths', geometry: 'path',
    layerKey: 'retreatPath', layerLabel: 'Retreat Paths', badge: 'RP', defaultColor: '#22C55E',
    shortcutHint: 'Click to place the retreat route, then Finish.',
    fields: [
      TEXT('fallbackCompound', 'Fallback Compound'),
      TEXT('regroupLocation', 'Regroup Location'),
      TEXT('vehicleLocation', 'Vehicle Location'),
      NOTES('emergencyNotes', 'Emergency Notes'),
    ],
  },
  {
    key: 'scoutPath', label: 'Scout Path', group: 'paths', geometry: 'path',
    layerKey: 'scoutPath', layerLabel: 'Scout Paths', badge: 'SC', defaultColor: '#00D4FF',
    shortcutHint: 'Click to place the scout route from start to end, then Finish.',
    fields: [
      PLAYER('assignedPlayer', 'Assigned Player'),
      TEXT('infoObjective', 'Information Objective'),
      TEXT('returnPoint', 'Return Point'),
      NOTES(),
    ],
  },

  /* ---- markers / positions ---- */
  {
    key: 'teamDrop', label: 'Team Drop', group: 'markers', geometry: 'point',
    layerKey: 'teamDrop', layerLabel: 'Team Drops', badge: 'TD', defaultColor: '#F59E0B',
    shortcutHint: 'Click the drop location, then fill in the drop plan.',
    fields: [
      TEXT('team', 'Team'),
      SELECT('priority', 'Priority', ['Low', 'Medium', 'High']),
      SELECT('dropType', 'Drop Type', ['Primary', 'Secondary', 'Contest', 'Emergency']),
      TEXT('lootRoute', 'Loot Route'),
      TEXT('vehiclePlan', 'Vehicle Plan'),
      TEXT('firstRotation', 'First Rotation'),
      NOTES(),
    ],
  },
  {
    key: 'holdPosition', label: 'Hold Position', group: 'markers', geometry: 'point',
    layerKey: 'holdPosition', layerLabel: 'Hold Positions', badge: 'HD', defaultColor: '#7C3AED',
    shortcutHint: 'Click the hold location, then fill in the details.',
    fields: [
      TEXT('team', 'Team'),
      TEXT('players', 'Players'),
      TEXT('holdDuration', 'Hold Duration'),
      DIRECTION('direction'),
      TEXT('purpose', 'Purpose'),
      NOTES(),
    ],
  },
  {
    key: 'pushPosition', label: 'Push Position', group: 'markers', geometry: 'point',
    layerKey: 'pushPosition', layerLabel: 'Push Positions', badge: 'PU', defaultColor: '#EF4444',
    shortcutHint: 'Click the push origin, then fill in the details.',
    fields: [
      TEXT('team', 'Team'),
      TEXT('target', 'Target'),
      DIRECTION('entryDirection', 'Entry Direction'),
      TEXT('playersAssigned', 'Players Assigned'),
      TEXT('timing', 'Timing'),
      PLAYER('supportPlayer', 'Support Player'),
      NOTES(),
    ],
  },
  {
    key: 'enemyPosition', label: 'Enemy Position', group: 'markers', geometry: 'point',
    layerKey: 'enemyPosition', layerLabel: 'Enemy Positions', badge: 'EN', defaultColor: '#DC2626',
    shortcutHint: 'Click the spotted location, then fill in what you saw.',
    fields: [
      TEXT('enemyTeam', 'Enemy Team'),
      TEXT('countEstimate', 'Player / Team Count'),
      TEXT('timestamp', 'Timestamp'),
      SELECT('confidence', 'Confidence Level', ['Confirmed', 'Likely', 'Possible']),
      DIRECTION('direction'),
      NOTES(),
    ],
  },
  {
    key: 'vehicleMarker', label: 'Vehicle Marker', group: 'markers', geometry: 'point',
    layerKey: 'vehicleMarker', layerLabel: 'Vehicle Markers', badge: 'VH', defaultColor: '#F59E0B',
    shortcutHint: 'Click the vehicle location, then fill in the details.',
    fields: [
      TEXT('vehicleType', 'Vehicle Type'),
      SELECT('availability', 'Availability', ['Available', 'Unavailable']),
      TEXT('assignedTeam', 'Assigned Team'),
      TEXT('pickupTime', 'Pickup Time'),
      TEXT('destination', 'Destination'),
    ],
  },
  {
    key: 'chokePoint', label: 'Choke Point', group: 'markers', geometry: 'point',
    layerKey: 'chokePoint', layerLabel: 'Choke Points', badge: 'CP', defaultColor: '#F59E0B',
    shortcutHint: 'Click the choke point location, then fill in the details.',
    fields: [
      TEXT('chokeType', 'Type'),
      SELECT('importance', 'Importance', ['Low', 'Medium', 'High', 'Critical']),
      SELECT('enemyControl', 'Enemy Control', ['Contested', 'Enemy-held', 'Friendly-held', 'Unknown']),
      TEXT('recommendedAction', 'Recommended Action'),
      TEXT('alternateRoute', 'Alternate Route'),
    ],
  },
  {
    key: 'entryMarker', label: 'Entry Marker', group: 'markers', geometry: 'point',
    layerKey: 'entryExit', layerLabel: 'Entry/Exit Markers', badge: 'IN', defaultColor: '#22C55E',
    shortcutHint: 'Click where players enter the compound/area, then fill in the details.',
    fields: [
      DIRECTION('direction'),
      PLAYER('assignedPlayer', 'Assigned Player'),
      TEXT('timing', 'Timing'),
      NOTES(),
    ],
  },
  {
    key: 'exitMarker', label: 'Exit Marker', group: 'markers', geometry: 'point',
    layerKey: 'entryExit', layerLabel: 'Entry/Exit Markers', badge: 'OUT', defaultColor: '#EF4444',
    shortcutHint: 'Click the emergency exit/fallback direction point, then fill in the details.',
    fields: [
      DIRECTION('direction'),
      PLAYER('assignedPlayer', 'Assigned Player'),
      TEXT('timing', 'Timing'),
      NOTES(),
    ],
  },
  {
    key: 'sniperPosition', label: 'Sniper Position', group: 'markers', geometry: 'point',
    layerKey: 'sniperPosition', layerLabel: 'Sniper Positions', badge: 'SN', defaultColor: '#00D4FF',
    shortcutHint: 'Click the sniper position, then fill in the details.',
    fields: [
      TEXT('targetArea', 'Target Area'),
      DIRECTION('visibilityDirection', 'Visibility Direction'),
      PLAYER('assignedPlayer', 'Assigned Player'),
      TEXT('backupPosition', 'Backup Position'),
      TEXT('escapeRoute', 'Escape Route'),
    ],
  },
  {
    key: 'headglitchPosition', label: 'Head-glitch Position', group: 'markers', geometry: 'point',
    layerKey: 'headglitchPosition', layerLabel: 'Head-glitch Positions', badge: 'HG', defaultColor: '#7C3AED',
    shortcutHint: 'Click the head-glitch position, then fill in the details.',
    fields: [
      DIRECTION('direction'),
      TEXT('weaponRecommendation', 'Weapon Recommendation'),
      TEXT('targetArea', 'Target Area'),
      PLAYER('assignedPlayer', 'Assigned Player'),
      NOTES(),
    ],
  },
  {
    key: 'dangerZone', label: 'Danger Zone', group: 'markers', geometry: 'circle',
    layerKey: 'dangerZone', layerLabel: 'Danger Zones', badge: '!', defaultColor: '#DC2626',
    shortcutHint: 'Click and drag from the center outward to size the danger zone.',
    fields: [
      SELECT('dangerLevel', 'Danger Level', ['Low', 'Medium', 'High', 'Critical']),
      TEXT('reason', 'Reason'),
      TEXT('timePeriod', 'Time Period'),
      TEXT('enemyPresence', 'Enemy Presence'),
      TEXT('recommendedAction', 'Recommended Action'),
    ],
  },
]

export const TACTICAL_TOOLS_BY_KEY = Object.fromEntries(TACTICAL_TOOLS.map(t => [t.key, t]))

export const TACTICAL_PATH_TOOLS = TACTICAL_TOOLS.filter(t => t.geometry === 'path').map(t => t.key)
export const TACTICAL_POINT_TOOLS = TACTICAL_TOOLS.filter(t => t.geometry === 'point').map(t => t.key)
export const TACTICAL_CIRCLE_TOOLS = TACTICAL_TOOLS.filter(t => t.geometry === 'circle').map(t => t.key)

/* Circle-geometry tactical tools drag exactly like the existing
   Circle tool, so they join DRAG_DRAW_TOOLS/PAN_LOCKING_TOOLS in
   strategyDataSchema.js (that file imports this constant rather than
   the other way around, to avoid a circular import). */
export const TACTICAL_DRAG_TOOLS = [...TACTICAL_CIRCLE_TOOLS]

/* One layer-toggle group per unique layerKey (Entry + Exit share
   one). match() checks obj.type against every tool that maps to
   that layerKey. Merged into strategyDataSchema.js's LAYER_GROUPS. */
export const TACTICAL_LAYER_GROUPS = Object.values(
  TACTICAL_TOOLS.reduce((acc, t) => {
    if (!acc[t.layerKey]) {
      const typesForLayer = TACTICAL_TOOLS.filter(x => x.layerKey === t.layerKey).map(x => x.key)
      acc[t.layerKey] = { key: t.layerKey, label: t.layerLabel, match: o => typesForLayer.includes(o.type) }
    }
    return acc
  }, {})
)

export function isTacticalType(type) {
  return !!TACTICAL_TOOLS_BY_KEY[type]
}
