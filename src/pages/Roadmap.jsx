import { useNavigate } from 'react-router-dom'
import {
  Check, Lock, Play, ArrowRight, Clock, Zap, Trophy, RotateCcw, Compass,
} from 'lucide-react'
import { useRoadmap } from '../hooks/useRoadmap.js'
import { ROADMAP_TOTAL_XP } from '../data/roadmapStages.js'

/*
 * Career Roadmap — overview timeline.
 *
 * Each stage is a node on a vertical timeline. Locked stages are
 * greyed and non-clickable; unlocked ones open the 4-phase flow
 * (content → assessment → result → next step) at /roadmap/:stageId.
 * Unlock is milestone-based only (finish the previous stage) — no
 * day/calendar locking.
 */
export default function Roadmap() {
  const navigate = useNavigate()
  const {
    loading, stages, completedCount, totalStages, xpEarned, nextStage,
  } = useRoadmap()

  if (loading) {
    return (
      <div className="rm-wrap page-transition">
        <div className="card skeleton" style={{ height: 120 }} />
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="card skeleton" style={{ height: 110 }} />
        ))}
        <style>{styles}</style>
      </div>
    )
  }

  const pct = totalStages > 0 ? Math.round((completedCount / totalStages) * 100) : 0

  return (
    <div className="rm-wrap page-transition">
      {/* Header */}
      <div>
        <h1 className="rm-h1"><Compass size={22} /> Career Roadmap</h1>
        <div className="rm-sub">
          A guided path from beginner to competitive player. Finish a stage to unlock the next.
        </div>
      </div>

      {/* Progress summary */}
      <div className="card rm-summary">
        <div className="rm-summary-row">
          <SummaryStat icon={<Trophy size={16} />} value={`${completedCount}/${totalStages}`} label="Stages done" />
          <SummaryStat icon={<Zap size={16} />} value={xpEarned.toLocaleString()} label={`of ${ROADMAP_TOTAL_XP.toLocaleString()} roadmap XP`} />
          <SummaryStat icon={<ArrowRight size={16} />} value={nextStage ? `Stage ${nextStage.order}` : 'Complete'} label={nextStage ? nextStage.title : 'Whole roadmap done'} />
        </div>
        <div className="rm-bar">
          <div className="rm-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="rm-bar-label">{pct}% complete</div>

        {nextStage && (
          <button
            className="btn btn-primary btn-sm rm-resume"
            onClick={() => navigate(`/roadmap/${nextStage.id}`)}
          >
            {nextStage.state === 'in_progress' ? 'Resume' : 'Start'} Stage {nextStage.order}
            <ArrowRight size={13} />
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="rm-timeline">
        {stages.map((s, i) => (
          <StageNode
            key={s.id}
            stage={s}
            isLast={i === stages.length - 1}
            onOpen={() => navigate(`/roadmap/${s.id}`)}
          />
        ))}
      </div>

      <style>{styles}</style>
    </div>
  )
}

function SummaryStat({ icon, value, label }) {
  return (
    <div className="rm-sstat">
      <span className="rm-sstat-icon">{icon}</span>
      <div>
        <div className="rm-sstat-value">{value}</div>
        <div className="rm-sstat-label">{label}</div>
      </div>
    </div>
  )
}

function StageNode({ stage, isLast, onOpen }) {
  const { state, order, title, tagline, icon, estMinutes, xpReward, questionCount, result } = stage
  const locked = state === 'locked'
  const done = state === 'completed'
  const inProgress = state === 'in_progress'

  const nodeClass =
    done ? 'rm-node-dot done' :
    locked ? 'rm-node-dot locked' :
    inProgress ? 'rm-node-dot active' :
    'rm-node-dot available'

  return (
    <div className={`rm-node ${locked ? 'is-locked' : ''}`}>
      <div className="rm-node-rail">
        <div className={nodeClass}>
          {done ? <Check size={15} strokeWidth={3} />
            : locked ? <Lock size={13} />
            : <span>{order}</span>}
        </div>
        {!isLast && <div className={`rm-node-line ${done ? 'done' : ''}`} />}
      </div>

      <button
        type="button"
        className="card rm-card"
        disabled={locked}
        onClick={locked ? undefined : onOpen}
      >
        <div className="rm-card-top">
          <span className="rm-card-emoji">{icon}</span>
          <div className="rm-card-head">
            <div className="rm-card-kicker">
              Stage {order}
              {done && <span className="badge badge-green">Completed</span>}
              {inProgress && <span className="badge badge-blue">In progress</span>}
              {locked && <span className="badge badge-muted">Locked</span>}
            </div>
            <div className="rm-card-title">{title}</div>
          </div>
        </div>

        <div className="rm-card-tagline">{tagline}</div>

        <div className="rm-card-meta">
          <span><Clock size={12} /> ~{estMinutes} min</span>
          <span><Zap size={12} /> {xpReward} XP</span>
          <span>{questionCount} question{questionCount === 1 ? '' : 's'}</span>
          {done && result && (
            <span className="rm-card-score">
              Score {Math.round(result.score * 100)}%
            </span>
          )}
        </div>

        {!locked && (
          <div className="rm-card-cta">
            {done ? <><RotateCcw size={13} /> Review stage</>
              : inProgress ? <><Play size={13} /> Continue</>
              : <><Play size={13} /> Start stage</>}
            <ArrowRight size={13} />
          </div>
        )}
        {locked && (
          <div className="rm-card-cta muted">
            <Lock size={12} /> Finish Stage {order - 1} to unlock
          </div>
        )}
      </button>
    </div>
  )
}

const styles = `
  .rm-wrap { display:flex; flex-direction:column; gap:20px; max-width:860px; margin:0 auto; width:100%; }
  .rm-h1 { display:flex; align-items:center; gap:9px; font-family:'Bebas Neue',sans-serif; font-weight:400; font-size:28px; letter-spacing:0.04em; text-transform:uppercase; color:var(--text-primary); margin:0; }
  .rm-sub { font-family:'DM Sans',sans-serif; font-size:13px; color:var(--text-muted); margin-top:4px; }

  .rm-summary { display:flex; flex-direction:column; gap:12px; }
  .rm-summary-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; }
  .rm-sstat { display:flex; align-items:center; gap:10px; }
  .rm-sstat-icon { width:32px; height:32px; flex-shrink:0; border-radius:8px; background:var(--bg-elevated); border:1px solid var(--border); color:var(--cyan); display:flex; align-items:center; justify-content:center; }
  .rm-sstat-value { font-family:'Oxanium',sans-serif; font-weight:700; font-size:16px; color:var(--text-primary); line-height:1.2; }
  .rm-sstat-label { font-family:'DM Sans',sans-serif; font-size:11px; color:var(--text-subtle); }
  .rm-bar { height:10px; background:var(--bg-elevated); border:1px solid var(--border); border-radius:999px; overflow:hidden; }
  .rm-bar-fill { height:100%; background:linear-gradient(90deg,var(--blue),var(--cyan)); transition:width 0.5s ease; }
  .rm-bar-label { font-family:'DM Sans',sans-serif; font-size:11px; color:var(--text-subtle); text-align:right; }
  .rm-resume { align-self:flex-start; margin-top:2px; }

  .rm-timeline { display:flex; flex-direction:column; }
  .rm-node { display:flex; gap:14px; }
  .rm-node-rail { display:flex; flex-direction:column; align-items:center; flex-shrink:0; }
  .rm-node-dot { width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Oxanium',sans-serif; font-weight:700; font-size:14px; border:2px solid var(--border); background:var(--bg-elevated); color:var(--text-subtle); flex-shrink:0; }
  .rm-node-dot.available { border-color:var(--blue); color:var(--blue); }
  .rm-node-dot.active { border-color:var(--blue); background:var(--blue); color:#fff; box-shadow:0 0 12px rgba(59,130,246,0.45); }
  .rm-node-dot.done { border-color:var(--green); background:var(--green); color:#04140b; }
  .rm-node-dot.locked { color:var(--text-subtle); }
  .rm-node-line { width:2px; flex:1; min-height:22px; background:var(--border); margin:4px 0; }
  .rm-node-line.done { background:var(--green); }

  .rm-card { text-align:left; width:100%; margin-bottom:14px; cursor:pointer; display:flex; flex-direction:column; gap:10px; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius); padding:16px; transition:border-color 0.15s ease, transform 0.15s ease; }
  .rm-card:hover:not(:disabled) { border-color:var(--blue); transform:translateY(-1px); }
  .rm-card:disabled { cursor:default; opacity:0.55; }
  .rm-card-top { display:flex; gap:12px; align-items:flex-start; }
  .rm-card-emoji { font-size:24px; line-height:1; flex-shrink:0; }
  .rm-card-head { min-width:0; }
  .rm-card-kicker { display:flex; align-items:center; gap:8px; font-family:'DM Sans',sans-serif; font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-subtle); margin-bottom:3px; }
  .rm-card-title { font-family:'Oxanium',sans-serif; font-weight:700; font-size:17px; color:var(--text-primary); }
  .rm-card-tagline { font-family:'DM Sans',sans-serif; font-size:13px; color:var(--text-muted); line-height:1.5; }
  .rm-card-meta { display:flex; flex-wrap:wrap; gap:12px; font-family:'DM Sans',sans-serif; font-size:11.5px; color:var(--text-subtle); }
  .rm-card-meta span { display:inline-flex; align-items:center; gap:4px; }
  .rm-card-score { color:var(--green); }
  .rm-card-cta { display:inline-flex; align-items:center; gap:6px; font-family:'Oxanium',sans-serif; font-weight:700; font-size:12.5px; letter-spacing:0.03em; color:var(--blue); text-transform:uppercase; }
  .rm-card-cta.muted { color:var(--text-subtle); text-transform:none; font-family:'DM Sans',sans-serif; font-weight:500; letter-spacing:0; }

  @media (max-width:600px) {
    .rm-card-emoji { font-size:20px; }
    .rm-card-title { font-size:15.5px; }
  }
`
