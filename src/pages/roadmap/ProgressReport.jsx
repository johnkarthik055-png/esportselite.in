import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, TrendingUp, TrendingDown, Minus, Trophy, Target,
} from 'lucide-react'
import { useRoadmap } from '../../hooks/useRoadmap.js'
import { useRoles } from '../../hooks/useRoles.js'
import { useStreak } from '../../hooks/useStreak.js'
import { useUserData } from '../../hooks/useUserData.js'
import { computeProgressReport } from '../../utils/progressReport.js'
import AICoachPanel from '../../components/roadmap/AICoachPanel.jsx'

/*
 * Section C — Progress Report.
 *
 * Real, computed report from stored per-attempt history (roadmap stage
 * attempts + role discovery attempts) + live snapshots. Categories with
 * only one attempt show "Not enough data yet" — never a fake delta.
 */
const EASE = [0.22, 1, 0.36, 1]

export default function ProgressReport() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const { loading: rmLoading, stages } = useRoadmap()
  const { loading: rLoading, discovery, roleData } = useRoles()
  const streak = useStreak()
  const { matches } = useUserData()

  const primaryRoleReadiness = discovery.result?.primaryRoleId
    ? roleData(discovery.result.primaryRoleId).result
    : null

  const report = useMemo(() => computeProgressReport({
    roadmapStages: stages,
    roleAttempts: discovery.attempts,
    discoveryResult: discovery.result,
    streak,
    matchCount: (matches || []).length,
  }), [stages, discovery.attempts, discovery.result, streak, matches])

  if (rmLoading || rLoading) {
    return (
      <div className="prg-wrap page-transition">
        <div className="card skeleton" style={{ height: 160 }} />
        <div className="card skeleton" style={{ height: 300 }} />
      </div>
    )
  }

  return (
    <div className="prg-wrap page-transition">
      <motion.button
        className="prg-back"
        onClick={() => navigate('/roadmap')}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <ArrowLeft size={14} /> The Road to Esports
      </motion.button>

      <motion.header
        className="prg-hero"
        initial={{ opacity: 0, y: reduce ? 0 : 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <div className="prg-hero-dots" aria-hidden />
        <div className="prg-hero-glow-blue" aria-hidden />
        <div className="prg-hero-glow-red" aria-hidden />
        <div className="prg-hero-inner">
          <div className="prg-hero-kicker">Your Development</div>
          <h1 className="prg-title">PROGRESS REPORT</h1>
          <motion.div
            className="prg-accent"
            initial={{ scaleX: reduce ? 1 : 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
          />
          <p className="prg-sub">
            Built from your real assessment history. Where you have taken something twice, you get a
            trend. Where you have not, it says so.
          </p>
        </div>
      </motion.header>

      {/* Starting → Current level */}
      <motion.div
        className="card prg-card"
        initial={{ opacity: 0, y: reduce ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05, ease: EASE }}
        whileHover={{ y: -2 }}
      >
        <div className="prg-card-title">Level</div>
        {report.hasBaseline ? (
          <div className="prg-levels">
            <div className="prg-levelbox">
              <div className="prg-levelbox-label">Starting</div>
              <div className="prg-levelbox-val">{report.startingLevel.label}</div>
              <div className="prg-levelbox-score">{report.startingLevel.score}/100</div>
            </div>
            <ArrowRight className="prg-arrow" size={22} />
            <div className="prg-levelbox">
              <div className="prg-levelbox-label">Current</div>
              <div className="prg-levelbox-val">{report.currentLevel.label}</div>
              <div className="prg-levelbox-score">{report.currentLevel.score}/100</div>
            </div>
            {report.startingLevel.score !== report.currentLevel.score && (
              <span
                className={`prg-delta-val ${report.currentLevel.score > report.startingLevel.score ? 'prg-delta-val--up' : 'prg-delta-val--down'}`}
              >
                {report.currentLevel.score > report.startingLevel.score ? '+' : ''}
                {report.currentLevel.score - report.startingLevel.score} pts
              </span>
            )}
          </div>
        ) : (
          <p className="prg-empty">
            No overall baseline yet — take the Stage 1 &ldquo;Know Yourself&rdquo; assessment and this fills in.
          </p>
        )}
      </motion.div>

      {/* Per-category deltas */}
      <motion.div
        className="card prg-card"
        initial={{ opacity: 0, y: reduce ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: EASE }}
        whileHover={{ y: -2 }}
      >
        <div className="prg-card-title">Category movement</div>
        <ul className="prg-deltas">
          {report.categories.map(cat => <DeltaRow key={cat.id} cat={cat} />)}
        </ul>
        <p className="prg-empty" style={{ marginTop: 12 }}>
          Categories become trends once you have taken the underlying assessment (or Role Discovery) more
          than once.
        </p>
      </motion.div>

      {/* Callouts */}
      <div className="prg-callouts">
        <motion.div
          className="card prg-callout prg-callout--up"
          initial={{ opacity: 0, y: reduce ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15, ease: EASE }}
          whileHover={{ y: -2 }}
        >
          <div className="prg-callout-head"><TrendingUp size={13} /> Biggest improvement</div>
          {report.biggestImprovement ? (
            <p><strong>{report.biggestImprovement.label}</strong> — up {report.biggestImprovement.delta} points across {report.biggestImprovement.attempts} attempts.</p>
          ) : (
            <p>Not enough repeat data yet to name one. Re-take an assessment to unlock this.</p>
          )}
        </motion.div>
        <motion.div
          className="card prg-callout prg-callout--down"
          initial={{ opacity: 0, y: reduce ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2, ease: EASE }}
          whileHover={{ y: -2 }}
        >
          <div className="prg-callout-head"><Target size={13} /> Biggest remaining weakness</div>
          {report.biggestWeakness ? (
            <p><strong>{report.biggestWeakness.label}</strong>{typeof report.biggestWeakness.current === 'number' ? ` — currently ${report.biggestWeakness.current}%.` : '.'}</p>
          ) : (
            <p>Complete an assessment so there is something to measure.</p>
          )}
        </motion.div>
      </div>

      {/* Role + next steps */}
      <motion.div
        className="card prg-card"
        initial={{ opacity: 0, y: reduce ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25, ease: EASE }}
        whileHover={{ y: -2 }}
      >
        <div className="prg-card-title">Where you stand</div>
        <div className="prg-kv">
          <div className="prg-kv-row">
            <span className="prg-kv-k">Primary and secondary role</span>
            <span className="prg-kv-v">
              {report.primaryRole
                ? `${report.primaryRole}${report.secondaryRole ? ` · ${report.secondaryRole}` : ''}${report.roleFit ? ` (${report.roleFit} fit)` : ''}`
                : 'Not yet discovered'}
              {!report.primaryRole && (
                <button className="btn btn-secondary btn-sm" style={{ marginLeft: 10 }} onClick={() => navigate('/roadmap/roles/discover')}>
                  Run Role Discovery
                </button>
              )}
            </span>
          </div>
          <div className="prg-kv-row">
            <span className="prg-kv-k">Role readiness</span>
            <span className="prg-kv-v">
              {primaryRoleReadiness
                ? `${primaryRoleReadiness.readinessLabel} (${primaryRoleReadiness.score}%)`
                : discovery.result
                  ? 'Not assessed yet'
                  : '—'}
              {discovery.result && !primaryRoleReadiness && (
                <button className="btn btn-secondary btn-sm" style={{ marginLeft: 10 }} onClick={() => navigate(`/roadmap/roles/${discovery.result.primaryRoleId}`)}>
                  Take Role Assessment
                </button>
              )}
            </span>
          </div>
          <div className="prg-kv-row">
            <span className="prg-kv-k">Matches logged</span>
            <span className="prg-kv-v">{report.matchCount}</span>
          </div>
          <div className="prg-kv-row">
            <span className="prg-kv-k">Recommended next 30 days</span>
            <span className="prg-kv-v">{report.nextPriority}</span>
          </div>
          <div className="prg-kv-row">
            <span className="prg-kv-k">Next step</span>
            <span className="prg-kv-v">{report.nextStep}</span>
          </div>
        </div>
      </motion.div>

      <p className="prg-empty">
        This report tracks development toward competitive readiness — it is not a claim that you have
        become, or will become, a professional player. The goal is to know your level, close real gaps,
        and keep moving.
      </p>

      <div className="card prg-example">
        <div className="prg-card-title">Example report</div>
        <p>
          &ldquo;You improved most in close-range mechanics and communication. Your biggest remaining
          weakness is fight selection. You are developing well as an Entry Fragger, but your next
          priority is patience and information before committing to fights.&rdquo;
        </p>
      </div>

      <AICoachPanel
        context={{ area: 'progress-report' }}
        blurb="When available, the AI Coach can read this report and build the week's training plan around your weakest tracked area."
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/roadmap')}>Back to Roadmap</button>
        <motion.button
          className="btn btn-primary"
          onClick={() => navigate('/analytics')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Trophy size={14} /> Open Analytics <ArrowRight size={14} />
        </motion.button>
      </div>

      <style>{styles}</style>
    </div>
  )
}

function DeltaRow({ cat }) {
  let track = null
  let val = null

  if (cat.status === 'delta') {
    const up = cat.delta > 0
    const flat = cat.delta === 0
    track = (
      <div className="prg-delta-track">
        <div className="prg-delta-fill prg-delta-fill--start" style={{ width: `${cat.start}%` }} />
        <div className="prg-delta-fill" style={{ width: `${cat.current}%` }} />
      </div>
    )
    val = (
      <span className={`prg-delta-val ${up ? 'prg-delta-val--up' : flat ? 'prg-delta-val--flat' : 'prg-delta-val--down'}`}>
        {up ? <TrendingUp size={12} /> : flat ? <Minus size={12} /> : <TrendingDown size={12} />}
        {' '}{up ? '+' : ''}{cat.delta} ({cat.start}→{cat.current})
      </span>
    )
  } else if (cat.status === 'one') {
    track = <div className="prg-delta-track"><div className="prg-delta-fill" style={{ width: `${cat.current}%` }} /></div>
    val = <span className="prg-delta-val prg-delta-val--nodata">1 attempt · {cat.current}% — not enough data yet</span>
  } else if (cat.status === 'snapshot') {
    track = <div className="prg-delta-track"><div className="prg-delta-fill" style={{ width: `${Math.min(100, (cat.current / 30) * 100)}%` }} /></div>
    val = <span className="prg-delta-val prg-delta-val--nodata">{cat.current} {cat.unit} · no history tracked</span>
  } else {
    track = <div className="prg-delta-track" />
    val = <span className="prg-delta-val prg-delta-val--nodata">Not enough data yet</span>
  }

  return (
    <li className="prg-delta">
      <span className="prg-delta-name">{cat.label}</span>
      {track}
      {val}
    </li>
  )
}

const styles = `
  .prg-wrap { display: flex; flex-direction: column; gap: 16px; max-width: 920px; margin: 0 auto; width: 100%; }

  .prg-back {
    align-self: flex-start; display: inline-flex; align-items: center; gap: 6px;
    background: rgba(37,99,255,0.06); border: 1px solid rgba(37,99,255,0.1);
    border-radius: 999px; padding: 7px 16px 7px 12px; cursor: pointer;
    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #2563FF;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .prg-back:hover { background: rgba(37,99,255,0.1); border-color: rgba(37,99,255,0.18); }

  /* ── Hero ── */
  .prg-hero {
    position: relative; overflow: hidden;
    background: linear-gradient(135deg, #F7F9FD 0%, #EEF4FF 60%, #FFF0F2 100%);
    border: 1px solid #E5EAF3; border-radius: 18px;
    padding: clamp(24px, 4vw, 36px);
    box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 16px 48px rgba(15,23,42,0.05);
  }
  .prg-hero-dots {
    position: absolute; inset: 0; pointer-events: none; z-index: 0;
    background-image: radial-gradient(circle, rgba(37,99,255,0.06) 1px, transparent 1px);
    background-size: 24px 24px;
  }
  .prg-hero-glow-blue {
    position: absolute; top: -70px; left: -70px; width: 280px; height: 280px; border-radius: 50%;
    background: radial-gradient(circle, rgba(37,99,255,0.10) 0%, transparent 65%);
    pointer-events: none; z-index: 0;
  }
  .prg-hero-glow-red {
    position: absolute; top: -50px; right: -50px; width: 230px; height: 230px; border-radius: 50%;
    background: radial-gradient(circle, rgba(239,51,64,0.07) 0%, transparent 65%);
    pointer-events: none; z-index: 0;
  }
  .prg-hero-inner { position: relative; z-index: 1; }
  .prg-hero-kicker {
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.15em; color: #2563FF;
  }
  .prg-title {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900;
    font-size: clamp(28px, 5.5vw, 44px); line-height: 1; text-transform: uppercase;
    letter-spacing: 0.02em; color: #0B1224; margin: 4px 0 0;
  }
  .prg-accent {
    width: 56px; height: 3px; margin: 10px 0 2px; transform-origin: left;
    background: linear-gradient(90deg, #2563FF 0%, #5B3DF5 50%, #EF3340 100%);
    border-radius: 2px;
  }
  .prg-sub { font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.65; color: #475569; max-width: 620px; margin: 6px 0 0; }

  /* ── Cards ── */
  .prg-card { transition: box-shadow 0.2s ease; }
  .prg-card-title {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 13px;
    text-transform: uppercase; letter-spacing: 0.06em; color: #2563FF; margin-bottom: 12px;
  }
  .prg-empty { font-family: 'Inter', sans-serif; font-size: 13px; color: #94A3B8; font-style: italic; }

  .prg-levels { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .prg-levelbox { text-align: center; }
  .prg-levelbox-label { font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748B; }
  .prg-levelbox-val { font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 28px; letter-spacing: 0.02em; color: #0B1224; }
  .prg-levelbox-score { font-family: 'Inter', sans-serif; font-size: 11.5px; color: #475569; }
  .prg-arrow { color: #2563FF; flex-shrink: 0; }

  .prg-deltas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .prg-delta { display: grid; grid-template-columns: 150px 1fr auto; gap: 12px; align-items: center; padding-top: 10px; border-top: 1px solid #E5EAF3; }
  .prg-delta:first-child { border-top: none; padding-top: 0; }
  .prg-delta-name { font-family: 'Inter', sans-serif; font-weight: 500; font-size: 12.5px; color: #0B1224; }
  .prg-delta-track { position: relative; height: 8px; background: #F1F5F9; border: 1px solid #E5EAF3; border-radius: 999px; overflow: hidden; }
  .prg-delta-fill { position: absolute; top: 0; left: 0; height: 100%; background: linear-gradient(90deg, #2563FF, #5B3DF5); border-radius: 999px; }
  .prg-delta-fill--start { background: #CBD5E1; }
  .prg-delta-val { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 12px; white-space: nowrap; display: inline-flex; align-items: center; gap: 3px; }
  .prg-delta-val--up { color: #16A34A; }
  .prg-delta-val--down { color: #EF3340; }
  .prg-delta-val--flat { color: #64748B; }
  .prg-delta-val--nodata { color: #94A3B8; font-weight: 500; font-size: 11.5px; }

  @media (max-width: 560px) {
    .prg-delta { grid-template-columns: 1fr; gap: 6px; }
  }

  .prg-callouts { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .prg-callout { border-left: 3px solid #E5EAF3; }
  .prg-callout--up { border-left-color: #16A34A; }
  .prg-callout--down { border-left-color: #EF3340; }
  .prg-callout-head {
    display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
    font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 11px;
    letter-spacing: 0.08em; text-transform: uppercase; color: #64748B;
  }
  .prg-callout--up .prg-callout-head { color: #16A34A; }
  .prg-callout--down .prg-callout-head { color: #EF3340; }
  .prg-callout p { font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.6; color: #475569; margin: 0; }
  .prg-callout p strong { color: #0B1224; }

  .prg-kv { display: flex; flex-direction: column; gap: 10px; }
  .prg-kv-row {
    display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px;
    padding-top: 10px; border-top: 1px solid #E5EAF3;
  }
  .prg-kv-row:first-child { border-top: none; padding-top: 0; }
  .prg-kv-k { font-family: 'Inter', sans-serif; font-size: 12.5px; color: #64748B; }
  .prg-kv-v { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 13px; color: #0B1224; display: flex; align-items: center; }

  .prg-example { background: linear-gradient(135deg, #EEF4FF, #F0EEFF); border-color: #DCE5FA; }
  .prg-example p { font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.7; color: #475569; margin: 0; font-style: italic; }
`
