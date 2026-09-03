import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, X, Lock, BookOpen, ListChecks,
  ClipboardCheck, Flag, Bot, Play, Video, FileText, Dumbbell,
  RotateCcw, Zap, PartyPopper,
} from 'lucide-react'
import { useRoadmap } from '../hooks/useRoadmap.js'
import { useUserData } from '../hooks/useUserData.js'
import { ROADMAP_STAGES } from '../data/roadmapStages.js'

const PHASE_STEPS = [
  { id: 'content',    label: 'Content',   icon: BookOpen },
  { id: 'assessment', label: 'Assessment', icon: ListChecks },
  { id: 'result',     label: 'Result',    icon: ClipboardCheck },
  { id: 'next',       label: 'Next Step', icon: Flag },
]

export default function RoadmapStage() {
  const { stageId } = useParams()
  const navigate = useNavigate()
  const {
    loading, getStage, startStage, goToPhase, saveNotes, saveAssessment, completeStage,
  } = useRoadmap()
  const { updateXP } = useUserData()

  const stage = getStage(stageId)
  const startedRef = useRef(false)

  /* Auto-start an available stage on first view. */
  useEffect(() => {
    if (!loading && stage && stage.state === 'available' && !startedRef.current) {
      startedRef.current = true
      startStage(stage.id)
    }
  }, [loading, stage, startStage])

  if (loading) {
    return (
      <div className="rs-wrap page-transition">
        <div className="card skeleton" style={{ height: 60 }} />
        <div className="card skeleton" style={{ height: 320 }} />
        <style>{styles}</style>
      </div>
    )
  }

  if (!stage) {
    return (
      <div className="rs-wrap page-transition">
        <EmptyNotice
          title="Stage not found"
          body="That roadmap stage doesn't exist."
          action={() => navigate('/roadmap')}
          actionLabel="Back to Roadmap"
        />
        <style>{styles}</style>
      </div>
    )
  }

  if (stage.state === 'locked') {
    return (
      <div className="rs-wrap page-transition">
        <EmptyNotice
          icon={<Lock size={26} />}
          title={`Stage ${stage.order} is locked`}
          body={`Finish Stage ${stage.order - 1} to unlock "${stage.title}".`}
          action={() => navigate('/roadmap')}
          actionLabel="Back to Roadmap"
        />
        <style>{styles}</style>
      </div>
    )
  }

  const phase = stage.phase || 'content'

  function handleAssessmentSubmit({ correct, total, answers }) {
    saveAssessment(stage.id, { correct, total, answers })
  }

  function handleFinish() {
    const newlyCompleted = completeStage(stage.id)
    if (newlyCompleted && stage.xpReward) {
      updateXP(stage.xpReward)
    }
    /* completeStage sets phase to 'next' internally */
  }

  return (
    <div className="rs-wrap page-transition">
      <button className="rs-back" onClick={() => navigate('/roadmap')}>
        <ArrowLeft size={14} /> Roadmap
      </button>

      <div className="rs-titlerow">
        <span className="rs-emoji">{stage.icon}</span>
        <div>
          <div className="rs-kicker">Stage {stage.order}</div>
          <h1 className="rs-h1">{stage.title}</h1>
        </div>
      </div>

      <PhaseStepper current={phase} completed={stage.state === 'completed'} onJump={(p) => goToPhase(stage.id, p)} />

      {phase === 'content' && (
        <ContentPhase
          stage={stage}
          onNotes={(v) => saveNotes(stage.id, v)}
          onContinue={() => goToPhase(stage.id, 'assessment')}
        />
      )}

      {phase === 'assessment' && (
        <AssessmentPhase
          stage={stage}
          onBack={() => goToPhase(stage.id, 'content')}
          onSubmit={handleAssessmentSubmit}
        />
      )}

      {phase === 'result' && (
        <ResultPhase
          stage={stage}
          onRetake={() => goToPhase(stage.id, 'assessment')}
          onReview={() => goToPhase(stage.id, 'content')}
          onContinue={handleFinish}
        />
      )}

      {phase === 'next' && (
        <NextStepPhase
          stage={stage}
          onReview={() => goToPhase(stage.id, 'content')}
          onBackToRoadmap={() => navigate('/roadmap')}
          onNextStage={(id) => navigate(`/roadmap/${id}`)}
        />
      )}

      <style>{styles}</style>
    </div>
  )
}

/* ============================================================
   PHASE STEPPER
   ============================================================ */
function PhaseStepper({ current, completed, onJump }) {
  const currentIdx = PHASE_STEPS.findIndex(s => s.id === current)
  return (
    <div className="rs-stepper">
      {PHASE_STEPS.map((s, i) => {
        const Icon = s.icon
        const isCurrent = s.id === current
        const isPast = i < currentIdx || completed
        const reachable = isPast || isCurrent
        return (
          <div key={s.id} className="rs-step-wrap">
            <button
              className={`rs-step ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}
              disabled={!reachable}
              onClick={reachable ? () => onJump(s.id) : undefined}
            >
              <span className="rs-step-dot">
                {isPast && !isCurrent ? <Check size={13} strokeWidth={3} /> : <Icon size={13} />}
              </span>
              <span className="rs-step-label">{s.label}</span>
            </button>
            {i < PHASE_STEPS.length - 1 && <span className={`rs-step-line ${isPast ? 'past' : ''}`} />}
          </div>
        )
      })}
    </div>
  )
}

/* ============================================================
   PHASE 1 — CONTENT
   ============================================================ */
const CONTENT_TABS = [
  { id: 'lesson',    label: 'Content' },
  { id: 'keyPoints', label: 'Key Points' },
  { id: 'examples',  label: 'Examples' },
]

function ContentPhase({ stage, onNotes, onContinue }) {
  const [tab, setTab] = useState('lesson')
  const [notes, setNotesLocal] = useState(stage.notes || '')
  const saveTimer = useRef(null)

  const { content, coachTip, resources } = stage

  function handleNotes(v) {
    setNotesLocal(v)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => onNotes(v), 500)
  }
  useEffect(() => () => clearTimeout(saveTimer.current), [])

  return (
    <div className="rs-grid">
      <div className="rs-main">
        <div className="card">
          <p className="rs-intro">{content.intro}</p>

          <div className="rs-tabs">
            {CONTENT_TABS.map(t => (
              <button
                key={t.id}
                className={`rs-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="rs-tabbody">
            {tab === 'lesson' && content.tabs.lesson.map((b, i) => <LessonBlock key={i} block={b} />)}
            {tab === 'keyPoints' && (
              <ul className="rs-keypoints">
                {content.tabs.keyPoints.map((p, i) => (
                  <li key={i}><Check size={14} /> <span>{p}</span></li>
                ))}
              </ul>
            )}
            {tab === 'examples' && (
              <div className="rs-examples">
                {content.tabs.examples.map((ex, i) => (
                  <div key={i} className="rs-example">
                    <div className="rs-example-title">{ex.title}</div>
                    <div className="rs-example-text">{ex.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card rs-notes">
          <div className="card-title">Your notes</div>
          <textarea
            className="input"
            rows={4}
            placeholder="Jot down anything you want to remember from this stage…"
            value={notes}
            onChange={(e) => handleNotes(e.target.value)}
          />
          <div className="rs-notes-hint">Saved automatically. Visible only to you.</div>
        </div>

        <button className="btn btn-primary rs-cta" onClick={onContinue}>
          Continue to Assessment <ArrowRight size={14} />
        </button>
      </div>

      <aside className="rs-aside">
        <div className="card rs-coach">
          <div className="rs-coach-head"><Bot size={15} /> AI Coach Tip</div>
          <p>{coachTip}</p>
        </div>

        <div className="card rs-resources">
          <div className="card-title">Related Resources</div>
          <div className="rs-res-list">
            {resources.map((r, i) => <ResourceRow key={i} res={r} />)}
          </div>
        </div>
      </aside>
    </div>
  )
}

function LessonBlock({ block }) {
  if (block.type === 'h') return <h3 className="rs-lh">{block.text}</h3>
  if (block.type === 'list') {
    return (
      <ul className="rs-llist">
        {block.items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    )
  }
  return <p className="rs-lp">{block.text}</p>
}

function ResourceRow({ res }) {
  const navigate = useNavigate()
  const Icon = res.kind === 'video' ? Video : res.kind === 'drill' ? Dumbbell : FileText
  const clickable = !!res.to
  return (
    <button
      className={`rs-res ${clickable ? 'clickable' : ''}`}
      disabled={!clickable}
      onClick={clickable ? () => navigate(res.to) : undefined}
    >
      <span className="rs-res-icon"><Icon size={14} /></span>
      <span className="rs-res-label">{res.label}</span>
      {clickable ? <ArrowRight size={13} /> : <span className="rs-res-soon">soon</span>}
    </button>
  )
}

/* ============================================================
   PHASE 2 — ASSESSMENT
   ============================================================ */
function AssessmentPhase({ stage, onBack, onSubmit }) {
  const groups = stage.assessment.groups
  const allQ = useMemo(
    () => groups.flatMap(g => g.questions.map(q => ({ ...q, groupId: g.id }))),
    [groups],
  )
  const [answers, setAnswers] = useState({}) /* qid -> optionIndex */
  const [showGaps, setShowGaps] = useState(false)

  const answeredCount = Object.keys(answers).length
  const total = allQ.length
  const allAnswered = answeredCount === total

  function pick(qid, idx) {
    setAnswers(prev => ({ ...prev, [qid]: idx }))
  }

  function submit() {
    if (!allAnswered) { setShowGaps(true); return }
    let correct = 0
    allQ.forEach(q => { if (answers[q.id] === q.answer) correct += 1 })
    onSubmit({ correct, total, answers })
  }

  return (
    <div className="rs-grid rs-grid-assess">
      <div className="rs-main">
        {groups.map((g, gi) => (
          <div key={g.id} className="card rs-qgroup">
            <div className="rs-qgroup-head">
              <span className="rs-qgroup-num">{gi + 1}</span>
              <span className="rs-qgroup-title">{g.title}</span>
            </div>
            {g.questions.map((q) => {
              const globalIdx = allQ.findIndex(x => x.id === q.id)
              const missing = showGaps && answers[q.id] === undefined
              return (
                <div key={q.id} className={`rs-q ${missing ? 'missing' : ''}`}>
                  <div className="rs-q-prompt">
                    <span className="rs-q-idx">Q{globalIdx + 1}</span>
                    {q.prompt}
                  </div>
                  <div className="rs-q-opts">
                    {q.options.map((opt, oi) => (
                      <label key={oi} className={`rs-opt ${answers[q.id] === oi ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === oi}
                          onChange={() => pick(q.id, oi)}
                        />
                        <span className="rs-opt-mark" />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                  {missing && <div className="rs-q-missing">Pick an answer to continue.</div>}
                </div>
              )
            })}
          </div>
        ))}

        <div className="rs-assess-actions">
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={14} /> Back to Content
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!allAnswered}>
            Submit Assessment <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <aside className="rs-aside">
        <div className="card rs-progress">
          <div className="card-title">Progress</div>
          <div className="rs-progress-count">
            <span className="rs-progress-big">{answeredCount}</span> / {total} answered
          </div>
          <div className="rs-bar">
            <div className="rs-bar-fill" style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }} />
          </div>
          <div className="rs-progress-dots">
            {allQ.map((q, i) => (
              <span
                key={q.id}
                className={`rs-pdot ${answers[q.id] !== undefined ? 'done' : ''}`}
                title={`Q${i + 1}`}
              >
                {i + 1}
              </span>
            ))}
          </div>
          <button className="btn btn-primary btn-sm rs-progress-submit" onClick={submit} disabled={!allAnswered}>
            {allAnswered ? 'Submit' : `${total - answeredCount} left`}
          </button>
        </div>
      </aside>
    </div>
  )
}

/* ============================================================
   PHASE 3 — RESULT
   ============================================================ */
function ResultPhase({ stage, onRetake, onReview, onContinue }) {
  const result = stage.result
  const groups = stage.assessment.groups
  const allQ = useMemo(
    () => groups.flatMap(g => g.questions),
    [groups],
  )

  if (!result) {
    return (
      <EmptyNotice
        title="No attempt yet"
        body="Take the assessment first."
        action={onReview}
        actionLabel="Go to Content"
      />
    )
  }

  const pct = Math.round(result.score * 100)
  const passed = result.score >= (stage.assessment.passRate ?? 0.7)
  const answers = result.answers || {}

  return (
    <div className="rs-result">
      <div className={`card rs-scorecard ${passed ? 'pass' : 'fail'}`}>
        <div className="rs-score-ring" style={{ '--pct': pct }}>
          <span>{pct}%</span>
        </div>
        <div className="rs-score-copy">
          <div className="rs-score-verdict">
            {passed ? 'Nice — you\'ve got this' : 'Worth another look'}
          </div>
          <div className="rs-score-detail">
            {result.correct} of {result.total} correct.
            {passed
              ? ' You can move on, or review the misses below first.'
              : ` Aim for ${Math.round((stage.assessment.passRate ?? 0.7) * 100)}%+ — retake it after a quick review.`}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Question review</div>
        <div className="rs-review-list">
          {allQ.map((q, i) => {
            const given = answers[q.id]
            const ok = given === q.answer
            return (
              <div key={q.id} className={`rs-review ${ok ? 'ok' : 'bad'}`}>
                <div className="rs-review-top">
                  <span className={`rs-review-badge ${ok ? 'ok' : 'bad'}`}>
                    {ok ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                  </span>
                  <span className="rs-review-prompt">Q{i + 1}. {q.prompt}</span>
                </div>
                <div className="rs-review-ans">
                  <div><span className="rs-review-k">Your answer:</span> {given !== undefined ? q.options[given] : '—'}</div>
                  {!ok && <div><span className="rs-review-k">Correct:</span> {q.options[q.answer]}</div>}
                </div>
                {q.explain && <div className="rs-review-explain">{q.explain}</div>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="rs-result-actions">
        <button className="btn btn-secondary" onClick={onReview}>
          <RotateCcw size={14} /> Review Lesson
        </button>
        <button className="btn btn-secondary" onClick={onRetake}>
          <ListChecks size={14} /> Retake Assessment
        </button>
        <button className="btn btn-primary" onClick={onContinue}>
          Continue <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   PHASE 4 — NEXT STEP
   ============================================================ */
function NextStepPhase({ stage, onReview, onBackToRoadmap, onNextStage }) {
  const idx = ROADMAP_STAGES.findIndex(s => s.id === stage.id)
  const next = ROADMAP_STAGES[idx + 1] || null

  return (
    <div className="rs-next">
      <div className="card rs-next-hero">
        <div className="rs-next-check"><Check size={30} strokeWidth={3} /></div>
        <h2 className="rs-next-title">Stage {stage.order} complete</h2>
        <p className="rs-next-sub">{stage.title}</p>
        <div className="rs-next-xp">
          <Zap size={16} /> +{stage.xpReward} XP earned
        </div>
      </div>

      {next ? (
        <div className="card rs-next-up">
          <div className="card-title">Next up</div>
          <div className="rs-next-up-row">
            <span className="rs-next-up-emoji">{next.icon}</span>
            <div>
              <div className="rs-next-up-kicker">Stage {next.order} — now unlocked</div>
              <div className="rs-next-up-title">{next.title}</div>
              <div className="rs-next-up-tag">{next.tagline}</div>
            </div>
          </div>
          <button className="btn btn-primary rs-cta" onClick={() => onNextStage(next.id)}>
            <Play size={14} /> Start Stage {next.order}
          </button>
        </div>
      ) : (
        <div className="card rs-next-done">
          <PartyPopper size={26} />
          <div className="rs-next-done-title">You've finished the roadmap</div>
          <div className="rs-next-done-sub">
            Every stage is complete. Keep the habits going in the Training Center and Scheduler.
          </div>
        </div>
      )}

      <div className="rs-next-actions">
        <button className="btn btn-secondary" onClick={onReview}>
          <RotateCcw size={14} /> Review This Stage
        </button>
        <button className="btn btn-secondary" onClick={onBackToRoadmap}>
          <ArrowLeft size={14} /> Back to Roadmap
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   SHARED
   ============================================================ */
function EmptyNotice({ icon, title, body, action, actionLabel }) {
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
  .rs-wrap { display:flex; flex-direction:column; gap:16px; max-width:1000px; margin:0 auto; width:100%; }
  .rs-back { align-self:flex-start; display:inline-flex; align-items:center; gap:6px; background:transparent; border:none; color:var(--text-subtle); font-family:'DM Sans',sans-serif; font-size:13px; cursor:pointer; padding:0; }
  .rs-back:hover { color:var(--text-primary); }

  .rs-titlerow { display:flex; align-items:center; gap:12px; }
  .rs-emoji { font-size:30px; line-height:1; }
  .rs-kicker { font-family:'DM Sans',sans-serif; font-size:11px; text-transform:uppercase; letter-spacing:0.10em; color:var(--text-subtle); }
  .rs-h1 { font-family:'Bebas Neue',sans-serif; font-weight:400; font-size:26px; letter-spacing:0.03em; text-transform:uppercase; color:var(--text-primary); margin:2px 0 0; }

  /* Stepper */
  .rs-stepper { display:flex; align-items:center; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius); padding:10px 12px; overflow-x:auto; }
  .rs-step-wrap { display:flex; align-items:center; flex-shrink:0; }
  .rs-step { display:flex; align-items:center; gap:7px; background:transparent; border:none; cursor:pointer; padding:4px 6px; color:var(--text-subtle); font-family:'DM Sans',sans-serif; font-size:12.5px; white-space:nowrap; }
  .rs-step:disabled { cursor:default; opacity:0.6; }
  .rs-step-dot { width:24px; height:24px; border-radius:50%; border:2px solid var(--border); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .rs-step.current { color:var(--text-primary); }
  .rs-step.current .rs-step-dot { border-color:var(--blue); background:var(--blue); color:#fff; }
  .rs-step.past .rs-step-dot { border-color:var(--green); background:var(--green); color:#04140b; }
  .rs-step.past { color:var(--text-muted); }
  .rs-step-line { width:26px; height:2px; background:var(--border); flex-shrink:0; }
  .rs-step-line.past { background:var(--green); }

  /* Two-column layout */
  .rs-grid { display:grid; grid-template-columns:1fr; gap:16px; }
  .rs-main { display:flex; flex-direction:column; gap:16px; min-width:0; }
  .rs-aside { display:flex; flex-direction:column; gap:16px; min-width:0; }
  @media (min-width:900px) {
    .rs-grid { grid-template-columns:minmax(0,1fr) 300px; align-items:start; }
    .rs-grid-assess { grid-template-columns:minmax(0,1fr) 260px; }
    .rs-aside { position:sticky; top:16px; }
  }

  .rs-intro { font-family:'DM Sans',sans-serif; font-size:13.5px; line-height:1.7; color:var(--text-muted); margin:0 0 14px; }

  .rs-tabs { display:flex; gap:4px; border-bottom:1px solid var(--border); margin-bottom:14px; }
  .rs-tab { background:transparent; border:none; border-bottom:2px solid transparent; padding:8px 12px; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:12.5px; font-weight:500; color:var(--text-subtle); margin-bottom:-1px; }
  .rs-tab.active { color:var(--text-primary); border-bottom-color:var(--blue); }

  .rs-tabbody { font-family:'DM Sans',sans-serif; }
  .rs-lh { font-family:'Oxanium',sans-serif; font-weight:700; font-size:14px; color:var(--text-primary); margin:16px 0 6px; }
  .rs-lh:first-child { margin-top:0; }
  .rs-lp { font-size:13px; line-height:1.7; color:var(--text-muted); margin:0 0 10px; }
  .rs-llist { margin:0 0 10px; padding-left:18px; display:flex; flex-direction:column; gap:6px; }
  .rs-llist li { font-size:13px; line-height:1.6; color:var(--text-muted); }
  .rs-keypoints { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
  .rs-keypoints li { display:flex; gap:9px; font-size:13px; line-height:1.6; color:var(--text-muted); }
  .rs-keypoints li svg { color:var(--green); flex-shrink:0; margin-top:3px; }
  .rs-examples { display:flex; flex-direction:column; gap:12px; }
  .rs-example { background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px 14px; }
  .rs-example-title { font-family:'Oxanium',sans-serif; font-weight:700; font-size:12.5px; color:var(--text-primary); margin-bottom:5px; }
  .rs-example-text { font-size:12.5px; line-height:1.6; color:var(--text-muted); }

  .rs-notes textarea { margin-top:10px; font-family:'DM Sans',sans-serif; }
  .rs-notes-hint { font-size:11px; color:var(--text-subtle); margin-top:6px; }

  .rs-cta { align-self:flex-start; }

  .rs-coach { background:linear-gradient(160deg, rgba(34,211,238,0.08), rgba(59,130,246,0.05)); border-color:rgba(34,211,238,0.25); }
  .rs-coach-head { display:flex; align-items:center; gap:7px; font-family:'Oxanium',sans-serif; font-weight:700; font-size:12px; letter-spacing:0.05em; text-transform:uppercase; color:var(--cyan); margin-bottom:8px; }
  .rs-coach p { font-family:'DM Sans',sans-serif; font-size:12.5px; line-height:1.65; color:var(--text-muted); margin:0; }

  .rs-res-list { display:flex; flex-direction:column; gap:8px; margin-top:10px; }
  .rs-res { display:flex; align-items:center; gap:9px; width:100%; text-align:left; background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--radius-sm); padding:9px 11px; font-family:'DM Sans',sans-serif; font-size:12px; color:var(--text-muted); cursor:default; }
  .rs-res.clickable { cursor:pointer; }
  .rs-res.clickable:hover { border-color:var(--blue); color:var(--text-primary); }
  .rs-res-icon { color:var(--blue); flex-shrink:0; display:flex; }
  .rs-res-label { flex:1; min-width:0; }
  .rs-res-soon { font-size:9px; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-subtle); border:1px solid var(--border); border-radius:999px; padding:1px 6px; }

  /* Assessment */
  .rs-qgroup { display:flex; flex-direction:column; gap:16px; }
  .rs-qgroup-head { display:flex; align-items:center; gap:9px; }
  .rs-qgroup-num { width:22px; height:22px; border-radius:6px; background:var(--blue-tint); color:var(--blue); font-family:'Oxanium',sans-serif; font-weight:700; font-size:12px; display:flex; align-items:center; justify-content:center; }
  .rs-qgroup-title { font-family:'Oxanium',sans-serif; font-weight:700; font-size:13px; letter-spacing:0.04em; text-transform:uppercase; color:var(--text-primary); }
  .rs-q { border-top:1px solid var(--border); padding-top:14px; }
  .rs-q.missing { border-color:var(--danger); }
  .rs-q-prompt { font-family:'DM Sans',sans-serif; font-size:13px; line-height:1.6; color:var(--text-primary); margin-bottom:10px; display:flex; gap:8px; }
  .rs-q-idx { font-family:'Oxanium',sans-serif; font-weight:700; font-size:11px; color:var(--text-subtle); flex-shrink:0; margin-top:2px; }
  .rs-q-opts { display:flex; flex-direction:column; gap:7px; }
  .rs-opt { display:flex; align-items:center; gap:10px; padding:9px 12px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-elevated); cursor:pointer; font-family:'DM Sans',sans-serif; font-size:12.5px; color:var(--text-muted); transition:border-color 0.12s ease; }
  .rs-opt:hover { border-color:var(--border-light); }
  .rs-opt.selected { border-color:var(--blue); background:var(--blue-ghost); color:var(--text-primary); }
  .rs-opt input { position:absolute; opacity:0; pointer-events:none; }
  .rs-opt-mark { width:15px; height:15px; border-radius:50%; border:2px solid var(--text-subtle); flex-shrink:0; position:relative; }
  .rs-opt.selected .rs-opt-mark { border-color:var(--blue); }
  .rs-opt.selected .rs-opt-mark::after { content:''; position:absolute; inset:2px; border-radius:50%; background:var(--blue); }
  .rs-q-missing { font-size:11px; color:var(--danger); margin-top:6px; }

  .rs-assess-actions { display:flex; gap:10px; flex-wrap:wrap; }
  .rs-assess-actions .btn { flex:1; min-width:160px; }

  .rs-progress-count { font-family:'DM Sans',sans-serif; font-size:12.5px; color:var(--text-muted); margin:10px 0 8px; }
  .rs-progress-big { font-family:'Oxanium',sans-serif; font-weight:700; font-size:20px; color:var(--text-primary); }
  .rs-progress-dots { display:flex; flex-wrap:wrap; gap:6px; margin:12px 0; }
  .rs-pdot { width:24px; height:24px; border-radius:6px; border:1px solid var(--border); display:flex; align-items:center; justify-content:center; font-family:'Oxanium',sans-serif; font-size:11px; color:var(--text-subtle); }
  .rs-pdot.done { background:var(--green-tint); border-color:rgba(34,197,94,0.3); color:var(--green); }
  .rs-progress-submit { width:100%; margin-top:4px; }

  .rs-bar { height:8px; background:var(--bg-elevated); border:1px solid var(--border); border-radius:999px; overflow:hidden; }
  .rs-bar-fill { height:100%; background:linear-gradient(90deg,var(--blue),var(--cyan)); transition:width 0.35s ease; }

  /* Result */
  .rs-result { display:flex; flex-direction:column; gap:16px; }
  .rs-scorecard { display:flex; align-items:center; gap:18px; }
  .rs-scorecard.pass { border-color:rgba(34,197,94,0.35); }
  .rs-scorecard.fail { border-color:rgba(245,158,11,0.35); }
  .rs-score-ring { width:78px; height:78px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:conic-gradient(var(--blue) calc(var(--pct) * 1%), var(--bg-elevated) 0); font-family:'Oxanium',sans-serif; font-weight:800; font-size:17px; color:var(--text-primary); position:relative; }
  .rs-score-ring::after { content:''; position:absolute; inset:7px; border-radius:50%; background:var(--bg-surface); }
  .rs-score-ring span { position:relative; z-index:1; }
  .rs-score-verdict { font-family:'Oxanium',sans-serif; font-weight:700; font-size:15px; color:var(--text-primary); margin-bottom:4px; }
  .rs-score-detail { font-family:'DM Sans',sans-serif; font-size:12.5px; line-height:1.6; color:var(--text-muted); }

  .rs-review-list { display:flex; flex-direction:column; gap:10px; margin-top:10px; }
  .rs-review { border:1px solid var(--border); border-radius:var(--radius-sm); padding:11px 13px; background:var(--bg-elevated); }
  .rs-review.ok { border-color:rgba(34,197,94,0.25); }
  .rs-review.bad { border-color:rgba(245,158,11,0.3); }
  .rs-review-top { display:flex; gap:9px; align-items:flex-start; }
  .rs-review-badge { width:18px; height:18px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; margin-top:1px; }
  .rs-review-badge.ok { background:var(--green); color:#04140b; }
  .rs-review-badge.bad { background:var(--amber); color:#1a1200; }
  .rs-review-prompt { font-family:'DM Sans',sans-serif; font-size:12.5px; line-height:1.55; color:var(--text-primary); }
  .rs-review-ans { font-family:'DM Sans',sans-serif; font-size:12px; color:var(--text-muted); margin:8px 0 0 27px; display:flex; flex-direction:column; gap:2px; }
  .rs-review-k { color:var(--text-subtle); }
  .rs-review-explain { font-family:'DM Sans',sans-serif; font-size:12px; line-height:1.55; color:var(--text-subtle); margin:8px 0 0 27px; padding-top:8px; border-top:1px dashed var(--border); }

  .rs-result-actions, .rs-next-actions { display:flex; gap:10px; flex-wrap:wrap; }
  .rs-result-actions .btn, .rs-next-actions .btn { flex:1; min-width:150px; }

  /* Next step */
  .rs-next { display:flex; flex-direction:column; gap:16px; }
  .rs-next-hero { text-align:center; display:flex; flex-direction:column; align-items:center; gap:8px; padding:28px 20px; }
  .rs-next-check { width:56px; height:56px; border-radius:50%; background:var(--green); color:#04140b; display:flex; align-items:center; justify-content:center; }
  .rs-next-title { font-family:'Bebas Neue',sans-serif; font-weight:400; font-size:24px; letter-spacing:0.03em; text-transform:uppercase; color:var(--text-primary); margin:4px 0 0; }
  .rs-next-sub { font-family:'DM Sans',sans-serif; font-size:13px; color:var(--text-muted); margin:0; }
  .rs-next-xp { display:inline-flex; align-items:center; gap:6px; margin-top:8px; background:var(--blue-tint); border:1px solid rgba(59,130,246,0.25); color:var(--blue); border-radius:999px; padding:5px 14px; font-family:'Oxanium',sans-serif; font-weight:700; font-size:13px; }

  .rs-next-up-row { display:flex; gap:12px; align-items:flex-start; margin:10px 0 14px; }
  .rs-next-up-emoji { font-size:26px; line-height:1; flex-shrink:0; }
  .rs-next-up-kicker { font-family:'DM Sans',sans-serif; font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:var(--green); margin-bottom:3px; }
  .rs-next-up-title { font-family:'Oxanium',sans-serif; font-weight:700; font-size:16px; color:var(--text-primary); }
  .rs-next-up-tag { font-family:'DM Sans',sans-serif; font-size:12.5px; color:var(--text-muted); line-height:1.5; margin-top:3px; }

  .rs-next-done { text-align:center; display:flex; flex-direction:column; align-items:center; gap:8px; padding:24px; color:var(--cyan); }
  .rs-next-done-title { font-family:'Oxanium',sans-serif; font-weight:700; font-size:16px; color:var(--text-primary); }
  .rs-next-done-sub { font-family:'DM Sans',sans-serif; font-size:12.5px; color:var(--text-muted); line-height:1.6; max-width:360px; }
`
