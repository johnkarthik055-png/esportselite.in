import { Trash2 } from 'lucide-react'
import { PHASES, categoryColor, NEUTRAL_ROTATION_COLOR } from '../../utils/strategyDataSchema.js'
import { useStrategyStore, updateObject, deleteSelected } from './strategyStore.js'
import { SectionLabel, inputStyle } from './strategyUI.jsx'

const VEHICLE_PICKUP_CATEGORIES = ['compound', 'loot_priority']

/* Populates when an object is selected via the Select tool, clears
   (renders nothing) when nothing is selected — mirrors the mockup's
   "Selected Item" card, which only appears on selection. */
export default function SelectedItemPanel() {
  const st = useStrategyStore()
  const obj = st.objects.find(o => o.id === st.selectedObjectId)
  if (!obj) return null

  return (
    <div className="card">
      <SectionLabel>Selected Item</SectionLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginBottom: 3 }}>Type</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>
            {obj.type}{obj.category ? ` · ${obj.category.replace(/_/g, ' ')}` : ''}
          </div>
        </div>

        <input
          value={obj.label}
          onChange={(e) => updateObject(obj.id, { label: e.target.value }, { silent: true })}
          placeholder="Label"
          style={inputStyle}
        />

        <div>
          <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginBottom: 3 }}>Squad</div>
          <select
            value={obj.player || ''}
            onChange={(e) => {
              const playerId = e.target.value || null
              const player = st.players.find(p => p.id === playerId)
              const patch = { player: playerId }
              /* Color always tracks the current assignment — reassigning
                 or clearing a player recolors immediately instead of
                 leaving the object showing a stale player's color. */
              if (obj.type === 'rotation') {
                patch.color = player ? player.color : NEUTRAL_ROTATION_COLOR
              } else if (obj.type === 'marker') {
                patch.color = player ? player.color : categoryColor('marker', obj.category)
              }
              updateObject(obj.id, patch)
            }}
            style={inputStyle}
          >
            <option value="">No player</option>
            {st.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {obj.type === 'marker' && VEHICLE_PICKUP_CATEGORIES.includes(obj.category) && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!obj.vehiclePickup}
              onChange={(e) => updateObject(obj.id, { vehiclePickup: e.target.checked })}
            />
            Vehicle pickup here
          </label>
        )}

        <div>
          <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginBottom: 3 }}>Notes</div>
          <textarea
            value={obj.description}
            onChange={(e) => updateObject(obj.id, { description: e.target.value }, { silent: true })}
            placeholder="Hold this position and watch the bridge."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
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
          <select
            value={obj.phase}
            onChange={(e) => updateObject(obj.id, { phase: e.target.value })}
            style={{ ...inputStyle, flex: 1 }}
          >
            {PHASES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <button
          onClick={deleteSelected}
          className="btn btn-secondary btn-sm"
          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  )
}
