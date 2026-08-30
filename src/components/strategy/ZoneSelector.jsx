import { ZONE_NUMBERS } from '../../utils/strategyDataSchema.js'
import { useStrategyStore, setSelectedZone } from '../../utils/strategyDataSchema.js'

/* Small floating row of Zone 1-8 + ALL — appears ONLY while the Zone
   tool-mode is active (st.tool === 'zone'), never as a permanent
   panel. Selecting a number shows that zone's schematic overlay
   (rendered by DrawingCanvas); ALL shows every zone at once. */
export default function ZoneSelector() {
  const st = useStrategyStore()
  if (st.tool !== 'zone') return null

  return (
    <div className="szs-panel">
      {ZONE_NUMBERS.map(n => (
        <button
          key={n}
          className={`szs-btn${st.selectedZone === n ? ' szs-btn-active' : ''}`}
          onClick={() => setSelectedZone(n)}
          title={`Zone ${n}`}
          aria-label={`Zone ${n}`}
        >
          {n}
        </button>
      ))}
      <button
        className={`szs-btn szs-btn-all${st.selectedZone === 'all' ? ' szs-btn-active' : ''}`}
        onClick={() => setSelectedZone('all')}
        title="All Zones"
        aria-label="All Zones"
      >
        ALL
      </button>
    </div>
  )
}
