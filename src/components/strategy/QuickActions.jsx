import { UserPlus, UserX, Route, Car, AlertTriangle } from 'lucide-react'
import { setTool, setActiveType } from './strategyStore.js'
import { SectionLabel } from './strategyUI.jsx'

const ACTIONS = [
  { key: 'player',   label: '+ Player',   icon: UserPlus,      run: () => { setActiveType('marker', 'player_position'); setTool('marker') } },
  { key: 'enemy',    label: '+ Enemy',    icon: UserX,         run: () => { setActiveType('marker', 'enemy_position'); setTool('marker') } },
  { key: 'rotation', label: '+ Rotation', icon: Route,         run: () => setTool('rotation') },
  { key: 'vehicle',  label: '+ Vehicle',  icon: Car,           run: () => setTool('vehicle') },
  { key: 'danger',   label: '+ Danger',   icon: AlertTriangle, run: () => { setActiveType('marker', 'danger'); setTool('marker') } },
]

export default function QuickActions() {
  return (
    <div className="card">
      <SectionLabel>Quick Actions</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ACTIONS.map(a => {
          const Icon = a.icon
          return (
            <button
              key={a.key}
              onClick={a.run}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11, gap: 5 }}
            >
              <Icon size={12} /> {a.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
