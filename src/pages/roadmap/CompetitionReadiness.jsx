import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Trophy, Calendar, Check } from 'lucide-react'
import AICoachPanel from '../../components/roadmap/AICoachPanel.jsx'

/*
 * Competition Readiness — a short guidance screen that links into the
 * existing Tournaments page. It does NOT rebuild tournament functionality.
 * All content is VERBATIM from the content doc, Stage 9 "TOURNAMENT
 * READINESS" (lines 416-425).
 */

const CHECKLIST = [
  'Can you perform your role consistently?',
  'Can you communicate under pressure?',
  'Can you follow a team plan?',
  'Can you recover after a bad game?',
  'Can you review mistakes without blaming others?',
  'Can your team trust you to do your job?',
]

export default function CompetitionReadiness() {
  const navigate = useNavigate()
  return (
    <div className="rgd-wrap page-transition">
      <button className="roles-back" onClick={() => navigate('/roadmap')}>
        <ArrowLeft size={14} /> The Road to Esports
      </button>

      <div className="rgd-hero">
        <h1><Trophy size={20} style={{ verticalAlign: '-3px', marginRight: 8 }} />Tournament Readiness</h1>
        <p>
          Competition adds pressure, preparation, expectations, and stronger opponents. Build experience
          gradually rather than waiting to feel perfectly ready.
        </p>
        <div className="rgd-hero-actions">
          <button className="btn btn-primary" onClick={() => navigate('/tournaments')}>
            <Calendar size={14} /> Browse Tournaments <ArrowRight size={14} />
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/roadmap/scrim-prep')}>
            Scrim Preparation
          </button>
        </div>
      </div>

      <div className="card">
        <div className="rma-side-title">Progression</div>
        <p className="prg-empty">Ranked / Competitive Matches → Scrims → Small Tournaments → Bigger Competition.</p>
      </div>

      <div className="card">
        <div className="rma-side-title">Readiness assessment</div>
        <ul className="rdet-list">
          {CHECKLIST.map((c, i) => <li key={i}><Check size={14} /> <span>{c}</span></li>)}
        </ul>
        <p className="prg-empty" style={{ marginTop: 12 }}>
          Work through the full version — with a level and a recommended action — in
          {' '}
          <button
            className="link-btn"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--violet)', font: 'inherit', textDecoration: 'underline' }}
            onClick={() => navigate('/roadmap/compete')}
          >
            Stage 09 · Compete
          </button>.
        </p>
      </div>

      <AICoachPanel
        context={{ area: 'competition-readiness' }}
        compact
        blurb="Once available, the AI Coach can pressure-test this checklist against your recent results."
      />
    </div>
  )
}
