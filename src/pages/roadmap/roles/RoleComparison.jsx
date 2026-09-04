import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import {
  ROLES, ROLE_FIT_PROFILES, ROLE_FIT_NOTE, WHAT_A_ROLE_REALLY_MEANS,
} from '../../../data/roadmapRoles.js'

/*
 * Role Comparison. The content doc does not provide a role x attribute
 * ratings table, so this compares the seven roles on what the doc DOES
 * give verbatim: each role's Main Job and what it takes — plus the doc's
 * "Role Fit — What Esports Elite Should Look At" framework.
 */
export default function RoleComparison() {
  const navigate = useNavigate()

  return (
    <div className="roles-wrap page-transition">
      <button className="roles-back" onClick={() => navigate('/roadmap/roles')}>
        <ArrowLeft size={14} /> Role System
      </button>

      <header>
        <h1 className="roles-title">ROLE COMPARISON</h1>
        <p className="roles-sub">
          The seven roles side by side — the job each does and the skills each needs.
        </p>
      </header>

      <div className="card">
        <div className="rma-side-title">Role Fit — what Esports Elite looks at</div>
        <ul className="rcmp-profiles">
          {ROLE_FIT_PROFILES.map(p => (
            <li key={p.id}>
              <span className="rcmp-profile-k">{p.label}</span>
              <span className="rcmp-profile-v">{p.text}</span>
            </li>
          ))}
        </ul>
        <p className="rcmp-note">{ROLE_FIT_NOTE}</p>
      </div>

      <div className="rcmp-cards">
        {ROLES.map(r => (
          <button key={r.id} type="button" className="card rcmp-card" onClick={() => navigate(`/roadmap/roles/${r.id}`)}>
            <div className="rcmp-card-head">
              <span aria-hidden>{r.icon}</span>
              <span className="rcmp-card-name">{r.name}</span>
              <ArrowRight size={14} className="rcmp-card-chev" />
            </div>
            <div className="rcmp-card-job"><strong>Main Job:</strong> {r.card.mainJob}</div>
            <div className="rcmp-card-takes">
              {r.card.whatItTakes.map((t, i) => <span key={i}>{t}</span>)}
            </div>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="rma-side-title">What a role really means</div>
        <p className="rcmp-note" style={{ marginBottom: 10 }}>{WHAT_A_ROLE_REALLY_MEANS.intro}</p>
        <ul className="rcmp-means">
          {WHAT_A_ROLE_REALLY_MEANS.points.map((pt, i) => <li key={i}>{pt}</li>)}
        </ul>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/roadmap/roles/map')}>How roles work together</button>
        <button className="btn btn-primary" onClick={() => navigate('/roadmap/roles/discover')}>Take Role Discovery <ArrowRight size={14} /></button>
      </div>

      <style>{`
        .rcmp-profiles { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .rcmp-profiles li { display: grid; grid-template-columns: 150px 1fr; gap: 12px; }
        .rcmp-profile-k { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--violet); }
        .rcmp-profile-v { font-family: 'DM Sans', sans-serif; font-size: 12px; line-height: 1.55; color: var(--text-muted); }
        @media (max-width: 560px) { .rcmp-profiles li { grid-template-columns: 1fr; gap: 2px; } }
        .rcmp-note { font-family: 'DM Sans', sans-serif; font-size: 11.5px; line-height: 1.6; color: var(--text-subtle); margin: 0; }

        .rcmp-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
        .rcmp-card { display: flex; flex-direction: column; gap: 8px; text-align: left; cursor: pointer; }
        .rcmp-card:hover { border-color: var(--violet); }
        .rcmp-card-head { display: flex; align-items: center; gap: 8px; }
        .rcmp-card-name { flex: 1; font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 14px; color: var(--text-primary); }
        .rcmp-card-chev { color: var(--text-subtle); }
        .rcmp-card-job { font-family: 'DM Sans', sans-serif; font-size: 12px; line-height: 1.5; color: var(--text-muted); }
        .rcmp-card-job strong { color: var(--text-primary); font-weight: 600; }
        .rcmp-card-takes { display: flex; flex-wrap: wrap; gap: 4px; }
        .rcmp-card-takes span { font-family: 'DM Sans', sans-serif; font-size: 10px; color: var(--text-subtle); background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 999px; padding: 2px 7px; }

        .rcmp-means { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
        .rcmp-means li { font-family: 'DM Sans', sans-serif; font-size: 12px; line-height: 1.6; color: var(--text-muted); }
      `}</style>
    </div>
  )
}
