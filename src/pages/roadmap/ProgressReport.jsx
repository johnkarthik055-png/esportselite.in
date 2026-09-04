import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
export default function ProgressReport() {
  const navigate = useNavigate()
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
        <div className="card skeleton" style={{ height: 60 }} />
        <div className="card skeleton" style={{ height: 300 }} />
      </div>
    )
  }

  return (
    <div className="prg-wrap page-transition">
      <button className="roles-back" onClick={() => navigate('/roadmap')}>
        <ArrowLeft size={14} /> The Road to Esports
      </button>

      <header>
        <h1 className="roles-title">PROGRESS REPORT</h1>
        <p className="roles-sub">
          Built from your real assessment history. Where you have taken something twice, you get a
          trend. Where you have not, it says so.
        </p>
      </header>

      {/* Starting → Current level */}
      <div className="card">
        <div className="rma-side-title">Level</div>
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
      </div>

      {/* Per-category deltas */}
      <div className="card">
        <div className="rma-side-title">Category movement</div>
        <ul className="prg-deltas">
          {report.categories.map(cat => <DeltaRow key={cat.id} cat={cat} />)}
        </ul>
        <p className="prg-empty" style={{ marginTop: 12 }}>
          Categories become trends once you have taken the underlying assessment (or Role Discovery) more
          than once.
        </p>
      </div>

      {/* Callouts */}
      <div className="prg-callouts">
        <div className="card prg-callout prg-callout--up">
          <div className="prg-callout-head"><TrendingUp size={13} /> Biggest improvement</div>
          {report.biggestImprovement ? (
            <p><strong>{report.biggestImprovement.label}</strong> — up {report.biggestImprovement.delta} points across {report.biggestImprovement.attempts} attempts.</p>
          ) : (
            <p>Not enough repeat data yet to name one. Re-take an assessment to unlock this.</p>
          )}
        </div>
        <div className="card prg-callout prg-callout--down">
          <div className="prg-callout-head"><Target size={13} /> Biggest remaining weakness</div>
          {report.biggestWeakness ? (
            <p><strong>{report.biggestWeakness.label}</strong>{typeof report.biggestWeakness.current === 'number' ? ` — currently ${report.biggestWeakness.current}%.` : '.'}</p>
          ) : (
            <p>Complete an assessment so there is something to measure.</p>
          )}
        </div>
      </div>

      {/* Role + next steps */}
      <div className="card">
        <div className="rma-side-title">Where you stand</div>
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
      </div>

      <p className="prg-empty">
        This report tracks development toward competitive readiness — it is not a claim that you have
        become, or will become, a professional player. The goal is to know your level, close real gaps,
        and keep moving.
      </p>

      <div className="card prg-example">
        <div className="rma-side-title">Example report</div>
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
        <button className="btn btn-primary" onClick={() => navigate('/analytics')}>
          <Trophy size={14} /> Open Analytics <ArrowRight size={14} />
        </button>
      </div>
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
