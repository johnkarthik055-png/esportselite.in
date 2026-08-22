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

   Rondo was verified the same way once a genuine (non-duplicate)
   Rondo dataset arrived: rondo_vehicle_spawns.json's 402 points were
   first checked byte-for-byte against Erangel's and Miramar's vehicle
   AND boat coordinates (zero matches, unlike the two earlier "Rondo"
   files that turned out to be Erangel's data relabeled) — genuinely
   new data.

   Deriving its constant did NOT start from an assumption. Rondo is a
   3x3km map versus Erangel/Miramar's 8x8km, so a naively "proportional"
   guess would suggest a much smaller GAME_SIZE — but the raw x/y values
   in the file already span up to ~795,000 units, close to Erangel's
   816,000 ceiling, which rules out a small constant immediately (a
   smaller GAME_SIZE would push those points off the 0..WORLD_SIZE
   canvas entirely). Plotting the full point set against
   public/tiles/Rondo/3/0/0.png (confirmed via sharp to be the same
   256x256 single full-map tile layout as Erangel/Miramar) at several
   candidate constants (800000 / 816000 / 830000), cross-checked at
   both Y-flip and no-flip orientation, showed:
     - 816000 traces every road far more tightly than 800000 or 830000
       (both show visible cumulative drift for points far from the
       origin corner) — so Rondo reuses the exact same 816000 engine
       constant as Erangel/Miramar, not a scaled-down one. The map's
       smaller physical footprint apparently just occupies a smaller
       region of the same fixed engine coordinate space, rather than
       using a rescaled unit system of its own.
     - Y-flip is WRONG for this file — dots sit visibly off every road.
       No-flip (raw y used directly as top-down image-row, without the
       WORLD_SIZE - ... inversion Erangel/Miramar's telemetry needs) is
       the one where every dot lands exactly on the road centerline.
       This dataset's y-axis convention is the opposite of Erangel's
       and Miramar's raw telemetry — likely extracted by a different
       tool/pipeline than those two files were.
   ============================================================ */

export const MAP_WORLD_SIZE = 256

/* Erangel, Miramar, and Rondo's raw coordinate space all use the same
   816000 x 816000 engine-unit constant — empirically verified for
   each map individually (see above), not assumed to carry over. Keyed
   by map id so callers can look up the right constant without an
   if/else chain. */
export const GAME_WORLD_SIZE = 816000
export const GAME_WORLD_SIZE_BY_MAP = {
  erangel: GAME_WORLD_SIZE,
  miramar: GAME_WORLD_SIZE,
  rondo:   GAME_WORLD_SIZE,
}

/* Whether a map's raw y needs the WORLD_SIZE-flip to land in Leaflet's
   top-down lat space (see gameCoordToLatLng). Erangel and Miramar's
   telemetry both do; Rondo's dataset — verified above — does not. */
export const Y_FLIP_BY_MAP = {
  erangel: true,
  miramar: true,
  rondo:   false,
}

/**
 * Convert a raw in-game world coordinate into this app's Leaflet
 * [lat, lng] space (0..MAP_WORLD_SIZE), matching how every other
 * pin on the map (Compound, Hot Drop, etc.) is positioned.
 */
export function gameCoordToLatLng(x, y, gameSize = GAME_WORLD_SIZE, worldSize = MAP_WORLD_SIZE, flipY = true) {
  const lng = (x / gameSize) * worldSize
  const lat = flipY ? worldSize - (y / gameSize) * worldSize : (y / gameSize) * worldSize
  return [lat, lng]
}

/**
 * Same conversion, looked up per map id instead of passing the game
 * size / flip flag by hand at every call site — the single place new
 * maps plug into once their own constant is derived and verified.
 */
export function gameCoordToLatLngForMap(mapId, x, y) {
  const gameSize = GAME_WORLD_SIZE_BY_MAP[mapId] ?? GAME_WORLD_SIZE
  const flipY = Y_FLIP_BY_MAP[mapId] ?? true
  return gameCoordToLatLng(x, y, gameSize, MAP_WORLD_SIZE, flipY)
}
