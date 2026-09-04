import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Info, TrendingUp, Target, ShieldAlert,
  Users, Sparkles, RotateCcw, Dumbbell,
} from 'lucide-react'
import { DISCOVERY_GROUPS, getRole, ROLE_RESULT_NOTE } from '../../../data/roadmapRoles.js'
import { useRoles } from '../../../hooks/useRoles.js'
import AICoachPanel from '../../../components/roadmap/AICoachPanel.jsx'

/*
 * Role Discovery — deep version (doc lines 797-825): mechanical, decision,
 * team, scenario and consistency questions. Deterministic scoring in
 * utils/roleScoring.js — no AI. Produces a full Role Profile that is
 * explicitly NOT a locked identity (Primary + Secondary + Development Path).
 */
export default function RoleDiscovery() {
  const navigate = useNavigate()
  const { loading, discovery, saveDiscoveryAnswer, submitDiscovery } = useRoles()

  const [showGaps, setShowGaps] = useState(false)
  const [mode, setMode] = useState(null) /* null=auto, 'taking', 'result' */

  const allQ = useMemo(() => DISCOVERY_GROUPS.flatMap(g => g.questions), [])
  const answers = discovery.answers
  const total = allQ.length
  const answered = allQ.filter(q => Number.isInteger(answers[q.id])).length
  const allAnswered = answered === total

  const result = discovery.result
  const showResult = mode === 'result' || (mode !== 'taking' && !!result)

  function submit() {
    if (!allAnswered) { setShowGaps(true); return }
    submitDiscovery()
    setMode('result')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="roles-wrap page-transition">
        <div className="card skeleton" style={{ height: 60 }} />
        <div className="card skeleton" style={{ height: 400 }} />
      </div>
    )
  }

  return (
    <div className="roles-wrap page-transition">
      <button className="roles-back" onClick={() => navigate('/roadmap/roles')}>
        <ArrowLeft size={14} /> Role System
      </button>

      {showResult && result ? (
        <DiscoveryResult
          result={result}
          onRetake={() => { setMode('taking'); setShowGaps(false); window.scrollTo({ top: 0 }) }}
          onOpenRole={(id) => navigate(`/roadmap/roles/${id}`)}
          onDone={() => navigate('/roadmap/roles')}
        />
      ) : (
        <>
          <header>
            <h1 className="roles-title">ROLE DISCOVERY</h1>
            <p className="roles-sub">
              Different question types so the result is not based on one self-rating. Answer honestly about
              how you actually play.
            </p>
          </header>

          <div className="road-grid road-grid--assess">
            <div className="road-grid-main">
              {DISCOVERY_GROUPS.map(group => (
                <div key={group.id} className="card rdisc-group">
                  <div className="rdisc-group-name">{group.title}</div>
                  {group.questions.map((q, i) => {
                    const given = answers[q.id]
                    const missing = showGaps && !Number.isInteger(given)
                    return (
                      <div key={q.id} className={`rdisc-q ${missing ? 'is-missing' : ''}`}>
                        <div className="rdisc-q-prompt">
                          <span className="rdisc-q-idx">{i + 1}</span>
                          <span>
                            {q.prompt}
                            {q.type === 'scenario' && <span className="rdisc-q-kind"> · what would you do?</span>}
                          </span>
                        </div>
                        <div className="rdisc-q-opts">
                          {q.options.map((opt, oi) => (
                            <label key={oi} className={`rdisc-opt ${given === oi ? 'is-selected' : ''}`}>
                              <input type="radio" name={q.id} checked={given === oi} onChange={() => saveDiscoveryAnswer(q.id, oi)} />
                              <span className="rdisc-opt-mark" />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                        {missing && <div className="rdisc-q-miss">Pick an answer.</div>}
                      </div>
                    )
                  })}
                </div>
              ))}

              <button className="btn btn-primary rdisc-submit" onClick={submit} disabled={!allAnswered}>
                {allAnswered ? 'See My Role Profile' : `${total - answered} left`} <ArrowRight size={14} />
              </button>
            </div>

            <aside className="road-grid-aside">
              <div className="card rma-why">
                <div className="rma-why-head"><Info size={14} /> Why This Matters</div>
                <p>A questionnaire can suggest a role fit; it should not pretend to prove one. Your role is a starting point that changes as you develop.</p>
              </div>
              <div className="card">
                <div className="rma-side-title">Progress</div>
                <div className="rma-side-progress"><span className="rma-side-big">{answered}</span> / {total} answered</div>
                <div className="road-bar" style={{ marginTop: 8 }}>
                  <div className="road-bar-fill" style={{ width: `${(answered / total) * 100}%` }} />
                </div>
              </div>
              <AICoachPanel compact context={{ area: 'role-discovery' }} blurb="Once available, the AI Coach can talk through your result and what to train first." />
            </aside>
          </div>
        </>
      )}

      <style>{styles}</style>
    </div>
  )
}

function DiscoveryResult({ result, onRetake, onOpenRole, onDone }) {
  const primaryRole = getRole(result.primaryRoleId)
  const CAT_LABEL = { mechanical: 'Mechanical', decision: 'Decision', team: 'Team', consistency: 'Consistency' }

  return (
    <div className="rdisc-result">
      <div className={`card rdisc-hero rdisc-hero--${result.roleFitKey}`}>
        <span className="rdisc-hero-emoji" aria-hidden>{primaryRole?.icon}</span>
        <div>
          <div className="rdisc-hero-kicker">Primary Role</div>
          <div className="rdisc-hero-role">{result.primaryRoleName}</div>
          <div className="rdisc-hero-fit">
            <span className="rdisc-confidence"><strong>{result.roleFitScore}%</strong> confidence</span>
            <span className="rdisc-fitlabel">{result.roleFit} fit</span>
            {result.secondaryRoleName && <span>Secondary: <strong>{result.secondaryRoleName}</strong></span>}
          </div>
          <div className="rdisc-why">
            <span className="rdisc-why-head">Why This Role Fits You</span>
            <p className="rdisc-hero-explain">{result.explanation}</p>
          </div>
        </div>
      </div>

      {/* Role Result — the doc's field set (lines 826-836) */}
      <div className="rdisc-profile">
        <ProfileCell icon={<TrendingUp size={13} />} tone="strong" label="Strengths" items={result.strengths} />
        <ProfileCell icon={<Target size={13} />} tone="gap" label="Needs Work" items={[result.needsWork]} />
        <ProfileCell icon={<Users size={13} />} tone="team" label="Team Value" text={result.teamValue} />
        <ProfileCell icon={<ShieldAlert size={13} />} tone="risk" label="Main Risk" text={result.mainRisk} />
      </div>

      <div className="card rdisc-next">
        <div className="rdisc-next-row">
          <span className="rdisc-next-head"><Sparkles size={13} /> Next Focus</span>
          <p>{result.nextFocus}</p>
        </div>
        <div className="rdisc-next-row">
          <span className="rdisc-next-head"><Dumbbell size={13} /> Recommended Training</span>
          <p>{result.recommendedTraining}</p>
        </div>
      </div>

      {/* Role fit ranking */}
      <div className="card">
        <div className="rdisc-block-title">Role fit — all seven</div>
        <ul className="rdisc-fitlist">
          {result.roleFits.map((f, i) => (
            <li key={f.roleId} className={i === 0 ? 'is-top' : ''}>
              <span className="rdisc-fit-rank">{i + 1}</span>
              <span className="rdisc-fit-name">{f.icon} {f.name}</span>
              <span className="rdisc-fit-bar"><span className="rdisc-fit-fill" style={{ width: `${f.fit}%` }} /></span>
              <span className="rdisc-fit-num">{f.fit}%</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Category scores */}
      <div className="card">
        <div className="rdisc-block-title">Your profile</div>
        <ul className="rdisc-cats">
          {Object.keys(result.categoryScores).map(c => (
            <li key={c}>
              <span className="rdisc-cat-name">{CAT_LABEL[c] || c}</span>
              <span className="rdisc-cat-bar"><span style={{ width: `${result.categoryScores[c]}%` }} /></span>
              <span className="rdisc-cat-num">{result.categoryScores[c]}%</span>
            </li>
          ))}
        </ul>
        <div className="rdisc-trait">Playstyle read: <strong>{result.dominantTrait}</strong></div>
      </div>

      {/* Development path — role is not permanent */}
      <div className="card rdisc-devpath">
        <div className="rdisc-block-title">Role Development Path</div>
        <p>{result.developmentPath}</p>
      </div>

      <p className="roles-sub" style={{ fontSize: 12 }}>{ROLE_RESULT_NOTE}</p>

      <div className="rdisc-actions">
        <button className="btn btn-secondary" onClick={onRetake}><RotateCcw size={14} /> Retake</button>
        <button className="btn btn-secondary" onClick={onDone}>All Roles</button>
        <button className="btn btn-primary" onClick={() => onOpenRole(result.primaryRoleId)}>
          View Role — {result.primaryRoleName} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

function ProfileCell({ icon, tone, label, items, text }) {
  return (
    <div className={`card rdisc-pcell rdisc-pcell--${tone}`}>
      <div className="rdisc-pcell-head">{icon} {label}</div>
      {text && <p className="rdisc-pcell-text">{text}</p>}
      {items && (
        <ul className="rdisc-pcell-list">
          {items.filter(Boolean).map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      )}
    </div>
  )
}

const styles = `
  .rdisc-group { display: flex; flex-direction: column; gap: 16px; }
  .rdisc-group-name { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: 0.03em; text-transform: uppercase; color: var(--violet); }
  .rdisc-q { border-top: 1px solid var(--border); padding-top: 15px; }
  .rdisc-q:nth-of-type(2) { border-top: none; padding-top: 0; }
  .rdisc-q-prompt { display: flex; gap: 9px; align-items: flex-start; font-family: 'DM Sans', sans-serif; font-size: 13px; line-height: 1.55; color: var(--text-primary); margin-bottom: 10px; }
  .rdisc-q-kind { font-size: 11px; color: var(--text-subtle); font-style: italic; }
  .rdisc-q-idx { flex-shrink: 0; width: 19px; height: 19px; border-radius: 5px; margin-top: 1px; background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text-subtle); font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 10px; display: flex; align-items: center; justify-content: center; }
  .rdisc-q-opts { display: flex; flex-direction: column; gap: 7px; }
  .rdisc-opt { display: flex; align-items: center; gap: 10px; padding: 10px 13px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-elevated); cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 12.5px; color: var(--text-muted); transition: border-color 0.12s ease, background 0.12s ease; }
  .rdisc-opt:hover { border-color: var(--border-light); }
  .rdisc-opt.is-selected { border-color: var(--violet); background: var(--violet-tint); color: var(--text-primary); }
  .rdisc-opt input { position: absolute; opacity: 0; pointer-events: none; }
  .rdisc-opt-mark { width: 15px; height: 15px; border-radius: 50%; flex-shrink: 0; border: 2px solid var(--text-subtle); position: relative; }
  .rdisc-opt.is-selected .rdisc-opt-mark { border-color: var(--violet); }
  .rdisc-opt.is-selected .rdisc-opt-mark::after { content: ''; position: absolute; inset: 2px; border-radius: 50%; background: var(--violet); }
  .rdisc-q.is-missing .rdisc-q-idx { background: var(--danger-tint); border-color: var(--danger); color: var(--danger); }
  .rdisc-q-miss { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--danger); margin-top: 6px; }
  .rdisc-submit { align-self: flex-start; }

  .rdisc-result { display: flex; flex-direction: column; gap: 16px; }
  .rdisc-hero { display: flex; gap: 16px; align-items: flex-start; }
  .rdisc-hero--needs-work { border-color: rgba(245,158,11,0.35); }
  .rdisc-hero--developing { border-color: rgba(59,130,246,0.35); }
  .rdisc-hero--strong { border-color: rgba(34,197,94,0.4); }
  .rdisc-hero-emoji { font-size: 40px; line-height: 1; flex-shrink: 0; }
  .rdisc-hero-kicker { font-family: 'DM Sans', sans-serif; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-subtle); }
  .rdisc-hero-role { font-family: 'Bebas Neue', sans-serif; font-size: 30px; letter-spacing: 0.03em; color: var(--text-primary); margin: 2px 0; }
  .rdisc-hero-fit { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; font-family: 'DM Sans', sans-serif; font-size: 12.5px; color: var(--text-muted); }
  .rdisc-hero-fit strong { color: var(--text-primary); }
  .rdisc-confidence {
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 13px; color: var(--violet);
  }
  .rdisc-confidence strong { color: var(--violet); font-size: 16px; }
  .rdisc-fitlabel {
    font-family: 'DM Sans', sans-serif; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--text-subtle); border: 1px solid var(--border); border-radius: 999px; padding: 2px 8px;
  }
  .rdisc-why { margin-top: 10px; }
  .rdisc-why-head {
    display: block; font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 10.5px;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--violet); margin-bottom: 4px;
  }
  .rdisc-hero-explain { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.65; color: var(--text-muted); margin: 0; }

  .rdisc-profile { display: grid; grid-template-columns: 1fr; gap: 12px; }
  @media (min-width: 620px) { .rdisc-profile { grid-template-columns: 1fr 1fr; } }
  .rdisc-pcell-head { display: flex; align-items: center; gap: 6px; margin-bottom: 7px; font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; }
  .rdisc-pcell--strong .rdisc-pcell-head { color: var(--green); }
  .rdisc-pcell--gap .rdisc-pcell-head { color: var(--amber); }
  .rdisc-pcell--team .rdisc-pcell-head { color: var(--blue); }
  .rdisc-pcell--risk .rdisc-pcell-head { color: var(--danger); }
  .rdisc-pcell-text { font-family: 'DM Sans', sans-serif; font-size: 12px; line-height: 1.6; color: var(--text-muted); margin: 0; }
  .rdisc-pcell-list { margin: 0; padding-left: 16px; display: flex; flex-direction: column; gap: 4px; }
  .rdisc-pcell-list li { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-muted); }

  .rdisc-next-row { display: flex; flex-direction: column; gap: 4px; }
  .rdisc-next-row + .rdisc-next-row { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
  .rdisc-next-head { display: inline-flex; align-items: center; gap: 6px; font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--violet); }
  .rdisc-next-row p { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.6; color: var(--text-muted); margin: 0; }

  .rdisc-block-title { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-primary); margin-bottom: 12px; }
  .rdisc-fitlist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .rdisc-fitlist li { display: grid; grid-template-columns: 20px 1fr 90px 42px; align-items: center; gap: 10px; }
  .rdisc-fitlist li.is-top .rdisc-fit-name { color: var(--text-primary); font-weight: 700; }
  .rdisc-fit-rank { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 11px; color: var(--text-subtle); }
  .rdisc-fit-name { font-family: 'DM Sans', sans-serif; font-size: 12.5px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rdisc-fit-bar { height: 6px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 999px; overflow: hidden; }
  .rdisc-fit-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--violet), var(--cyan)); }
  .rdisc-fit-num { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 11.5px; color: var(--text-muted); text-align: right; }

  .rdisc-cats { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 9px; }
  .rdisc-cats li { display: grid; grid-template-columns: 110px 1fr 40px; align-items: center; gap: 10px; }
  .rdisc-cat-name { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-muted); }
  .rdisc-cat-bar { height: 7px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 999px; overflow: hidden; }
  .rdisc-cat-bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--violet), var(--blue)); }
  .rdisc-cat-num { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 11.5px; color: var(--text-muted); text-align: right; }
  .rdisc-trait { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-subtle); }
  .rdisc-trait strong { color: var(--violet); text-transform: capitalize; }

  .rdisc-devpath { background: var(--violet-tint); border-color: rgba(124,58,237,0.25); }
  .rdisc-devpath p { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.65; color: var(--text-muted); margin: 0; }

  .rdisc-actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .rdisc-actions .btn { flex: 1; min-width: 140px; }
`
