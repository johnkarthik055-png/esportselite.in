import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, ArrowRight, Gamepad2 } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { STORAGE_KEYS } from '../utils/constants.js'

/* esportselite_training_plans is local to this feature — inline key. */
const PLANS_KEY = 'esportselite_training_plans'

/** JS getDay() is 0=Sun..6=Sat; convert to Mon=0..Sun=6. */
function mondayIndex() {
  return (new Date().getDay() + 6) % 7
}

export default function TodayPlanWidget() {
  const navigate = useNavigate()
  const [plans] = useLocalStorage(PLANS_KEY, [])
  const [modules] = useLocalStorage(STORAGE_KEYS.MODULES, [])

  const { activePlan, today } = useMemo(() => {
    const active = (Array.isArray(plans) ? plans : []).find(p => p.isActive) || null
    if (!active) return { activePlan: null, today: null }
    const idx = mondayIndex()
    const day =
      (active.days || []).find(d => d.dayIndex === idx) || (active.days || [])[idx] || null
    return { activePlan: active, today: day }
  }, [plans])

  /* No active plan → render nothing. */
  if (!activePlan) return null

  function iconFor(name) {
    return (modules || []).find(m => m.name === name)?.icon || '🎯'
  }

  const sessions = today?.sessions || []
  const isRest = !!today?.isRestDay
  const hasMatch = !!today?.matchPractice
  const hasAnything = sessions.length > 0 || hasMatch

  return (
    <section className="relative glass clip-corner-sm overflow-hidden animate-fade-in">
      <div className="absolute top-0 left-0 h-full w-1 bg-red-gradient pointer-events-none" />

      <div className="px-5 sm:px-6 py-4 sm:py-5 pl-6 sm:pl-7">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="heading text-base sm:text-lg text-white tracking-wide flex items-center gap-2">
            <ClipboardList size={18} className="text-accent-secondary" /> TODAY'S PLAN
            <span className="text-text-secondary font-normal normal-case text-sm">
              — {activePlan.name}
            </span>
          </h3>
        </div>

        {isRest ? (
          <div className="py-3 text-sm text-text-secondary">
            😴 <span className="text-white heading tracking-wide">Rest Day</span> — Recovery
            is part of the grind.
          </div>
        ) : !hasAnything ? (
          <div className="py-3 text-sm text-text-muted">
            No sessions planned for today. Open the Training Plan to add some.
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {sessions.map((s, i) => (
              <div key={s.id || i} className="flex items-center gap-3">
                <span className="text-lg flex-shrink-0">{iconFor(s.moduleName)}</span>
                <span className="flex-1 text-white text-sm truncate">{s.moduleName}</span>
                <span className="mono text-accent-secondary text-sm whitespace-nowrap">
                  {s.duration} mins
                </span>
              </div>
            ))}
            {hasMatch && (
              <div className="flex items-center gap-3">
                <Gamepad2 size={18} className="text-accent-secondary flex-shrink-0" />
                <span className="flex-1 text-white text-sm">Match Practice</span>
                <span className="mono text-success text-sm">ON</span>
              </div>
            )}
          </div>
        )}

        {!isRest && hasAnything && (
          <button
            onClick={() => {
              /* One-shot flag → Training.jsx scrolls to the plan banner on arrival. */
              try {
                sessionStorage.setItem('esportselite_scroll_to_plan', 'true')
              } catch {
                /* ignore */
              }
              navigate('/training')
            }}
            className="btn-red px-5 py-2.5 rounded-md text-xs uppercase tracking-[0.15em] flex items-center gap-2"
          >
            Start Today's Session <ArrowRight size={14} />
          </button>
        )}
      </div>
    </section>
  )
}
