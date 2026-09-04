import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check, Lock, ChevronRight, Play, Zap, Flame, CalendarDays, Compass,
  ListTree, CalendarRange, Users, LineChart, ClipboardList, Target, Sparkles,
} from 'lucide-react'
import { useRoadmap } from '../../hooks/useRoadmap.js'
import { useUserData } from '../../hooks/useUserData.js'
import { useStreak } from '../../hooks/useStreak.js'
import { getLevelName, XP_PER_LEVEL } from '../../utils/db.js'
import { ROADMAP_INTRO } from '../../data/roadmapStages.js'
import ThirtyDayJourney from './ThirtyDayJourney.jsx'

const PHASE_ACTION = {
  content: 'Learn the lesson',
  assessment: 'Take the assessment',
  result: 'Review your result',
  improve: 'See how to improve',
  next: 'Confirm and continue',
}

/*
 * THE ROAD TO ESPORTS — overview.
 *
 * A vertical timeline of the 10 stages. Only Stage 1 starts AVAILABLE;
 * every later stage is LOCKED until the previous stage is COMPLETED
 * (progress-based, never day-based). The "Day N" chip is cosmetic only.
 *
 * Sidebar / XP / streak indicators are the app's existing ones, read
 * from the same hooks the Sidebar and Dashboard use — not rebuilt.
 */
export default function RoadmapOverview() {
  const navigate = useNavigate()
  const [view, setView] = useState('stage')
  const {
    loading, stages, completedCount, totalStages, overallPct,
    currentStage, dayCount,
  } = useRoadmap()
  const { xp, level } = useUserData()
  const streak = useStreak()

  const levelName = getLevelName(level)
  const floor = XP_PER_LEVEL[level] ?? 0
  const ceil = XP_PER_LEVEL[level + 1] ?? floor
  const xpPct = ceil > floor
    ? Math.round(Math.min(1, (xp - floor) / (ceil - floor)) * 100)
    : 100

  /* "Your Biggest Opportunity" — real, derived from the most recently
     computed result across ALL stages. Never fabricated: shows an honest
     empty state when no assessment has been taken yet. */
  const latestResultStage = useMemo(() => {
    let best = null
    stages.forEach(s => {
      if (s.result?.computedAt && s.result.weakest && (!best || s.result.computedAt > best.result.computedAt)) best = s
    })
    return best
  }, [stages])
  const biggestOpportunity = latestResultStage
    ? {
        stageTitle: latestResultStage.title,
        name: latestResultStage.result.weakest.name,
        level: latestResultStage.result.weakest.level,
        score: latestResultStage.result.weakest.score,
      }
    : null

  /* "Next Action" — real, derived from where the current stage actually is
     in the Learn -> Assess -> Result -> Improve -> Next loop. */
  const nextAction = currentStage
    ? `${PHASE_ACTION[currentStage.phase] || 'Continue'} — Stage ${String(currentStage.order).padStart(2, '0')} · ${currentStage.title}`
    : (totalStages && completedCount === totalStages
      ? "You've completed every stage — check your Progress Report for what's next."
      : null)

  if (loading) {
    return (
      <div className="road-wrap page-transition">
        <div className="card skeleton" style={{ height: 150 }} />
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="card skeleton" style={{ height: 96 }} />
        ))}
      </div>
    )
  }

  return (
    <div className="road-wrap page-transition">

      {/* ── Hero ─────────────────────────────── */}
      <header className="rmo-hero">
        <div className="rmo-hero-glow" aria-hidden />
        <div className="rmo-hero-kicker">
          <Compass size={14} /> Esports Elite
        </div>
        <h1 className="rmo-title">THE ROAD TO ESPORTS</h1>
        <p className="rmo-hook">Find your level. Fix your weaknesses. Build your game.</p>
        <p className="rmo-sub">{ROADMAP_INTRO.purpose[1]}</p>
        <span className="rmo-tagline">{ROADMAP_INTRO.tagline}</span>

        <div className="rmo-how">
          {ROADMAP_INTRO.how.map(h => (
            <div key={h.k} className="rmo-how-item">
              <span className="rmo-how-k">{h.k}</span>
              <span className="rmo-how-v">{h.v}</span>
            </div>
          ))}
        </div>

        <div className="rmo-stats">
          <div className="rmo-stat">
            <span className="rmo-stat-icon"><CalendarDays size={15} /></span>
            <div>
              <div className="rmo-stat-value">Day {dayCount}</div>
              <div className="rmo-stat-label">since you started</div>
            </div>
          </div>
          <div className="rmo-stat">
            <span className="rmo-stat-icon"><Play size={14} /></span>
            <div>
              <div className="rmo-stat-value">
                {currentStage ? `Stage ${currentStage.order}` : 'All done'}
              </div>
              <div className="rmo-stat-label">
                {currentStage ? currentStage.title : 'Roadmap complete'}
              </div>
            </div>
          </div>
          <div className="rmo-stat">
            <span className="rmo-stat-icon"><Check size={14} /></span>
            <div>
              <div className="rmo-stat-value">{completedCount}/{totalStages}</div>
              <div className="rmo-stat-label">stages complete</div>
            </div>
          </div>
          <div className="rmo-stat">
            <span className="rmo-stat-icon rmo-stat-icon--flame"><Flame size={14} /></span>
            <div>
              <div className="rmo-stat-value">{streak.current} day{streak.current === 1 ? '' : 's'}</div>
              <div className="rmo-stat-label">training streak</div>
            </div>
          </div>
        </div>

        {/* Real, derived-from-data callouts — never fabricated */}
        <div className="rmo-opportunity-grid">
          <div className="rmo-opp-card">
            <div className="rmo-opp-head"><Target size={13} /> Your Biggest Opportunity</div>
            {biggestOpportunity ? (
              <>
                <div className="rmo-opp-main">{biggestOpportunity.name}</div>
                <div className="rmo-opp-sub">{biggestOpportunity.level} · {biggestOpportunity.score}% · from {biggestOpportunity.stageTitle}</div>
              </>
            ) : (
              <div className="rmo-opp-empty">Complete an assessment to see this.</div>
            )}
          </div>
          <div className="rmo-opp-card">
            <div className="rmo-opp-head"><Sparkles size={13} /> Next Action</div>
            {nextAction ? (
              <div className="rmo-opp-main rmo-opp-main--action">{nextAction}</div>
            ) : (
              <div className="rmo-opp-empty">Start Stage 01 to begin.</div>
            )}
          </div>
        </div>

        {/* Progress + XP: existing app indicators */}
        <div className="rmo-progress">
          <div className="rmo-progress-head">
            <span>Overall progress</span>
            <span>{overallPct}%</span>
          </div>
          <div className="road-bar"><div className="road-bar-fill" style={{ width: `${overallPct}%` }} /></div>
          <div className="rmo-progress-head rmo-progress-head--xp">
            <span><Zap size={12} /> {levelName} · Level {level + 1}</span>
            <span>{xp.toLocaleString()} / {(ceil || xp).toLocaleString()} XP</span>
          </div>
          <div className="road-bar road-bar--xp"><div className="road-bar-fill road-bar-fill--xp" style={{ width: `${xpPct}%` }} /></div>
        </div>

        {currentStage && (
          <button
            className="btn btn-primary rmo-hero-cta"
            onClick={() => navigate(`/roadmap/${currentStage.id}`)}
          >
            {currentStage.state === 'in_progress' ? 'Resume' : 'Start'} Stage {currentStage.order}
            <ChevronRight size={15} />
          </button>
        )}
      </header>

      {/* ── Deeper areas ── */}
      <div className="road-links">
        <button className="road-link" onClick={() => navigate('/roadmap/roles')}>
          <span className="road-link-icon"><Users size={16} /></span>
          <span className="road-link-body">
            <span className="road-link-title">Role System</span>
            <span className="road-link-sub">Discovery + 7 role guides</span>
          </span>
          <ChevronRight size={15} style={{ color: 'var(--text-subtle)' }} />
        </button>
        <button className="road-link" onClick={() => navigate('/roadmap/progress-report')}>
          <span className="road-link-icon"><LineChart size={16} /></span>
          <span className="road-link-body">
            <span className="road-link-title">Progress Report</span>
            <span className="road-link-sub">Your improvement over time</span>
          </span>
          <ChevronRight size={15} style={{ color: 'var(--text-subtle)' }} />
        </button>
        <button className="road-link" onClick={() => navigate('/roadmap/gameplay-review')}>
          <span className="road-link-icon"><ClipboardList size={16} /></span>
          <span className="road-link-body">
            <span className="road-link-title">Gameplay Review</span>
            <span className="road-link-sub">Debrief a session or match</span>
          </span>
          <ChevronRight size={15} style={{ color: 'var(--text-subtle)' }} />
        </button>
      </div>

      {/* ── View toggle: same real progress, two visual angles ── */}
      <div className="rmo-viewtabs" role="tablist" aria-label="Roadmap view">
        <button
          role="tab"
          aria-selected={view === 'stage'}
          className={`rmo-viewtab ${view === 'stage' ? 'is-active' : ''}`}
          onClick={() => setView('stage')}
        >
          <ListTree size={13} /> Stage View
        </button>
        <button
          role="tab"
          aria-selected={view === 'days'}
          className={`rmo-viewtab ${view === 'days' ? 'is-active' : ''}`}
          onClick={() => setView('days')}
        >
          <CalendarRange size={13} /> 30-Day View
        </button>
      </div>

      {view === 'stage' ? (
        <>
          {/* ── Timeline ─────────────────────────── */}
          <ol className="rmo-timeline">
            {stages.map((s, i) => (
              <StageRow
                key={s.id}
                stage={s}
                isLast={i === stages.length - 1}
                onOpen={() => navigate(`/roadmap/${s.id}`)}
              />
            ))}
          </ol>

          {/* ── Footer ───────────────────────────── */}
          <footer className="rmo-footer">
            <p className="rmo-footer-quote">{ROADMAP_INTRO.coreLoop}</p>
            <span className="rmo-footer-stamp">{ROADMAP_INTRO.tagline}</span>
          </footer>
        </>
      ) : (
        <ThirtyDayJourney />
      )}

      <style>{styles}</style>
    </div>
  )
}

function StageRow({ stage, isLast, onOpen }) {
  const { state, order, title, description, icon } = stage
  const locked = state === 'locked'
  const done = state === 'completed'
  const inProgress = state === 'in_progress'
  const available = state === 'available'

  return (
    <li className={`rmo-row rmo-row--${state}`}>
      <div className="rmo-rail">
        <span className="rmo-node">
          {done ? <Check size={15} strokeWidth={3} />
            : locked ? <Lock size={12} />
            : <span className="rmo-node-num">{String(order).padStart(2, '0')}</span>}
        </span>
        {!isLast && <span className="rmo-rail-line" />}
      </div>

      <button
        type="button"
        className={`rmo-card ${inProgress ? 'rmo-card--current' : ''} ${locked ? 'rmo-card--locked' : ''}`}
        disabled={locked}
        onClick={locked ? undefined : onOpen}
        aria-disabled={locked}
      >
        {inProgress && <span className="rmo-current-ribbon">Current stage</span>}
        <span className="rmo-card-icon" aria-hidden>{icon}</span>
        <span className="rmo-card-body">
          <span className="rmo-card-kicker">
            Stage {String(order).padStart(2, '0')}
            {done && <span className="rmo-tag rmo-tag--done">Completed</span>}
            {available && <span className="rmo-tag rmo-tag--open">Available</span>}
            {locked && <span className="rmo-lock-hint"><Lock size={10} /> Locked</span>}
          </span>
          <span className="rmo-card-title">{title}</span>
          {!locked && <span className="rmo-card-desc">{description}</span>}
          {locked && (
            <span className="rmo-card-hint">
              Complete Stage {String(order - 1).padStart(2, '0')} to unlock
            </span>
          )}
        </span>
        {!locked && (
          <span className="rmo-card-chev">
            {done ? 'Review' : inProgress ? 'Continue' : 'Start'}
            <ChevronRight size={15} />
          </span>
        )}
      </button>
    </li>
  )
}

const styles = `
  .rmo-hero {
    position: relative; overflow: hidden;
    background: linear-gradient(165deg, #0D1528 0%, #0B1020 55%, #0A0A1C 100%);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    padding: clamp(20px, 4vw, 34px);
    display: flex; flex-direction: column; gap: 10px;
  }
  .rmo-hero-glow {
    position: absolute; top: -120px; right: -80px;
    width: 320px; height: 320px; border-radius: 50%;
    background: radial-gradient(circle, rgba(124,58,237,0.28), transparent 70%);
    pointer-events: none;
  }
  .rmo-hero-kicker {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: 'DM Sans', sans-serif; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.16em;
    color: var(--violet); font-weight: 600;
  }
  .rmo-title {
    font-family: 'Bebas Neue', sans-serif; font-weight: 400;
    font-size: clamp(30px, 7vw, 46px); line-height: 1;
    letter-spacing: 0.03em; color: var(--text-primary); margin: 4px 0 0;
  }
  .rmo-hook {
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 15px;
    color: var(--text-primary); margin: 6px 0 0;
  }
  .rmo-sub {
    font-family: 'DM Sans', sans-serif; font-size: 13.5px; line-height: 1.6;
    color: var(--text-muted); max-width: 460px; margin: 6px 0 0;
  }
  .rmo-tagline {
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 12px;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--cyan); margin-top: 2px;
  }
  .rmo-how { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
  .rmo-how-item { display: flex; gap: 10px; align-items: baseline; }
  .rmo-how-k {
    flex-shrink: 0; width: 62px;
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 10.5px;
    letter-spacing: 0.06em; color: var(--violet);
  }
  .rmo-how-v { font-family: 'DM Sans', sans-serif; font-size: 12px; line-height: 1.5; color: var(--text-muted); }

  .rmo-stats {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px; margin-top: 16px;
  }
  .rmo-stat { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .rmo-stat-icon {
    width: 32px; height: 32px; flex-shrink: 0; border-radius: 9px;
    background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.28);
    color: var(--violet);
    display: flex; align-items: center; justify-content: center;
  }
  .rmo-stat-icon--flame { background: var(--amber-tint); border-color: rgba(245,158,11,0.28); color: var(--amber); }
  .rmo-stat-value {
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 15px;
    color: var(--text-primary); line-height: 1.2;
  }
  .rmo-stat-label {
    font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-subtle);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .rmo-opportunity-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px; margin-top: 16px;
  }
  .rmo-opp-card {
    background: var(--bg-elevated); border: 1px solid var(--border);
    border-radius: var(--radius-sm); padding: 12px 14px;
  }
  .rmo-opp-head {
    display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 10.5px;
    letter-spacing: 0.05em; text-transform: uppercase; color: var(--violet);
  }
  .rmo-opp-main { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 14px; color: var(--text-primary); }
  .rmo-opp-main--action { font-size: 12.5px; }
  .rmo-opp-sub { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-subtle); margin-top: 2px; }
  .rmo-opp-empty { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-subtle); font-style: italic; }

  .rmo-progress { margin-top: 18px; display: flex; flex-direction: column; gap: 6px; }
  .rmo-progress-head {
    display: flex; justify-content: space-between; align-items: center;
    font-family: 'DM Sans', sans-serif; font-size: 11.5px; color: var(--text-subtle);
  }
  .rmo-progress-head--xp { margin-top: 8px; }
  .rmo-progress-head--xp span { display: inline-flex; align-items: center; gap: 5px; }

  .rmo-hero-cta { align-self: flex-start; margin-top: 18px; }

  /* Timeline */
  .rmo-timeline { list-style: none; margin: 4px 0 0; padding: 0; }
  .rmo-row { display: flex; gap: 14px; }
  .rmo-rail { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; width: 34px; }
  .rmo-node {
    width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid var(--border); background: var(--bg-elevated);
    color: var(--text-subtle);
  }
  .rmo-node-num { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 12px; }
  .rmo-rail-line { width: 2px; flex: 1; min-height: 20px; background: var(--border); margin: 4px 0; }

  .rmo-row--available .rmo-node { border-color: var(--blue); color: var(--blue); }
  .rmo-row--in_progress .rmo-node {
    border-color: var(--violet); background: var(--violet); color: #fff;
    box-shadow: 0 0 14px rgba(124,58,237,0.5);
  }
  .rmo-row--completed .rmo-node { border-color: var(--green); background: var(--green); color: #04140b; }
  .rmo-row--completed .rmo-rail-line { background: var(--green); }

  .rmo-card {
    flex: 1; min-width: 0; text-align: left; cursor: pointer;
    display: flex; align-items: center; gap: 13px;
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 14px 15px; margin-bottom: 12px;
    transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  }
  .rmo-card:hover:not(:disabled) { border-color: var(--violet); transform: translateY(-1px); }
  .rmo-row--completed .rmo-card { border-color: rgba(34,197,94,0.35); }

  /* Current stage: visually dominant, not just another row in the list. */
  .rmo-card--current {
    padding: 20px 20px 20px 22px;
    border-color: var(--violet);
    background: linear-gradient(135deg, rgba(124,58,237,0.14), var(--bg-surface) 60%);
    box-shadow: 0 0 0 1px rgba(124,58,237,0.35), 0 0 28px rgba(124,58,237,0.18);
    position: relative;
  }
  .rmo-card--current .rmo-card-icon { font-size: 30px; }
  .rmo-card--current .rmo-card-title { font-size: 19px; }
  .rmo-current-ribbon {
    position: absolute; top: -9px; left: 18px;
    background: var(--violet); color: #fff;
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 9.5px;
    letter-spacing: 0.08em; text-transform: uppercase;
    border-radius: 999px; padding: 3px 10px;
    box-shadow: 0 2px 8px rgba(124,58,237,0.5);
  }

  /* Locked: understated, not heavy/dim — a quiet row, not a black slab. */
  .rmo-card--locked {
    background: transparent; border-color: transparent;
    padding: 10px 8px; opacity: 0.6;
  }
  .rmo-card--locked:hover { transform: none; }
  .rmo-card--locked .rmo-card-icon { font-size: 18px; filter: grayscale(0.6); }
  .rmo-card--locked .rmo-card-title { font-size: 13.5px; color: var(--text-subtle); font-family: 'DM Sans', sans-serif; font-weight: 600; }
  .rmo-card:disabled { cursor: default; }

  .rmo-lock-hint {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: 'DM Sans', sans-serif; font-size: 10px; color: var(--text-subtle);
  }

  .rmo-card-icon { font-size: 24px; line-height: 1; flex-shrink: 0; }
  .rmo-card-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
  .rmo-card-kicker {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    font-family: 'DM Sans', sans-serif; font-size: 10.5px;
    text-transform: uppercase; letter-spacing: 0.09em; color: var(--text-subtle);
  }
  .rmo-card-title { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 16px; color: var(--text-primary); }
  .rmo-card-desc { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.5; color: var(--text-muted); }
  .rmo-card-hint {
    display: inline-flex; align-items: center; gap: 5px; margin-top: 4px;
    font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-subtle);
  }
  .rmo-card-chev {
    flex-shrink: 0; display: inline-flex; align-items: center; gap: 3px;
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 11.5px;
    letter-spacing: 0.04em; text-transform: uppercase; color: var(--violet);
  }
  .rmo-row--completed .rmo-card-chev { color: var(--green); }

  .rmo-tag {
    font-family: 'DM Sans', sans-serif; font-size: 9.5px; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase;
    border-radius: 999px; padding: 2px 7px; border: 1px solid transparent;
  }
  .rmo-tag--done { background: var(--green-tint); color: var(--green); border-color: rgba(34,197,94,0.3); }
  .rmo-tag--prog { background: var(--violet-tint); color: var(--violet); border-color: rgba(124,58,237,0.3); }
  .rmo-tag--open { background: var(--blue-tint); color: var(--blue); border-color: rgba(59,130,246,0.3); }
  .rmo-tag--lock { background: var(--bg-elevated); color: var(--text-subtle); border-color: var(--border); }

  /* Footer */
  .rmo-footer {
    text-align: center; padding: 30px 20px 8px;
    display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .rmo-footer-quote {
    font-family: 'DM Sans', sans-serif; font-size: 14px; line-height: 1.7;
    color: var(--text-muted); margin: 0;
  }
  .rmo-footer-quote strong { color: var(--text-primary); }
  .rmo-footer-stamp {
    font-family: 'Bebas Neue', sans-serif; font-size: 30px; letter-spacing: 0.1em;
    background: linear-gradient(90deg, var(--violet), var(--cyan));
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }

  @media (max-width: 600px) {
    .rmo-card { flex-wrap: wrap; }
    .rmo-card-chev { width: 100%; justify-content: flex-end; }
    .rmo-card-title { font-size: 14.5px; }
  }
`
