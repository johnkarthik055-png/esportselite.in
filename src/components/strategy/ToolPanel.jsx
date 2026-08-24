import {
  MARKER_TYPES, ROTATION_TYPES, ZONE_TYPES, FREEHAND_COLORS,
} from '../../utils/strategyDataSchema.js'
import {
  useStrategyStore, setActiveType, setActivePlayer,
  setActiveFreehandColor, setActiveVehiclePickup,
} from './strategyStore.js'
import { SectionLabel, PillButton, SwatchButton, inputStyle } from './strategyUI.jsx'

const TYPE_LISTS = {
  marker: MARKER_TYPES, rotation: ROTATION_TYPES, zone: ZONE_TYPES,
}

const VEHICLE_PICKUP_CATEGORIES = ['compound', 'loot_priority']

/* Contextual options for whichever tool is active on the bottom
   tool bar (see BottomToolBar.jsx) — the bar itself just switches
   `st.tool`; this card is where the category/type, player
   assignment, and freehand color get picked before the next map
   click. Renders nothing for 'select' or 'measure', which have
   nothing to configure. */
export default function ToolPanel() {
  const st = useStrategyStore()
  const hasTypeList = !!TYPE_LISTS[st.tool]
  const showPlayerPicker = ['marker', 'rotation'].includes(st.tool)
  const showFreehandColorPicker = st.tool === 'draw'
  const showVehiclePickupToggle = st.tool === 'marker' && VEHICLE_PICKUP_CATEGORIES.includes(st.activeType.marker)

  if (!hasTypeList && !showFreehandColorPicker) return null

  return (
    <div className="card">
      <SectionLabel>Tool Options</SectionLabel>

      {hasTypeList && (
        <div>
          <SectionLabel small>Type</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
            {TYPE_LISTS[st.tool].map(t => (
              <PillButton
                key={t.key}
                small
                active={st.activeType[st.tool] === t.key}
                onClick={() => setActiveType(st.tool, t.key)}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                {t.label}
              </PillButton>
            ))}
          </div>
        </div>
      )}

      {showVehiclePickupToggle && <VehiclePickupToggle />}
      {showPlayerPicker && <PlayerPicker />}
      {showFreehandColorPicker && <FreehandColorPicker />}
    </div>
  )
}

function VehiclePickupToggle() {
  const st = useStrategyStore()
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 7, marginTop: 10,
      fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-primary)',
      cursor: 'pointer',
    }}>
      <input
        type="checkbox"
        checked={st.activeVehiclePickup}
        onChange={(e) => setActiveVehiclePickup(e.target.checked)}
      />
      Vehicle pickup here
    </label>
  )
}

function FreehandColorPicker() {
  const st = useStrategyStore()
  return (
    <div>
      <SectionLabel small>Color</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {FREEHAND_COLORS.map(c => (
          <SwatchButton
            key={c.key}
            color={c.value}
            title={c.key}
            active={st.activeFreehandColor === c.value}
            onClick={() => setActiveFreehandColor(c.value)}
          />
        ))}
      </div>
    </div>
  )
}

function PlayerPicker() {
  const st = useStrategyStore()
  return (
    <div style={{ marginTop: 10 }}>
      <SectionLabel small>Assign Player (optional)</SectionLabel>
      <select
        value={st.activePlayerId || ''}
        onChange={(e) => setActivePlayer(e.target.value || null)}
        style={inputStyle}
      >
        <option value="">None</option>
        {st.players.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  )
}
