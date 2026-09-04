import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Lock, Check, BookOpen, ClipboardList, BarChart3, Dumbbell, Flag,
  CalendarDays, Hammer,
} from 'lucide-react'
import { useRoadmap } from '../../hooks/useRoadmap.js'
import { useUserData } from '../../hooks/useUserData.js'
import { readySections } from '../../data/roadmapStages.js'
import StageContent from './StageContent.jsx'
import StageAssessment from './StageAssessment.jsx'
import StageResult from './StageResult.jsx'
import StageImprove from './StageImprove.jsx'
import StageNextStep from './StageNextStep.jsx'

/* The core product loop, applied to every stage: Learn -> Assess -> Result
   -> Improve -> Next. */
const PHASES = [
  { id: 'content',    label: 'Learn',    icon: BookOpen },
  { id: 'assessment', label: 'Assess',   icon: ClipboardList },
  { id: 'result',     label: 'Result',   icon: BarChart3 },
  { id: 'improve',    label: 'Improve',  icon: Dumbbell },
  { id: 'next',       label: 'Next',     icon: Flag },
]

export default function RoadmapStage() {
  const { stageId } = useParams()
  const navigate = useNavigate()
  const {
    loading, getStage, dayCount,
    enterStage, setPhase, setActiveSection, markSectionViewed,
    saveNote, saveAnswer, submitAssessment, completeStage,
  } = useRoadmap()
  const { updateXP } = useUserData()

  const stage = getStage(stageId)
  const enteredRef = useRef(false)

  /* Enter an available stage on first view (stamps roadmap start date +
     marks in_progress). Never runs for locked/completed stages. */
  useEffect(() => {
    if (!loading && stage && stage.state === 'available' && !enteredRef.current) {
      enteredRef.current = true
      enterStage(stage.id)
    }
  }, [loading, stage, enterStage])

  if (loading) {
    return (
      <div className="road-stage-wrap page-transition">
        <div className="card skeleton" style={{ height: 54 }} />
        <div className="card skeleton" style={{ height: 340 }} />
      </div>
    )
  }

  if (!stage) {
    return (
      <div className="road-stage-wrap page-transition">
        <Notice
          title="Stage not found"
          body="That roadmap stage doesn't exist."
          action={() => navigate('/roadmap')}
          actionLabel="Back to Roadmap"
        />
      </div>
    )
  }

  if (stage.state === 'locked') {
    return (
      <div className="road-stage-wrap page-transition">
        <Notice
          icon={<Lock size={24} />}
          title={`Stage ${String(stage.order).padStart(2, '0')} is locked`}
          body={`Complete Stage ${String(stage.order - 1).padStart(2, '0')} to unlock "${stage.title}".`}
          action={() => navigate('/roadmap')}
          actionLabel="Back to Roadmap"
        />
      </div>
    )
  }

  const phase = stage.phase || 'content'
  const hasResult = !!stage.result
  const isComplete = stage.state === 'completed'
  const hasContent = readySections(stage).length > 0 || !stage.comingSoon

  const reachable = {
    content: true,
    assessment: true,
    result: hasResult || isComplete,
    improve: hasResult || isComplete,
    next: isComplete,
  }

  function jumpPhase(p) {
    if (reachable[p]) setPhase(stage.id, p)
  }

  function handleFinish() {
    const { newlyCompleted, xpReward } = completeStage(stage.id)
    if (newlyCompleted && xpReward) updateXP(xpReward)
  }

  return (
    <div className="road-stage-wrap page-transition">
      <button className="road-back" onClick={() => navigate('/roadmap')}>
        <ArrowLeft size={14} /> The Road to Esports
      </button>

      <div className="road-stage-head">
        <span className="road-stage-emoji" aria-hidden>{stage.icon}</span>
        <div className="road-stage-headtext">
          <div className="road-stage-kicker">
            Stage {String(stage.order).padStart(2, '0')}
            <span className="road-daychip"><CalendarDays size={11} /> Day {dayCount}</span>
          </div>
          <h1 className="road-stage-title">{stage.title}</h1>
          <p className="road-stage-desc">{stage.description}</p>
        </div>
      </div>

      {hasContent ? (
        <>
          <PhaseTracker current={phase} reachable={reachable} completed={isComplete} onJump={jumpPhase} />

          {phase === 'content' && (
            <StageContent
              stage={stage}
              onSetActiveSection={(sid) => setActiveSection(stage.id, sid)}
              onViewSection={(sid) => markSectionViewed(stage.id, sid)}
              onSaveNote={(sid, text) => saveNote(stage.id, sid, text)}
              onContinue={() => setPhase(stage.id, 'assessment')}
            />
          )}

          {phase === 'assessment' && (
            <StageAssessment
              stage={stage}
              onAnswer={(sid, qid, idx) => saveAnswer(stage.id, sid, qid, idx)}
              onBack={() => setPhase(stage.id, 'content')}
              onSubmit={() => submitAssessment(stage.id)}
            />
          )}

          {phase === 'result' && (
            <StageResult
              stage={stage}
              onRetake={() => setPhase(stage.id, 'assessment')}
              onReview={() => setPhase(stage.id, 'content')}
              onContinue={() => setPhase(stage.id, 'improve')}
            />
          )}

          {phase === 'improve' && (
            <StageImprove
              stage={stage}
              onBack={() => setPhase(stage.id, 'result')}
              onContinue={handleFinish}
            />
          )}

          {phase === 'next' && (
            <StageNextStep
              stage={stage}
              dayCount={dayCount}
              onReview={() => setPhase(stage.id, 'content')}
              onBackToRoadmap={() => navigate('/roadmap')}
              onNextStage={(id) => navigate(`/roadmap/${id}`)}
            />
          )}
        </>
      ) : (
        <ComingSoonStage stage={stage} onBack={() => navigate('/roadmap')} />
      )}

      <style>{styles}</style>
    </div>
  )
}

/* ============================================================
   PHASE TRACKER
   ============================================================ */
function PhaseTracker({ current, reachable, completed, onJump }) {
  const currentIdx = PHASES.findIndex(p => p.id === current)
  return (
    <div className="road-tracker" role="tablist" aria-label="Stage phases">
      {PHASES.map((p, i) => {
        const Icon = p.icon
        const isCurrent = p.id === current
        const isPast = completed || i < currentIdx
        const canJump = reachable[p.id]
        return (
          <div key={p.id} className="road-tracker-item">
            <button
              className={`road-tstep ${isCurrent ? 'is-current' : ''} ${isPast ? 'is-past' : ''}`}
              disabled={!canJump}
              onClick={canJump ? () => onJump(p.id) : undefined}
              role="tab"
              aria-selected={isCurrent}
            >
              <span className="road-tstep-dot">
                {isPast && !isCurrent ? <Check size={12} strokeWidth={3} /> : <Icon size={12} />}
              </span>
              <span className="road-tstep-label">{p.label}</span>
            </button>
            {i < PHASES.length - 1 && <span className={`road-tstep-line ${isPast ? 'is-past' : ''}`} />}
          </div>
        )
      })}
    </div>
  )
}

/* ============================================================
   COMING-SOON STAGE (stages 2–10, content not authored yet)
   ============================================================ */
function ComingSoonStage({ stage, onBack }) {
  return (
    <div className="card road-soon">
      <span className="road-soon-icon"><Hammer size={26} /></span>
      <h2 className="road-soon-title">Stage {String(stage.order).padStart(2, '0')} content is in the works</h2>
      <p className="road-soon-body">
        &ldquo;{stage.title}&rdquo; is unlocked, but its lessons and assessment are still
        being written. It&apos;ll appear here as soon as it&apos;s ready — your progress
        so far is saved.
      </p>
      <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginTop: 6 }}>
        <ArrowLeft size={13} /> Back to Roadmap
      </button>
    </div>
  )
}

/* ============================================================
   SHARED NOTICE
   ============================================================ */
function Notice({ icon, title, body, action, actionLabel }) {
  return (
    <div className="card empty-state">
      {icon && <span className="empty-state-icon">{icon}</span>}
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-desc">{body}</div>
      {action && (
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={action}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

const styles = `
  .road-stage-wrap { display: flex; flex-direction: column; gap: 16px; max-width: 1040px; margin: 0 auto; width: 100%; }
  .road-back {
    align-self: flex-start; display: inline-flex; align-items: center; gap: 6px;
    background: transparent; border: none; padding: 0; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text-subtle);
  }
  .road-back:hover { color: var(--text-primary); }

  .road-stage-head { display: flex; gap: 13px; align-items: flex-start; }
  .road-stage-emoji { font-size: 30px; line-height: 1; flex-shrink: 0; }
  .road-stage-headtext { min-width: 0; }
  .road-stage-kicker {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    font-family: 'DM Sans', sans-serif; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-subtle);
  }
  .road-stage-title {
    font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 27px;
    letter-spacing: 0.03em; text-transform: uppercase; color: var(--text-primary);
    margin: 3px 0 0;
  }
  .road-stage-desc { font-family: 'DM Sans', sans-serif; font-size: 12.5px; color: var(--text-muted); margin: 4px 0 0; }

  /* Phase tracker */
  .road-tracker {
    display: flex; align-items: center; overflow-x: auto;
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 10px 12px;
  }
  .road-tracker::-webkit-scrollbar { display: none; }
  .road-tracker-item { display: flex; align-items: center; flex-shrink: 0; }
  .road-tstep {
    display: flex; align-items: center; gap: 7px; padding: 4px 6px;
    background: transparent; border: none; cursor: pointer; white-space: nowrap;
    font-family: 'DM Sans', sans-serif; font-size: 12.5px; color: var(--text-subtle);
  }
  .road-tstep:disabled { cursor: default; opacity: 0.55; }
  .road-tstep-dot {
    width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
    border: 2px solid var(--border);
    display: flex; align-items: center; justify-content: center;
  }
  .road-tstep.is-current { color: var(--text-primary); }
  .road-tstep.is-current .road-tstep-dot { border-color: var(--violet); background: var(--violet); color: #fff; }
  .road-tstep.is-past { color: var(--text-muted); }
  .road-tstep.is-past .road-tstep-dot { border-color: var(--green); background: var(--green); color: #04140b; }
  .road-tstep-line { width: 22px; height: 2px; background: var(--border); flex-shrink: 0; }
  .road-tstep-line.is-past { background: var(--green); }

  /* Coming soon */
  .road-soon { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 34px 22px; }
  .road-soon-icon {
    width: 54px; height: 54px; border-radius: 14px;
    background: var(--bg-elevated); border: 1px solid var(--border);
    color: var(--text-muted); display: flex; align-items: center; justify-content: center;
  }
  .road-soon-title { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 17px; color: var(--text-primary); }
  .road-soon-body { font-family: 'DM Sans', sans-serif; font-size: 13px; line-height: 1.6; color: var(--text-muted); max-width: 420px; }

  /* Two-column layout shared by Content + Assessment phases */
  .road-grid { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; }
  .road-grid-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .road-grid-aside { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  @media (min-width: 940px) {
    .road-grid { grid-template-columns: minmax(0, 1fr) 300px; }
    .road-grid-aside { position: sticky; top: 16px; }
  }
`
