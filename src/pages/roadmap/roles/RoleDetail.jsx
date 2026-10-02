import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
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

const EASE = [0.22, 1, 0.36, 1]

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
  const reduce = useReducedMotion()
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
      <motion.button
        className="roles-back"
        onClick={() => navigate('/roadmap/roles')}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <ArrowLeft size={14} /> Role System
      </motion.button>

      <motion.div
        className="rdet-hero"
        initial={{ opacity: 0, y: reduce ? 0 : 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="rdet-hero-dots" aria-hidden />
        <div className="rdet-hero-glow" aria-hidden />
        <div className="rdet-hero-inner">
          <span className="rdet-hero-emoji" aria-hidden>{role.icon}</span>
          <div>
            <div className="rdet-hero-kicker">Role</div>
            <h1 className="rdet-hero-name">{role.name}</h1>
            <p className="rdet-hero-tag">{d.whatItDoes}</p>
          </div>
        </div>
      </motion.div>

      <div className="card rdet-toc-card">
        <div className="rdet-toc">
          {PARTS.map(p => <button key={p.id} onClick={() => jump(p.id)}>{p.title}</button>)}
        </div>
      </div>

      <Part id="job" title="Main Job" index={0} reduce={reduce}>
        <div className="rdet-mainjob">{d.mainJob}</div>
      </Part>

      <Part id="skills" title="What Skills Does It Take?" index={1} reduce={reduce}>
        <BulletList items={d.skills} />
      </Part>

      <Part id="play" title="How Should You Play the Role?" index={2} reduce={reduce}>
        <div className="rdet-phases">
          {d.howToPlay.map((ph, i) => (
            <div key={i} className="rdet-phase">
              <div className="rdet-phase-label">{ph.label}</div>
              <div className="rdet-phase-text">{ph.text}</div>
            </div>
          ))}
        </div>
      </Part>

      <Part id="good" title="What Does Good Performance Look Like?" index={3} reduce={reduce}>
        <BulletList items={d.goodPerformance} />
      </Part>

      <Part id="mistakes" title="Common Mistakes" index={4} reduce={reduce}>
        <ul className="rdet-list rdet-list--warn">
          {d.commonMistakes.map((m, i) => <li key={i}><AlertTriangle size={14} /> <span>{m}</span></li>)}
        </ul>
      </Part>

      <Part id="improve" title="How to Improve" index={5} reduce={reduce}>
        <BulletList items={d.howToImprove} />
      </Part>

      <Part id="bda" title="Before / During / After Check" index={6} reduce={reduce}>
        <div className="rdet-phases">
          <div className="rdet-phase"><div className="rdet-phase-label">Before</div><div className="rdet-phase-text">{ROLE_BDA_CHECK.before}</div></div>
          <div className="rdet-phase"><div className="rdet-phase-label">During</div><div className="rdet-phase-text">{ROLE_BDA_CHECK.during}</div></div>
          <div className="rdet-phase"><div className="rdet-phase-label">After</div><div className="rdet-phase-text">{ROLE_BDA_CHECK.after}</div></div>
        </div>
      </Part>

      <Part id="assess" title="Role Assessment" index={7} reduce={reduce}>
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
            <motion.button
              className="btn btn-primary"
              style={{ marginTop: 14 }}
              onClick={submit}
              disabled={!allAnswered}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {allAnswered ? 'See My Role Readiness' : `${qs.length - answeredCount} left`} <ArrowRight size={14} />
            </motion.button>
          </>
        )}
      </Part>

      <Part id="ready" title="Role Readiness" index={8} reduce={reduce}>
        {data.result ? (
          <div className="rdet-cta">
            <span className="rdet-cta-text">
              Latest: <strong>{data.result.readinessLabel}</strong> ({data.result.score}%). Open the full breakdown and training plan.
            </span>
            <motion.button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/roadmap/roles/${roleId}/readiness`)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Open Readiness <ChevronRight size={14} />
            </motion.button>
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

      <style>{styles}</style>
    </div>
  )
}

function Part({ id, title, children, index, reduce }) {
  return (
    <motion.section
      id={`rdet-${id}`}
      className="card rdet-part"
      initial={{ opacity: 0, y: reduce ? 0 : 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.35, delay: Math.min(index, 4) * 0.05, ease: EASE }}
      whileHover={{ y: -2 }}
    >
      <h2 className="rdet-part-title">{title}</h2>
      {children}
    </motion.section>
  )
}

function BulletList({ items }) {
  return (
    <ul className="rdet-list">
      {(items || []).map((it, i) => <li key={i}><Check size={14} /> <span>{it}</span></li>)}
    </ul>
  )
}

const styles = `
  .roles-wrap { display: flex; flex-direction: column; gap: 16px; max-width: 1040px; margin: 0 auto; width: 100%; }
  .roles-back {
    align-self: flex-start; display: inline-flex; align-items: center; gap: 6px;
    background: rgba(37,99,255,0.06); border: 1px solid rgba(37,99,255,0.1);
    border-radius: 999px; padding: 7px 16px 7px 12px; cursor: pointer;
    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #2563FF;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .roles-back:hover { background: rgba(37,99,255,0.1); border-color: rgba(37,99,255,0.18); }

  /* ── Hero ── */
  .rdet-hero {
    position: relative; overflow: hidden;
    background: linear-gradient(135deg, #F7F9FD 0%, #EEF4FF 60%, #FFF0F2 100%);
    border: 1px solid #E5EAF3; border-radius: 18px;
    padding: clamp(20px, 3.5vw, 32px);
    box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 16px 48px rgba(15,23,42,0.05);
  }
  .rdet-hero-dots {
    position: absolute; inset: 0; pointer-events: none; z-index: 0;
    background-image: radial-gradient(circle, rgba(37,99,255,0.06) 1px, transparent 1px);
    background-size: 24px 24px;
  }
  .rdet-hero-glow {
    position: absolute; top: -60px; right: -60px; width: 260px; height: 260px; border-radius: 50%;
    background: radial-gradient(circle, rgba(91,61,245,0.10) 0%, transparent 65%);
    pointer-events: none; z-index: 0;
  }
  .rdet-hero-inner { position: relative; z-index: 1; display: flex; gap: 16px; align-items: flex-start; }
  .rdet-hero-emoji { font-size: 38px; line-height: 1; flex-shrink: 0; }
  .rdet-hero-kicker { font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #2563FF; }
  .rdet-hero-name {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: clamp(26px, 4vw, 36px);
    text-transform: uppercase; letter-spacing: 0.02em; color: #0B1224; margin: 3px 0 0; line-height: 1.05;
  }
  .rdet-hero-tag { font-family: 'Inter', sans-serif; font-size: 13.5px; line-height: 1.6; color: #475569; margin: 6px 0 0; max-width: 560px; }

  /* ── TOC ── */
  .rdet-toc-card { padding: 14px 16px; }
  .rdet-toc { display: flex; flex-wrap: wrap; gap: 6px; }
  .rdet-toc button {
    background: #F8FAFD; border: 1px solid #E5EAF3; border-radius: 999px; padding: 6px 12px;
    cursor: pointer; font-family: 'Inter', sans-serif; font-weight: 500; font-size: 11px; color: #475569;
    transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  }
  .rdet-toc button:hover { border-color: #2563FF; color: #2563FF; background: #EEF4FF; }

  /* ── Parts ── */
  .rdet-part { scroll-margin-top: 90px; }
  .rdet-part-title { font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 18px; text-transform: uppercase; letter-spacing: 0.02em; color: #0B1224; margin: 0 0 12px; }
  .rdet-lead { font-family: 'Inter', sans-serif; font-size: 13.5px; line-height: 1.7; color: #475569; margin: 0 0 10px; }
  .rdet-mainjob {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 16px; color: #0B1224;
    padding: 14px 16px; background: #EEF4FF; border: 1px solid rgba(37,99,255,0.18); border-radius: 12px;
  }
  .rdet-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
  .rdet-list li { display: flex; gap: 9px; font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.6; color: #475569; }
  .rdet-list li svg { color: #2563FF; flex-shrink: 0; margin-top: 3px; }
  .rdet-list--warn li svg { color: #F59E0B; }
  .rdet-phases { display: flex; flex-direction: column; gap: 12px; }
  .rdet-phase { display: grid; grid-template-columns: 130px 1fr; gap: 12px; }
  .rdet-phase-label { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #5B3DF5; }
  .rdet-phase-text { font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.6; color: #475569; }
  @media (max-width: 560px) { .rdet-phase { grid-template-columns: 1fr; gap: 3px; } }

  .rdet-qlist { display: flex; flex-direction: column; gap: 16px; }
  .rdisc-q { border-top: 1px solid #E5EAF3; padding-top: 14px; }
  .rdisc-q-prompt { display: flex; gap: 10px; align-items: flex-start; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 13.5px; color: #0B1224; margin-bottom: 10px; }
  .rdisc-q-idx {
    width: 22px; height: 22px; flex-shrink: 0; border-radius: 50%; background: #EEF4FF; color: #2563FF;
    display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;
  }
  .rdisc-q-opts { display: flex; flex-direction: column; gap: 6px; margin-left: 32px; }
  .rdisc-opt {
    display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px;
    border: 1px solid #E5EAF3; background: #F8FAFD; cursor: pointer; font-family: 'Inter', sans-serif;
    font-size: 13px; color: #475569; transition: border-color 0.15s ease, background 0.15s ease;
  }
  .rdisc-opt:hover { border-color: rgba(37,99,255,0.3); }
  .rdisc-opt.is-selected { border-color: #2563FF; background: #EEF4FF; color: #0B1224; font-weight: 600; }
  .rdisc-opt input { display: none; }
  .rdisc-opt-mark {
    width: 16px; height: 16px; border-radius: 50%; border: 2px solid #CBD5E1; flex-shrink: 0;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .rdisc-opt.is-selected .rdisc-opt-mark { border-color: #2563FF; background: #2563FF; box-shadow: inset 0 0 0 3px #fff; }
  .rdisc-q.is-missing .rdisc-q-prompt { color: #EF3340; }
  .rdisc-q-miss { margin-left: 32px; margin-top: 6px; font-family: 'Inter', sans-serif; font-size: 11.5px; color: #EF3340; }

  .rdet-cta {
    display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 16px;
    border-radius: 12px; border: 1px solid rgba(37,99,255,0.18); background: #EEF4FF;
  }
  .rdet-cta-text { flex: 1; min-width: 180px; font-family: 'Inter', sans-serif; font-size: 13px; color: #475569; }
  .rdet-cta-text strong { color: #0B1224; }
`
