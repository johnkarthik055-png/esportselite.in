import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Compass, GitCompareArrows, Workflow, ChevronRight,
  Check, AlertTriangle,
} from 'lucide-react'
import {
  ROLES, WHAT_IS_A_ROLE, ROLE_NOT_PERMANENT, ROLE_FINAL_MESSAGE,
} from '../../../data/roadmapRoles.js'
import { useRoles } from '../../../hooks/useRoles.js'
import AICoachPanel from '../../../components/roadmap/AICoachPanel.jsx'

const EASE = [0.22, 1, 0.36, 1]

/*
 * Role System landing (doc: "What is a Role?" + the seven short role cards,
 * lines 185-267). Entry point from Stage 5 and directly at /roadmap/roles.
 * Nothing here gates anything.
 */
export default function RoleList() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
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
      <motion.button
        className="roles-back"
        onClick={() => navigate('/roadmap')}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <ArrowLeft size={14} /> The Road to Esports
      </motion.button>

      <motion.header
        className="roles-hero"
        initial={{ opacity: 0, y: reduce ? 0 : 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <div className="roles-hero-dots" aria-hidden />
        <div className="roles-hero-glow-blue" aria-hidden />
        <div className="roles-hero-glow-red" aria-hidden />

        <div className="roles-hero-inner">
          <div className="roles-hero-kicker"><Compass size={13} /> Find Your Role</div>
          <h1 className="roles-title">WHAT IS A ROLE?</h1>
          <motion.div
            className="roles-accent"
            initial={{ scaleX: reduce ? 1 : 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
          />
          <p className="roles-sub">{WHAT_IS_A_ROLE}</p>
          <div className="roles-hero-actions">
            <motion.button
              className="btn btn-primary"
              onClick={() => navigate('/roadmap/roles/discover')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {discovery.result ? 'Retake Role Discovery' : 'Take Role Discovery'} <ArrowRight size={14} />
            </motion.button>
            <motion.button
              className="btn btn-secondary"
              onClick={() => navigate('/roadmap/roles/compare')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <GitCompareArrows size={14} /> Compare Roles
            </motion.button>
            <motion.button
              className="btn btn-secondary"
              onClick={() => navigate('/roadmap/roles/map')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Workflow size={14} /> How Roles Work Together
            </motion.button>
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
        </div>
      </motion.header>

      <div className="roles-grid">
        {roleCards.map((r, i) => (
          <motion.button
            key={r.id}
            type="button"
            className={`roles-card ${r.isPrimary ? 'is-primary' : ''}`}
            onClick={() => navigate(`/roadmap/roles/${r.id}`)}
            initial={{ opacity: 0, y: reduce ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.05, ease: EASE }}
            whileHover={{ y: -2 }}
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
              {r.card.whatItTakes.map((t, ti) => <span key={ti} className="roles-card-chip">{t}</span>)}
            </span>
            <span className="roles-card-mistakes">
              {r.card.commonMistakes.map((m, mi) => (
                <span key={mi}><AlertTriangle size={11} /> {m}</span>
              ))}
            </span>
            {r.readiness && (
              <span className="roles-card-readiness"><Check size={11} /> {r.readiness}</span>
            )}
          </motion.button>
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
  /* ── Hero ── */
  .roles-hero {
    position: relative; overflow: hidden;
    background: linear-gradient(135deg, #F7F9FD 0%, #EEF4FF 60%, #FFF0F2 100%);
    border: 1px solid #E5EAF3; border-radius: 18px;
    padding: clamp(24px, 4vw, 40px);
    box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 16px 48px rgba(15,23,42,0.05);
  }
  .roles-hero-dots {
    position: absolute; inset: 0; pointer-events: none; z-index: 0;
    background-image: radial-gradient(circle, rgba(37,99,255,0.06) 1px, transparent 1px);
    background-size: 24px 24px;
  }
  .roles-hero-glow-blue {
    position: absolute; top: -80px; left: -80px; width: 300px; height: 300px; border-radius: 50%;
    background: radial-gradient(circle, rgba(37,99,255,0.10) 0%, transparent 65%);
    pointer-events: none; z-index: 0;
  }
  .roles-hero-glow-red {
    position: absolute; top: -60px; right: -60px; width: 250px; height: 250px; border-radius: 50%;
    background: radial-gradient(circle, rgba(239,51,64,0.07) 0%, transparent 65%);
    pointer-events: none; z-index: 0;
  }
  .roles-hero-inner { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 10px; }

  .roles-hero-kicker {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 12px;
    text-transform: uppercase; letter-spacing: 0.15em; color: #2563FF;
  }
  .roles-title {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900;
    font-size: clamp(28px, 5.5vw, 44px); line-height: 1; text-transform: uppercase;
    letter-spacing: 0.02em; color: #0B1224; margin: 4px 0 0;
  }
  .roles-accent {
    width: 56px; height: 3px; margin: 10px 0 2px; transform-origin: left;
    background: linear-gradient(90deg, #2563FF 0%, #5B3DF5 50%, #EF3340 100%);
    border-radius: 2px;
  }
  .roles-sub { font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.65; color: #475569; max-width: 620px; margin: 4px 0 0; }
  .roles-hero-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }

  .roles-result-strip {
    margin-top: 14px; padding: 12px 16px; border-radius: 12px;
    background: #FFFFFF; border: 1px solid #E5EAF3; border-left: 3px solid #2563FF;
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px;
    box-shadow: 0 2px 8px rgba(15,23,42,0.04);
  }
  .roles-result-label { font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748B; }
  .roles-result-role { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 15px; color: #0B1224; }
  .roles-result-role em { font-style: normal; font-weight: 500; font-size: 12.5px; color: #2563FF; }
  .roles-result-sec { font-family: 'Inter', sans-serif; font-size: 11.5px; color: #64748B; }

  /* ── Role cards ── */
  .roles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
  .roles-card {
    display: flex; flex-direction: column; gap: 8px; text-align: left; cursor: pointer;
    background: #FFFFFF; border: 1px solid #E5EAF3; border-radius: 16px; padding: 18px;
    box-shadow: 0 4px 20px rgba(15,23,42,0.04);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .roles-card:hover { border-color: rgba(37,99,255,0.3); box-shadow: 0 8px 30px rgba(37,99,255,0.08); }
  .roles-card.is-primary { border-color: rgba(37,99,255,0.45); box-shadow: 0 0 0 1px rgba(37,99,255,0.18), 0 8px 24px rgba(37,99,255,0.08); }
  .roles-card-top { display: flex; align-items: center; gap: 9px; }
  .roles-card-icon { font-size: 22px; line-height: 1; flex-shrink: 0; }
  .roles-card-name {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 15px;
    text-transform: uppercase; letter-spacing: 0.02em; color: #0B1224;
  }
  .roles-card-tag {
    font-family: 'Rajdhani', sans-serif; font-size: 9.5px; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase; color: #2563FF;
    background: #EAF2FF; border: 1px solid rgba(37,99,255,0.2);
    border-radius: 999px; padding: 1px 7px;
  }
  .roles-card-tag--sec { color: #64748B; background: #F1F5F9; border-color: #E5EAF3; }
  .roles-card-chev { color: #2563FF; flex-shrink: 0; }
  .roles-card-job { font-family: 'Inter', sans-serif; font-size: 12.5px; line-height: 1.5; color: #475569; }
  .roles-card-job strong { color: #0B1224; font-weight: 600; }
  .roles-card-takes { display: flex; flex-wrap: wrap; gap: 4px; }
  .roles-card-chip {
    font-family: 'Inter', sans-serif; font-size: 10px; color: #64748B;
    background: #F8FAFD; border: 1px solid #E5EAF3; border-radius: 999px; padding: 2px 8px;
  }
  .roles-card-mistakes { display: flex; flex-direction: column; gap: 3px; }
  .roles-card-mistakes span {
    display: flex; gap: 5px; font-family: 'Inter', sans-serif; font-size: 11px;
    line-height: 1.4; color: #64748B;
  }
  .roles-card-mistakes svg { color: #F59E0B; flex-shrink: 0; margin-top: 2px; }
  .roles-card-readiness {
    display: inline-flex; align-items: center; gap: 4px; margin-top: 2px;
    font-family: 'Inter', sans-serif; font-weight: 600; font-size: 10.5px; color: #16A34A;
  }

  /* ── Notes / final card ── */
  .roles-note-head {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 13px;
    text-transform: uppercase; letter-spacing: 0.06em; color: #2563FF; margin-bottom: 8px;
  }
  .roles-note p { font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.65; color: #475569; margin: 0 0 8px; }
  .roles-note p:last-child { margin-bottom: 0; }

  .roles-final { background: linear-gradient(135deg, #EEF4FF, #F0EEFF); border-color: #DCE5FA; }
  .roles-final p { font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.7; color: #475569; margin: 0 0 8px; }
  .roles-final p:last-child { margin-bottom: 0; }
  .roles-final-last {
    font-family: 'Barlow Condensed', sans-serif !important; font-weight: 700 !important;
    font-size: 14px !important; color: #0B1224 !important;
  }

  /* ── Shared breadcrumb (also used by RoleDetail / ProgressReport / GameplayReview) ── */
  .roles-back {
    align-self: flex-start; display: inline-flex; align-items: center; gap: 6px;
    background: rgba(37,99,255,0.06); border: 1px solid rgba(37,99,255,0.1);
    border-radius: 999px; padding: 7px 16px 7px 12px; cursor: pointer;
    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #2563FF;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .roles-back:hover { background: rgba(37,99,255,0.1); border-color: rgba(37,99,255,0.18); }

  .roles-wrap { display: flex; flex-direction: column; gap: 16px; max-width: 1040px; margin: 0 auto; width: 100%; }

  @media (prefers-reduced-motion: reduce) {
    .roles-card:hover { transform: none; }
  }
`
