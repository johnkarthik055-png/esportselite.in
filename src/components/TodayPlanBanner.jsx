import { useMemo, useState } from 'react'
import { ClipboardList, X, Gamepad2 } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { STORAGE_KEYS } from '../utils/constants.js'

/* esportselite_training_plans is local to this feature — inline key. */
const PLANS_KEY = 'esportselite_training_plans'
/* Dismissal lives in sessionStorage only — reappears next browser session. */
const DISMISS_KEY = 'esportselite_plan_banner_dismissed'

/** JS getDay() is 0=Sun..6=Sat; convert to Mon=0..Sun=6. */
function mondayIndex() {
  return (new Date().getDay() + 6) % 7
}

function dateKeyLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

/**
 * Prominent "Today's Training Plan" banner shown at the top of the
 * Training Center when an active plan covers today.
 */
export default function TodayPlanBanner() {
  const [plans] = useLocalStorage(PLANS_KEY, [])
  const [dailySessions] = useLocalStorage(STORAGE_KEYS.DAILY_SESSIONS, {})
  const [modules] = useLocalStorage(STORAGE_KEYS.MODULES, [])

  const [dismissedToken, setDismissedToken] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY)
    } catch {
      return null
    }
  })

  const { activePlan, today } = useMemo(() => {
    const active = (Array.isArray(plans) ? plans : []).find(p => p.isActive) || null
    if (!active) return { activePlan: null, today: null }
    const idx = mondayIndex()
    const day =
      (active.days || []).find(d => d.dayIndex === idx) || (active.days || [])[idx] || null
    return { activePlan: active, today: day }
  }, [plans])

  if (!activePlan) return null

  const dismissToken = `${activePlan.id}:${dateKeyLocal(new Date())}`
  if (dismissedToken === dismissToken) return null

  const sessions = today?.sessions || []
  const isRest = !!today?.isRestDay
  const hasMatch = !!today?.matchPractice
  const hasAnything = sessions.length > 0 || hasMatch

  /* Active plan but nothing scheduled today and not a rest day → hide. */
  if (!isRest && !hasAnything) return null

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, dismissToken)
    } catch {
      /* ignore */
    }
    setDismissedToken(dismissToken)
  }

  function iconFor(name) {
    return (modules || []).find(m => m.name === name)?.icon || '🎯'
  }

  /* ---- Progress ---- */
  const start = new Date(activePlan.startDate)
  start.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const msPerDay = 86400000
  const elapsed = Math.floor((now - start) / msPerDay)
  const duration = Number(activePlan.duration) || 7
  const currentDay = Math.min(Math.max(elapsed + 1, 1), duration)

  let completedDays = 0
  const lastOffset = Math.min(elapsed, duration - 1)
  for (let i = 0; i <= lastOffset; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const entry = dailySessions[dateKeyLocal(d)]
    if (entry && (entry.status === 'completed' || (entry.drillCount || 0) > 0)) {
      completedDays++
    }
  }
  const progressPct =
    duration > 0 ? Math.min(100, Math.round((completedDays / duration) * 100)) : 0

  /* ---- Rest day ---- */
  if (isRest) {
    return (
      <section
        id="today-plan-banner"
        className="relative glass clip-corner-sm overflow-hidden animate-fade-in"
      >
        <div
          className="absolute top-0 left-0 h-full w-1 pointer-events-none"
          style={{ background: '#4A9EFF' }}
        />
        <div className="px-5 sm:px-6 py-4 pl-6 sm:pl-7">
          <div className="flex items-center justify-between gap-3">
            <h3 className="heading text-base sm:text-lg text-white tracking-wide">
              😴 REST DAY{' '}
              <span className="text-text-secondary font-normal normal-case text-sm">
                — {activePlan.name}
              </span>
            </h3>
            <button
              onClick={dismiss}
              className="p-2 rounded-md text-text-secondary hover:text-white hover:bg-white/5 transition-all flex-shrink-0"
              title="Dismiss"
              aria-label="Dismiss banner"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Today is scheduled as a rest day. Recovery is part of the grind. 💪
          </p>
        </div>
      </section>
    )
  }

  /* ---- Active training day ---- */
  return (
    <section
      id="today-plan-banner"
      className="relative glass clip-corner-sm overflow-hidden animate-fade-in"
    >
      <div className="absolute top-0 left-0 h-full w-1 bg-red-gradient pointer-events-none" />

      <div className="px-5 sm:px-6 py-4 sm:py-5 pl-6 sm:pl-7">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="heading text-base sm:text-lg text-white tracking-wide flex items-center gap-2">
              <ClipboardList size={18} className="text-accent-secondary" /> TODAY'S TRAINING PLAN
            </h3>
            <p className="text-sm mt-1">
              <span className="text-gold heading tracking-wide">{activePlan.name}</span>
              <span className="text-text-muted">
                {' '}
                • Day {currentDay} of {duration}
              </span>
            </p>
          </div>
          <button
            onClick={dismiss}
            className="p-2 rounded-md text-text-secondary hover:text-white hover:bg-white/5 transition-all flex-shrink-0"
            title="Dismiss"
            aria-label="Dismiss banner"
          >
            <X size={16} />
          </button>
        </div>

        {/* Session chips — 2 per row on mobile, wrap on desktop */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-3">
            {sessions.map((s, i) => (
              <div
                key={s.id || i}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-bg-elevated/60 border border-[rgba(232,0,28,0.3)] min-w-0"
              >
                <span className="text-base flex-shrink-0">{iconFor(s.moduleName)}</span>
                <div className="min-w-0">
                  <div className="text-white text-sm truncate">{s.moduleName}</div>
                  <div className="mono text-accent-secondary text-xs">{s.duration} mins</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Match practice */}
        {hasMatch && (
          <div className="text-sm text-text-secondary mb-3 flex items-center gap-2">
            <Gamepad2 size={15} className="text-accent-secondary" /> Match Practice:{' '}
            <span className="text-success heading">🟢 ON</span>
          </div>
        )}

        {/* Daily tip (AI plans) */}
        {today?.dailyTip && (
          <div className="text-xs text-text-secondary bg-[rgba(255,215,0,0.06)] border border-[rgba(255,215,0,0.25)] rounded-md px-3 py-2 mb-3">
            💡{' '}
            <span className="text-gold heading uppercase tracking-widest text-[10px]">
              Daily Tip:
            </span>{' '}
            {today.dailyTip}
          </div>
        )}

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] heading uppercase tracking-widest text-text-secondary">
              Progress
            </span>
            <span className="text-[11px] text-text-muted">
              Day {currentDay} of {duration}
              <span className="mono text-accent-secondary ml-2">{progressPct}%</span>
            </span>
          </div>
          <div className="h-2 w-full bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-red-gradient transition-all duration-500 shadow-red-glow"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
