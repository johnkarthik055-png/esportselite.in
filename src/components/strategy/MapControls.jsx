import { Plus, Minus, Crosshair, Maximize } from 'lucide-react'
import { WORLD_BOUNDS, WORLD_CENTER, mapInstanceRef } from '../../utils/strategyDataSchema.js'

function Btn({ onClick, title, children }) {
  return (
    <button className="smc-btn" onClick={onClick} title={title} aria-label={title}>
      {children}
    </button>
  )
}

/* Compact floating zoom/center/fit controls on the RIGHT side of the
   map — Strategy Maker's own equivalent of View Map/Dev Editor's
   zoom cluster, kept separate so those two are pixel-untouched. Reads
   the live map instance via mapInstanceRef (see strategyDataSchema.js)
   since this renders outside <MapContainer>. */
export default function MapControls() {
  function zoomIn() { mapInstanceRef.current?.zoomIn() }
  function zoomOut() { mapInstanceRef.current?.zoomOut() }
  function center() {
    const map = mapInstanceRef.current
    if (!map) return
    map.flyTo(WORLD_CENTER, map.getZoom(), { duration: 0.3 })
  }
  function fitMap() {
    const map = mapInstanceRef.current
    if (!map) return
    const coverZoom = map.getBoundsZoom(WORLD_BOUNDS, true)
    map.flyTo(WORLD_CENTER, coverZoom, { duration: 0.4 })
  }

  return (
    <div className="smc-panel">
      <Btn onClick={zoomIn} title="Zoom In"><Plus size={15} /></Btn>
      <Btn onClick={zoomOut} title="Zoom Out"><Minus size={15} /></Btn>
      <Btn onClick={center} title="Center"><Crosshair size={15} /></Btn>
      <Btn onClick={fitMap} title="Fit Map"><Maximize size={15} /></Btn>
    </div>
  )
}
