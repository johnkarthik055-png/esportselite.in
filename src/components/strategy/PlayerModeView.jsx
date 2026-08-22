import { ArrowLeft, ChevronDown, Save, MoreVertical, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { PHASES } from '../../utils/strategyDataSchema.js'
import { useStrategyStore, setPlayerModeSelectedId } from './strategyStore.js'

/* Player Mode's read-only mobile-style chrome (Issue 3). Coach Mode
   keeps the full sidebar/tool-bar editing UI (StrategyMakerPanel +
   BottomToolBar); flipping to Player Mode swaps both the page header
   and the side column for this instead — a minimal, non-editing
   header (back / map name / save / overflow) plus a briefing list
   for whichever squad member is selected. The map canvas underneath
   is the same MapContainer, just made read-only by StrategyDrawingLayer
   when viewMode === 'player'. */
export function PlayerModeHeader({ activeMap, mapList, onSelectMap, onBack, onSave, saving }) {
  const [mapMenuOpen, setMapMenuOpen] = useState(false)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 10, padding: '8px 4px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconBtn onClick={onBack} title="Back to Coach Mode"><ArrowLeft size={16} /></IconBtn>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMapMenuOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, background: 'transparent',
              border: 'none', cursor: 'pointer', color: 'var(--text-primary)',
              fontFamily: 'Bebas Neue, sans-serif', fontSize: 16, letterSpacing: '0.04em',
            }}
          >
            {activeMap.name} <ChevronDown size={14} />
          </button>
          {mapMenuOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 20,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 4, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {mapList.map(m => (
                <button
                  key={m.id}
                  onClick={() => { onSelectMap(m.id); setMapMenuOpen(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px',
                    background: m.id === activeMap.id ? 'var(--blue)' : 'transparent',
                    color: m.id === activeMap.id ? '#fff' : 'var(--text-primary)',
                    border: 'none', borderRadius: 6, cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif', fontSize: 12,
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <IconBtn onClick={onSave} title="Save" disabled={saving}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        </IconBtn>
        <IconBtn title="More"><MoreVertical size={15} /></IconBtn>
      </div>
    </div>
  )
}

function IconBtn({ onClick, title, children, disabled }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
        color: 'var(--text-primary)', cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}

export default function PlayerModeSidebar() {
  const st = useStrategyStore()
  const selectedId = st.playerModeSelectedId || st.players[0]?.id
  const player = st.players.find(p => p.id === selectedId)
  const myObjects = st.objects.filter(o => o.player === selectedId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
      <div className="card">
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--text-subtle)', marginBottom: 8 }}>
          Viewing As
        </div>
        <select
          value={selectedId || ''}
          onChange={(e) => setPlayerModeSelectedId(e.target.value)}
          style={{
            width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif',
            fontSize: 12, padding: '6px 9px',
          }}
        >
          {st.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {player && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: player.color }} />
            <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{player.name}</strong>
          </div>

          {myObjects.length === 0 ? (
            <div style={{ color: 'var(--text-subtle)', fontSize: 11 }}>
              No objectives assigned to this player yet.
            </div>
          ) : (
            PHASES.map(phase => {
              const inPhase = myObjects.filter(o => o.phase === phase.id)
              if (inPhase.length === 0) return null
              return (
                <div key={phase.id} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', marginBottom: 4 }}>
                    {phase.name}
                  </div>
                  {inPhase.map(o => (
                    <div key={o.id} style={{
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '6px 8px', marginBottom: 4,
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 11 }}>{o.label || o.type}</div>
                      {o.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{o.description}</div>}
                      {o.priority !== 'normal' && (
                        <div style={{ fontSize: 10, color: 'var(--amber)', marginTop: 2, textTransform: 'uppercase' }}>{o.priority} priority</div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
