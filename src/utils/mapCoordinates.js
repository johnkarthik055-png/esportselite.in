/* ============================================================
   RAW GAME-WORLD COORDINATE CONVERSION
   ------------------------------------------------------------
   PUBG/BGMI stores in-world positions (vehicle spawns, boat
   spawns, telemetry, etc.) as raw engine units on a square
   0..GAME_SIZE plane per map, with X increasing east (right)
   and Y increasing south (down) — the same top-down orientation
   as a standard image, not a north-up lat/lng system.

   MapKnowledge.jsx renders every map on a Leaflet L.CRS.Simple
   canvas sized 0..WORLD_SIZE, using a custom Transformation of
   (1, 0, -1, WORLD_SIZE) so that "lat" behaves like an inverted
   image-Y: lat=WORLD_SIZE is the TOP of the map, lat=0 is the
   BOTTOM (see the transformation comment in MapKnowledge.jsx).

   Converting a raw game coordinate into that space is therefore
   a straight linear scale on X, plus a flip-and-scale on Y:
     lng = (x / GAME_SIZE) * WORLD_SIZE
     lat = WORLD_SIZE - (y / GAME_SIZE) * WORLD_SIZE

   This was verified empirically, not assumed: plotting every
   point in erangel_vehicle_boat_spawns.json through this exact
   formula and overlaying the result on both the map's own
   zoom-3 tile (public/tiles/Erangel/3/0/0.png, the single tile
   that covers the whole map) and the reference thumbnail
   (public/assets/Maps/erangel.png) shows every vehicle spawn
   sitting exactly on a road and every boat spawn hugging the
   coastline — confirming both the axis orientation and the
   816000-unit game-world size below.

   Miramar was verified the same way (overlaid every point in
   miramar_boat_spawns.json against public/tiles/Miramar/3/0/0.png):
   the identical formula and 816000 constant put every boat spawn
   exactly on the coastline, so it reuses GAME_WORLD_SIZE unchanged
   rather than needing its own constant.

   Rondo has NOT been verified or wired in. A "Rondo vehicle spawns"
   file was provided but its x/y values are byte-identical to
   erangel_vehicle_boat_spawns.json's vehicleSpawns (just with a z
   field added) — i.e. not real Rondo data, so there is nothing
   correct to derive a constant from yet. When genuine Rondo data
   arrives, derive and verify its constant the same way (Rondo is a
   3x3km map, so GAME_WORLD_SIZE is very unlikely to apply as-is)
   before adding a Rondo entry here.
   ============================================================ */

export const MAP_WORLD_SIZE = 256

/* Erangel and Miramar's raw playable area is 816000 x 816000 engine
   units — both empirically verified (see above). Keyed by map id so
   callers can look up the right constant without an if/else chain;
   add 'rondo' here once real Rondo data lets us derive and verify
   its own constant. */
export const GAME_WORLD_SIZE = 816000
export const GAME_WORLD_SIZE_BY_MAP = {
  erangel: GAME_WORLD_SIZE,
  miramar: GAME_WORLD_SIZE,
}

/**
 * Convert a raw in-game world coordinate into this app's Leaflet
 * [lat, lng] space (0..MAP_WORLD_SIZE), matching how every other
 * pin on the map (Compound, Hot Drop, etc.) is positioned.
 */
export function gameCoordToLatLng(x, y, gameSize = GAME_WORLD_SIZE, worldSize = MAP_WORLD_SIZE) {
  const lng = (x / gameSize) * worldSize
  const lat = worldSize - (y / gameSize) * worldSize
  return [lat, lng]
}
