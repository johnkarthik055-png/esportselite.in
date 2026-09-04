import { Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { ROLE_INTERACTION, ROLE_BDA_CHECK, getRole } from '../../../data/roadmapRoles.js'

/*
 * Role Interaction (doc lines 784-796) — how the roles work together.
 * A visual flow, verbatim copy.
 */
const FLOW_NODES = [
  { key: 'scout',   roleId: 'scout',         label: 'Scout',   sub: 'provides information' },
  { key: 'igl',     roleId: 'igl',           label: 'IGL',     sub: 'turns it into a decision' },
  { key: 'entry',   roleId: 'entry-fragger', label: 'Entry',   sub: 'creates the opening' },
  { key: 'fragger', roleId: 'assaulter',     label: 'Fragger', sub: 'converts it' },
  { key: 'support', roleId: 'support',       label: 'Support', sub: 'enables it' },
]

export default function RoleInteractionDiagram() {
  const navigate = useNavigate()

  return (
    <div className="roles-wrap page-transition">
      <button className="roles-back" onClick={() => navigate('/roadmap/roles')}>
        <ArrowLeft size={14} /> Role System
      </button>

      <header>
        <h1 className="roles-title">HOW THE ROLES WORK TOGETHER</h1>
        <p className="roles-sub">{ROLE_INTERACTION.intro}</p>
      </header>

      <div className="card">
        <div className="rdiag-flow">
          {FLOW_NODES.map((node, i) => {
            const role = getRole(node.roleId)
            return (
              <Fragment key={node.key}>
                <button
                  type="button"
                  className="rdiag-node"
                  onClick={() => role && navigate(`/roadmap/roles/${role.id}`)}
                  style={{ cursor: role ? 'pointer' : 'default' }}
                >
                  <div className="rdiag-node-icon" aria-hidden>{role?.icon || '•'}</div>
                  <div className="rdiag-node-label">{node.label}</div>
                  <div className="rdiag-node-sub">{node.sub}</div>
                </button>
                {i < FLOW_NODES.length - 1 && (
                  <div className="rdiag-arrow"><ArrowRight size={18} /></div>
                )}
              </Fragment>
            )
          })}
        </div>

        <div className="rdiag-flows">
          {ROLE_INTERACTION.flows.map((f, i) => (
            <div key={i} className="rdiag-flowline">{f}</div>
          ))}
        </div>

        <div className="rdiag-notes">
          {ROLE_INTERACTION.closing.map((c, i) => (
            <div key={i} className="rdiag-note">{c}</div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="rma-side-title">Before / During / After — role responsibility check</div>
        <div className="rdiag-bda">
          <div><span className="rdiag-bda-k">Before</span><p>{ROLE_BDA_CHECK.before}</p></div>
          <div><span className="rdiag-bda-k">During</span><p>{ROLE_BDA_CHECK.during}</p></div>
          <div><span className="rdiag-bda-k">After</span><p>{ROLE_BDA_CHECK.after}</p></div>
        </div>
        <p className="rdiag-bda-note">{ROLE_BDA_CHECK.note}</p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/roadmap/roles/compare')}>Role Comparison</button>
        <button className="btn btn-primary" onClick={() => navigate('/roadmap/roles/discover')}>Take Role Discovery <ArrowRight size={14} /></button>
      </div>

      <style>{`
        .rdiag-flows { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
        .rdiag-flowline {
          font-family: 'DM Sans', sans-serif; font-size: 12px; line-height: 1.6; color: var(--text-muted);
          padding: 9px 11px; border-radius: var(--radius-sm); background: var(--violet-tint);
          border: 1px solid rgba(124,58,237,0.2);
        }
        .rdiag-bda { display: flex; flex-direction: column; gap: 10px; }
        .rdiag-bda-k { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--cyan); }
        .rdiag-bda p { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.6; color: var(--text-muted); margin: 3px 0 0; }
        .rdiag-bda-note { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-subtle); margin: 12px 0 0; }
      `}</style>
    </div>
  )
}
