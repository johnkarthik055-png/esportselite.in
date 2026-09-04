import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, AlertTriangle, ChevronRight,
} from 'lucide-react'
import {
  getRole, roleAssessmentSection, ROLE_BDA_CHECK,
} from '../../../data/roadmapRoles.js'
import { useRoles } from '../../../hooks/useRoles.js'
import { isAnswered } from '../../../utils/roadmapScoring.js'
import AICoachPanel from '../../../components/roadmap/AICoachPanel.jsx'

/*
 * Role Detail — the deep dive (doc lines 541-783), one structure for every
 * role. All content is verbatim from the doc.
 *
 *   Main Job / What it does / What skills it takes /
 *   How should you play the role (Before / During / After) /
 *   What does good performance look like / Common mistakes / How to improve /
 *   Role Assessment (part) / Role Readiness (screen)
 */

const PARTS = [
  { id: 'job',      title: 'Main Job' },
  { id: 'skills',   title: 'What Skills Does It Take?' },
  { id: 'play',     title: 'How Should You Play the Role?' },
  { id: 'good',     title: 'What Does Good Performance Look Like?' },
  { id: 'mistakes', title: 'Common Mistakes' },
  { id: 'improve',  title: 'How to Improve' },
  { id: 'bda',      title: 'Before / During / After Check' },
  { id: 'assess',   title: 'Role Assessment' },
  { id: 'ready',    title: 'Role Readiness' },
]

export default function RoleDetail() {
  const { roleId } = useParams()
  const navigate = useNavigate()
  const role = getRole(roleId)
  const { loading, roleData, saveRoleAnswer, submitRoleAssessment } = useRoles()

  const section = useMemo(() => roleAssessmentSection(roleId), [roleId])
  const data = roleData(roleId)
  const [showGaps, setShowGaps] = useState(false)

  if (!role) {
    return (
      <div className="roles-wrap page-transition">
        <div className="card empty-state">
          <div className="empty-state-title">Role not found</div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigate('/roadmap/roles')}>Back to Roles</button>
        </div>
      </div>
    )
  }

  const d = role.deep
  const answers = data.answers
  const qs = section?.questions || []
  const answeredCount = qs.filter(q => isAnswered(q, answers[q.id])).length
  const allAnswered = qs.length > 0 && answeredCount === qs.length

  function jump(id) {
    document.getElementById(`rdet-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  function submit() {
    if (!allAnswered) { setShowGaps(true); return }
    submitRoleAssessment(roleId)
    navigate(`/roadmap/roles/${roleId}/readiness`)
  }

  return (
    <div className="roles-wrap page-transition">
      <button className="roles-back" onClick={() => navigate('/roadmap/roles')}>
        <ArrowLeft size={14} /> Role System
      </button>

      <div className="card rdet-hero">
        <span className="rdet-hero-emoji" aria-hidden>{role.icon}</span>
        <div>
          <div className="rdet-hero-kicker">Role</div>
          <h1 className="rdet-hero-name">{role.name}</h1>
          <p className="rdet-hero-tag">{d.whatItDoes}</p>
        </div>
      </div>

      <div className="card">
        <div className="rdet-toc">
          {PARTS.map(p => <button key={p.id} onClick={() => jump(p.id)}>{p.title}</button>)}
        </div>
      </div>

      <Part id="job" title="Main Job">
        <div className="rdet-mainjob">{d.mainJob}</div>
      </Part>

      <Part id="skills" title="What Skills Does It Take?">
        <BulletList items={d.skills} />
      </Part>

      <Part id="play" title="How Should You Play the Role?">
        <div className="rdet-phases">
          {d.howToPlay.map((ph, i) => (
            <div key={i} className="rdet-phase">
              <div className="rdet-phase-label">{ph.label}</div>
              <div className="rdet-phase-text">{ph.text}</div>
            </div>
          ))}
        </div>
      </Part>

      <Part id="good" title="What Does Good Performance Look Like?">
        <BulletList items={d.goodPerformance} />
      </Part>

      <Part id="mistakes" title="Common Mistakes">
        <ul className="rdet-list rdet-list--warn">
          {d.commonMistakes.map((m, i) => <li key={i}><AlertTriangle size={14} /> <span>{m}</span></li>)}
        </ul>
      </Part>

      <Part id="improve" title="How to Improve">
        <BulletList items={d.howToImprove} />
      </Part>

      <Part id="bda" title="Before / During / After Check">
        <div className="rdet-phases">
          <div className="rdet-phase"><div className="rdet-phase-label">Before</div><div className="rdet-phase-text">{ROLE_BDA_CHECK.before}</div></div>
          <div className="rdet-phase"><div className="rdet-phase-label">During</div><div className="rdet-phase-text">{ROLE_BDA_CHECK.during}</div></div>
          <div className="rdet-phase"><div className="rdet-phase-label">After</div><div className="rdet-phase-text">{ROLE_BDA_CHECK.after}</div></div>
        </div>
      </Part>

      <Part id="assess" title="Role Assessment">
        {loading ? (
          <div className="card skeleton" style={{ height: 200 }} />
        ) : (
          <>
            <p className="rdet-lead">A short, honest self-check on the {role.name} job. Feeds your Role Readiness.</p>
            <div className="rdet-qlist">
              {qs.map((q, i) => {
                const given = answers[q.id]
                const missing = showGaps && !isAnswered(q, given)
                return (
                  <div key={q.id} className={`rdisc-q ${missing ? 'is-missing' : ''}`} style={{ borderTop: i === 0 ? 'none' : undefined, paddingTop: i === 0 ? 0 : undefined }}>
                    <div className="rdisc-q-prompt"><span className="rdisc-q-idx">{i + 1}</span>{q.prompt}</div>
                    <div className="rdisc-q-opts">
                      {q.options.map((opt, oi) => (
                        <label key={oi} className={`rdisc-opt ${given === oi ? 'is-selected' : ''}`}>
                          <input type="radio" name={q.id} checked={given === oi} onChange={() => saveRoleAnswer(roleId, q.id, oi)} />
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
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={submit} disabled={!allAnswered}>
              {allAnswered ? 'See My Role Readiness' : `${qs.length - answeredCount} left`} <ArrowRight size={14} />
            </button>
          </>
        )}
      </Part>

      <Part id="ready" title="Role Readiness">
        {data.result ? (
          <div className="rdet-cta">
            <span className="rdet-cta-text">
              Latest: <strong>{data.result.readinessLabel}</strong> ({data.result.score}%). Open the full breakdown and training plan.
            </span>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/roadmap/roles/${roleId}/readiness`)}>
              Open Readiness <ChevronRight size={14} />
            </button>
          </div>
        ) : (
          <p className="rdet-lead">Complete the Role Assessment above to generate your readiness level (Exploring → Developing → Ready → Competitive) and a training plan.</p>
        )}
      </Part>

      <AICoachPanel
        context={{ area: 'role-detail', roleId }}
        blurb={`When available, the AI Coach can answer "${role.name}" questions and turn your readiness gaps into drills.`}
        suggestions={[`How do I get better at ${role.name} faster?`, 'What should I avoid in this role?']}
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/roadmap/roles/compare')}>Compare with other roles</button>
        <button className="btn btn-secondary" onClick={() => navigate('/roadmap/roles')}>All roles</button>
      </div>

      <style>{`
        .rdet-hero { display: flex; gap: 14px; align-items: flex-start; }
        .rdet-hero-emoji { font-size: 34px; line-height: 1; flex-shrink: 0; }
        .rdet-hero-kicker { font-family: 'DM Sans', sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-subtle); }
        .rdet-hero-name { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 26px; letter-spacing: 0.03em; text-transform: uppercase; color: var(--text-primary); margin: 3px 0 0; }
        .rdet-hero-tag { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.6; color: var(--violet); margin: 4px 0 0; }
        .rdet-toc { display: flex; flex-wrap: wrap; gap: 5px; }
        .rdet-toc button { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 999px; padding: 5px 10px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 10.5px; color: var(--text-muted); }
        .rdet-toc button:hover { border-color: var(--violet); color: var(--text-primary); }
        .rdet-part { scroll-margin-top: 80px; }
        .rdet-part-title { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 15px; color: var(--text-primary); margin: 0 0 10px; }
        .rdet-lead { font-family: 'DM Sans', sans-serif; font-size: 13px; line-height: 1.7; color: var(--text-muted); margin: 0 0 10px; }
        .rdet-mainjob { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 15px; color: var(--text-primary); padding: 12px 14px; background: var(--violet-tint); border: 1px solid rgba(124,58,237,0.25); border-radius: var(--radius-sm); }
        .rdet-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .rdet-list li { display: flex; gap: 9px; font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.6; color: var(--text-muted); }
        .rdet-list li svg { color: var(--violet); flex-shrink: 0; margin-top: 3px; }
        .rdet-list--warn li svg { color: var(--amber); }
        .rdet-phases { display: flex; flex-direction: column; gap: 10px; }
        .rdet-phase { display: grid; grid-template-columns: 130px 1fr; gap: 12px; }
        .rdet-phase-label { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--cyan); }
        .rdet-phase-text { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.6; color: var(--text-muted); }
        @media (max-width: 560px) { .rdet-phase { grid-template-columns: 1fr; gap: 3px; } }
        .rdet-qlist { display: flex; flex-direction: column; gap: 16px; }
        .rdet-cta { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 14px; border-radius: var(--radius); border: 1px solid rgba(124,58,237,0.3); background: var(--violet-tint); }
        .rdet-cta-text { flex: 1; min-width: 180px; font-family: 'DM Sans', sans-serif; font-size: 12.5px; color: var(--text-muted); }
      `}</style>
    </div>
  )
}

function Part({ id, title, children }) {
  return (
    <section id={`rdet-${id}`} className="card rdet-part">
      <h2 className="rdet-part-title">{title}</h2>
      {children}
    </section>
  )
}

function BulletList({ items }) {
  return (
    <ul className="rdet-list">
      {(items || []).map((it, i) => <li key={i}><Check size={14} /> <span>{it}</span></li>)}
    </ul>
  )
}
