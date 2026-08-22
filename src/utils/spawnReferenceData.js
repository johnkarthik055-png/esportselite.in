/* ============================================================
   VERIFIED SPAWN REFERENCE DATA — shared between View Map's
   Vehicle/Boat layers and Strategy Maker's reference overlay.
   ------------------------------------------------------------
   Extracted so both consumers compute these once from the same
   source instead of each maintaining their own copy. Every value
   here is real, empirically-verified data (see mapCoordinates.js
   for how the conversion formula was derived and checked against
   each map's actual tiles) — nothing here is a placeholder.

   Erangel (vehicle + boat) and Miramar (vehicle + boat) have
   verified datasets. Rondo vehicle spawns are now verified too — see
   mapCoordinates.js for how its constant and Y-orientation were
   derived (816000, same as Erangel/Miramar, but NOT y-flipped — the
   first two "Rondo" files received under that label turned out to be
   Erangel's data relabeled and were rejected before this one).
   Rondo boat spawns still have no verified data; consumers must show
   an explicit "data unavailable" state for that instead of falling
   back to another map's coordinates.

   Miramar's raw vehicle-spawn export (miramar_vehicle_spawns.json)
   mixes several unrelated spawn kinds in one `categories` field,
   confirmed by cross-checking coordinates against the existing
   datasets and by each category's z (altitude) value:
     - Road / Offroad / Esports1 / Esports2 / Hacienda_GoldMirado
       (450 of 550) — genuine ground vehicle spawns, z clusters at
       land altitude same as Road. These populate MIRAMAR_VEHICLE_POSITIONS.
     - Water (43 of 550) — z ≈ -1450 to -1553 (sea level). Every
       single one of these 43 points matched an existing entry in
       miramar_boat_spawns.json exactly (same x/y) — a pure re-export
       of data already wired in, not new data. Skipped entirely to
       avoid double-rendering the same boat spawn twice.
     - Water_Ferry / EsportsWater (19 of 550) — z ≈ -957 to -1450
       (also sea level), but NOT present in the existing 43-point
       boat dataset — genuinely new boat/ferry spawns. Merged
       additively into miramar_boat_spawns.json (43 -> 62); nothing
       in the original 43 was changed or removed.
     - Motorglider (38 of 550) — crCategories:["Sky"], glider/aircraft
       spawns, not a ground vehicle or watercraft. There's no
       Aircraft layer yet, so these are intentionally excluded from
       both MIRAMAR_VEHICLE_POSITIONS and the boat dataset rather
       than being miscategorized into either.
   450 + 43 + 19 + 38 = 550, all 550 raw entries accounted for.
   ============================================================ */
import { gameCoordToLatLng, gameCoordToLatLngForMap } from './mapCoordinates.js'
import erangelSpawns from '../data/erangel_vehicle_boat_spawns.json'
import miramarBoatSpawns from '../data/miramar_boat_spawns.json'
import miramarVehicleSpawnsRaw from '../data/miramar_vehicle_spawns.json'
import rondoVehicleSpawnsRaw from '../data/rondo_vehicle_spawns.json'

export const ERANGEL_VEHICLE_POSITIONS = erangelSpawns.vehicleSpawns.map(p => gameCoordToLatLng(p.x, p.y))
export const ERANGEL_BOAT_POSITIONS    = erangelSpawns.boatSpawns.map(p => gameCoordToLatLng(p.x, p.y))
export const MIRAMAR_BOAT_POSITIONS    = miramarBoatSpawns.boatSpawns.map(p => gameCoordToLatLng(p.x, p.y))

/* Category names in the raw file that represent an actual ground
   vehicle spawn — see the file-header comment above for how each
   category was classified. */
const MIRAMAR_GROUND_VEHICLE_CATEGORIES = new Set([
  'Road', 'Offroad', 'Esports1', 'Esports2', 'Hacienda_GoldMirado',
])
export const MIRAMAR_VEHICLE_POSITIONS = miramarVehicleSpawnsRaw.spawns
  .filter(s => (s.categories || []).some(c => MIRAMAR_GROUND_VEHICLE_CATEGORIES.has(c)))
  .map(s => gameCoordToLatLng(s.x, s.y))

export const RONDO_VEHICLE_POSITIONS = rondoVehicleSpawnsRaw
  .map(p => gameCoordToLatLngForMap('rondo', p.x, p.y))

/* mapId -> { vehicle: [...]|null, boat: [...]|null } — null means
   no verified data, never an empty array standing in for "none
   placed yet" (which would be indistinguishable from "unavailable"
   in the UI). */
export const SPAWN_REFERENCE = {
  erangel: { vehicle: ERANGEL_VEHICLE_POSITIONS, boat: ERANGEL_BOAT_POSITIONS },
  miramar: { vehicle: MIRAMAR_VEHICLE_POSITIONS, boat: MIRAMAR_BOAT_POSITIONS },
  rondo:   { vehicle: RONDO_VEHICLE_POSITIONS, boat: null },
}

export function getSpawnReference(mapId, kind) {
  return SPAWN_REFERENCE[mapId]?.[kind] ?? null
}
