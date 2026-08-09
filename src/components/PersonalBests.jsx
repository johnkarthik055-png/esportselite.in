import { useMemo } from 'react'
import { Trophy, Target, Medal, Flame, Zap } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { STORAGE_KEYS } from '../utils/constants.js'

/* ============================================================
   HELPERS
   ============================================================ */
function shortDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

function matchKillsValue(m) {
  if (m.type === 'Classic') return Number(m.kills) || 0
  return Number(m.individualKills) || 0
}

function matchPositionValue(m) {
  if (m.type === 'Classic') return m.position != null ? Number(m.position) : null
  return m.teamPosition != null ? Number(m.teamPosition) : null
}

/**
 * Compute the longest run of consecutive "completed" days in
 * daily_sessions. This is the source of truth for streak data —
 * we never write to esportselite_streak, but if anything ever does,
 * we honour the larger of the two below.
 */
function longestCompletedStreak(daily) {
  if (!daily || typeof daily !== 'object') return 0
  const completedDays = Object.entries(daily)
    .filter(([, v]) => v && v.status === 'completed')
    .map(([k]) => k)
    .sort()
  if (!completedDays.length) return 0

  let best = 1
  let run = 1
  for (let i = 1; i < completedDays.length; i++) {
    const prev = new Date(completedDays[i - 1])
    const curr = new Date(completedDays[i])
    prev.setHours(0, 0, 0, 0)
    curr.setHours(0, 0, 0, 0)
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24))
    if (diffDays === 1) {
      run += 1
      if (run > best) best = run
    } else {
      run = 1
    }
  }
  return best
}

/* ============================================================
   MAIN
   ============================================================ */
export default function PersonalBests() {
  const [matches] = useLocalStorage(STORAGE_KEYS.MATCHES, [])
  const [daily] = useLocalStorage(STORAGE_KEYS.DAILY_SESSIONS, {})
  const [storedStreak] = useLocalStorage(STORAGE_KEYS.STREAK, null)

  const bests = useMemo(() => {
    const list = Array.isArray(matches) ? matches : []

    /* ---- Best Kills ---- */
    let bestKills = null
    list.forEach(m => {
      const k = matchKillsValue(m)
      if (k > 0 && (bestKills == null || k > bestKills.value)) {
        bestKills = { value: k, type: m.type, ts: m.timestamp }
      }
    })

    /* ---- Best Placement (lowest position number is best) ---- */
    let bestPlacement = null
    list.forEach(m => {
      const p = matchPositionValue(m)
      if (p != null && p >= 1 && (bestPlacement == null || p < bestPlacement.value)) {
        bestPlacement = { value: p, type: m.type, ts: m.timestamp }
      }
    })

    /* ---- Longest Streak ---- */
    const computedStreak = longestCompletedStreak(daily)
    const storedStreakNum = Number(storedStreak)
    const longestStreak =
      Number.isFinite(storedStreakNum) && storedStreakNum > computedStreak
        ? storedStreakNum
        : computedStreak

    /* ---- Best Damage (Classic only, requires numeric m.damage) ---- */
    let bestDamage = null
    list.forEach(m => {
      if (m.type !== 'Classic') return
      const d = Number(m.damage)
      if (!Number.isFinite(d) || d <= 0) return
      if (bestDamage == null || d > bestDamage.value) {
        bestDamage = { value: d, ts: m.timestamp }
      }
    })

    return { bestKills, bestPlacement, longestStreak, bestDamage }
  }, [matches, daily, storedStreak])

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="heading text-lg sm:text-xl text-white tracking-wide flex items-center gap-2">
          <Trophy size={20} className="text-gold" /> PERSONAL BESTS
        </h3>
        <p className="text-[10px] sm:text-xs text-text-muted uppercase tracking-widest heading">
          Your all-time highs
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <PBCard
          icon={<Target size={28} className="text-gold" />}
          label="Best Kills"
          value={bests.bestKills != null ? String(bests.bestKills.value) : '--'}
          subType={bests.bestKills?.type}
          subDate={bests.bestKills ? shortDate(bests.bestKills.ts) : null}
          empty={!bests.bestKills}
        />
        <PBCard
          icon={<Medal size={28} className="text-gold" />}
          label="Best Placement"
          value={bests.bestPlacement != null ? `#${bests.bestPlacement.value}` : '--'}
          subType={bests.bestPlacement?.type}
          subDate={bests.bestPlacement ? shortDate(bests.bestPlacement.ts) : null}
          empty={!bests.bestPlacement}
        />
        <PBCard
          icon={<Flame size={28} className="text-gold" />}
          label="Longest Streak"
          value={
            bests.longestStreak > 0
              ? `${bests.longestStreak} day${bests.longestStreak === 1 ? '' : 's'}`
              : '--'
          }
          subType={null}
          subDate={null}
          empty={bests.longestStreak <= 0}
          emptyMessage="No completed days yet"
        />
        <PBCard
          icon={<Zap size={28} className="text-gold" />}
          label="Best Damage"
          value={bests.bestDamage != null ? String(bests.bestDamage.value) : '--'}
          subType={bests.bestDamage ? 'Classic' : null}
          subDate={bests.bestDamage ? shortDate(bests.bestDamage.ts) : null}
          empty={!bests.bestDamage}
          emptyMessage="No damage logged yet"
        />
      </div>
    </section>
  )
}

/* ============================================================
   CARD
   Glassmorphism, gold top border, gold-glow on hover.
   ============================================================ */
function PBCard({ icon, label, value, subType, subDate, empty, emptyMessage }) {
  return (
    <div
      className="relative rounded-md p-4 sm:p-5 transition-all bg-bg-elevated/40 backdrop-blur-md border border-border hover:shadow-gold-glow hover:border-[rgba(255,215,0,0.4)] group"
      style={{ borderTop: '2px solid #FFD700' }}
    >
      <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gold opacity-0 group-hover:opacity-[0.08] blur-2xl transition-opacity pointer-events-none" />

      <div className="relative z-10">
        <div className="mb-3">{icon}</div>

        <div className="heading text-[10px] sm:text-xs uppercase tracking-[0.18em] text-text-secondary">
          {label}
        </div>

        <div className="heading mt-1 text-2xl sm:text-3xl lg:text-[32px] text-white tracking-wide leading-tight break-words">
          {value}
        </div>

        <div className="mt-2 text-[10px] sm:text-xs text-text-muted min-h-[1.5em] leading-snug">
          {empty ? (
            emptyMessage || 'No matches logged yet'
          ) : (
            <>
              {subType && <span className="block">{subType}</span>}
              {subDate && <span className="block">{subDate}</span>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
