import { useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, Info, Lock, Circle, CircleDot, ExternalLink,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { isAnswered } from '../../utils/roadmapScoring.js'

/*
 * Phase B — ASSESSMENT.
 *
 * A multi-section flow. The right rail lists every section in the stage with
 * a live status. Question types (see roadmapStages.js / roadmapScoring.js):
 *   'scale'    ordered radio options (scored)
 *   'choice'   radio options; `multi:true` -> checkboxes (captured)
 *   'scenario' radio options (the response you would make); captured
 *   'text'     free-text reflection
 *
 * Every answer is saved immediately via onAnswer so resuming works. Submit is
 * enabled once every question in every section has an answer. onSubmit() runs
 * the deterministic scoring engine and advances to Result.
 */
export default function StageAssessment({ stage, onAnswer, onBack, onSubmit }) {
  const navigate = useNavigate()
  const sections = stage.sections || []
  const readyIds = useMemo(
    () => sections.filter(s => s.status === 'ready' && s.questions?.length).map(s => s.id),
    [sections],
  )
  const firstReady = readyIds[0] || sections[0]?.id
  const [activeId, setActiveId] = useState(
    stage.activeSectionId && readyIds.includes(stage.activeSectionId)
      ? stage.activeSectionId
      : firstReady,
  )

  const section = sections.find(s => s.id === activeId) || null
  const answers = stage.answers || {}
  const [showGaps, setShowGaps] = useState(false)

  const { answeredTotal, questionTotal, allAnswered } = useMemo(() => {
    let a = 0, q = 0
    readyIds.forEach(id => {
      const cfg = sections.find(s => s.id === id)
      q += cfg.questions.length
      cfg.questions.forEach(question => {
        if (isAnswered(question, answers[id]?.[question.id])) a += 1
      })
    })
    return { answeredTotal: a, questionTotal: q, allAnswered: q > 0 && a === q }
  }, [readyIds, sections, answers])

  function sectionStatus(s) {
    if (s.status !== 'ready' || !s.questions?.length) return 'soon'
    const ans = answers[s.id] || {}
    const done = s.questions.filter(q => isAnswered(q, ans[q.id])).length
    if (done === s.questions.length) return 'complete'
    if (done > 0 || s.id === activeId) return 'progress'
    return 'pending'
  }

  function submit() {
    if (!allAnswered) { setShowGaps(true); return }
    onSubmit()
  }

  const readySection = section && section.status === 'ready' && section.questions?.length

  return (
    <div className="road-grid road-grid--assess">
      <div className="road-grid-main">
        <div className="rma-open">
          <h2 className="rma-open-title">Let&apos;s see where you actually stand.</h2>
          <p className="rma-open-progress">Question {Math.min(answeredTotal + 1, questionTotal)} / {questionTotal}</p>
        </div>

        {section && (
          <div className="card rma-card">
            <div className="rma-card-head">
              <h2 className="rma-card-title">{section.name}</h2>
              {section.tagline && <p className="rma-card-tag">{section.tagline}</p>}
            </div>

            {readySection ? (
              <div className="rma-qlist">
                {section.questions.map((q, i) => (
                  <QuestionField
                    key={q.id}
                    q={q}
                    index={i}
                    value={answers[section.id]?.[q.id]}
                    missing={showGaps && !isAnswered(q, answers[section.id]?.[q.id])}
                    onChange={(val) => onAnswer(section.id, q.id, val)}
                  />
                ))}
              </div>
            ) : section.status === 'elsewhere' ? (
              <div className="rma-soon">
                <ExternalLink size={20} />
                <div className="rma-soon-title">{section.name} lives in another stage</div>
                <p className="rma-soon-body">This area is assessed in {section.linkLabel}.</p>
                {section.linkStage && (
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => navigate(`/roadmap/${section.linkStage}`)}>
                    Go there <ArrowRight size={13} />
                  </button>
                )}
              </div>
            ) : (
              <div className="rma-soon">
                <Lock size={20} />
                <div className="rma-soon-title">Nothing to answer here</div>
              </div>
            )}
          </div>
        )}

        <div className="rma-actions">
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={14} /> Back to Content
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!allAnswered}>
            {allAnswered
              ? 'Submit Assessment'
              : `${questionTotal - answeredTotal} question${questionTotal - answeredTotal === 1 ? '' : 's'} left`}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <aside className="road-grid-aside">
        <div className="card rma-why">
          <div className="rma-why-head"><Info size={14} /> Why This Matters</div>
          <p>Practical questions, scenarios, and tasks that show your current level — followed by a recommended action.</p>
        </div>

        <div className="card rma-side">
          <div className="rma-side-title">Sections</div>
          <div className="rma-side-progress">
            <span className="rma-side-big">{answeredTotal}</span> / {questionTotal} answered
          </div>
          <div className="road-bar" style={{ margin: '8px 0 12px' }}>
            <div className="road-bar-fill" style={{ width: `${questionTotal ? (answeredTotal / questionTotal) * 100 : 0}%` }} />
          </div>
          <ul className="rma-seclist">
            {sections.map(s => {
              const st = sectionStatus(s)
              return (
                <li key={s.id}>
                  <button
                    className={`rma-secrow ${s.id === activeId ? 'is-active' : ''}`}
                    onClick={() => setActiveId(s.id)}
                  >
                    <span className={`rma-secrow-icon rma-secrow-icon--${st}`}>
                      {st === 'complete' ? <Check size={12} strokeWidth={3} />
                        : st === 'progress' ? <CircleDot size={12} />
                        : st === 'soon' ? <ExternalLink size={11} />
                        : <Circle size={11} />}
                    </span>
                    <span className="rma-secrow-name">{s.name}</span>
                    <span className="rma-secrow-status">
                      {st === 'complete' ? 'Complete'
                        : st === 'progress' ? 'In Progress'
                        : st === 'soon' ? 'Elsewhere'
                        : 'Pending'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>

      <style>{styles}</style>
    </div>
  )
}

function QuestionField({ q, index, value, missing, onChange }) {
  const optLabel = (o) => (typeof o === 'string' ? o : o.label)

  return (
    <div className={`rma-q ${missing ? 'is-missing' : ''}`}>
      <div className="rma-q-prompt">
        <span className="rma-q-idx">{index + 1}</span>
        <span>
          {q.prompt}
          {q.type === 'text' && <span className="rma-q-kind"> · your own words</span>}
          {q.type === 'scenario' && <span className="rma-q-kind"> · what would you do?</span>}
          {q.multi && <span className="rma-q-kind"> · choose any</span>}
        </span>
      </div>

      {q.type === 'text' ? (
        <textarea
          className="input rma-q-text"
          rows={2}
          placeholder={q.placeholder || 'Type your answer…'}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : q.multi ? (
        <div className="rma-q-opts">
          {q.options.map((opt, oi) => {
            const arr = Array.isArray(value) ? value : []
            const on = arr.includes(oi)
            return (
              <label key={oi} className={`rma-opt ${on ? 'is-selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    const next = on ? arr.filter(x => x !== oi) : [...arr, oi].sort((a, b) => a - b)
                    onChange(next)
                  }}
                />
                <span className="rma-opt-mark rma-opt-mark--box" />
                <span>{optLabel(opt)}</span>
              </label>
            )
          })}
        </div>
      ) : (
        <div className="rma-q-opts">
          {q.options.map((opt, oi) => (
            <label key={oi} className={`rma-opt ${value === oi ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name={q.id}
                checked={value === oi}
                onChange={() => onChange(oi)}
              />
              <span className="rma-opt-mark" />
              <span>{optLabel(opt)}</span>
            </label>
          ))}
        </div>
      )}

      {missing && <div className="rma-q-miss">Answer this to continue.</div>}
    </div>
  )
}

const styles = `
  .rma-open { display: flex; flex-direction: column; gap: 3px; }
  .rma-open-title {
    font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 22px;
    letter-spacing: 0.02em; color: var(--text-primary); margin: 0;
  }
  .rma-open-progress {
    font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-subtle); margin: 0;
  }

  @media (min-width: 940px) {
    .road-grid--assess { grid-template-columns: minmax(0, 1fr) 270px; }
  }

  .rma-card-head { margin-bottom: 16px; }
  .rma-card-title { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 18px; color: var(--text-primary); }
  .rma-card-tag { font-family: 'DM Sans', sans-serif; font-size: 12.5px; font-style: italic; color: var(--violet); margin-top: 3px; }

  .rma-qlist { display: flex; flex-direction: column; gap: 18px; }
  .rma-q { border-top: 1px solid var(--border); padding-top: 16px; }
  .rma-q:first-child { border-top: none; padding-top: 0; }
  .rma-q-prompt {
    display: flex; gap: 9px; align-items: flex-start;
    font-family: 'DM Sans', sans-serif; font-size: 13.5px; line-height: 1.55;
    color: var(--text-primary); margin-bottom: 11px;
  }
  .rma-q-kind { font-size: 11px; color: var(--text-subtle); font-style: italic; }
  .rma-q-idx {
    flex-shrink: 0; width: 20px; height: 20px; border-radius: 6px;
    background: var(--violet-tint); color: var(--violet);
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 11px;
    display: flex; align-items: center; justify-content: center; margin-top: 1px;
  }
  .rma-q-opts { display: flex; flex-direction: column; gap: 7px; }
  .rma-q-text { font-family: 'DM Sans', sans-serif; resize: vertical; }
  .rma-opt {
    display: flex; align-items: center; gap: 10px; padding: 10px 13px;
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    background: var(--bg-elevated); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 12.5px; color: var(--text-muted);
    transition: border-color 0.12s ease, background 0.12s ease;
  }
  .rma-opt:hover { border-color: var(--border-light); }
  .rma-opt.is-selected { border-color: var(--violet); background: var(--violet-tint); color: var(--text-primary); }
  .rma-opt input { position: absolute; opacity: 0; pointer-events: none; }
  .rma-opt-mark {
    width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0;
    border: 2px solid var(--text-subtle); position: relative;
  }
  .rma-opt-mark--box { border-radius: 4px; }
  .rma-opt.is-selected .rma-opt-mark { border-color: var(--violet); }
  .rma-opt.is-selected .rma-opt-mark::after {
    content: ''; position: absolute; inset: 2px; border-radius: 50%; background: var(--violet);
  }
  .rma-opt.is-selected .rma-opt-mark--box::after { border-radius: 1px; }
  .rma-q.is-missing .rma-q-idx { background: var(--danger-tint); color: var(--danger); }
  .rma-q-miss { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--danger); margin-top: 7px; }

  .rma-soon {
    display: flex; flex-direction: column; align-items: center; text-align: center;
    gap: 8px; padding: 26px 18px; color: var(--text-subtle);
  }
  .rma-soon-title { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 14px; color: var(--text-primary); }
  .rma-soon-body { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.6; color: var(--text-muted); max-width: 380px; }

  .rma-actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .rma-actions .btn { flex: 1; min-width: 170px; }

  .rma-secrow-icon--complete { background: var(--green); border-color: var(--green); color: #04140b; }
  .rma-secrow-icon--progress { border-color: var(--violet); color: var(--violet); }
`
