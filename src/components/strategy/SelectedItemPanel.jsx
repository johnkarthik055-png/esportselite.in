import { Trash2 } from 'lucide-react'
import { PHASES } from '../../utils/strategyDataSchema.js'
import { useStrategyStore, updateObject, deleteSelected } from './strategyStore.js'
import { SectionLabel, inputStyle } from './strategyUI.jsx'

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
            onChange={(e) => updateObject(obj.id, { player: e.target.value || null })}
            style={inputStyle}
          >
            <option value="">No player</option>
            {st.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

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
