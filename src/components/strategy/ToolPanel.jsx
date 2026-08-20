import {
  MousePointer2, MapPin, Route, Swords, FlaskConical, Eye,
  CircleDot, Car, Users2, Ruler, Trash2,
} from 'lucide-react'
import {
  MARKER_TYPES, ROTATION_TYPES, COMBAT_TYPES, UTILITY_TYPES,
  VISION_TYPES, ZONE_TYPES, VEHICLE_ANNOTATION_TYPES,
  FORMATIONS, PHASES,
} from '../../utils/strategyDataSchema.js'
import {
  useStrategyStore, setTool, setActiveType, setActiveFormationKey,
  setActivePlayer, updateObject, deleteSelected,
} from './strategyStore.js'
import { SectionLabel, PillButton, inputStyle } from './strategyUI.jsx'

const TOOL_GRID = [
  [{ key: 'select', label: 'Select', icon: MousePointer2 }, { key: 'marker', label: 'Marker', icon: MapPin }],
  [{ key: 'rotation', label: 'Rotation', icon: Route }, { key: 'combat', label: 'Combat', icon: Swords }],
  [{ key: 'utility', label: 'Utility', icon: FlaskConical }, { key: 'vision', label: 'Vision', icon: Eye }],
  [{ key: 'zone', label: 'Zone', icon: CircleDot }, { key: 'vehicle', label: 'Vehicle', icon: Car }],
  [{ key: 'formation', label: 'Formation', icon: Users2 }, { key: 'measure', label: 'Measure', icon: Ruler }],
]

const TYPE_LISTS = {
  marker: MARKER_TYPES, rotation: ROTATION_TYPES, combat: COMBAT_TYPES,
  utility: UTILITY_TYPES, vision: VISION_TYPES, zone: ZONE_TYPES, vehicle: VEHICLE_ANNOTATION_TYPES,
}
const TOOL_HINTS = {
  marker: 'Click the map to place a marker.',
  rotation: 'Click to add waypoints, double-click to finish the route.',
  combat: 'Click a start point, then click the target point.',
  utility: 'Click the throw point, then click the target point.',
  vision: 'Click the origin, then click to set facing direction.',
  zone: 'Click the center, then click to set the radius.',
  vehicle: 'Click the map to place a tactical vehicle annotation.',
  formation: 'Pick a preset below, then click the map to place the squad.',
}

export default function ToolPanel() {
  const st = useStrategyStore()
  const selected = st.objects.find(o => o.id === st.selectedObjectId)

  return (
    <div className="card">
      <SectionLabel>Tools</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {TOOL_GRID.flat().map(t => {
          const Icon = t.icon
          return (
            <PillButton key={t.key} active={st.tool === t.key} onClick={() => setTool(t.key)}>
              <Icon size={13} /> {t.label}
            </PillButton>
          )
        })}
      </div>

      {TOOL_HINTS[st.tool] && (
        <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 10, lineHeight: 1.5 }}>
          {TOOL_HINTS[st.tool]}
        </div>
      )}

      {TYPE_LISTS[st.tool] && (
        <div style={{ marginTop: 10 }}>
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

      {['marker', 'combat', 'utility'].includes(st.tool) && (
        <PlayerPicker />
      )}

      {st.tool === 'formation' && <FormationPicker />}

      {st.tool === 'select' && selected && (
        <SelectedObjectEditor obj={selected} />
      )}
      {st.tool === 'select' && !selected && (
        <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 10 }}>
          Click an object on the map to select and edit it.
        </div>
      )}
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

function SelectedObjectEditor({ obj }) {
  const st = useStrategyStore()
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      <SectionLabel small>Selected: {obj.label || obj.type}</SectionLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          value={obj.label}
          onChange={(e) => updateObject(obj.id, { label: e.target.value }, { silent: true })}
          placeholder="Label"
          style={inputStyle}
        />
        <textarea
          value={obj.description}
          onChange={(e) => updateObject(obj.id, { description: e.target.value }, { silent: true })}
          placeholder="Description / instructions"
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
        />

        <div style={{ display: 'flex', gap: 6 }}>
          <select
            value={obj.player || ''}
            onChange={(e) => updateObject(obj.id, { player: e.target.value || null })}
            style={{ ...inputStyle, flex: 1 }}
          >
            <option value="">No player</option>
            {st.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select
            value={obj.priority}
            onChange={(e) => updateObject(obj.id, { priority: e.target.value })}
            style={{ ...inputStyle, flex: 1 }}
          >
            <option value="low">Low priority</option>
            <option value="normal">Normal priority</option>
            <option value="high">High priority</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <select
          value={obj.phase}
          onChange={(e) => updateObject(obj.id, { phase: e.target.value })}
          style={inputStyle}
        >
          {PHASES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {obj.type === 'vision' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <label style={{ flex: 1, fontSize: 10, color: 'var(--text-subtle)' }}>
              Spread
              <input
                type="number" min="10" max="180" value={Math.round(obj.spread)}
                onChange={(e) => updateObject(obj.id, { spread: Number(e.target.value) })}
                style={{ ...inputStyle, marginTop: 2 }}
              />
            </label>
            <label style={{ flex: 1, fontSize: 10, color: 'var(--text-subtle)' }}>
              Radius
              <input
                type="number" min="2" value={Math.round(obj.radius)}
                onChange={(e) => updateObject(obj.id, { radius: Number(e.target.value) })}
                style={{ ...inputStyle, marginTop: 2 }}
              />
            </label>
          </div>
        )}

        <button onClick={deleteSelected} className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  )
}
