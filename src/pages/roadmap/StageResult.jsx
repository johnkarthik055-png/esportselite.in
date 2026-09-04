import { useMemo } from 'react'
import {
  ArrowRight, RotateCcw, ListChecks, TrendingUp, Target, Sparkles, Quote, Check,
} from 'lucide-react'
import { extractImproveItems } from '../../data/roadmapStages.js'

/*
 * Phase C — RESULT (rule-based, deterministic).
 *
 * Per the content doc: results do not end as a score. They return a useful
 * starting point (Strong / Developing / Needs Work) plus a Priority Focus
 * recommended action, and they show the player's own reflective answers
 * back to them. Stage 1 renders as a "Player Starting Point" summary.
 */
export default function StageResult({ stage, onRetake, onReview, onContinue }) {
  const result = stage.result
  const bands = useMemo(() => ([
    { label: 'Needs Work', range: '0–40' },
    { label: 'Developing', range: '41–70' },
    { label: 'Strong', range: '71–100' },
  ]), [])

  if (!result) {
    return (
      <div className="card empty-state">
        <div className="empty-state-title">No attempt yet</div>
        <div className="empty-state-desc">Complete the assessment first to see your result.</div>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={onReview}>
          Go to Content
        </button>
      </div>
    )
  }

  const scored = result.sectionResults.filter(s => s.score !== null)
  const single = scored.length === 1
  const hasOverall = result.overall !== null
  const attemptCount = (stage.attempts || []).length
  const isStartingPoint = (stage.sections || []).some(s => s.outputLabel === 'Player Starting Point')

  /* "What To Do Next" — the weakest scored section's REAL "How to Improve"
     list, pulled straight from its authored content. Falls back to the
     scoring engine's Priority Focus sentence when a section has no
     improve checklist (e.g. Stage 1's overview). */
  const weakestSectionCfg = result.weakest
    ? (stage.sections || []).find(s => s.id === result.weakest.sectionId)
    : null
  const nextActions = weakestSectionCfg ? extractImproveItems(weakestSectionCfg, 4) : []

  return (
    <div className="rmr-wrap">
      <div className="rmr-pagehead">Your Result</div>

      {isStartingPoint && (
        <StartingPointCard stage={stage} result={result} />
      )}

      {/* Headline scorecard */}
      {hasOverall ? (
        <div className={`card rmr-hero rmr-hero--${result.overallLevelKey || 'developing'}`}>
          <div className="rmr-ring" style={{ '--pct': result.overall }}>
            <span className="rmr-ring-num">{result.overall}</span>
            <span className="rmr-ring-unit">/ 100</span>
          </div>
          <div className="rmr-hero-copy">
            <div className="rmr-hero-kicker">{isStartingPoint ? 'Habits & commitment' : 'Your current level'}</div>
            <div className="rmr-hero-level">{result.overallLevel}</div>
            <p className="rmr-hero-blurb">{result.overallBlurb}</p>
            <div className="rmr-bands">
              {bands.map(b => (
                <span key={b.label} className={`rmr-band ${b.label === result.overallLevel ? 'is-current' : ''}`}>
                  {b.label} <em>{b.range}</em>
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : !isStartingPoint && (
        <div className="card">
          <div className="rmr-hero-kicker">Your answers</div>
          <p className="rmr-explain-text">{result.explanation}</p>
        </div>
      )}

      {/* Strongest / needs work (multi-section stages) */}
      {!single && scored.length > 1 && (
        <div className="rmr-split">
          <div className="card rmr-cell rmr-cell--strong">
            <div className="rmr-cell-head"><TrendingUp size={14} /> Strongest area</div>
            <div className="rmr-cell-main">{result.strongest?.name}</div>
            <div className="rmr-cell-sub">{result.strongest?.score}% · {result.strongest?.level}</div>
          </div>
          <div className="card rmr-cell rmr-cell--gap">
            <div className="rmr-cell-head"><Target size={14} /> Needs work</div>
            <div className="rmr-cell-main">{result.weakest?.name}</div>
            <div className="rmr-cell-sub">{result.weakest?.score}% · {result.weakest?.level}</div>
          </div>
        </div>
      )}

      {/* Explanation + Your Biggest Opportunity + What To Do Next */}
      {hasOverall && (
        <div className="card rmr-explain">
          <p className="rmr-explain-text">{result.explanation}</p>
          <div className="rmr-focus">
            <span className="rmr-focus-head"><Sparkles size={13} /> Your Biggest Opportunity</span>
            <p>{stripFocusPrefix(result.recommendedFocus)}</p>
          </div>
          {nextActions.length > 0 && (
            <div className="rmr-nextdo">
              <span className="rmr-nextdo-head">What To Do Next</span>
              <ul>
                {nextActions.map((a, i) => <li key={i}><Check size={13} /> <span>{a}</span></li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Per-section breakdown */}
      {result.sectionResults.map(sec => (
        <div key={sec.sectionId} className="card">
          <div className="rmr-sec-head">
            <span className="rmr-sec-name">{sec.name}</span>
            {sec.score !== null && <span className="rmr-sec-score">{sec.score}% · {sec.level}</span>}
          </div>

          {sec.score !== null && (
            <>
              <div className="road-bar" style={{ margin: '6px 0 12px' }}>
                <div className="road-bar-fill" style={{ width: `${sec.score}%` }} />
              </div>

              {sec.areas && sec.areas.length > 0 && (
                <div className="rmr-areas">
                  {sec.areas.map(a => (
                    <div key={a.area} className={`rmr-area rmr-area--${a.level.toLowerCase().replace(' ', '-')}`}>
                      <span>{a.area}</span>
                      <em>{a.level}</em>
                    </div>
                  ))}
                </div>
              )}

              {sec.perQuestion.length > 0 && (
                <ul className="rmr-qbreak">
                  {sec.perQuestion.map(q => (
                    <li key={q.id}>
                      <span className="rmr-qbreak-label">{cap(q.short)}</span>
                      <span className="rmr-qbreak-bar"><span className="rmr-qbreak-fill" style={{ width: `${q.pct}%` }} /></span>
                      <span className="rmr-qbreak-choice">{q.choice}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* Scenario picks + guidance */}
          {sec.choices.filter(c => c.guidance).length > 0 && (
            <div className="rmr-scenarios">
              {sec.choices.filter(c => c.guidance).map(c => (
                <div key={c.id} className="rmr-scenario">
                  <div className="rmr-scenario-q">{c.prompt}</div>
                  <div className="rmr-scenario-you"><strong>You chose:</strong> {c.answer}</div>
                  <div className="rmr-scenario-guide"><Sparkles size={11} /> {c.guidance}</div>
                </div>
              ))}
            </div>
          )}

          {/* Captured non-scenario choices */}
          {sec.choices.filter(c => !c.guidance).length > 0 && (
            <ul className="rmr-choices">
              {sec.choices.filter(c => !c.guidance).map(c => (
                <li key={c.id}>
                  <span className="rmr-choices-q">{c.prompt}</span>
                  <span className="rmr-choices-a">{c.multi ? (c.answers || []).join(', ') : c.answer}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Free-text reflections */}
          {sec.reflections.length > 0 && (
            <div className="rmr-reflections">
              <div className="rmr-reflections-head"><Quote size={12} /> Your notes</div>
              {sec.reflections.map(r => (
                <div key={r.id} className="rmr-reflection">
                  <div className="rmr-reflection-q">{r.prompt}</div>
                  <div className="rmr-reflection-a">{r.answer}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Stage 3 result-format example from the doc */}
      {stage.sections?.[0]?.resultExample && (
        <div className="card rmr-example">
          <div className="rmr-example-head">Example result</div>
          <p>{stage.sections[0].resultExample}</p>
        </div>
      )}

      <div className="rmr-attempts">
        Attempt {attemptCount}{hasOverall ? ` · scored ${result.overall}/100 from your answers` : ' · saved from your answers'}
      </div>

      <div className="rmr-actions">
        <button className="btn btn-secondary" onClick={onReview}>
          <RotateCcw size={14} /> Review Lesson
        </button>
        <button className="btn btn-secondary" onClick={onRetake}>
          <ListChecks size={14} /> Retake Assessment
        </button>
        <button className="btn btn-primary" onClick={onContinue}>
          See How To Improve <ArrowRight size={14} />
        </button>
      </div>

      <style>{styles}</style>
    </div>
  )
}

/* Stage 1 — "Player Starting Point" (doc line 43). */
function StartingPointCard({ stage, result }) {
  const sec = result.sectionResults[0]
  if (!sec) return null
  const choice = (id) => sec.choices.find(c => c.id === id)
  const scoredQ = (id) => sec.perQuestion.find(q => q.id === id)

  const strengths = choice('s1-q1')?.answers || []
  const problem = choice('s1-q2')?.answer
  const afterBad = choice('s1-q5')?.answer
  const goal = choice('s1-q6')?.answer
  const days = scoredQ('s1-q3')?.choice
  const review = scoredQ('s1-q4')?.choice
  const time = scoredQ('s1-q7')?.choice
  const commitment = sec.level

  return (
    <div className="card rmr-sp">
      <div className="rmr-sp-head">
        <span className="rmr-sp-kicker">Output</span>
        <h2 className="rmr-sp-title">Player Starting Point</h2>
      </div>
      <div className="rmr-sp-grid">
        <SPRow label="Strengths" value={strengths.length ? strengths.join(', ') : '—'} />
        <SPRow label="Current focus / weakness" value={problem || '—'} />
        <SPRow label="Commitment level" value={commitment ? `${commitment}${time ? ` · ${time}` : ''}${days ? ` · trains ${days} days/week` : ''}` : '—'} />
        <SPRow label="Review habit" value={review || '—'} />
        <SPRow label="After a bad game" value={afterBad || '—'} />
        <SPRow label="Goal" value={goal || '—'} />
        <SPRow label="Recommended next step" value={stripFocusPrefix(result.recommendedFocus)} />
      </div>
    </div>
  )
}

function SPRow({ label, value }) {
  return (
    <div className="rmr-sp-row">
      <span className="rmr-sp-k">{label}</span>
      <span className="rmr-sp-v">{value}</span>
    </div>
  )
}

function stripFocusPrefix(s) {
  return String(s || '').replace(/^Priority Focus:\s*/, '')
}
function cap(s) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const styles = `
  .rmr-wrap { display: flex; flex-direction: column; gap: 16px; }
  .rmr-pagehead {
    font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 22px;
    letter-spacing: 0.02em; color: var(--text-primary);
  }

  .rmr-hero { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
  .rmr-hero--needs-work { border-color: rgba(245,158,11,0.35); }
  .rmr-hero--developing { border-color: rgba(59,130,246,0.35); }
  .rmr-hero--strong { border-color: rgba(34,197,94,0.4); }
  .rmr-ring {
    width: 108px; height: 108px; border-radius: 50%; flex-shrink: 0; position: relative;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: conic-gradient(var(--violet) calc(var(--pct) * 1%), var(--bg-elevated) 0);
  }
  .rmr-ring::after { content: ''; position: absolute; inset: 9px; border-radius: 50%; background: var(--bg-surface); }
  .rmr-ring-num { position: relative; z-index: 1; font-family: 'Oxanium', sans-serif; font-weight: 800; font-size: 28px; color: var(--text-primary); line-height: 1; }
  .rmr-ring-unit { position: relative; z-index: 1; font-family: 'DM Sans', sans-serif; font-size: 10px; color: var(--text-subtle); }
  .rmr-hero-copy { flex: 1; min-width: 200px; }
  .rmr-hero-kicker { font-family: 'DM Sans', sans-serif; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-subtle); }
  .rmr-hero-level { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 30px; letter-spacing: 0.03em; color: var(--text-primary); margin: 2px 0 4px; }
  .rmr-hero-blurb { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.6; color: var(--text-muted); margin: 0 0 10px; }
  .rmr-bands { display: flex; flex-wrap: wrap; gap: 6px; }
  .rmr-band { font-family: 'DM Sans', sans-serif; font-size: 10.5px; color: var(--text-subtle); border: 1px solid var(--border); border-radius: 999px; padding: 3px 9px; }
  .rmr-band em { font-style: normal; opacity: 0.7; }
  .rmr-band.is-current { border-color: var(--violet); background: var(--violet-tint); color: var(--text-primary); }

  /* Player Starting Point */
  .rmr-sp { background: linear-gradient(160deg, rgba(124,58,237,0.10), rgba(13,21,40,0.35)); border-color: rgba(124,58,237,0.3); }
  .rmr-sp-kicker { font-family: 'DM Sans', sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--violet); }
  .rmr-sp-title { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 26px; letter-spacing: 0.03em; color: var(--text-primary); margin: 2px 0 12px; }
  .rmr-sp-grid { display: flex; flex-direction: column; gap: 8px; }
  .rmr-sp-row { display: grid; grid-template-columns: 170px 1fr; gap: 12px; align-items: start; }
  .rmr-sp-k { font-family: 'DM Sans', sans-serif; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-subtle); }
  .rmr-sp-v { font-family: 'DM Sans', sans-serif; font-size: 13px; line-height: 1.5; color: var(--text-primary); }
  @media (max-width: 560px) { .rmr-sp-row { grid-template-columns: 1fr; gap: 2px; } }

  .rmr-split { display: grid; grid-template-columns: 1fr; gap: 12px; }
  @media (min-width: 620px) { .rmr-split { grid-template-columns: 1fr 1fr; } }
  .rmr-cell-head { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; }
  .rmr-cell--strong .rmr-cell-head { color: var(--green); }
  .rmr-cell--gap .rmr-cell-head { color: var(--amber); }
  .rmr-cell-main { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 16px; color: var(--text-primary); }
  .rmr-cell-sub { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-muted); margin-top: 3px; }

  .rmr-explain-text { font-family: 'DM Sans', sans-serif; font-size: 13.5px; line-height: 1.7; color: var(--text-primary); margin: 0; }
  .rmr-focus { margin-top: 12px; padding: 12px 14px; border-radius: var(--radius-sm); background: var(--violet-tint); border: 1px solid rgba(124,58,237,0.25); }
  .rmr-focus-head { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 5px; font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--violet); }
  .rmr-focus p { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.6; color: var(--text-muted); margin: 0; }
  .rmr-nextdo { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
  .rmr-nextdo-head {
    display: block; margin-bottom: 8px;
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 10.5px;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-primary);
  }
  .rmr-nextdo ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
  .rmr-nextdo li { display: flex; gap: 8px; font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.5; color: var(--text-muted); }
  .rmr-nextdo li svg { color: var(--green); flex-shrink: 0; margin-top: 2px; }

  .rmr-sec-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .rmr-sec-name { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 14px; color: var(--text-primary); }
  .rmr-sec-score { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-muted); }

  .rmr-areas { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .rmr-area { display: inline-flex; align-items: center; gap: 6px; font-family: 'DM Sans', sans-serif; font-size: 11px; border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; color: var(--text-muted); }
  .rmr-area em { font-style: normal; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; }
  .rmr-area--strong { border-color: rgba(34,197,94,0.35); } .rmr-area--strong em { color: var(--green); }
  .rmr-area--developing { border-color: rgba(59,130,246,0.35); } .rmr-area--developing em { color: var(--blue); }
  .rmr-area--needs-work { border-color: rgba(245,158,11,0.35); } .rmr-area--needs-work em { color: var(--amber); }

  .rmr-qbreak { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .rmr-qbreak li { display: grid; grid-template-columns: 1fr 90px auto; align-items: center; gap: 10px; }
  .rmr-qbreak-label { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-muted); }
  .rmr-qbreak-bar { height: 6px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 999px; overflow: hidden; }
  .rmr-qbreak-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--violet), var(--cyan)); }
  .rmr-qbreak-choice { font-family: 'DM Sans', sans-serif; font-size: 10.5px; color: var(--text-subtle); text-align: right; white-space: nowrap; }
  @media (max-width: 520px) { .rmr-qbreak li { grid-template-columns: 1fr auto; } .rmr-qbreak-bar { display: none; } }

  .rmr-scenarios { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
  .rmr-scenario { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; background: var(--bg-elevated); }
  .rmr-scenario-q { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-primary); line-height: 1.5; }
  .rmr-scenario-you { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-muted); margin: 5px 0; }
  .rmr-scenario-you strong { color: var(--text-subtle); font-weight: 600; }
  .rmr-scenario-guide { display: flex; gap: 6px; font-family: 'DM Sans', sans-serif; font-size: 11.5px; line-height: 1.55; color: var(--violet); }
  .rmr-scenario-guide svg { flex-shrink: 0; margin-top: 2px; }

  .rmr-choices { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .rmr-choices li { display: flex; flex-direction: column; gap: 2px; }
  .rmr-choices-q { font-family: 'DM Sans', sans-serif; font-size: 11.5px; color: var(--text-subtle); }
  .rmr-choices-a { font-family: 'DM Sans', sans-serif; font-size: 12.5px; color: var(--text-primary); }

  .rmr-reflections { margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--border); }
  .rmr-reflections-head { display: inline-flex; align-items: center; gap: 5px; font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-subtle); margin-bottom: 8px; }
  .rmr-reflection { margin-bottom: 8px; }
  .rmr-reflection-q { font-family: 'DM Sans', sans-serif; font-size: 11.5px; color: var(--text-subtle); }
  .rmr-reflection-a { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.5; color: var(--text-primary); white-space: pre-wrap; }

  .rmr-example { background: var(--bg-elevated); }
  .rmr-example-head { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-subtle); margin-bottom: 6px; }
  .rmr-example p { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.6; color: var(--text-muted); margin: 0; }

  .rmr-attempts { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-subtle); }

  .rmr-actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .rmr-actions .btn { flex: 1; min-width: 150px; }
`
