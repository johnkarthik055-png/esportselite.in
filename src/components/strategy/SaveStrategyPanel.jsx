import { useState } from 'react'
import { Save, Trash2, Loader2, FolderOpen, X } from 'lucide-react'
import { GAME_MODES } from '../../utils/strategyDataSchema.js'
import {
  useStrategyStore, setName, setDescription, setGameMode, setTags, setPlayers,
} from './strategyStore.js'
import { SectionLabel, inputStyle } from './strategyUI.jsx'

export default function SaveStrategyPanel({ strategies, saving, onSave, onLoad, onDelete }) {
  const st = useStrategyStore()
  const [tagInput, setTagInput] = useState('')

  function addTag() {
    const t = tagInput.trim()
    if (!t || st.tags.includes(t)) { setTagInput(''); return }
    setTags([...st.tags, t])
    setTagInput('')
  }
  function removeTag(t) { setTags(st.tags.filter(x => x !== t)) }

  return (
    <>
      <div className="card">
        <SectionLabel>Squad</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {st.players.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
              <input
                value={p.name}
                onChange={(e) => {
                  const next = st.players.slice()
                  next[i] = { ...p, name: e.target.value }
                  setPlayers(next)
                }}
                style={{ ...inputStyle, fontSize: 11, padding: '5px 8px' }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <SectionLabel>Save Strategy</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            value={st.name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Strategy name"
            style={inputStyle}
          />
          <textarea
            value={st.description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <select value={st.gameMode} onChange={(e) => setGameMode(e.target.value)} style={inputStyle}>
            {GAME_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="Add tag, Enter"
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
            {st.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {st.tags.map(t => (
                  <span key={t} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {t}
                    <X size={10} style={{ cursor: 'pointer' }} onClick={() => removeTag(t)} />
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onSave}
            disabled={saving}
            className="btn btn-primary btn-sm"
            style={{ width: '100%' }}
          >
            {saving ? <><Loader2 size={12} className="animate-spin" /> Saving</> : <><Save size={12} /> Save Strategy</>}
          </button>
        </div>
      </div>

      <div className="card">
        <SectionLabel>My Strategies</SectionLabel>
        {strategies.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>No saved strategies yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {strategies.map(s => (
              <div key={s.id} style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8,
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
                <button onClick={() => onLoad(s)} className="btn btn-secondary btn-sm" title="Load"><FolderOpen size={12} /></button>
                <button onClick={() => onDelete(s)} className="btn btn-secondary btn-sm" title="Delete"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
