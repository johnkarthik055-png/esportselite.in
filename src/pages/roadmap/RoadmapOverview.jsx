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
import { useSubscription } from '../../hooks/useSubscription.js'
import UpgradeOverlay from '../../components/UpgradeOverlay.jsx'

const PHASE_ACTION = {
  content: 'Learn the lesson',
  assessment: 'Take the assessment',
  result: 'Review your result',
  improve: 'See how to improve',
  next: 'Confirm and continue',
}

export default function RoadmapOverview() {
  const navigate = useNavigate()
  const [view, setView] = useState('stage')
  const {
    loading, stages, completedCount, totalStages, overallPct,
    currentStage, dayCount,
  } = useRoadmap()
  const { xp, level } = useUserData()
  const streak = useStreak()
  const { isActive, loading: subLoading } = useSubscription()

  const levelName = getLevelName(level)
  const floor = XP_PER_LEVEL[level] ?? 0
  const ceil = XP_PER_LEVEL[level + 1] ?? floor
  const xpPct = ceil > floor
    ? Math.round(Math.min(1, (xp - floor) / (ceil - floor)) * 100)
    : 100

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
        {/* Decorative layers — pointer-events none, z-index 0 */}
        <div className="rmo-hero-dots" aria-hidden />
        <div className="rmo-hero-glow-blue" aria-hidden />
        <div className="rmo-hero-glow-red" aria-hidden />

        {/* All content sits above decorative layers */}
        <div className="rmo-hero-kicker">
          <Compass size={14} /> YOUR ROADMAP TO PRO
        </div>
        <h1 className="rmo-title">THE ROAD TO ESPORTS</h1>
        <p className="rmo-hook">Find your level. Fix your weaknesses. Build your game.</p>
        <p className="rmo-sub">{ROADMAP_INTRO.purpose[1]}</p>

        {/* Stat pills */}
        <div className="rmo-stats">
          <div className="rmo-stat">
            <span className="rmo-stat-icon"><CalendarDays size={18} /></span>
            <div>
              <div className="rmo-stat-value">Day {dayCount}</div>
              <div className="rmo-stat-label">since you started</div>
            </div>
          </div>
          <div className="rmo-stat">
            <span className="rmo-stat-icon"><Play size={18} /></span>
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
            <span className="rmo-stat-icon"><Check size={18} /></span>
            <div>
              <div className="rmo-stat-value">{completedCount}/{totalStages}</div>
              <div className="rmo-stat-label">stages complete</div>
            </div>
          </div>
          <div className="rmo-stat">
            <span className="rmo-stat-icon rmo-stat-icon--flame"><Flame size={18} /></span>
            <div>
              <div className="rmo-stat-value">{streak.current} day{streak.current === 1 ? '' : 's'}</div>
              <div className="rmo-stat-label">training streak</div>
            </div>
          </div>
        </div>

        {/* Data-derived callouts */}
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

        {/* Progress + XP */}
        <div className="rmo-progress">
          <div className="rmo-progress-head">
            <span>Overall Progress</span>
            <span className="rmo-progress-pct">{overallPct}%</span>
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
            className="rmo-hero-cta"
            onClick={() => navigate(`/roadmap/${currentStage.id}`)}
          >
            <span className="rmo-cta-label">{currentStage.state === 'in_progress' ? 'Resume' : 'Start'} Stage {currentStage.order}</span>
            <span className="rmo-cta-arrow" aria-hidden>→</span>
          </button>
        )}
      </header>

      {/* ── Deeper area tool cards ── */}
      <div className="road-links">
        <button className="road-link" onClick={() => navigate('/roadmap/roles')}>
          <span className="road-link-icon"><Users size={20} /></span>
          <span className="road-link-body">
            <span className="road-link-title">Role System</span>
            <span className="road-link-sub">Discovery + 7 role guides</span>
          </span>
          <ChevronRight size={15} className="road-link-chev" />
        </button>
        <button className="road-link" onClick={() => navigate('/roadmap/progress-report')}>
          <span className="road-link-icon"><LineChart size={20} /></span>
          <span className="road-link-body">
            <span className="road-link-title">Progress Report</span>
            <span className="road-link-sub">Your improvement over time</span>
          </span>
          <ChevronRight size={15} className="road-link-chev" />
        </button>
        <button className="road-link" onClick={() => navigate('/roadmap/gameplay-review')}>
          <span className="road-link-icon"><ClipboardList size={20} /></span>
          <span className="road-link-body">
            <span className="road-link-title">Gameplay Review</span>
            <span className="road-link-sub">Debrief a session or match</span>
          </span>
          <ChevronRight size={15} className="road-link-chev" />
        </button>
      </div>

      {/* ── View toggle ── */}
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

      <div key={view} className="rmo-view-content">
        {view === 'stage' ? (
          <>
            <ol className="rmo-timeline">
              {stages.map((s, i) => (
                <StageRow
                  key={s.id}
                  stage={s}
                  index={i}
                  isLast={i === stages.length - 1}
                  onOpen={() => navigate(`/roadmap/${s.id}`)}
                  gated={!isActive && !subLoading && i >= 3}
                />
              ))}
            </ol>

            <footer className="rmo-footer">
              <p className="rmo-footer-quote">{ROADMAP_INTRO.coreLoop}</p>
              <span className="rmo-footer-stamp">{ROADMAP_INTRO.tagline}</span>
            </footer>
          </>
        ) : (
          <ThirtyDayJourney />
        )}
      </div>

      <style>{styles}</style>
    </div>
  )
}

/* ============================================================
   STAGE ROW — all logic preserved, visual layer updated
   ============================================================ */
function StageRow({ stage, index, isLast, onOpen, gated }) {
  const { state, order, title, description, icon } = stage
  const locked = state === 'locked'
  const done = state === 'completed'
  const inProgress = state === 'in_progress'
  const available = state === 'available'

  if (gated) {
    return (
      <li style={{ position: 'relative', overflow: 'hidden', display: 'flex', gap: 14, marginBottom: 12 }}>
        {/* Blurred rail */}
        <div className="rmo-rail" style={{ filter: 'blur(2px)', opacity: 0.35, pointerEvents: 'none', flexShrink: 0 }}>
          <span className="rmo-node"><Lock size={12} /></span>
          {!isLast && <span className="rmo-rail-line" />}
        </div>
        {/* Blurred card preview */}
        <button
          type="button"
          className="rmo-card"
          disabled
          tabIndex={-1}
          aria-hidden="true"
          style={{
            filter: 'blur(3px)', opacity: 0.4,
            pointerEvents: 'none', userSelect: 'none',
            marginBottom: 0, flex: 1, animation: 'none',
          }}
        >
          <span className="rmo-card-icon" aria-hidden>{icon}</span>
          <span className="rmo-card-body">
            <span className="rmo-card-kicker">Stage {String(order).padStart(2, '0')}</span>
            <span className="rmo-card-title">{title}</span>
            {description && <span className="rmo-card-desc">{description}</span>}
          </span>
        </button>
        {/* Light-themed elite gate */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(238,244,255,0.96), rgba(255,240,243,0.96))',
          backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
          border: '1px solid #DCE5FA',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 10, padding: '0 16px', borderRadius: 14, flexWrap: 'wrap',
        }}>
          <Lock size={15} color="#5B3DF5" style={{ flexShrink: 0 }} />
          <span style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13,
            color: '#0B1224', flexShrink: 0,
          }}>Roadmap Phase 2</span>
          <span style={{
            background: 'linear-gradient(90deg, #2563FF, #5B3DF5)',
            color: '#FFFFFF',
            fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 10,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            borderRadius: 999, padding: '2px 10px', flexShrink: 0,
          }}>ELITE</span>
          <a href="/#/checkout" style={{
            background: '#2563FF', color: '#fff', borderRadius: 8, padding: '6px 16px',
            fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13,
            textDecoration: 'none', flexShrink: 0,
          }}>Upgrade →</a>
        </div>
      </li>
    )
  }

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

      <div
        className={`rmo-card-shell rmo-card-shell--${state}`}
        style={{ animationDelay: `${Math.min(index, 6) * 0.055}s` }}
      >
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
      </div>
    </li>
  )
}

/* ============================================================
   STYLES — white premium theme
   ============================================================ */
const styles = `
  /* ── Entry animation keyframes ── */
  @keyframes rmo-fadeup {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes rmo-fadein {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes rmo-bar-grow {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }

  /* ── Hero ── */
  .rmo-hero {
    position: relative; overflow: hidden;
    background: linear-gradient(135deg, #F7F9FD 0%, #EEF4FF 50%, #FFF0F2 100%);
    border: 1px solid #E5EAF3;
    border-radius: 18px;
    padding: clamp(24px, 4vw, 40px);
    display: flex; flex-direction: column; gap: 10px;
    box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 16px 48px rgba(15,23,42,0.05);
    animation: rmo-fadeup 0.5s cubic-bezier(0.23,1,0.32,1) both;
  }
  .rmo-hero-dots {
    position: absolute; inset: 0; pointer-events: none; z-index: 0;
    background-image: radial-gradient(circle, rgba(37,99,255,0.06) 1px, transparent 1px);
    background-size: 24px 24px;
  }
  .rmo-hero-glow-blue {
    position: absolute; top: -80px; left: -80px;
    width: 300px; height: 300px; border-radius: 50%;
    background: radial-gradient(circle, rgba(37,99,255,0.10) 0%, transparent 65%);
    pointer-events: none; z-index: 0;
  }
  .rmo-hero-glow-red {
    position: absolute; top: -60px; right: -60px;
    width: 250px; height: 250px; border-radius: 50%;
    background: radial-gradient(circle, rgba(239,51,64,0.07) 0%, transparent 65%);
    pointer-events: none; z-index: 0;
  }
  .rmo-hero > * { position: relative; z-index: 1; }

  .rmo-hero-kicker {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: 'Rajdhani', sans-serif; font-size: 12px;
    text-transform: uppercase; letter-spacing: 0.15em;
    color: #64748B; font-weight: 600;
  }
  .rmo-title {
    font-family: 'Anton', sans-serif; font-weight: 400;
    font-size: clamp(24px, 5vw, 36px); line-height: 1;
    letter-spacing: 0.03em; color: #0B1224; margin: 4px 0 0;
  }
  .rmo-hook {
    font-family: 'Inter', sans-serif; font-weight: 700; font-size: 15px;
    color: #0B1224; margin: 6px 0 0;
  }
  .rmo-sub {
    font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.65;
    color: #475569; max-width: 600px; margin: 4px 0 0;
  }
  .rmo-tagline {
    font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 12px;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #2563FF; margin-top: 2px;
  }

  /* ── Stat pills ── */
  .rmo-stats {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
    gap: 12px; margin-top: 16px;
  }
  .rmo-stat {
    display: flex; align-items: center; gap: 10px;
    background: #FFFFFF; border: 1px solid #E5EAF3;
    border-radius: 12px; padding: 14px 18px;
    box-shadow: 0 2px 8px rgba(15,23,42,0.04);
    min-width: 0;
  }
  .rmo-stat-icon {
    width: 36px; height: 36px; flex-shrink: 0; border-radius: 10px;
    background: #EAF2FF; color: #2563FF;
    display: flex; align-items: center; justify-content: center;
  }
  .rmo-stat-icon--flame { background: #FFF0F2; color: #EF3340; }
  .rmo-stat-value {
    font-family: 'Inter', sans-serif; font-weight: 700; font-size: 18px;
    color: #0B1224; line-height: 1.2;
  }
  .rmo-stat-label {
    font-family: 'Inter', sans-serif; font-size: 11px; color: #64748B;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;
  }

  /* ── Opportunity callouts ── */
  .rmo-opportunity-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px; margin-top: 16px;
  }
  .rmo-opp-card {
    background: #FFFFFF; border: 1px solid #E5EAF3;
    border-radius: 12px; padding: 14px 16px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 8px rgba(15,23,42,0.04);
  }
  .rmo-opportunity-grid .rmo-opp-card:nth-child(1) {
    border-left: 3px solid rgba(239,51,64,0.45);
  }
  .rmo-opportunity-grid .rmo-opp-card:nth-child(2) {
    border-left: 3px solid rgba(37,99,255,0.35);
  }
  .rmo-opp-head {
    display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
    font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 11px;
    letter-spacing: 0.08em; text-transform: uppercase; color: #2563FF;
  }
  .rmo-opp-main { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 14px; color: #0B1224; }
  .rmo-opp-main--action { font-size: 12.5px; }
  .rmo-opp-sub { font-family: 'Inter', sans-serif; font-size: 11px; color: #64748B; margin-top: 2px; }
  .rmo-opp-empty { font-family: 'Inter', sans-serif; font-size: 12px; color: #94A3B8; font-style: italic; }

  /* ── Progress ── */
  .rmo-progress { margin-top: 18px; display: flex; flex-direction: column; gap: 6px; }
  .rmo-progress-head {
    display: flex; justify-content: space-between; align-items: center;
    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #0B1224;
  }
  .rmo-progress-pct { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 14px; color: #2563FF; }
  .rmo-progress-head--xp {
    margin-top: 10px;
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500; color: #64748B;
  }
  .rmo-progress-head--xp span { display: inline-flex; align-items: center; gap: 5px; }

  .rmo-hero-cta {
    align-self: flex-start; margin-top: 14px;
    display: inline-flex; align-items: center; gap: 10px;
    background: linear-gradient(90deg, #2563FF 0%, #EF3340 100%);
    color: #FFFFFF;
    font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px;
    padding: 10px 10px 10px 20px;
    border-radius: 999px; border: none; cursor: pointer;
    box-shadow: 0 4px 16px rgba(37,99,255,0.28), inset 0 1px 0 rgba(255,255,255,0.12);
    transition: transform 0.2s cubic-bezier(0.23,1,0.32,1), box-shadow 0.2s ease;
  }
  .rmo-hero-cta:hover {
    transform: scale(1.02);
    box-shadow: 0 6px 28px rgba(37,99,255,0.38), inset 0 1px 0 rgba(255,255,255,0.12);
  }
  .rmo-hero-cta:active { transform: scale(0.98); }
  .rmo-cta-arrow {
    width: 32px; height: 32px; border-radius: 50%;
    background: rgba(255,255,255,0.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; flex-shrink: 0;
    transition: transform 0.2s cubic-bezier(0.23,1,0.32,1);
  }
  .rmo-hero-cta:hover .rmo-cta-arrow { transform: translateX(2px) scale(1.08); }

  /* ── Tool / link cards ── */
  .road-links {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
  }
  .road-link {
    background: #FFFFFF; border: 1px solid #E5EAF3;
    border-radius: 14px; padding: 20px;
    display: flex; align-items: center; gap: 12px;
    cursor: pointer; text-align: left;
    transition: transform 0.2s cubic-bezier(0.23,1,0.32,1), border-color 0.2s ease, box-shadow 0.2s ease;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 8px rgba(15,23,42,0.04);
  }
  .road-link:hover {
    transform: translateY(-2px);
    border-color: #2563FF;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 24px rgba(37,99,255,0.09);
  }
  .road-link-icon {
    width: 40px; height: 40px; border-radius: 10px;
    background: #EAF2FF; color: #2563FF;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    transition: transform 0.2s cubic-bezier(0.23,1,0.32,1);
  }
  .road-link:hover .road-link-icon {
    transform: translateX(2px) translateY(-1px) scale(1.06);
  }
  .road-link-body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .road-link-title { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 14px; color: #0B1224; }
  .road-link-sub { font-family: 'Inter', sans-serif; font-size: 12px; color: #64748B; }
  .road-link-chev { color: #2563FF; margin-left: auto; flex-shrink: 0; }

  /* ── View tabs ── */
  .rmo-viewtabs {
    display: flex; align-items: center; gap: 4px;
    background: #F1F4F9; border-radius: 10px; padding: 4px;
    align-self: flex-start;
  }
  .rmo-viewtab {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 7px; border: none;
    background: transparent; cursor: pointer;
    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500;
    color: #64748B; transition: all 0.15s ease;
  }
  .rmo-viewtab.is-active {
    background: #FFFFFF; color: #0B1224; font-weight: 600;
    box-shadow: 0 2px 8px rgba(15,23,42,0.08);
  }

  /* ── Timeline ── */
  .rmo-timeline { list-style: none; margin: 4px 0 0; padding: 0; }
  .rmo-row { display: flex; gap: 14px; }
  .rmo-rail { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; width: 34px; }
  .rmo-node {
    width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #E5EAF3; background: #FFFFFF; color: #94A3B8;
  }
  .rmo-node-num { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 12px; }
  .rmo-rail-line { width: 2px; flex: 1; min-height: 20px; background: #E5EAF3; margin: 4px 0; }

  .rmo-row--available .rmo-node { border-color: #2563FF; color: #2563FF; }
  .rmo-row--in_progress .rmo-node {
    border-color: #2563FF; background: #2563FF; color: #fff;
    box-shadow: 0 0 14px rgba(37,99,255,0.35);
  }
  .rmo-row--completed .rmo-node { border-color: #16A34A; background: #16A34A; color: #fff; }
  .rmo-row--completed .rmo-rail-line { background: #16A34A; }

  /* ── Stage card shells (outer bezel) ── */
  .rmo-card-shell {
    flex: 1; min-width: 0; margin-bottom: 12px;
    background: rgba(37,99,255,0.012);
    border: 1px solid rgba(37,99,255,0.05);
    border-radius: 17px; padding: 3px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    animation: rmo-fadeup 0.35s cubic-bezier(0.23,1,0.32,1) both;
  }
  .rmo-card-shell--locked {
    background: transparent;
    border-color: #E5EAF3;
  }
  .rmo-card-shell--completed {
    background: rgba(22,163,74,0.01);
    border-color: rgba(22,163,74,0.1);
  }
  .rmo-card-shell--available {
    background: rgba(37,99,255,0.018);
    border: 1px solid rgba(37,99,255,0.08);
    border-left: 3px solid #2563FF;
  }
  .rmo-card-shell--in_progress {
    background: rgba(37,99,255,0.03);
    border-color: rgba(37,99,255,0.15);
    box-shadow: 0 0 0 3px rgba(37,99,255,0.05), 0 8px 28px rgba(37,99,255,0.08);
  }
  .rmo-card-shell:has(.rmo-card:hover:not(:disabled)) {
    border-color: rgba(37,99,255,0.22);
    box-shadow: 0 6px 20px rgba(37,99,255,0.09);
  }
  .rmo-card-shell--in_progress:has(.rmo-card:hover:not(:disabled)) {
    box-shadow: 0 0 0 3px rgba(37,99,255,0.06), 0 10px 32px rgba(37,99,255,0.12);
  }

  /* ── Stage cards (inner core) ── */
  .rmo-card {
    width: 100%; box-sizing: border-box; text-align: left; cursor: pointer;
    display: flex; align-items: center; gap: 13px;
    background: #FFFFFF; border: none;
    border-radius: 14px; padding: 16px 18px; margin-bottom: 0;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.9);
    transition: transform 0.2s cubic-bezier(0.23,1,0.32,1);
  }
  .rmo-card:hover:not(:disabled) {
    transform: translateY(-1px);
  }
  .rmo-row--completed .rmo-card { background: rgba(22,163,74,0.01); }

  /* Current stage: dominant inner */
  .rmo-card--current {
    padding: 20px 20px 20px 22px;
    background: linear-gradient(135deg, rgba(37,99,255,0.04), #FFFFFF 60%);
    position: relative;
  }
  .rmo-card--current .rmo-card-icon { font-size: 30px; }
  .rmo-card--current .rmo-card-title { font-size: 19px; }
  .rmo-current-ribbon {
    position: absolute; top: -9px; left: 18px;
    background: linear-gradient(90deg, #2563FF, #EF3340); color: #fff;
    font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 10px;
    letter-spacing: 0.08em; text-transform: uppercase;
    border-radius: 999px; padding: 3px 10px;
    box-shadow: 0 2px 8px rgba(37,99,255,0.30);
  }

  /* Locked: muted, understated */
  .rmo-card--locked {
    background: #F8FAFF; border-color: #E5EAF3;
    padding: 14px 16px; opacity: 0.65;
  }
  .rmo-card--locked:hover { transform: none; border-color: #E5EAF3; box-shadow: none; }
  .rmo-card--locked .rmo-card-icon { font-size: 18px; filter: grayscale(0.7); }
  .rmo-card--locked .rmo-card-title { font-size: 14px; color: #94A3B8; font-weight: 600; }
  .rmo-card:disabled { cursor: default; }

  .rmo-lock-hint {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: 'Inter', sans-serif; font-size: 11px; color: #94A3B8;
  }
  .rmo-card-icon { font-size: 24px; line-height: 1; flex-shrink: 0; }
  .rmo-card-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
  .rmo-card-kicker {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.12em; color: #64748B;
  }
  .rmo-card-title { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 16px; color: #0B1224; }
  .rmo-card-desc { font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.5; color: #64748B; }
  .rmo-card-hint {
    display: inline-flex; align-items: center; gap: 5px; margin-top: 4px;
    font-family: 'Inter', sans-serif; font-size: 12px; color: #94A3B8;
  }
  .rmo-card-chev {
    flex-shrink: 0; display: inline-flex; align-items: center; gap: 3px;
    font-family: 'Inter', sans-serif; font-weight: 600; font-size: 12px;
    letter-spacing: 0.04em; text-transform: uppercase; color: #2563FF;
  }
  .rmo-row--completed .rmo-card-chev { color: #16A34A; }

  /* Tags / badges */
  .rmo-tag {
    font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
    border-radius: 999px; padding: 2px 8px; border: 1px solid transparent;
  }
  .rmo-tag--done { background: rgba(22,163,74,0.08); color: #16A34A; border-color: rgba(22,163,74,0.2); }
  .rmo-tag--open { background: #EAF2FF; color: #2563FF; border-color: rgba(37,99,255,0.2); }

  /* Footer */
  .rmo-footer {
    text-align: center; padding: 30px 20px 8px;
    display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .rmo-footer-quote {
    font-family: 'Inter', sans-serif; font-size: 14px; line-height: 1.7;
    color: #64748B; margin: 0;
  }
  .rmo-footer-quote strong { color: #0B1224; }
  .rmo-footer-stamp {
    font-family: 'Anton', sans-serif; font-size: 24px; letter-spacing: 0.10em;
    background: linear-gradient(90deg, #2563FF, #EF3340);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }

  @media (max-width: 700px) {
    .road-links { grid-template-columns: 1fr; }
    .rmo-stats { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 600px) {
    .rmo-card { flex-wrap: wrap; }
    .rmo-card-chev { width: 100%; justify-content: flex-end; }
    .rmo-card-title { font-size: 14.5px; }
  }

  /* ── Progress bar grow (scaleX — no layout reflow) ── */
  .road-bar-fill {
    transform-origin: left center;
    animation: rmo-bar-grow 0.7s cubic-bezier(0.23,1,0.32,1) 0.4s both;
  }
  .road-bar-fill--xp {
    animation-delay: 0.52s;
  }

  /* ── View content fade on tab switch ── */
  .rmo-view-content {
    animation: rmo-fadein 0.15s ease both;
  }

  /* ── Reduced motion ── */
  @media (prefers-reduced-motion: reduce) {
    .rmo-hero {
      animation: rmo-fadein 0.2s ease both;
    }
    .rmo-card-shell {
      animation: rmo-fadein 0.15s ease both !important;
    }
    .rmo-card {
      animation: none !important;
    }
    .road-bar-fill {
      animation: none;
      transform: none;
    }
    .rmo-view-content {
      animation: none;
    }
  }
`
