import { useState } from 'react'
import { Check, X as XIcon } from 'lucide-react'
import { TACTICAL_TOOLS_BY_KEY } from '../../utils/tacticalToolsSchema.js'
import { useStrategyStore, commitTacticalForm, commitTacticalEdit, cancelTacticalDraft } from './strategyStore.js'
import { SectionLabel, inputStyle } from './strategyUI.jsx'

function buildInitialValues(tool, existingFields) {
  const values = {}
  for (const f of tool.fields) {
    values[f.key] = existingFields?.[f.key] ?? (f.type === 'select' ? (f.options?.[0] ?? '') : '')
  }
  return values
}

/* Small structured form shown right after a tactical tool's geometry
   is placed (drafting.kind === 'tactical-form') or when editing an
   already-placed tactical object via Select -> Edit Details
   (drafting.kind === 'tactical-edit'). Config-driven from
   TACTICAL_TOOLS so this one component covers all 15 tactical tools
   instead of one form per tool. */
export default function TacticalPropertyPanel() {
  const st = useStrategyStore()
  const drafting = st.drafting
  const isEdit = drafting?.kind === 'tactical-edit'
  const isNew = drafting?.kind === 'tactical-form'
  const toolKey = drafting?.toolKey
  const tool = toolKey ? TACTICAL_TOOLS_BY_KEY[toolKey] : null

  const existingObj = isEdit ? st.objects.find(o => o.id === drafting.objectId) : null
  const [values, setValues] = useState(() => tool ? buildInitialValues(tool, existingObj?.fields) : {})
  const [seededFor, setSeededFor] = useState(drafting)

  if (!tool || (!isEdit && !isNew)) return null

  /* Re-seed local form state when a different placement/edit starts
     while this component stays mounted between transitions handled
     by the same parent (defensive — normally the parent only mounts
     this when drafting is one of the two relevant kinds). */
  if (seededFor !== drafting) {
    setSeededFor(drafting)
    setValues(buildInitialValues(tool, existingObj?.fields))
  }

  function setField(key, val) {
    setValues(v => ({ ...v, [key]: val }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (isEdit) commitTacticalEdit(values)
    else commitTacticalForm(values)
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--blue)' }}>
      <SectionLabel small>{isEdit ? `Edit — ${tool.label}` : `New — ${tool.label}`}</SectionLabel>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tool.fields.map(f => (
          <div key={f.key}>
            <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginBottom: 3 }}>{f.label}</div>
            {f.type === 'textarea' && (
              <textarea
                style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }}
                value={values[f.key] || ''}
                onChange={e => setField(f.key, e.target.value)}
              />
            )}
            {f.type === 'select' && (
              <select
                style={inputStyle}
                value={values[f.key] || ''}
                onChange={e => setField(f.key, e.target.value)}
              >
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {f.type === 'player' && (
              <select
                style={inputStyle}
                value={values[f.key] || ''}
                onChange={e => setField(f.key, e.target.value)}
              >
                <option value="">— none —</option>
                {st.players.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            )}
            {f.type === 'text' && (
              <input
                type="text"
                style={inputStyle}
                value={values[f.key] || ''}
                onChange={e => setField(f.key, e.target.value)}
              />
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }}>
            <Check size={12} /> {isEdit ? 'Save' : 'Place'}
          </button>
          <button type="button" onClick={cancelTacticalDraft} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
            <XIcon size={12} /> Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
