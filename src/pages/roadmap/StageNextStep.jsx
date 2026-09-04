import { useMemo } from 'react'
import {
  Check, Zap, Play, ArrowLeft, RotateCcw, PartyPopper, CalendarDays,
} from 'lucide-react'
import { ROADMAP_STAGES } from '../../data/roadmapStages.js'

/*
 * Phase D — NEXT STEP.
 *
 * Confirms the stage is complete, shows the XP earned (awarded through the
 * app's EXISTING XP system by the parent — this screen only displays it),
 * and routes back to the overview where the next stage is now unlocked.
 */
export default function StageNextStep({
  stage, dayCount, onReview, onBackToRoadmap, onNextStage,
}) {
  const next = useMemo(() => {
    const idx = ROADMAP_STAGES.findIndex(s => s.id === stage.id)
    return ROADMAP_STAGES[idx + 1] || null
  }, [stage.id])

  const level = stage.result?.overallLevel
  const score = stage.result?.overall

  return (
    <div className="rmn-wrap">
      <div className="card rmn-hero">
        <div className="rmn-check"><Check size={30} strokeWidth={3} /></div>
        <div className="rmn-hero-kicker">
          Stage {String(stage.order).padStart(2, '0')} complete
          <span className="road-daychip"><CalendarDays size={11} /> Day {dayCount}</span>
        </div>
        <h2 className="rmn-hero-title">{stage.title}</h2>
        {level && (
          <p className="rmn-hero-sub">
            You finished at a <strong>{level}</strong> level ({score}/100). That baseline
            is saved — later stages will track how far you&apos;ve moved.
          </p>
        )}
        <div className="rmn-xp">
          <Zap size={15} /> +{stage.xpReward} XP earned
        </div>
        <div className="rmn-xp-note">Added to your account XP &amp; level — check the Dashboard.</div>
      </div>

      {next ? (
        <div className="card rmn-next">
          <div className="rmn-next-label">Next up · now unlocked</div>
          <div className="rmn-next-row">
            <span className="rmn-next-emoji" aria-hidden>{next.icon}</span>
            <div className="rmn-next-text">
              <div className="rmn-next-title">
                Stage {String(next.order).padStart(2, '0')} — {next.title}
              </div>
              <div className="rmn-next-desc">{next.description}</div>
            </div>
          </div>
          <button className="btn btn-primary rmn-next-cta" onClick={() => onNextStage(next.id)}>
            <Play size={14} /> Go to Stage {String(next.order).padStart(2, '0')}
          </button>
        </div>
      ) : (
        <div className="card rmn-done">
          <PartyPopper size={26} />
          <div className="rmn-done-title">You&apos;ve reached the end of the road</div>
          <div className="rmn-done-sub">
            Every stage is complete. Keep the habits going in the Training Center and Scheduler.
          </div>
        </div>
      )}

      <div className="rmn-actions">
        <button className="btn btn-secondary" onClick={onReview}>
          <RotateCcw size={14} /> Review This Stage
        </button>
        <button className="btn btn-primary" onClick={onBackToRoadmap}>
          <ArrowLeft size={14} /> Back to Roadmap
        </button>
      </div>

      <style>{styles}</style>
    </div>
  )
}

const styles = `
  .rmn-wrap { display: flex; flex-direction: column; gap: 16px; }

  .rmn-hero {
    text-align: center; display: flex; flex-direction: column; align-items: center; gap: 7px;
    padding: 30px 22px;
    background: linear-gradient(165deg, rgba(124,58,237,0.10), rgba(13,21,40,0.4));
    border-color: rgba(124,58,237,0.3);
  }
  .rmn-check {
    width: 56px; height: 56px; border-radius: 50%; background: var(--green); color: #04140b;
    display: flex; align-items: center; justify-content: center;
  }
  .rmn-hero-kicker {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center;
    margin-top: 6px;
    font-family: 'DM Sans', sans-serif; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-subtle);
  }
  .rmn-hero-title {
    font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 26px;
    letter-spacing: 0.03em; text-transform: uppercase; color: var(--text-primary); margin: 2px 0 0;
  }
  .rmn-hero-sub {
    font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.6;
    color: var(--text-muted); max-width: 380px; margin: 4px 0 0;
  }
  .rmn-hero-sub strong { color: var(--text-primary); }
  .rmn-xp {
    display: inline-flex; align-items: center; gap: 6px; margin-top: 12px;
    background: var(--violet-tint); border: 1px solid rgba(124,58,237,0.3); color: var(--violet);
    border-radius: 999px; padding: 6px 16px;
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 13px;
  }
  .rmn-xp-note { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-subtle); margin-top: 5px; }

  .rmn-next-label {
    font-family: 'DM Sans', sans-serif; font-size: 10.5px; text-transform: uppercase;
    letter-spacing: 0.09em; color: var(--green); margin-bottom: 10px;
  }
  .rmn-next-row { display: flex; gap: 12px; align-items: flex-start; }
  .rmn-next-emoji { font-size: 26px; line-height: 1; flex-shrink: 0; }
  .rmn-next-title { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 15px; color: var(--text-primary); }
  .rmn-next-desc { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.5; color: var(--text-muted); margin-top: 3px; }
  .rmn-next-cta { margin-top: 14px; }

  .rmn-done { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 26px; color: var(--cyan); }
  .rmn-done-title { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 16px; color: var(--text-primary); }
  .rmn-done-sub { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.6; color: var(--text-muted); max-width: 360px; }

  .rmn-actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .rmn-actions .btn { flex: 1; min-width: 160px; }
`
