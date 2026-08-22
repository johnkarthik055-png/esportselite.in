import {
  MARKER_TYPES, ROTATION_TYPES, COMBAT_TYPES, UTILITY_TYPES,
  VISION_TYPES, ZONE_TYPES, VEHICLE_ANNOTATION_TYPES, FORMATIONS,
} from '../../utils/strategyDataSchema.js'
import {
  useStrategyStore, setActiveType, setActiveFormationKey, setActivePlayer,
} from './strategyStore.js'
import { SectionLabel, PillButton, inputStyle } from './strategyUI.jsx'

const TYPE_LISTS = {
  marker: MARKER_TYPES, rotation: ROTATION_TYPES, combat: COMBAT_TYPES,
  utility: UTILITY_TYPES, vision: VISION_TYPES, zone: ZONE_TYPES, vehicle: VEHICLE_ANNOTATION_TYPES,
}

/* Contextual options for whichever tool is active on the bottom
   tool bar (see BottomToolBar.jsx) — the bar itself just switches
   `st.tool`; this card is where the category/type, player
   assignment, and formation preset get picked before the next map
   click. Renders nothing for 'select' or 'measure', which have
   nothing to configure. */
export default function ToolPanel() {
  const st = useStrategyStore()
  const hasTypeList = !!TYPE_LISTS[st.tool]
  const showPlayerPicker = ['marker', 'combat', 'utility'].includes(st.tool)
  const showFormationPicker = st.tool === 'formation'

  if (!hasTypeList && !showFormationPicker) return null

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

      {showPlayerPicker && <PlayerPicker />}
      {showFormationPicker && <FormationPicker />}
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

function FormationPicker() {
  const st = useStrategyStore()
  const groups = [...new Set(FORMATIONS.map(f => f.group))]
  return (
    <div style={{ marginTop: 10 }}>
      <SectionLabel small>Preset</SectionLabel>
      {groups.map(g => (
        <div key={g} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginBottom: 4 }}>{g}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {FORMATIONS.filter(f => f.group === g).map(f => (
              <PillButton
                key={f.key} small
                active={st.activeFormationKey === f.key}
                onClick={() => setActiveFormationKey(f.key)}
              >
                {f.label}
              </PillButton>
            ))}
          </div>
        </div>
      ))}
      {!st.activeFormationKey && (
        <div style={{ fontSize: 11, color: 'var(--amber)' }}>Pick a preset before clicking the map.</div>
      )}
    </div>
  )
}
