import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, RefreshCcw, TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import { useRoadmap } from '../../hooks/useRoadmap.js'
import { useRoles } from '../../hooks/useRoles.js'
import { useStreak } from '../../hooks/useStreak.js'
import { useUserData } from '../../hooks/useUserData.js'
import { computeProgressReport } from '../../utils/progressReport.js'
import StageAssessment from './StageAssessment.jsx'

const STAGE_ID = 'know-yourself'

/*
 * Final Reassessment (Issue 8 — real bug fix).
 *
 * Previously, Day 28 of the 30-Day Journey opened Stage 1's assessment with
 * no distinct framing — indistinguishable from "Stage 01 Assessment". This
 * is a dedicated, clearly-labeled screen: "Let's see what changed."
 *
 * It reuses Stage 1's REAL assessment questions/flow under the hood (the
 * same <StageAssessment> component, the same useRoadmap actions, so a
 * retake here is a genuine new attempt in Stage 1's attempts[] history) —
 * but the chrome, heading, and result view are unmistakably "Final
 * Reassessment", never "Stage 01 Assessment". The result compares ORIGINAL
 * baseline vs CURRENT scores per real tracked category (the same category
 * set the Progress Report uses), not a fake number.
 */
export default function FinalReassessment() {
  const navigate = useNavigate()
  const {
    loading, getStage, stages, saveAnswer, submitAssessment,
  } = useRoadmap()
  const { loading: rLoading, discovery } = useRoles()
  const streak = useStreak()
  const { matches } = useUserData()

  const [mode, setMode] = useState('intro') /* 'intro' | 'assessing' */

  const stage = getStage(STAGE_ID)
  const attemptCount = stage?.attempts?.length || 0

  const report = useMemo(() => computeProgressReport({
    roadmapStages: stages,
    roleAttempts: discovery.attempts,
    discoveryResult: discovery.result,
    streak,
    matchCount: (matches || []).length,
  }), [stages, discovery.attempts, discovery.result, streak, matches])

  if (loading || rLoading || !stage) {
    return (
      <div className="roles-wrap page-transition">
        <div className="card skeleton" style={{ height: 60 }} />
        <div className="card skeleton" style={{ height: 300 }} />
      </div>
    )
  }

  function handleSubmit() {
    submitAssessment(STAGE_ID)
    setMode('intro')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (mode === 'assessing') {
    return (
      <div className="roles-wrap page-transition">
        <button className="roles-back" onClick={() => setMode('intro')}>
          <ArrowLeft size={14} /> Final Reassessment
        </button>
        <header>
          <h1 className="roles-title">FINAL REASSESSMENT</h1>
          <p className="roles-sub">
            Same questions as your Stage 1 baseline, answered fresh. This is not the original Stage 01
            assessment — it&apos;s a check on what&apos;s changed since then.
          </p>
        </header>
        <StageAssessment
          stage={stage}
          onAnswer={(sid, qid, val) => saveAnswer(STAGE_ID, sid, qid, val)}
          onBack={() => setMode('intro')}
          onSubmit={handleSubmit}
        />
      </div>
    )
  }

  return (
    <div className="roles-wrap page-transition">
      <button className="roles-back" onClick={() => navigate('/roadmap')}>
        <ArrowLeft size={14} /> The Road to Esports
      </button>

      <header>
        <h1 className="roles-title">FINAL REASSESSMENT</h1>
        <p className="roles-sub">Let&apos;s see what changed.</p>
      </header>

      {attemptCount === 0 && (
        <div className="card empty-state">
          <div className="empty-state-title">No baseline yet</div>
          <div className="empty-state-desc">
            You haven&apos;t completed your Stage 1 baseline assessment yet — there&apos;s nothing to
            compare against. Complete it first, then come back here.
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigate('/roadmap/know-yourself')}>
            Go to Stage 01 · Know Yourself
          </button>
        </div>
      )}

      {attemptCount === 1 && (
        <div className="card">
          <div className="rma-side-title">You have a baseline, not a comparison yet</div>
          <p className="prg-empty">
            You&apos;ve completed your Stage 1 baseline once. Retake it now — honestly, based on how you
            actually play today — and this page will show real starting-vs-current movement per area.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setMode('assessing')}>
            <RefreshCcw size={14} /> Start Final Reassessment <ArrowRight size={14} />
          </button>
        </div>
      )}

      {attemptCount >= 2 && (
        <>
          <div className="card">
            <div className="rma-side-title">Category movement — starting vs current</div>
            <ul className="prg-deltas">
              {report.categories.map(cat => <ReassessRow key={cat.id} cat={cat} />)}
            </ul>
            <p className="prg-empty" style={{ marginTop: 12 }}>
              Only categories you&apos;ve assessed more than once show a real trend — the rest still say
              &ldquo;not enough data yet&rdquo;, honestly.
            </p>
          </div>

          <div className="card">
            <div className="rma-side-title">Overall level</div>
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
              </div>
            ) : (
              <p className="prg-empty">No overall baseline recorded yet.</p>
            )}
          </div>

          <div className="rgd-hero-actions">
            <button className="btn btn-secondary" onClick={() => setMode('assessing')}>
              <RefreshCcw size={14} /> Reassess again
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/roadmap/progress-report')}>
              Open Full Progress Report <ArrowRight size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function ReassessRow({ cat }) {
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
    val = <span className="prg-delta-val prg-delta-val--nodata">1 attempt · not enough data yet</span>
  } else if (cat.status === 'snapshot') {
    track = <div className="prg-delta-track"><div className="prg-delta-fill" style={{ width: `${Math.min(100, (cat.current / 30) * 100)}%` }} /></div>
    val = <span className="prg-delta-val prg-delta-val--nodata">{cat.current} {cat.unit}</span>
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
