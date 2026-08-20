import { useStrategyStore, setActivePhase } from './strategyStore.js'
import { SectionLabel } from './strategyUI.jsx'

export default function PhaseSelector() {
  const st = useStrategyStore()
  return (
    <div className="card">
      <SectionLabel>Phase</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {st.phases.map(p => {
          const count = st.objects.filter(o => o.phase === p.id).length
          const active = st.activePhase === p.id
          return (
            <button
              key={p.id}
              onClick={() => setActivePhase(p.id)}
              className="btn btn-sm"
              style={{
                background: active ? 'var(--blue)' : 'var(--bg-elevated)',
                border: `1px solid ${active ? 'var(--blue)' : 'var(--border)'}`,
                color: active ? '#fff' : 'var(--text-primary)',
                fontSize: 11, padding: '5px 9px', gap: 4,
              }}
            >
              {p.name}
              <span style={{ opacity: 0.7 }}>({count})</span>
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 6 }}>
        Objects placed while a phase is active are tagged to it — switching phases filters the map to just that phase's plan.
      </div>
    </div>
  )
}
