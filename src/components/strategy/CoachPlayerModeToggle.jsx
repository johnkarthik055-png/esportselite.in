import { Eye, Pencil } from 'lucide-react'
import { setViewMode } from './strategyStore.js'
import { useStrategyStore } from './strategyStore.js'
import { SectionLabel, PillButton } from './strategyUI.jsx'

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
    </div>
  )
}
