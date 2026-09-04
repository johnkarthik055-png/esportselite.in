import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarClock, Users, ClipboardList } from 'lucide-react'
import AICoachPanel from '../../components/roadmap/AICoachPanel.jsx'

/*
 * Scrim Preparation — a short guidance screen. It does NOT rebuild
 * scheduling; it links into the existing Scheduler and My Team pages.
 * All bullet content is VERBATIM from the content doc, Stage 9 "SCRIMS".
 */

/* doc lines 398-403 */
const BENEFITS = ['Team coordination', 'Strategy testing', 'Stronger opponents', 'New weaknesses', 'Competitive habits']
/* doc lines 411-415 */
const IMPROVE = [
  'Set a purpose before each scrim.',
  'Focus on role execution, not only kills.',
  'Review team fights.',
  'Track repeated problems.',
  'Change one thing at a time.',
]

export default function ScrimPreparation() {
  const navigate = useNavigate()
  return (
    <div className="rgd-wrap page-transition">
      <button className="roles-back" onClick={() => navigate('/roadmap')}>
        <ArrowLeft size={14} /> The Road to Esports
      </button>

      <div className="rgd-hero">
        <h1><Users size={20} style={{ verticalAlign: '-3px', marginRight: 8 }} />Scrim Preparation</h1>
        <p>Scrims test your training against stronger players and real team situations.</p>
        <div className="rgd-hero-actions">
          <button className="btn btn-primary" onClick={() => navigate('/scheduler')}>
            <CalendarClock size={14} /> Open Scheduler <ArrowRight size={14} />
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/team')}>
            <Users size={14} /> My Team
          </button>
        </div>
      </div>

      <div className="card">
        <div className="rma-side-title">Benefits</div>
        <ul className="rdet-list">
          {BENEFITS.map((b, i) => <li key={i}><ClipboardList size={13} /> <span>{b}</span></li>)}
        </ul>
      </div>

      <div className="card">
        <div className="rma-side-title">How to prepare and review</div>
        <ol className="rgd-steps">
          {IMPROVE.map((s, i) => (
            <li key={i}><div><div className="rgd-step-title">{s}</div></div></li>
          ))}
        </ol>
      </div>

      <AICoachPanel
        context={{ area: 'scrim-prep' }}
        compact
        blurb="Once available, the AI Coach can turn last block's review into this block's focus."
      />

      <div className="card">
        <div className="rma-side-title">After the block</div>
        <p className="prg-empty">
          Head to <button className="link-btn" onClick={() => navigate('/roadmap/gameplay-review')} style={linkStyle}>Gameplay Review</button> to
          write up what happened, or <button className="link-btn" onClick={() => navigate('/analytics')} style={linkStyle}>Analytics</button> to
          check the numbers.
        </p>
      </div>
    </div>
  )
}

const linkStyle = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  color: 'var(--violet)', font: 'inherit', textDecoration: 'underline',
}
