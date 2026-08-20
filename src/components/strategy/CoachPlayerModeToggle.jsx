import { Eye, Pencil } from 'lucide-react'
import { PHASES } from '../../utils/strategyDataSchema.js'
import { useStrategyStore, setViewMode, setPlayerModeSelectedId } from './strategyStore.js'
import { SectionLabel, PillButton, inputStyle } from './strategyUI.jsx'

export default function CoachPlayerModeToggle() {
  const st = useStrategyStore()
  return (
    <div className="card">
      <SectionLabel>Mode</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <PillButton active={st.viewMode === 'coach'} onClick={() => setViewMode('coach')}>
          <Pencil size={12} /> Coach
        </PillButton>
        <PillButton active={st.viewMode === 'player'} onClick={() => setViewMode('player')}>
          <Eye size={12} /> Player
        </PillButton>
      </div>

      {st.viewMode === 'player' && <PlayerBriefing />}
    </div>
  )
}

function PlayerBriefing() {
  const st = useStrategyStore()
  const selectedId = st.playerModeSelectedId || st.players[0]?.id
  const player = st.players.find(p => p.id === selectedId)
  const myObjects = st.objects.filter(o => o.player === selectedId)

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <select
        value={selectedId || ''}
        onChange={(e) => setPlayerModeSelectedId(e.target.value)}
        style={inputStyle}
      >
        {st.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      {player && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: player.color }} />
            <strong>{player.name}</strong>
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
