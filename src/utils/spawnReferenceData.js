/* ============================================================
   VERIFIED SPAWN REFERENCE DATA — shared between View Map's
   Vehicle/Boat layers and Strategy Maker's reference overlay.
   ------------------------------------------------------------
   Extracted so both consumers compute these once from the same
   source instead of each maintaining their own copy. Every value
   here is real, empirically-verified data (see mapCoordinates.js
   for how the conversion formula was derived and checked against
   each map's actual tiles) — nothing here is a placeholder.

   Only Erangel (vehicle + boat) and Miramar (boat) have verified
   datasets. Miramar vehicle and all Rondo spawn data do NOT —
   every file received so far under those labels turned out to be
   a duplicate of Erangel's vehicle list, and was rejected rather
   than wired in. Consumers must show an explicit "data
   unavailable" state for those instead of falling back to
   Erangel's coordinates.
   ============================================================ */
import { gameCoordToLatLng } from './mapCoordinates.js'
import erangelSpawns from '../data/erangel_vehicle_boat_spawns.json'
import miramarSpawns from '../data/miramar_boat_spawns.json'

export const ERANGEL_VEHICLE_POSITIONS = erangelSpawns.vehicleSpawns.map(p => gameCoordToLatLng(p.x, p.y))
export const ERANGEL_BOAT_POSITIONS    = erangelSpawns.boatSpawns.map(p => gameCoordToLatLng(p.x, p.y))
export const MIRAMAR_BOAT_POSITIONS    = miramarSpawns.boatSpawns.map(p => gameCoordToLatLng(p.x, p.y))

/* mapId -> { vehicle: [...]|null, boat: [...]|null } — null means
   no verified data, never an empty array standing in for "none
   placed yet" (which would be indistinguishable from "unavailable"
   in the UI). */
export const SPAWN_REFERENCE = {
  erangel: { vehicle: ERANGEL_VEHICLE_POSITIONS, boat: ERANGEL_BOAT_POSITIONS },
  miramar: { vehicle: null, boat: MIRAMAR_BOAT_POSITIONS },
  rondo:   { vehicle: null, boat: null },
}

export function getSpawnReference(mapId, kind) {
  return SPAWN_REFERENCE[mapId]?.[kind] ?? null
}
