import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, AlertTriangle, RotateCcw, Dumbbell,
} from 'lucide-react'
import {
  getRole, ROLE_READINESS_LEVELS, ROLE_READINESS_NOTE, ROLE_READINESS_CHECKLIST,
  ROLE_TRAINING_LOOP,
} from '../../../data/roadmapRoles.js'
import { useRoles } from '../../../hooks/useRoles.js'
import AICoachPanel from '../../../components/roadmap/AICoachPanel.jsx'

/*
 * Role Readiness (doc lines 838-843, verbatim levels). Shown after the Role
 * Assessment. Level label, progress bar, "you understand" list, "needs work"
 * list, training plan, and a "Start Role Training" button that links out to
 * the existing Training Center.
 */
export default function RoleReadiness() {
  const { roleId } = useParams()
  const navigate = useNavigate()
  const role = getRole(roleId)
  const { loading, roleData } = useRoles()
  const data = roleData(roleId)
  const result = data.result

  const bandIndex = useMemo(
    () => (result ? ROLE_READINESS_LEVELS.findIndex(b => b.key === result.readinessKey) : -1),
    [result],
  )

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
  if (loading) {
    return (
      <div className="roles-wrap page-transition">
        <div className="card skeleton" style={{ height: 60 }} />
        <div className="card skeleton" style={{ height: 300 }} />
      </div>
    )
  }
  if (!result) {
    return (
      <div className="roles-wrap page-transition">
        <button className="roles-back" onClick={() => navigate(`/roadmap/roles/${roleId}`)}>
          <ArrowLeft size={14} /> {role.name}
        </button>
        <div className="card empty-state">
          <div className="empty-state-title">No role assessment yet</div>
          <div className="empty-state-desc">Complete the {role.name} Role Assessment to see your readiness.</div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigate(`/roadmap/roles/${roleId}`)}>
            Go to Role Assessment
          </button>
        </div>
      </div>
    )
  }

  const plan =
    `You are ${result.readinessLabel} for ${role.name}. ` +
    (result.needsWork.length
      ? `Build a focused training task around ${result.needsWork.slice(0, 2).join(' and ')}, use the role in real matches or scrims, review role execution (not only kills), and re-assess after a period of practice.`
      : `Keep using the role in real matches, review role execution over kills, and re-assess every few weeks to make sure it holds under pressure.`)

  return (
    <div className="roles-wrap page-transition">
      <button className="roles-back" onClick={() => navigate(`/roadmap/roles/${roleId}`)}>
        <ArrowLeft size={14} /> {role.name}
      </button>

      <div className="card rrdy-hero">
        <div className="rrdy-ring" style={{ '--pct': result.score }}><span>{result.score}</span></div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="rdet-hero-kicker">{role.icon} {role.name} · Role Readiness</div>
          <div className="rrdy-level">{result.readinessLabel}</div>
          <p className="rrdy-blurb">{result.readinessBlurb}</p>
        </div>
      </div>

      <div className="card">
        <div className="rma-side-title">The readiness ladder</div>
        <div className="road-bar" style={{ marginBottom: 12 }}>
          <div className="road-bar-fill" style={{ width: `${result.score}%` }} />
        </div>
        <div className="rrdy-ladder">
          {ROLE_READINESS_LEVELS.map((b, i) => (
            <div key={b.key} className={`rrdy-rung ${i === bandIndex ? 'is-current' : ''}`}>
              <span className="rrdy-rung-label">{b.label}</span>
              <span className="rrdy-rung-def">{b.def}</span>
            </div>
          ))}
        </div>
        <p className="rrdy-note">{ROLE_READINESS_NOTE}</p>
      </div>

      <div className="rrdy-split">
        <div className="card rrdy-col rrdy-col--know">
          <div className="rrdy-col-title"><Check size={13} /> You understand</div>
          {result.understand.length ? (
            <ul>{result.understand.map((s, i) => <li key={i}><Check size={12} style={{ color: 'var(--green)' }} /> {s}</li>)}</ul>
          ) : (
            <p className="rrdy-blurb">Nothing scored as a clear strength yet — that is normal early on.</p>
          )}
        </div>
        <div className="card rrdy-col rrdy-col--gap">
          <div className="rrdy-col-title"><AlertTriangle size={13} /> Needs work</div>
          {result.needsWork.length ? (
            <ul>{result.needsWork.map((s, i) => <li key={i}><AlertTriangle size={12} style={{ color: 'var(--amber)' }} /> {s}</li>)}</ul>
          ) : (
            <p className="rrdy-blurb">No clear weak spots in this pass — pressure-test it in scrims next.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="rrdy-plan">
          <div className="rrdy-plan-head">Recommended training plan</div>
          <p>{plan}</p>
        </div>
      </div>

      <div className="card">
        <div className="rma-side-title">Role Readiness Checklist</div>
        <ul className="rrdy-checklist">
          {ROLE_READINESS_CHECKLIST.map((c, i) => <li key={i}><Check size={13} /> {c}</li>)}
        </ul>
      </div>

      <div className="card">
        <div className="rma-side-title">The role training loop</div>
        <ol className="rrdy-loop">
          {ROLE_TRAINING_LOOP.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
      </div>

      <AICoachPanel
        context={{ area: 'role-readiness', roleId }}
        compact
        blurb={`When available, the AI Coach can turn these ${role.name} gaps into a specific drill list.`}
      />

      <div className="rrdy-actions">
        <button className="btn btn-secondary" onClick={() => navigate(`/roadmap/roles/${roleId}`)}>
          <RotateCcw size={14} /> Re-take assessment
        </button>
        <button className="btn btn-primary" onClick={() => navigate('/training')}>
          <Dumbbell size={14} /> Start Role Training <ArrowRight size={14} />
        </button>
      </div>

      <style>{`
        .rrdy-ladder { display: flex; flex-direction: column; gap: 6px; }
        .rrdy-rung { padding: 9px 11px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-elevated); }
        .rrdy-rung.is-current { border-color: var(--violet); background: var(--violet-tint); }
        .rrdy-rung-label { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-primary); }
        .rrdy-rung.is-current .rrdy-rung-label { color: var(--violet); }
        .rrdy-rung-def { display: block; font-family: 'DM Sans', sans-serif; font-size: 11.5px; line-height: 1.5; color: var(--text-muted); margin-top: 2px; }
        .rrdy-note { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-subtle); margin: 10px 0 0; }
        .rrdy-checklist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
        .rrdy-checklist li { display: flex; gap: 8px; font-family: 'DM Sans', sans-serif; font-size: 12.5px; color: var(--text-muted); }
        .rrdy-checklist li svg { color: var(--green); flex-shrink: 0; margin-top: 2px; }
        .rrdy-loop { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
        .rrdy-loop li { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.5; color: var(--text-muted); }
      `}</style>
    </div>
  )
}
