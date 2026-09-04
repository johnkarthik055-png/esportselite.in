import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Compass, GitCompareArrows, Workflow, ChevronRight,
  Check, AlertTriangle,
} from 'lucide-react'
import {
  ROLES, WHAT_IS_A_ROLE, ROLE_NOT_PERMANENT, ROLE_FINAL_MESSAGE,
} from '../../../data/roadmapRoles.js'
import { useRoles } from '../../../hooks/useRoles.js'
import AICoachPanel from '../../../components/roadmap/AICoachPanel.jsx'

/*
 * Role System landing (doc: "What is a Role?" + the seven short role cards,
 * lines 185-267). Entry point from Stage 5 and directly at /roadmap/roles.
 * Nothing here gates anything.
 */
export default function RoleList() {
  const navigate = useNavigate()
  const { discovery, roleData } = useRoles()
  const primaryRoleId = discovery.result?.primaryRoleId || null
  const secondaryRoleId = discovery.result?.secondaryRoleId || null

  const roleCards = useMemo(() => ROLES.map(r => ({
    ...r,
    isPrimary: r.id === primaryRoleId,
    isSecondary: r.id === secondaryRoleId,
    readiness: roleData(r.id).result?.readinessLabel || null,
  })), [primaryRoleId, secondaryRoleId, roleData])

  return (
    <div className="roles-wrap page-transition">
      <button className="roles-back" onClick={() => navigate('/roadmap')}>
        <ArrowLeft size={14} /> The Road to Esports
      </button>

      <header className="roles-hero">
        <div className="roles-hero-kicker"><Compass size={13} /> Find Your Role</div>
        <h1 className="roles-title">WHAT IS A ROLE?</h1>
        <p className="roles-sub">{WHAT_IS_A_ROLE}</p>
        <div className="roles-hero-actions">
          <button className="btn btn-primary" onClick={() => navigate('/roadmap/roles/discover')}>
            {discovery.result ? 'Retake Role Discovery' : 'Take Role Discovery'} <ArrowRight size={14} />
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/roadmap/roles/compare')}>
            <GitCompareArrows size={14} /> Compare Roles
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/roadmap/roles/map')}>
            <Workflow size={14} /> How Roles Work Together
          </button>
        </div>

        {discovery.result && (
          <div className="roles-result-strip">
            <span className="roles-result-label">Your discovery result</span>
            <span className="roles-result-role">
              {discovery.result.primaryRoleName}
              <em> · {discovery.result.roleFit} fit ({discovery.result.roleFitScore}%)</em>
            </span>
            {discovery.result.secondaryRoleName && (
              <span className="roles-result-sec">Secondary: {discovery.result.secondaryRoleName}</span>
            )}
          </div>
        )}
      </header>

      <div className="roles-grid">
        {roleCards.map(r => (
          <button
            key={r.id}
            type="button"
            className={`roles-card ${r.isPrimary ? 'is-primary' : ''}`}
            onClick={() => navigate(`/roadmap/roles/${r.id}`)}
          >
            <span className="roles-card-top">
              <span className="roles-card-icon" aria-hidden>{r.icon}</span>
              <span className="roles-card-name">
                {r.name}
                {r.isPrimary && <span className="roles-card-tag">Your primary</span>}
                {r.isSecondary && <span className="roles-card-tag roles-card-tag--sec">Secondary</span>}
              </span>
              <ChevronRight size={15} className="roles-card-chev" />
            </span>
            <span className="roles-card-job"><strong>Main Job:</strong> {r.card.mainJob}</span>
            <span className="roles-card-takes">
              {r.card.whatItTakes.map((t, i) => <span key={i} className="roles-card-chip">{t}</span>)}
            </span>
            <span className="roles-card-mistakes">
              {r.card.commonMistakes.map((m, i) => (
                <span key={i}><AlertTriangle size={11} /> {m}</span>
              ))}
            </span>
            {r.readiness && (
              <span className="roles-card-readiness"><Check size={11} /> {r.readiness}</span>
            )}
          </button>
        ))}
      </div>

      <div className="card roles-note">
        <div className="roles-note-head">Role is not permanent</div>
        <p>{ROLE_NOT_PERMANENT.body}</p>
        <p>{ROLE_NOT_PERMANENT.system}</p>
      </div>

      <AICoachPanel
        context={{ area: 'role-list' }}
        blurb="Once available, the AI Coach will help you interpret your discovery result and pick which role to commit to first."
        suggestions={['Which role should I main?', 'How do my top two roles differ day to day?']}
      />

      <div className="card roles-final">
        {ROLE_FINAL_MESSAGE.map((line, i) => (
          <p key={i} className={i === ROLE_FINAL_MESSAGE.length - 1 ? 'roles-final-last' : ''}>{line}</p>
        ))}
      </div>

      <style>{styles}</style>
    </div>
  )
}

const styles = `
  .roles-hero {
    position: relative; overflow: hidden;
    background: linear-gradient(165deg, #0D1528 0%, #0B1020 55%, #0A0A1C 100%);
    border: 1px solid var(--border); border-radius: var(--radius-xl);
    padding: clamp(20px, 4vw, 32px); display: flex; flex-direction: column; gap: 10px;
  }
  .roles-hero-kicker {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.16em; color: var(--violet);
  }
  .roles-hero .roles-title { margin: 4px 0 0; }
  .roles-hero .roles-sub { max-width: 560px; }
  .roles-hero-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }

  .roles-result-strip {
    margin-top: 14px; padding: 10px 13px; border-radius: var(--radius-sm);
    background: var(--violet-tint); border: 1px solid rgba(124,58,237,0.25);
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px;
  }
  .roles-result-label { font-family: 'DM Sans', sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-subtle); }
  .roles-result-role { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 14px; color: var(--text-primary); }
  .roles-result-role em { font-style: normal; font-weight: 400; font-size: 12px; color: var(--violet); }
  .roles-result-sec { font-family: 'DM Sans', sans-serif; font-size: 11.5px; color: var(--text-subtle); }

  .roles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
  .roles-card {
    display: flex; flex-direction: column; gap: 8px; text-align: left; cursor: pointer;
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 15px;
    transition: border-color 0.15s ease, transform 0.15s ease;
  }
  .roles-card:hover { border-color: var(--violet); transform: translateY(-1px); }
  .roles-card.is-primary { border-color: rgba(124,58,237,0.5); box-shadow: 0 0 0 1px rgba(124,58,237,0.2); }
  .roles-card-top { display: flex; align-items: center; gap: 9px; }
  .roles-card-icon { font-size: 22px; line-height: 1; flex-shrink: 0; }
  .roles-card-name {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 14.5px; color: var(--text-primary);
  }
  .roles-card-tag {
    font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 600;
    letter-spacing: 0.05em; text-transform: uppercase; color: var(--violet);
    background: var(--violet-tint); border: 1px solid rgba(124,58,237,0.3);
    border-radius: 999px; padding: 1px 6px;
  }
  .roles-card-tag--sec { color: var(--text-subtle); background: var(--bg-elevated); border-color: var(--border); }
  .roles-card-chev { color: var(--text-subtle); flex-shrink: 0; }
  .roles-card-job { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.5; color: var(--text-muted); }
  .roles-card-job strong { color: var(--text-primary); font-weight: 600; }
  .roles-card-takes { display: flex; flex-wrap: wrap; gap: 4px; }
  .roles-card-chip {
    font-family: 'DM Sans', sans-serif; font-size: 10px; color: var(--text-subtle);
    background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 999px; padding: 2px 7px;
  }
  .roles-card-mistakes { display: flex; flex-direction: column; gap: 3px; }
  .roles-card-mistakes span {
    display: flex; gap: 5px; font-family: 'DM Sans', sans-serif; font-size: 11px;
    line-height: 1.4; color: var(--text-subtle);
  }
  .roles-card-mistakes svg { color: var(--amber); flex-shrink: 0; margin-top: 2px; }
  .roles-card-readiness {
    display: inline-flex; align-items: center; gap: 4px; margin-top: 2px;
    font-family: 'DM Sans', sans-serif; font-size: 10.5px; color: var(--green);
  }

  .roles-note { }
  .roles-note-head {
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 12px;
    letter-spacing: 0.04em; text-transform: uppercase; color: var(--violet); margin-bottom: 8px;
  }
  .roles-note p { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.65; color: var(--text-muted); margin: 0 0 8px; }
  .roles-note p:last-child { margin-bottom: 0; }

  .roles-final { background: linear-gradient(160deg, rgba(124,58,237,0.08), rgba(13,21,40,0.3)); border-color: rgba(124,58,237,0.25); }
  .roles-final p { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.7; color: var(--text-muted); margin: 0 0 8px; }
  .roles-final p:last-child { margin-bottom: 0; }
  .roles-final-last { font-family: 'Oxanium', sans-serif !important; font-weight: 700 !important; font-size: 13px !important; color: var(--text-primary) !important; }
`
