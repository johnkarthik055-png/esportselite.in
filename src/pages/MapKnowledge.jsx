/*
 * ADD TO FIRESTORE RULES:
 *
 * match /mapData/{mapId}/{collection}/{doc} {
 *   allow read: if request.auth != null;
 *   allow write: if request.auth != null &&
 *     request.auth.token.email in [
 *       'karthikreddyy2010@gmail.com',
 *       'johnkarthik055@gmail.com'
 *     ];
 * }
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, Component } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import {
  MapContainer, TileLayer, Marker, Popup,
  useMap, useMapEvents, Circle, Polygon, Polyline,
} from 'react-leaflet'
import {
  addDoc, collection, deleteDoc, doc, getDocs,
  onSnapshot, orderBy, query, serverTimestamp, updateDoc,
  where, writeBatch,
} from 'firebase/firestore'
import {
  X, MapPin, MousePointer2, ArrowUpRight, Circle as CircleIcon,
  Eraser, Save, Trash2, Search, Plus, Minus, ChevronDown,
  Loader2, PencilLine, Info, Edit, ArrowRight, Shield,
} from 'lucide-react'
import { db } from '../utils/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'

/* ============================================================
   LEAFLET DEFAULT ICON FIX
   Vite doesn't resolve the relative paths inside Leaflet's CSS
   for the default marker icon, so we point them at the CDN copy.
   Only affects fallback markers — our custom DivIcons render
   independently.
   ============================================================ */
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

/* ============================================================
   CONSTANTS
   ============================================================ */
const ADMIN_EMAILS = [
  'karthikreddyy2010@gmail.com',
  'johnkarthik055@gmail.com',
]

/* World bounds fixed at 0..WORLD_SIZE so pin data (all our seed +
   bulk-import coordinates, which live in a 0..256 range) always
   lands inside the visible area. Tile alignment is handled
   separately via TILE_ZOOM_OFFSET.

   How the tile pyramid maps:
     - stacta.json says the source is SOURCE_SIZE (8192) pixels
       square, sliced into 256-px tiles at URL zoom 8 (32x32
       tiles per side).
     - gdal2tiles keeps URL zooms 0..3 all as a single 1x1 tile
       (the whole world downsampled), then doubles from URL 4 on.
     - With WORLD_SIZE = 256 world units and default Leaflet
       scale 2^Z, Leaflet needs 2^Z tiles per side at zoom Z. So
       Leaflet zoom N should request URL zoom N + TILE_ZOOM_OFFSET
       (3), which gives 1x1 tile at Leaflet zoom 0 (URL 3), 2x2 at
       1, ..., 32x32 at 5 (URL 8). Above Leaflet zoom 5 we upscale
       the URL-8 tiles via maxNativeZoom. */
const SOURCE_SIZE      = 8192
const TILE_SIZE        = 256
const WORLD_SIZE       = 256
const TILE_ZOOM_OFFSET = 3
const MAX_NATIVE_ZOOM  = 5     /* Leaflet zoom (URL zoom = 8 with offset) */
const BOUNDS           = [[0, 0], [WORLD_SIZE, WORLD_SIZE]]
const CENTER           = [WORLD_SIZE / 2, WORLD_SIZE / 2]
const MIN_ZOOM         = 0
const MAX_ZOOM         = 8     /* Leaflet zoom (5 native + 3 upscaled) */
const LABEL_ZOOM       = 2     /* compound labels start showing at this Leaflet zoom */
const DEFAULT_ZOOM     = 1

/* Default CRS.Simple ships with transformation (1, 0, -1, 0),
   which maps lat -> negative pixel-y. With center=[128, 128] and
   bounds [[0, 0], [256, 256]] that pushes every tile request
   into the negative Y half of the tile grid (e.g. /tiles/Erangel/2/2/-3.png).
   Overriding to (1, 0, -1, WORLD_SIZE) shifts the origin so
   lat 0..WORLD_SIZE lands in the positive tile grid: pixel-y =
   WORLD_SIZE - lat, so lat=WORLD_SIZE -> top row, lat=0 ->
   bottom row. Both the seed compound data and the bulk-import
   sample use lat/lng in the 0..256 range, so a pin at
   lat=113, lng=122 falls at the centre of the map. */
const MAP_CRS = L.extend({}, L.CRS.Simple, {
  transformation: new L.Transformation(1, 0, -1, WORLD_SIZE),
})

const MAPS = [
  { id: 'erangel', name: 'Erangel', tileFolder: 'Erangel', size: '8×8 km',
    description: 'Classic island map. Most popular in competitive BGMI.' },
  { id: 'miramar', name: 'Miramar', tileFolder: 'Miramar', size: '8×8 km',
    description: 'Desert map. Long range fights, sparse cover.' },
  { id: 'rondo',   name: 'Rondo',   tileFolder: 'Rondo',   size: '8×8 km',
    description: 'New map with unique terrain and urban areas.' },
]

const PIN_TYPES = {
  compound:   { label: 'Compound',   color: '#4A9EFF' },
  hotdrop:    { label: 'Hot Drop',   color: '#E8001C' },
  vehicle:    { label: 'Vehicle',    color: '#F59E0B' },
  boat:       { label: 'Boat',       color: '#00C9FF' },
  garage:     { label: 'Garage',     color: '#FF8C00' },
  hovercraft: { label: 'Hovercraft', color: '#A855F7' },
  recall:     { label: 'Recall',     color: '#00C96E' },
  zipline:    { label: 'Zipline',    color: '#4A9EFF' },
  rotation:   { label: 'Rotation',   color: '#E2E2EC' },
}

const DEFAULT_VISIBLE_LAYERS = ['compound', 'hotdrop']

const TIER_COLORS = {
  hot:    '#E8001C',
  medium: '#F59E0B',
  safe:   '#00C96E',
}

const STRATEGY_TYPES = [
  { key: 'drop',     label: 'Drop Zone' },
  { key: 'rotation', label: 'Rotation'  },
  { key: 'attack',   label: 'Attack'    },
  { key: 'defend',   label: 'Defend'    },
  { key: 'note',     label: 'Note'      },
]

const COLOR_PRESETS = [
  { key: 'red',    value: '#E8001C' },
  { key: 'blue',   value: '#4A9EFF' },
  { key: 'green',  value: '#00C96E' },
  { key: 'amber',  value: '#F59E0B' },
  { key: 'purple', value: '#A855F7' },
  { key: 'white',  value: '#E2E2EC' },
]

const POLYGON_TYPES = [
  { key: 'compound_boundary', label: 'Compound' },
  { key: 'zone',              label: 'Zone' },
  { key: 'restricted',        label: 'Restricted' },
  { key: 'rotation_path',     label: 'Rotation Path' },
]

/* Colour choices in the "Name this compound" modal. Kept separate
   from COLOR_PRESETS so the modal picker (5 options, white default)
   matches the mock even if the strategy-maker palette drifts. */
const MODAL_COLORS = [
  { key: 'white', value: '#FFFFFF' },
  { key: 'red',   value: '#E8001C' },
  { key: 'blue',  value: '#4A9EFF' },
  { key: 'green', value: '#00C96E' },
  { key: 'amber', value: '#F59E0B' },
]

/* ============================================================
   SEED DATA
   ------------------------------------------------------------
   Default compound seeding was removed intentionally. Admins
   populate every pin/polygon from the Dev Editor now, so the
   pin/polygon collections start empty and stay empty until
   someone deliberately writes to them.
   ============================================================ */

/* ============================================================
   FIRESTORE HELPERS
   ============================================================ */
const pinsCol       = (mapId) => collection(db, 'mapData', mapId, 'pins')
const polygonsCol   = (mapId) => collection(db, 'mapData', mapId, 'polygons')
const strategiesCol = (mapId) => collection(db, 'mapData', mapId, 'strategies')

async function addPin(mapId, data, uid) {
  return addDoc(pinsCol(mapId), {
    ...data,
    createdBy: uid || 'unknown',
    createdAt: serverTimestamp(),
  })
}
async function updatePin(mapId, pinId, data) {
  return updateDoc(doc(db, 'mapData', mapId, 'pins', pinId), data)
}
async function deletePin(mapId, pinId) {
  return deleteDoc(doc(db, 'mapData', mapId, 'pins', pinId))
}
async function addPolygon(mapId, data, uid) {
  return addDoc(polygonsCol(mapId), {
    ...data,
    createdBy: uid || 'unknown',
    createdAt: serverTimestamp(),
  })
}
async function updatePolygon(mapId, id, data) {
  return updateDoc(doc(db, 'mapData', mapId, 'polygons', id), data)
}
async function deletePolygon(mapId, id) {
  return deleteDoc(doc(db, 'mapData', mapId, 'polygons', id))
}
async function addStrategy(mapId, data, uid) {
  return addDoc(strategiesCol(mapId), {
    ...data,
    createdBy: uid || 'unknown',
    createdAt: serverTimestamp(),
  })
}
async function deleteStrategy(mapId, id) {
  return deleteDoc(doc(db, 'mapData', mapId, 'strategies', id))
}

/* ============================================================
   DIVICON FACTORIES
   ============================================================ */
function createPinIcon(type, tier) {
  const compoundColor =
    tier === 'hot'    ? '#E8001C' :
    tier === 'medium' ? '#F59E0B' :
                        '#00C96E'
  const colors = {
    compound:   compoundColor,
    vehicle:    '#F59E0B',
    boat:       '#00C9FF',
    garage:     '#FF8C00',
    hovercraft: '#A855F7',
    recall:     '#00C96E',
    hotdrop:    '#E8001C',
    zipline:    '#4A9EFF',
    rotation:   '#E2E2EC',
  }
  const color = colors[type] || '#8888A8'
  return L.divIcon({
    className: 'mk-pin-marker',
    html: `<div style="
      width: 12px;
      height: 12px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.6);
      cursor: pointer;
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8],
  })
}

function createLabelIcon(name) {
  const safe = String(name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return L.divIcon({
    className: 'mk-label-marker',
    html: `<div style="
      color: white;
      font-family: 'DM Sans', sans-serif;
      font-size: 11px;
      font-weight: 600;
      text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.9);
      white-space: nowrap;
      pointer-events: none;
      margin-top: 14px;
    ">${safe}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/* Compound-polygon labels use a heavier 4-way outline (PIVAGA
   style) instead of the softer text-shadow used by pin labels, so
   they stay legible against any tile at any zoom. The font size
   is passed in so the caller can grow/shrink it based on zoom. */
function createPolygonLabelIcon(name, fontSize) {
  const safe = String(name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return L.divIcon({
    className: 'mk-polygon-label',
    html: `<div style="
      color: white;
      font-family: 'DM Sans', sans-serif;
      font-size: ${fontSize}px;
      font-weight: 700;
      text-shadow:
        -1px -1px 0 #000,
         1px -1px 0 #000,
        -1px  1px 0 #000,
         1px  1px 0 #000;
      white-space: nowrap;
      pointer-events: none;
    ">${safe}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/* Font-size ladder for compound labels — smaller at low zoom so
   they don't overlap adjacent compounds, bigger at high zoom so
   they read as titles once you're inspecting a single area. */
function polygonLabelFontSize(zoom) {
  if (zoom >= 7) return 15
  if (zoom >= 5) return 13
  if (zoom >= 3) return 11
  return 9
}

function createVertexIcon() {
  return L.divIcon({
    className: 'mk-vertex-marker',
    html: `<div style="
      width: 8px; height: 8px;
      background: #FFFFFF;
      border: 2px solid rgba(0, 0, 0, 0.5);
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.7);
    "></div>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  })
}

/* ============================================================
   PAGE ROOT
   ============================================================ */
export default function MapKnowledge() {
  const { user } = useAuth()
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email)

  const [activeMapId, setActiveMapId] = useState('erangel')
  const [mode, setMode] = useState('view') /* 'view' | 'strategy' | 'dev' */
  const [selectedPin, setSelectedPin] = useState(null)
  const [visibleLayers, setVisibleLayers] = useState(new Set(DEFAULT_VISIBLE_LAYERS))
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [flyTarget, setFlyTarget] = useState(null)
  const [mousePos, setMousePos] = useState(null)

  const [pins, setPins] = useState([])
  const [polygons, setPolygons] = useState([])
  const [strategies, setStrategies] = useState([])

  const activeMap = MAPS.find(m => m.id === activeMapId) || MAPS[0]
  const tileUrl = `/tiles/${activeMap.tileFolder}/{z}/{x}/{y}.png`

  /* Real-time pins subscription + auto-seed on empty */
  useEffect(() => {
    const unsub = onSnapshot(pinsCol(activeMapId), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setPins(list)
      /* Extra debug so a bulk-import problem is visible in the
         console: log count + a sample pin's lat/lng so it's
         obvious whether the coordinates live inside BOUNDS
         (0..WORLD_SIZE) or have drifted. */
      // eslint-disable-next-line no-console
      console.log(
        '[MapKnowledge] pins loaded for', activeMapId,
        '→', list.length,
        list[0] ? `(sample: ${list[0].name || '?'} lat=${list[0].lat} lng=${list[0].lng})` : '',
      )
    }, (err) => {
      // eslint-disable-next-line no-console
      console.error('[MapKnowledge] pin snapshot error:', err)
    })
    return unsub
  }, [activeMapId])

  useEffect(() => {
    const unsub = onSnapshot(polygonsCol(activeMapId), (snap) => {
      setPolygons(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [activeMapId])

  useEffect(() => {
    if (!user?.uid) { setStrategies([]); return }
    const unsub = onSnapshot(
      query(strategiesCol(activeMapId), where('createdBy', '==', user.uid)),
      (snap) => setStrategies(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {
        /* If the where filter fails (rules), silently drop to empty. */
        setStrategies([])
      }
    )
    return unsub
  }, [activeMapId, user?.uid])

  const visiblePins = useMemo(
    () => pins.filter(p => visibleLayers.has(p.type)),
    [pins, visibleLayers]
  )

  function toggleLayer(key) {
    setVisibleLayers(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="mk-page">
      <div className="mk-header">
        <div style={{ display: 'flex', gap: 4 }}>
          {MAPS.map(m => (
            <TabButton
              key={m.id}
              active={activeMapId === m.id}
              onClick={() => { setActiveMapId(m.id); setSelectedPin(null) }}
            >
              {m.name}
            </TabButton>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <TabButton active={mode === 'view'} onClick={() => setMode('view')}>View Map</TabButton>
          <TabButton active={mode === 'strategy'} onClick={() => setMode('strategy')}>Strategy Maker</TabButton>
          {isAdmin && (
            <span className="mk-dev-tab" style={{ display: 'inline-flex' }}>
              <TabButton active={mode === 'dev'} onClick={() => setMode('dev')}>
                <Shield size={12} style={{ marginRight: 4 }} /> Dev Editor
              </TabButton>
            </span>
          )}
        </div>
      </div>

      <div className="mk-body">
        <div className="mk-map-col">
          <MapPanel
            activeMap={activeMap}
            tileUrl={tileUrl}
            pins={pins}
            visiblePins={visiblePins}
            polygons={polygons}
            zoom={zoom}
            onZoomChange={setZoom}
            selectedPin={selectedPin}
            onSelectPin={setSelectedPin}
            flyTarget={flyTarget}
            onFlyDone={() => setFlyTarget(null)}
            onMouseMove={setMousePos}
            mode={mode}
          />
        </div>

        <div className="mk-side-col">
          {mode === 'view' && (
            <ViewPanel
              activeMap={activeMap}
              pins={pins}
              visibleLayers={visibleLayers}
              onToggleLayer={toggleLayer}
              selectedPin={selectedPin}
              onSelectPin={setSelectedPin}
              onFlyTo={setFlyTarget}
              isAdmin={isAdmin}
              mapId={activeMapId}
            />
          )}
          {mode === 'strategy' && (
            <StrategyPanel
              mapId={activeMapId}
              strategies={strategies}
            />
          )}
          {mode === 'dev' && isAdmin && (
            <DevPanel
              mapId={activeMapId}
              pins={pins}
              polygons={polygons}
              mousePos={mousePos}
              user={user}
            />
          )}
        </div>
      </div>

      <MapStyles />
    </div>
  )
}

/* ============================================================
   HEADER — TAB BUTTON
   ============================================================ */
function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--red)' : 'var(--bg-elevated)',
        color: active ? '#fff' : 'var(--text-primary)',
        border: `1px solid ${active ? 'var(--red)' : 'var(--border)'}`,
        borderRadius: 6,
        padding: '7px 14px',
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        transition: 'all 0.15s ease',
      }}
    >
      {children}
    </button>
  )
}

/* ============================================================
   MAP PANEL — the Leaflet canvas
   ============================================================ */
function MapPanel({
  activeMap, tileUrl,
  pins, visiblePins, polygons,
  zoom, onZoomChange,
  selectedPin, onSelectPin,
  flyTarget, onFlyDone,
  onMouseMove, mode,
}) {
  const mapRef = useRef(null)

  /* Strategy Maker and Dev Editor push their own layers onto the
     canvas via context (children of MapContainer that we render
     via lookups). To keep interaction paths clean we let those
     panels drive drawings through window custom events. */

  const showLabels = zoom >= LABEL_ZOOM

  return (
    <div className="mk-canvas" style={{
      position: 'relative',
      /* zIndex here (any value, not just a high one) turns this
         into its own stacking context, so the custom zoom buttons'
         z-index below is contained locally and can never compete
         with page-level fixed overlays (nav drawers, modals) again. */
      zIndex: 0,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      height: '100%', width: '100%',
    }}>
      {/* key={activeMap.id} forces a full remount when the user
          switches maps so pan/zoom don't carry over from the last
          selection. Critically, `activeMap.id` is *only* touched
          when the map selector fires — pin/polygon Firestore saves
          update pins[] / polygons[] arrays via onSnapshot, which
          leaves activeMap.id untouched. That prevents the map
          from blanking after every save. */}
      <MapContainer
        key={activeMap.id}
        crs={MAP_CRS}
        center={CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        maxBounds={BOUNDS}
        maxBoundsViscosity={1.0}
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%', minHeight: 300 }}
        ref={mapRef}
      >
        {/* Tile URLs offset by TILE_ZOOM_OFFSET so Leaflet zoom N
            requests URL zoom N+3. That lines up with the on-disk
            pyramid (URL zoom 3 = 1x1 tile, URL zoom 8 = 32x32).
            maxNativeZoom in Leaflet space is 5 (URL 8); zooms
            above 5 upscale the URL-8 tiles in the browser.
            updateWhenIdle/Zooming false keeps the layer painting
            during pan/zoom so it never goes momentarily blank. */}
        <TileLayer
          url={`/tiles/${activeMap.tileFolder}/{z}/{x}/{y}.png`}
          tileSize={TILE_SIZE}
          noWrap
          bounds={BOUNDS}
          minZoom={0}
          maxZoom={MAX_ZOOM}
          maxNativeZoom={MAX_NATIVE_ZOOM}
          zoomOffset={TILE_ZOOM_OFFSET}
          keepBuffer={4}
          updateWhenIdle={false}
          updateWhenZooming={false}
          errorTileUrl=""
          attribution=""
        />

        <ZoomWatcher onZoomChange={onZoomChange} />
        <MouseWatcher onMove={onMouseMove} />
        <FlyToTarget target={flyTarget} onDone={onFlyDone} />
        <FitToContainer />

        {/* Compound + zone polygons (real-time from Firestore) */}
        {polygons.map(p => (
          <PolygonRender key={p.id} polygon={p} zoom={zoom} />
        ))}

        {/* Pins */}
        {visiblePins.map(pin => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={createPinIcon(pin.type, pin.tier)}
            eventHandlers={{
              click: () => onSelectPin(pin),
            }}
          >
            <Popup>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{pin.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                {PIN_TYPES[pin.type]?.label || pin.type}
                {pin.tier ? ` · ${pin.tier}` : ''}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Compound name labels — only compound pins get labels */}
        {showLabels && visiblePins.filter(p => p.type === 'compound').map(pin => (
          <Marker
            key={`lbl-${pin.id}`}
            position={[pin.lat, pin.lng]}
            icon={createLabelIcon(pin.name)}
            interactive={false}
          />
        ))}

        {/* Strategy Maker overlay */}
        {mode === 'strategy' && <StrategyDrawingLayer />}

        {/* Dev Editor overlay */}
        {mode === 'dev' && <DevDrawingLayer />}
      </MapContainer>

      {/* Custom zoom controls */}
      <div style={{
        position: 'absolute', top: 10, right: 10, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <ZoomBtn onClick={() => mapRef.current?.zoomIn()}><Plus size={14} /></ZoomBtn>
        <ZoomBtn onClick={() => mapRef.current?.zoomOut()}><Minus size={14} /></ZoomBtn>
      </div>
    </div>
  )
}

function ZoomBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32, height: 32,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        color: 'var(--text-primary)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}

/* ============================================================
   MAP SUB-COMPONENTS (hooks-only helpers)
   ============================================================ */
function ZoomWatcher({ onZoomChange }) {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  })
  useEffect(() => { onZoomChange(map.getZoom()) }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function MouseWatcher({ onMove }) {
  useMapEvents({
    mousemove: (e) => onMove({ lat: e.latlng.lat, lng: e.latlng.lng }),
    mouseout:  () => onMove(null),
  })
  return null
}

/* On mount, zoom the map so the square tile bounds fully COVER the
   container (no empty dark gaps on any side), rather than Leaflet's
   default fitBounds "contain" behaviour which can leave letterboxing
   when the container's aspect ratio isn't square — e.g. the desktop
   map column (wide) or the clamped mobile height (short). Excess
   content beyond the container edges is simply outside the viewport,
   same as object-fit: cover on an <img>. Only runs once per mount
   (map switch remounts via the `key={activeMap.id}` above) so it
   never yanks a user's manual pan/zoom back to center. Resize only
   calls invalidateSize() — required whenever a Leaflet container's
   box changes size — without forcing a re-fit. */
function FitToContainer() {
  const map = useMap()
  useLayoutEffect(() => {
    map.invalidateSize()
    const coverZoom = map.getBoundsZoom(BOUNDS, true)
    map.setView(CENTER, Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, coverZoom)), { animate: false })

    function onResize() { map.invalidateSize() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [map])
  return null
}

function FlyToTarget({ target, onDone }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 5), { duration: 0.6 })
    const t = setTimeout(() => onDone?.(), 800)
    return () => clearTimeout(t)
  }, [target, map, onDone])
  return null
}

/* Firestore rejects nested arrays, so polygon coordinates are stored
   as [{ lat, lng }, ...] rather than [[lat, lng], ...]. This helper
   normalises to Leaflet's [lat, lng] tuple format and tolerates
   either shape so anything written before the format change still
   renders. */
function toLatLngTuple(c) {
  if (Array.isArray(c) && c.length === 2) return c
  if (c && typeof c.lat === 'number' && typeof c.lng === 'number') return [c.lat, c.lng]
  return null
}

function PolygonRender({ polygon, zoom }) {
  const coords = (polygon.coordinates || [])
    .map(toLatLngTuple)
    .filter(Boolean)
  if (coords.length < 3) return null
  const centroid = coords.reduce(
    (acc, [la, ln]) => ({ lat: acc.lat + la, lng: acc.lng + ln }),
    { lat: 0, lng: 0 },
  )
  centroid.lat /= coords.length
  centroid.lng /= coords.length

  const fontSize = polygonLabelFontSize(Number(zoom) || 0)

  return (
    <>
      <Polygon
        positions={coords}
        pathOptions={{
          color: polygon.color || '#FFFFFF',
          fillColor: 'transparent',
          fillOpacity: 0,
          weight: 2,
          opacity: 0.85,
          dashArray: '6, 4',
        }}
      />
      {/* Compound labels render at every zoom — the font ladder
          in polygonLabelFontSize keeps them from stepping on each
          other at low zoom while staying prominent at high zoom. */}
      {polygon.name && (
        <Marker
          position={[centroid.lat, centroid.lng]}
          icon={createPolygonLabelIcon(polygon.name, fontSize)}
          interactive={false}
        />
      )}
    </>
  )
}

/* ============================================================
   VIEW MAP MODE — RIGHT PANEL
   ============================================================ */
function ViewPanel({
  activeMap, pins, visibleLayers, onToggleLayer,
  selectedPin, onSelectPin, onFlyTo, isAdmin, mapId,
}) {
  const [search, setSearch] = useState('')

  const counts = useMemo(() => {
    const c = {}
    for (const p of pins) c[p.type] = (c[p.type] || 0) + 1
    return c
  }, [pins])

  const results = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return pins
      .filter(p => (p.name || '').toLowerCase().includes(q))
      .slice(0, 10)
  }, [pins, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
      <SearchCard
        search={search}
        onSearch={setSearch}
        results={results}
        onPick={(p) => { onFlyTo({ lat: p.lat, lng: p.lng }); onSelectPin(p); setSearch('') }}
      />

      <LayersCard
        visibleLayers={visibleLayers}
        onToggleLayer={onToggleLayer}
        counts={counts}
      />

      {selectedPin ? (
        <PinDetailCard
          pin={selectedPin}
          onClose={() => onSelectPin(null)}
          isAdmin={isAdmin}
          mapId={mapId}
        />
      ) : (
        <MapInfoCard map={activeMap} pins={pins} />
      )}
    </div>
  )
}

function SearchCard({ search, onSearch, results, onPick }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-subtle)' }} />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search compounds…"
          style={{
            width: '100%',
            padding: '8px 10px 8px 32px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-primary)',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
          }}
        />
      </div>
      {results.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => onPick(r)}
              style={{
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                padding: '6px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ArrowRight size={12} style={{ color: 'var(--text-subtle)' }} />
              {r.name}
              {r.tier && (
                <span style={{ marginLeft: 'auto', color: TIER_COLORS[r.tier], fontSize: 11 }}>
                  {r.tier}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LayersCard({ visibleLayers, onToggleLayer, counts }) {
  return (
    <div className="card">
      <SectionLabel>Layers</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.entries(PIN_TYPES).map(([key, info]) => {
          const active = visibleLayers.has(key)
          const count = counts[key] || 0
          return (
            <button
              key={key}
              onClick={() => onToggleLayer(key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 8px',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 13,
                color: 'var(--text-primary)',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 16, height: 16,
                  background: active ? 'var(--red)' : 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 10, fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {active ? '✓' : ''}
              </span>
              <span
                aria-hidden
                style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: info.color, flexShrink: 0,
                }}
              />
              <span style={{ flex: 1 }}>{info.label}</span>
              <span style={{
                fontSize: 11,
                color: 'var(--text-subtle)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                padding: '1px 8px', borderRadius: 999,
              }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PinDetailCard({ pin, onClose, isAdmin, mapId }) {
  const [editing, setEditing] = useState(false)
  const info = PIN_TYPES[pin.type] || { label: 'Pin', color: '#8888A8' }
  const tierColor = pin.tier ? TIER_COLORS[pin.tier] : null
  const loot = Number(pin.loot) || 0

  async function handleDelete() {
    if (!window.confirm(`Delete pin "${pin.name}"?`)) return
    try {
      await deletePin(mapId, pin.id)
      onClose()
    } catch (e) { alert('Delete failed: ' + (e?.message || e)) }
  }

  if (editing) {
    return (
      <EditPinCard
        pin={pin}
        mapId={mapId}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false) }}
      />
    )
  }

  return (
    <div className="card mk-pin-detail" style={{ position: 'relative' }}>
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute', top: 10, right: 10,
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 6, color: 'var(--text-muted)',
          padding: 4, cursor: 'pointer', display: 'flex',
        }}
      >
        <X size={12} />
      </button>

      <span className="badge" style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${info.color}`,
        color: info.color,
      }}>
        {info.label}
      </span>

      <h3 style={{
        fontFamily: 'Bebas Neue, sans-serif',
        fontWeight: 400, fontSize: 22, letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--text-primary)', margin: '10px 0 6px',
      }}>
        {pin.name || 'Unnamed'}
      </h3>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {pin.tier && (
          <span className="badge" style={{
            background: 'var(--bg-elevated)',
            border: `1px solid ${tierColor}`,
            color: tierColor,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            fontSize: 11,
          }}>
            {pin.tier}
          </span>
        )}
        {loot > 0 && (
          <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <span key={i} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: i <= loot ? 'var(--gold)' : 'var(--border)',
              }} />
            ))}
          </span>
        )}
      </div>

      {pin.notes && (
        <p style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 13, lineHeight: 1.6,
          color: 'var(--text-muted)', margin: 0,
        }}>
          {pin.notes}
        </p>
      )}

      {isAdmin && (
        <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
          <button onClick={() => setEditing(true)} className="btn btn-secondary btn-sm">
            <Edit size={12} /> Edit
          </button>
          <button onClick={handleDelete} className="btn btn-secondary btn-sm">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

function EditPinCard({ pin, mapId, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:  pin.name || '',
    type:  pin.type || 'compound',
    tier:  pin.tier || 'medium',
    loot:  Number(pin.loot) || 3,
    notes: pin.notes || '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await updatePin(mapId, pin.id, form)
      onSaved()
    } catch (e) { alert('Save failed: ' + (e?.message || e)) }
    finally    { setSaving(false) }
  }

  return (
    <div className="card">
      <SectionLabel>Edit Pin</SectionLabel>
      <PinForm form={form} onChange={setForm} />
      <div style={{ display: 'flex', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
        <button onClick={save} disabled={saving} className="btn btn-primary btn-sm">
          {saving ? <><Loader2 size={12} className="animate-spin" /> Saving</> : <><Save size={12} /> Save</>}
        </button>
      </div>
    </div>
  )
}

function MapInfoCard({ map, pins }) {
  const counts = useMemo(() => {
    const c = {}
    for (const p of pins) c[p.type] = (c[p.type] || 0) + 1
    return c
  }, [pins])
  return (
    <div className="card">
      <SectionLabel>Map Info</SectionLabel>
      <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 20, letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
        {map.name}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{map.size}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
        {map.description}
      </div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {Object.entries(PIN_TYPES).slice(0, 6).map(([key, info]) => (
          <div key={key} style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 10px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: info.color }} />
            <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{info.label}</span>
            <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{counts[key] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   STRATEGY MAKER — drawing layer + right panel
   ============================================================
   The drawing state lives in module-scoped refs via window
   events so the canvas can inject Leaflet layers without
   prop-drilling the tool state through MapContainer's context. */
const strategyBus = new EventTarget()
const strategyState = {
  tool: 'select',      /* select | pin | arrow | zone | eraser */
  color: '#E8001C',
  pins: [],            /* [{ id, lat, lng, name, type, color }] */
  arrows: [],          /* [{ id, from:[lat,lng], to:[lat,lng], color, label }] */
  zones: [],           /* [{ id, center:[lat,lng], radius, color, label }] */
  drafting: null,      /* { kind: 'arrow' | 'zone', ... } */
}
function fireStrategy() {
  strategyBus.dispatchEvent(new Event('change'))
}

function useStrategyState() {
  const [, tick] = useState(0)
  useEffect(() => {
    function onChange() { tick(v => v + 1) }
    strategyBus.addEventListener('change', onChange)
    return () => strategyBus.removeEventListener('change', onChange)
  }, [])
  return strategyState
}

function StrategyDrawingLayer() {
  const st = useStrategyState()
  const [pendingPin, setPendingPin] = useState(null)

  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng
      if (st.tool === 'pin') {
        setPendingPin({ lat, lng, name: '', type: 'drop', color: st.color })
      } else if (st.tool === 'arrow') {
        if (!st.drafting) {
          st.drafting = { kind: 'arrow', from: [lat, lng], to: [lat, lng] }
          fireStrategy()
        } else if (st.drafting.kind === 'arrow') {
          st.arrows = [...st.arrows, { id: uid(), from: st.drafting.from, to: [lat, lng], color: st.color, label: '' }]
          st.drafting = null
          fireStrategy()
        }
      } else if (st.tool === 'zone') {
        if (!st.drafting) {
          st.drafting = { kind: 'zone', center: [lat, lng], radius: 0 }
          fireStrategy()
        } else if (st.drafting.kind === 'zone') {
          const dx = lat - st.drafting.center[0]
          const dy = lng - st.drafting.center[1]
          const r = Math.max(2, Math.hypot(dx, dy))
          st.zones = [...st.zones, { id: uid(), center: st.drafting.center, radius: r, color: st.color, label: '' }]
          st.drafting = null
          fireStrategy()
        }
      } else if (st.tool === 'eraser') {
        if (st.pins.length)        st.pins   = st.pins.slice(0, -1)
        else if (st.arrows.length) st.arrows = st.arrows.slice(0, -1)
        else if (st.zones.length)  st.zones  = st.zones.slice(0, -1)
        fireStrategy()
      }
    },
    mousemove: (e) => {
      if (!st.drafting) return
      const { lat, lng } = e.latlng
      if (st.drafting.kind === 'arrow') {
        st.drafting = { ...st.drafting, to: [lat, lng] }
        fireStrategy()
      } else if (st.drafting.kind === 'zone') {
        const dx = lat - st.drafting.center[0]
        const dy = lng - st.drafting.center[1]
        st.drafting = { ...st.drafting, radius: Math.max(2, Math.hypot(dx, dy)) }
        fireStrategy()
      }
    },
  })

  function commitPin() {
    if (!pendingPin?.name?.trim()) { setPendingPin(null); return }
    st.pins = [...st.pins, {
      id: uid(),
      lat: pendingPin.lat, lng: pendingPin.lng,
      name: pendingPin.name.trim(),
      type: pendingPin.type,
      color: pendingPin.color,
    }]
    setPendingPin(null)
    fireStrategy()
  }

  return (
    <>
      {st.zones.map(z => (
        <Circle key={z.id} center={z.center} radius={z.radius}
          pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.2, weight: 2 }} />
      ))}
      {st.drafting?.kind === 'zone' && (
        <Circle center={st.drafting.center} radius={st.drafting.radius}
          pathOptions={{ color: '#4A9EFF', fillColor: '#4A9EFF', fillOpacity: 0.15, weight: 1, dashArray: '4 4' }} />
      )}

      {st.arrows.map(a => (
        <Polyline key={a.id} positions={[a.from, a.to]}
          pathOptions={{ color: a.color, weight: 3, opacity: 0.8 }} />
      ))}
      {st.drafting?.kind === 'arrow' && (
        <Polyline positions={[st.drafting.from, st.drafting.to]}
          pathOptions={{ color: '#ffffff', weight: 2, opacity: 0.5, dashArray: '4 4' }} />
      )}

      {st.pins.map(p => (
        <Marker key={p.id} position={[p.lat, p.lng]}
          icon={L.divIcon({
            className: 'mk-strat-pin',
            html: `<div style="
              width:14px; height:14px; background:${p.color};
              border:2px solid #fff; border-radius:50%;
              box-shadow:0 1px 3px rgba(0,0,0,0.6);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          })}
        >
          <Popup>{p.name}</Popup>
        </Marker>
      ))}

      {pendingPin && (
        <StrategyPinFormPopup
          pin={pendingPin}
          onChange={setPendingPin}
          onCancel={() => setPendingPin(null)}
          onSave={commitPin}
        />
      )}
    </>
  )
}

function StrategyPinFormPopup({ pin, onChange, onCancel, onSave }) {
  return (
    <Popup
      position={[pin.lat, pin.lng]}
      eventHandlers={{ remove: onCancel }}
      autoClose={false}
      closeOnClick={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
        <input
          autoFocus
          value={pin.name}
          placeholder="Name"
          onChange={(e) => onChange({ ...pin, name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
          style={inputStyle}
        />
        <select
          value={pin.type}
          onChange={(e) => onChange({ ...pin, type: e.target.value })}
          style={inputStyle}
        >
          {STRATEGY_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {COLOR_PRESETS.slice(0, 5).map(c => (
            <button
              key={c.key}
              onClick={() => onChange({ ...pin, color: c.value })}
              style={{
                width: 18, height: 18, borderRadius: '50%',
                background: c.value,
                border: `2px solid ${pin.color === c.value ? '#fff' : 'transparent'}`,
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className="btn btn-secondary btn-sm">Cancel</button>
          <button onClick={onSave} className="btn btn-primary btn-sm">Save</button>
        </div>
      </div>
    </Popup>
  )
}

function StrategyPanel({ mapId, strategies }) {
  const st = useStrategyState()
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)

  function setTool(t) { st.tool = t; st.drafting = null; fireStrategy() }
  function setColor(c) { st.color = c; fireStrategy() }
  function clearAll() {
    if (!window.confirm('Clear all drawings?')) return
    st.pins = []; st.arrows = []; st.zones = []; st.drafting = null
    fireStrategy()
  }

  async function saveStrategy() {
    if (!user?.uid)     { alert('Sign in to save strategies.'); return }
    if (!name.trim())   { alert('Give this strategy a name first.'); return }
    setSaving(true)
    try {
      await addStrategy(mapId, {
        name: name.trim(),
        description: desc.trim(),
        pins: st.pins,
        arrows: st.arrows,
        zones: st.zones,
        isPublic: false,
      }, user.uid)
      setName(''); setDesc('')
      alert('Strategy saved.')
    } catch (e) { alert('Save failed: ' + (e?.message || e)) }
    finally    { setSaving(false) }
  }

  function loadStrategy(s) {
    st.pins = s.pins || []
    st.arrows = s.arrows || []
    st.zones = s.zones || []
    st.drafting = null
    fireStrategy()
  }

  async function removeStrategy(s) {
    if (!window.confirm(`Delete strategy "${s.name}"?`)) return
    try { await deleteStrategy(mapId, s.id) }
    catch (e) { alert('Delete failed: ' + (e?.message || e)) }
  }

  const tools = [
    { key: 'select', icon: <MousePointer2 size={13} />,  label: 'Select' },
    { key: 'pin',    icon: <MapPin size={13} />,        label: 'Pin' },
    { key: 'arrow',  icon: <ArrowUpRight size={13} />,  label: 'Arrow' },
    { key: 'zone',   icon: <CircleIcon size={13} />,    label: 'Zone' },
    { key: 'eraser', icon: <Eraser size={13} />,        label: 'Eraser' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
      <div className="card">
        <SectionLabel>Tools</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {tools.map(t => (
            <button
              key={t.key}
              onClick={() => setTool(t.key)}
              className="btn btn-sm"
              style={{
                background: st.tool === t.key ? 'var(--red)' : 'var(--bg-elevated)',
                border: `1px solid ${st.tool === t.key ? 'var(--red)' : 'var(--border)'}`,
                color: st.tool === t.key ? '#fff' : 'var(--text-primary)',
                justifyContent: 'flex-start',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 10 }}>
          <SectionLabel small>Color</SectionLabel>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COLOR_PRESETS.map(c => (
              <button
                key={c.key}
                onClick={() => setColor(c.value)}
                aria-label={c.key}
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: c.value,
                  border: `2px solid ${st.color === c.value ? '#fff' : 'transparent'}`,
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>

        <button onClick={clearAll} className="btn btn-secondary btn-sm" style={{ marginTop: 12, width: '100%' }}>
          <Trash2 size={12} /> Clear All
        </button>
      </div>

      <div className="card">
        <SectionLabel>Save Strategy</SectionLabel>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Strategy name"
          style={inputStyle}
        />
        <textarea
          value={desc} onChange={(e) => setDesc(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          style={{ ...inputStyle, marginTop: 6, resize: 'vertical' }}
        />
        <button
          onClick={saveStrategy}
          disabled={saving}
          className="btn btn-primary btn-sm"
          style={{ marginTop: 8, width: '100%' }}
        >
          {saving ? <><Loader2 size={12} className="animate-spin" /> Saving</> : <><Save size={12} /> Save Strategy</>}
        </button>
      </div>

      <div className="card">
        <SectionLabel>My Strategies</SectionLabel>
        {strategies.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
            No saved strategies yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {strategies.map(s => (
              <div key={s.id} style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '8px 10px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </div>
                  {s.description && (
                    <div style={{ fontSize: 11, color: 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.description}
                    </div>
                  )}
                </div>
                <button onClick={() => loadStrategy(s)} className="btn btn-secondary btn-sm">Load</button>
                <button onClick={() => removeStrategy(s)} className="btn btn-secondary btn-sm">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ background: 'var(--bg-elevated)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Info size={14} style={{ color: 'var(--text-subtle)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <strong>Pin:</strong> Click once. Fill form.<br />
            <strong>Arrow:</strong> Click start, then end.<br />
            <strong>Zone:</strong> Click centre, then edge.<br />
            <strong>Eraser:</strong> Removes last item.
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   DEV EDITOR — drawing layer + right panel
   ============================================================ */
const devBus = new EventTarget()
const devState = {
  mode: 'idle',              /* 'idle' | 'placePin' | 'drawPolygon' */
  polygonVerts: [],          /* [[lat, lng], ...] currently being drawn */
  pendingPinAt: null,        /* {lat, lng} */
  pendingPolygonForm: null,  /* opens after Close Polygon */
}
function fireDev() { devBus.dispatchEvent(new Event('change')) }
function useDevState() {
  const [, tick] = useState(0)
  useEffect(() => {
    function onChange() { tick(v => v + 1) }
    devBus.addEventListener('change', onChange)
    return () => devBus.removeEventListener('change', onChange)
  }, [])
  return devState
}

function DevDrawingLayer() {
  const st = useDevState()

  useMapEvents({
    click: (e) => {
      const pt = [e.latlng.lat, e.latlng.lng]
      if (st.mode === 'placePin') {
        st.pendingPinAt = { lat: pt[0], lng: pt[1] }
        fireDev()
      } else if (st.mode === 'drawPolygon') {
        st.polygonVerts = [...st.polygonVerts, pt]
        fireDev()
      }
    },
    dblclick: () => {
      if (st.mode === 'drawPolygon' && st.polygonVerts.length >= 3) {
        st.pendingPolygonForm = { coordinates: st.polygonVerts }
        st.polygonVerts = []
        st.mode = 'idle'
        fireDev()
      }
    },
  })

  return (
    <>
      {st.polygonVerts.length > 1 && (
        <Polyline positions={[...st.polygonVerts, st.polygonVerts[0]]}
          pathOptions={{ color: '#FFFFFF', weight: 2, dashArray: '6, 4', opacity: 0.9 }} />
      )}
      {st.polygonVerts.map((v, i) => (
        <Marker key={i} position={v} icon={createVertexIcon()} interactive={false} />
      ))}
    </>
  )
}

function DevPanel({ mapId, pins, polygons, mousePos, user }) {
  const st = useDevState()
  const [pinForm, setPinForm] = useState({
    name: '', type: 'compound', tier: 'medium', loot: 3, notes: '',
  })
  const [polyForm, setPolyForm] = useState({
    name: '', type: 'compound_boundary',
    color: '#FFFFFF', fillOpacity: 0, notes: '',
  })
  const [pinSearch, setPinSearch] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [savingPin, setSavingPin] = useState(false)
  const [savingPoly, setSavingPoly] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [openPoly, setOpenPoly] = useState(false)
  const [openBulk, setOpenBulk] = useState(false)
  const [openManagePins, setOpenManagePins] = useState(false)
  const [openManagePolys, setOpenManagePolys] = useState(false)
  const [editingPolyId, setEditingPolyId] = useState(null)

  /* When a pending pin position was set from the map click, save it. */
  async function commitPendingPin() {
    if (!st.pendingPinAt) return
    if (!pinForm.name.trim()) { alert('Enter a name for the pin.'); return }
    setSavingPin(true)
    try {
      await addPin(mapId, {
        ...pinForm,
        name: pinForm.name.trim(),
        lat: st.pendingPinAt.lat,
        lng: st.pendingPinAt.lng,
      }, user?.uid)
      st.pendingPinAt = null
      st.mode = 'idle'
      fireDev()
      setPinForm({ name: '', type: 'compound', tier: 'medium', loot: 3, notes: '' })
    } catch (e) { alert('Save failed: ' + (e?.message || e)) }
    finally    { setSavingPin(false) }
  }

  function armPinPlacement() { st.mode = 'placePin'; fireDev() }
  function startPolygon()     { st.mode = 'drawPolygon'; st.polygonVerts = []; fireDev() }
  function undoLastVert()     {
    if (st.polygonVerts.length) { st.polygonVerts = st.polygonVerts.slice(0, -1); fireDev() }
  }
  function closePolygon() {
    if (st.polygonVerts.length < 3) { alert('At least 3 vertices required.'); return }
    st.pendingPolygonForm = { coordinates: st.polygonVerts }
    st.polygonVerts = []; st.mode = 'idle'
    fireDev()
  }
  function cancelPolygon() {
    st.polygonVerts = []; st.mode = 'idle'; fireDev()
  }

  async function commitPolygon() {
    const coords = editingPolyId
      ? polyForm.coordinates
      : st.pendingPolygonForm?.coordinates
    if (!coords || coords.length < 3) { alert('Polygon has no vertices.'); return }
    if (!polyForm.name.trim()) { alert('Enter a compound name.'); return }
    /* Firestore does not accept nested arrays, so convert
       [[lat, lng], ...] into [{ lat, lng }, ...] on the way in.
       PolygonRender / editPolygon convert back to tuples on read. */
    const firestoreCoords = coords.map(v =>
      Array.isArray(v)
        ? { lat: v[0], lng: v[1] }
        : { lat: v.lat, lng: v.lng }
    )
    setSavingPoly(true)
    try {
      if (editingPolyId) {
        await updatePolygon(mapId, editingPolyId, {
          name:  polyForm.name.trim(),
          type:  polyForm.type,
          color: polyForm.color,
          fillOpacity: 0,
          notes: polyForm.notes,
          coordinates: firestoreCoords,
        })
        setEditingPolyId(null)
      } else {
        await addPolygon(mapId, {
          name:  polyForm.name.trim(),
          type:  polyForm.type,
          color: polyForm.color,
          fillOpacity: 0,
          notes: polyForm.notes,
          coordinates: firestoreCoords,
        }, user?.uid)
        st.pendingPolygonForm = null
        fireDev()
      }
      setPolyForm({ name: '', type: 'compound_boundary', color: '#FFFFFF', fillOpacity: 0, notes: '' })
      /* Explicit close so the modal disappears the instant the
         Firestore write resolves, no matter how the sync effect
         schedules. mode stays 'dev', panel stays fully mounted. */
      setShowSaveModal(false)
    } catch (e) { alert('Save failed: ' + (e?.message || e)) }
    finally    { setSavingPoly(false) }
  }

  function editPolygon(p) {
    setEditingPolyId(p.id)
    setPolyForm({
      name: p.name || '',
      type: p.type || 'compound_boundary',
      color: p.color || '#FFFFFF',
      fillOpacity: 0,
      notes: p.notes || '',
      /* Firestore stores {lat, lng} objects — convert back to
         Leaflet [lat, lng] tuples for the drawing state. */
      coordinates: (p.coordinates || [])
        .map(c => Array.isArray(c) ? c : [c.lat, c.lng]),
    })
  }

  async function removePolygon(p) {
    if (!window.confirm(`Delete polygon "${p.name}"?`)) return
    try { await deletePolygon(mapId, p.id) }
    catch (e) { alert('Delete failed: ' + (e?.message || e)) }
  }

  async function importBulk() {
    let arr
    try { arr = JSON.parse(bulkText) }
    catch { alert('Invalid JSON.'); return }
    if (!Array.isArray(arr)) { alert('Expected a JSON array.'); return }
    try {
      const batch = writeBatch(db)
      for (const p of arr) {
        const ref = doc(pinsCol(mapId))
        batch.set(ref, {
          type:  p.type  || 'compound',
          name:  p.name  || '',
          lat:   Number(p.lat)  || 0,
          lng:   Number(p.lng)  || 0,
          tier:  p.tier  || null,
          loot:  p.loot != null ? Number(p.loot) : null,
          notes: p.notes || '',
          createdBy: user?.uid || 'unknown',
          createdAt: serverTimestamp(),
        })
      }
      await batch.commit()
      setBulkText('')
      alert(`Imported ${arr.length} pins.`)
    } catch (e) { alert('Import failed: ' + (e?.message || e)) }
  }

  /* Delete every pin on the currently-selected map. Firestore
     writeBatch caps at 500 ops per commit, so we chunk. Runs
     under the caller's admin session so it respects the same
     rules bulk-import already relies on. */
  async function deleteAllPinsOnMap() {
    const count = pins.length
    if (count === 0) { alert('No pins to delete on this map.'); return }
    if (!window.confirm(
      `Delete ALL ${count} pin${count === 1 ? '' : 's'} on ${mapId}?\n\nThis cannot be undone.`
    )) return
    setDeletingAll(true)
    try {
      const snap = await getDocs(pinsCol(mapId))
      const docs = snap.docs
      let removed = 0
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db)
        for (const d of docs.slice(i, i + 400)) batch.delete(d.ref)
        await batch.commit()
        removed += Math.min(400, docs.length - i)
      }
      alert(`Deleted ${removed} pin${removed === 1 ? '' : 's'} from ${mapId}.`)
    } catch (e) { alert('Delete failed: ' + (e?.message || e)) }
    finally    { setDeletingAll(false) }
  }

  const filteredPins = useMemo(() => {
    const q = pinSearch.trim().toLowerCase()
    if (!q) return pins
    return pins.filter(p => (p.name || '').toLowerCase().includes(q))
  }, [pins, pinSearch])

  /* Explicit React state for the "Name this compound" modal.
     Previously we derived visibility from `editingPolyId ||
     st.pendingPolygonForm`, which meant modal open/close was
     coupled to a module-scoped bag flushed through fireDev().
     If a later Firestore write or an unrelated re-render read
     st.pendingPolygonForm at the wrong tick the modal could
     linger while the surrounding panel had already refreshed —
     the "panel goes blank" symptom the user saw. Owning the flag
     as React state means the modal only opens when an action
     explicitly wants it and only closes when the save/discard
     path clears it. Everything else in DevPanel keeps rendering
     regardless of what this flag is. */
  const [showSaveModal, setShowSaveModal] = useState(false)
  const showingPolygonForm = showSaveModal

  /* Bidirectional sync between the drawing state bag and the React
     modal flag. Any devBus tick reads current st and mirrors it
     to showSaveModal — so DevDrawingLayer's dblclick opens the
     modal (st.pendingPolygonForm becomes truthy) AND a
     save/discard that clears st.pendingPolygonForm closes it.
     The editingPolyId dep also drives closes: setting it back to
     null from commitPolygon re-runs the effect, calls sync(),
     and flips the flag off. */
  useEffect(() => {
    function sync() {
      setShowSaveModal(!!(st.pendingPolygonForm || editingPolyId))
    }
    sync()
    devBus.addEventListener('change', sync)
    return () => devBus.removeEventListener('change', sync)
  }, [editingPolyId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
      {/* ADD PIN */}
      <div className="card">
        <SectionLabel>Add Pin</SectionLabel>
        {st.mode === 'placePin' && !st.pendingPinAt && (
          <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>
            Click on the map to place the pin.
          </div>
        )}
        <PinForm form={pinForm} onChange={setPinForm} />
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {!st.pendingPinAt ? (
            <button onClick={armPinPlacement} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
              <MapPin size={12} /> {st.mode === 'placePin' ? 'Waiting for click…' : 'Place Pin'}
            </button>
          ) : (
            <>
              <button onClick={commitPendingPin} disabled={savingPin} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                {savingPin ? <><Loader2 size={12} className="animate-spin" /> Saving</> : <><Save size={12} /> Save at {st.pendingPinAt.lat.toFixed(1)}, {st.pendingPinAt.lng.toFixed(1)}</>}
              </button>
              <button onClick={() => { st.pendingPinAt = null; st.mode = 'idle'; fireDev() }} className="btn btn-secondary btn-sm">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* DRAW COMPOUND */}
      <Collapsible title="Draw Compound / Polygon" open={openPoly} onToggle={() => setOpenPoly(!openPoly)}>
        {st.mode !== 'drawPolygon' && !showingPolygonForm && (
          <button onClick={startPolygon} className="btn btn-primary btn-sm" style={{ width: '100%' }}>
            <PencilLine size={12} /> Start Drawing Polygon
          </button>
        )}
        {st.mode === 'drawPolygon' && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>
              Click the map to add vertices. Double-click or press Close to finish.
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 8 }}>
              {st.polygonVerts.length} vertex/vertices placed.
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={undoLastVert} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>Undo</button>
              <button onClick={closePolygon} className="btn btn-primary btn-sm" style={{ flex: 1 }}>Close & Save</button>
              <button onClick={cancelPolygon} className="btn btn-secondary btn-sm">Cancel</button>
            </div>
          </div>
        )}
      </Collapsible>

      {/* MANAGE POLYGONS */}
      <Collapsible title={`Manage Polygons (${polygons.length})`} open={openManagePolys} onToggle={() => setOpenManagePolys(!openManagePolys)}>
        {polygons.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>No polygons yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {polygons.map(p => (
              <div key={p.id} style={rowStyle}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || '#4A9EFF', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || '(unnamed)'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{p.type}</div>
                </div>
                <button onClick={() => editPolygon(p)} className="btn btn-secondary btn-sm"><Edit size={11} /></button>
                <button onClick={() => removePolygon(p)} className="btn btn-secondary btn-sm"><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        )}
      </Collapsible>

      {/* MANAGE PINS */}
      <Collapsible title={`Manage Pins (${pins.length})`} open={openManagePins} onToggle={() => setOpenManagePins(!openManagePins)}>
        <input
          value={pinSearch}
          onChange={(e) => setPinSearch(e.target.value)}
          placeholder="Search pins…"
          style={inputStyle}
        />
        <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filteredPins.map(p => (
            <PinManageRow key={p.id} pin={p} mapId={mapId} />
          ))}
        </div>
      </Collapsible>

      {/* BULK IMPORT */}
      <Collapsible title="Bulk Import" open={openBulk} onToggle={() => setOpenBulk(!openBulk)}>
        <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 6 }}>
          JSON array: {'{'} name, type, lat, lng, tier, loot, notes {'}'}
        </div>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={5}
          placeholder='[{ "name": "…", "type": "compound", "lat": 128, "lng": 128, "tier": "hot", "loot": 5, "notes": "…" }]'
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'SF Mono, monospace', fontSize: 11 }}
        />
        <button onClick={importBulk} className="btn btn-primary btn-sm" style={{ marginTop: 6, width: '100%' }}>
          Import Pins
        </button>

        {/* Danger zone: wipes every pin on the currently-selected
            map. Scoped per map so a slip only affects one; hit it
            three times to clear every JSON-imported pin. */}
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px dashed var(--border)',
        }}>
          <div style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
            color: 'var(--red)',
            marginBottom: 6,
          }}>
            Danger zone
          </div>
          <button
            onClick={deleteAllPinsOnMap}
            disabled={deletingAll || pins.length === 0}
            className="btn btn-secondary btn-sm"
            style={{
              width: '100%',
              border: '1px solid var(--red)',
              color: 'var(--red)',
            }}
          >
            {deletingAll
              ? <><Loader2 size={12} className="animate-spin" /> Deleting…</>
              : <><Trash2 size={12} /> Delete all {pins.length} pin{pins.length === 1 ? '' : 's'} on {mapId}</>}
          </button>
        </div>
      </Collapsible>

      {/* Live coordinate readout */}
      <div className="card" style={{ background: 'var(--bg-elevated)', padding: 10 }}>
        <div style={{
          fontFamily: 'SF Mono, monospace', fontSize: 12,
          color: 'var(--text-primary)', display: 'flex',
          alignItems: 'center', gap: 6,
        }}>
          📍 {mousePos
            ? `lat: ${mousePos.lat.toFixed(2)}, lng: ${mousePos.lng.toFixed(2)}`
            : 'hover over the map for coordinates'}
        </div>
      </div>

      {showingPolygonForm && (
        <CompoundNameModal
          form={polyForm}
          onChange={setPolyForm}
          saving={savingPoly}
          editing={!!editingPolyId}
          onSave={commitPolygon}
          onDiscard={() => {
            setEditingPolyId(null)
            st.pendingPolygonForm = null
            fireDev()
            setPolyForm({ name: '', type: 'compound_boundary', color: '#FFFFFF', fillOpacity: 0, notes: '' })
            setShowSaveModal(false)
          }}
        />
      )}
    </div>
  )
}

function PinManageRow({ pin, mapId }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: pin.name || '', type: pin.type || 'compound',
    tier: pin.tier || 'medium',
    loot: Number(pin.loot) || 3,
    notes: pin.notes || '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await updatePin(mapId, pin.id, form)
      setEditing(false)
    } catch (e) { alert('Save failed: ' + (e?.message || e)) }
    finally    { setSaving(false) }
  }
  async function del() {
    if (!window.confirm(`Delete "${pin.name}"?`)) return
    try { await deletePin(mapId, pin.id) }
    catch (e) { alert('Delete failed: ' + (e?.message || e)) }
  }

  if (editing) {
    return (
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
        <PinForm form={form} onChange={setForm} />
        <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
          <button onClick={() => setEditing(false)} className="btn btn-secondary btn-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="btn btn-primary btn-sm">
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
          </button>
        </div>
      </div>
    )
  }

  const tierColor = pin.tier ? TIER_COLORS[pin.tier] : 'var(--text-subtle)'
  return (
    <div style={rowStyle}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: tierColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pin.name || '(unnamed)'}</div>
        <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{pin.type} · {pin.lat?.toFixed?.(1)}, {pin.lng?.toFixed?.(1)}</div>
      </div>
      <button onClick={() => setEditing(true)} className="btn btn-secondary btn-sm"><Edit size={11} /></button>
      <button onClick={del} className="btn btn-secondary btn-sm"><Trash2 size={11} /></button>
    </div>
  )
}

/* ============================================================
   SHARED FORMS
   ============================================================ */
function PinForm({ form, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        placeholder="Name"
        style={inputStyle}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <select
          value={form.type}
          onChange={(e) => onChange({ ...form, type: e.target.value })}
          style={{ ...inputStyle, flex: 1 }}
        >
          {Object.entries(PIN_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={form.tier || 'medium'}
          onChange={(e) => onChange({ ...form, tier: e.target.value })}
          style={{ ...inputStyle, flex: 1 }}
        >
          <option value="hot">Hot</option>
          <option value="medium">Medium</option>
          <option value="safe">Safe</option>
        </select>
      </div>
      <label style={{ fontSize: 11, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
        Loot
        <input
          type="range" min={1} max={5} step={1}
          value={form.loot}
          onChange={(e) => onChange({ ...form, loot: Number(e.target.value) })}
          style={{ flex: 1 }}
        />
        <span style={{ fontFamily: 'SF Mono, monospace', color: 'var(--text-primary)', minWidth: 12, textAlign: 'right' }}>{form.loot}</span>
      </label>
      <textarea
        value={form.notes}
        onChange={(e) => onChange({ ...form, notes: e.target.value })}
        placeholder="Notes"
        rows={2}
        style={{ ...inputStyle, resize: 'vertical' }}
      />
    </div>
  )
}

function CompoundNameModal({ form, onChange, saving, editing, onSave, onDiscard }) {
  return (
    <div className="modal-overlay" onClick={onDiscard}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div className="card-header">
          <div className="card-title">
            {editing ? 'Edit compound' : 'Name this compound'}
          </div>
        </div>

        <label style={modalFieldStyle}>
          <span style={modalLabelStyle}>Name *</span>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') onSave() }}
            placeholder="Compound name"
            style={inputStyle}
          />
        </label>

        <label style={modalFieldStyle}>
          <span style={modalLabelStyle}>Type</span>
          <select
            value={form.type}
            onChange={(e) => onChange({ ...form, type: e.target.value })}
            style={inputStyle}
          >
            {POLYGON_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>

        <label style={modalFieldStyle}>
          <span style={modalLabelStyle}>Notes</span>
          <textarea
            value={form.notes}
            onChange={(e) => onChange({ ...form, notes: e.target.value })}
            placeholder="Optional"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </label>

        <div style={modalFieldStyle}>
          <span style={modalLabelStyle}>Color</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {MODAL_COLORS.map(c => {
              const selected = form.color === c.value
              return (
                <button
                  key={c.key}
                  onClick={() => onChange({ ...form, color: c.value })}
                  aria-label={c.key}
                  style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: c.value,
                    border: `2px solid ${selected ? 'var(--text-primary)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    boxShadow: selected ? '0 0 0 2px var(--bg-elevated) inset' : 'none',
                  }}
                />
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onDiscard} className="btn btn-secondary btn-sm">
            Discard
          </button>
          <button onClick={onSave} disabled={saving} className="btn btn-primary btn-sm">
            {saving ? <><Loader2 size={12} className="animate-spin" /> Saving</> : <><Save size={12} /> Save Compound</>}
          </button>
        </div>
      </div>
    </div>
  )
}

const modalFieldStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}
const modalLabelStyle = {
  fontFamily: 'DM Sans, sans-serif',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.10em',
  color: 'var(--text-subtle)',
}

/* ============================================================
   UTILITIES
   ============================================================ */
function SectionLabel({ children, small }) {
  return (
    <div style={{
      fontFamily: 'DM Sans, sans-serif',
      fontSize: small ? 10 : 11,
      fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.10em',
      color: 'var(--text-subtle)',
      marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

function Collapsible({ title, open, onToggle, children }) {
  return (
    <div className="card">
      <button
        onClick={onToggle}
        style={{
          background: 'transparent', border: 'none',
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', cursor: 'pointer',
          padding: 0, color: 'var(--text-primary)',
          fontFamily: 'DM Sans, sans-serif', fontSize: 12,
          fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.10em', marginBottom: open ? 10 : 0,
        }}
      >
        <span>{title}</span>
        <ChevronDown size={14} style={{
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.2s ease',
          color: 'var(--text-subtle)',
        }} />
      </button>
      {open && children}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontFamily: 'DM Sans, sans-serif',
  fontSize: 13,
  padding: '7px 10px',
  outline: 'none',
  boxSizing: 'border-box',
}

const rowStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '6px 10px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/* ============================================================
   PAGE STYLES
   ============================================================ */
function MapStyles() {
  return (
    <style>{`
      .mk-page {
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: calc(100vh - 120px);
        min-height: 500px;
      }
      .mk-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .mk-body {
        display: flex;
        gap: 12px;
        flex: 1;
        min-height: 0;
      }
      .mk-map-col {
        flex: 1;
        min-width: 0;
        min-height: 0;
      }
      .mk-side-col {
        width: 280px;
        flex-shrink: 0;
        min-height: 0;
        overflow: hidden;
      }
      @media (max-width: 900px) {
        .mk-page { height: auto; }
        .mk-body { flex-direction: column; }
        /* Explicit height on the map column is required — Leaflet
           reads its container height at mount and won't render if
           the parent is a plain flex child at 0. 60vh keeps enough
           screen real estate to draw polygons accurately on
           phones; 300 / 700 clamps prevent collapse on tiny
           screens and runaway growth on tablets in landscape. */
        .mk-map-col {
          height: 60vh;
          min-height: 300px;
          max-height: 700px;
        }
        .mk-side-col { width: 100%; max-height: 60vh; }
      }
      .mk-pin-detail { animation: mk-fade 0.22s ease; }
      @keyframes mk-fade {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0);   }
      }
      @keyframes ee-mk-spin { to { transform: rotate(360deg); } }
      .animate-spin { animation: ee-mk-spin 0.9s linear infinite; }
    `}</style>
  )
}
