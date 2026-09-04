import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Target, Info, Dumbbell, ExternalLink,
} from 'lucide-react'
import { extractImproveItems } from '../../data/roadmapStages.js'
import { getTrainingRecommendation, trainingUrl } from '../../utils/roadmapTraining.js'

/*
 * Phase D — IMPROVE (Issue 5).
 *
 * "Your Weakness" -> "Why It Matters" -> "Train This" -> "Start Training".
 * The weak area and its improve list are both pulled from this stage's own
 * real result/content — nothing invented. "Train This" matches against the
 * REAL, EXISTING Training Center taxonomy (SUGGESTION_CATEGORIES /
 * DEFAULT_SUGGESTIONS in utils/constants.js) and — where the weak area maps
 * to a stage that already has its own dedicated real screen (Role System,
 * Gameplay Review, Scrim Prep, Competition Readiness, My Team, Progress
 * Report) — routes there instead, rather than duplicating anything inside
 * Roadmap.
 */
export default function StageImprove({ stage, onBack, onContinue }) {
  const navigate = useNavigate()
  const result = stage.result

  const weakestSectionCfg = useMemo(() => {
    if (!result?.weakest) return null
    return (stage.sections || []).find(s => s.id === result.weakest.sectionId) || null
  }, [result, stage.sections])

  const weakestSectionResult = useMemo(() => {
    if (!result?.weakest) return null
    return result.sectionResults.find(s => s.sectionId === result.weakest.sectionId) || null
  }, [result])

  /* Stage 3's per-area rollup gives a more precise weak spot than the
     section-level score (e.g. "Long Range" inside "Game Mechanics"). */
  const weakestArea = weakestSectionResult?.areas?.length
    ? [...weakestSectionResult.areas].sort((a, b) => {
        const rank = { 'Needs Work': 0, Developing: 1, Strong: 2 }
        return (rank[a.level] ?? 1) - (rank[b.level] ?? 1)
      })[0]
    : null

  const improveItems = weakestSectionCfg ? extractImproveItems(weakestSectionCfg, 4) : []
  const hasOwnCta = !!weakestSectionCfg?.content?.cta

  const trainingRec = useMemo(
    () => getTrainingRecommendation({
      sectionId: result?.weakest?.sectionId,
      areaName: weakestArea?.area,
    }),
    [result, weakestArea],
  )

  if (!result || !result.weakest) {
    return (
      <div className="card empty-state">
        <div className="empty-state-title">No result yet</div>
        <div className="empty-state-desc">Complete the assessment first to see what to improve.</div>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={onBack}>
          Back to Result
        </button>
      </div>
    )
  }

  const weakLabel = weakestArea ? weakestArea.area : (weakestSectionCfg?.name || result.weakest.name)
  const weakScoreText = weakestArea
    ? `${weakestArea.level}`
    : `${result.weakest.level} (${result.weakest.score}%)`

  const whyItMatters = weakestSectionCfg?.tagline
    ? weakestSectionCfg.tagline
    : `Of everything assessed in ${stage.title}, this is where your answers show the most room to grow — closing this gap moves your overall level the most.`

  function startTraining() {
    if (hasOwnCta) { navigate(weakestSectionCfg.content.cta.to); return }
    navigate(trainingUrl(trainingRec))
  }

  return (
    <div className="rmi-wrap">
      <div className="rmi-pagehead">Improve</div>

      <div className="card rmi-weakness">
        <div className="rmi-weakness-head"><Target size={15} /> Your Weakness</div>
        <div className="rmi-weakness-name">{weakLabel}</div>
        <div className="rmi-weakness-score">{weakScoreText}</div>
      </div>

      <div className="card">
        <div className="rmi-section-head"><Info size={13} /> Why It Matters</div>
        <p className="rmi-body">{whyItMatters}</p>
      </div>

      {improveItems.length > 0 && (
        <div className="card">
          <div className="rmi-section-head">How To Improve</div>
          <ul className="rmi-list">
            {improveItems.map((it, i) => <li key={i}><span className="rmi-list-num">{i + 1}</span> {it}</li>)}
          </ul>
        </div>
      )}

      <div className="card rmi-train">
        <div className="rmi-section-head"><Dumbbell size={13} /> Train This</div>
        {hasOwnCta ? (
          <p className="rmi-body">
            This area has its own tool — <strong>{weakestSectionCfg.content.cta.label}</strong> — instead of a
            generic drill list, so you use the real thing rather than a duplicate inside Roadmap.
          </p>
        ) : trainingRec.categoryName ? (
          <>
            <p className="rmi-body">
              Matched to the Training Center&apos;s <strong>{trainingRec.categoryName}</strong> category:
            </p>
            <ul className="rmi-drills">
              {trainingRec.drills.map(d => (
                <li key={d.id}><span aria-hidden>{d.icon}</span> {d.name}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="rmi-body">
            No single Training Center category maps directly to this one — head to the Training Center and
            build a module around it.
          </p>
        )}
        <button className="btn btn-primary rmi-train-cta" onClick={startTraining}>
          {hasOwnCta ? <ExternalLink size={14} /> : <Dumbbell size={14} />}
          {hasOwnCta ? weakestSectionCfg.content.cta.label : 'Start Training'}
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="rmi-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Result
        </button>
        <button className="btn btn-primary" onClick={onContinue}>
          Continue <ArrowRight size={14} />
        </button>
      </div>

      <style>{`
        .rmi-wrap { display: flex; flex-direction: column; gap: 16px; }
        .rmi-pagehead {
          font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 22px;
          letter-spacing: 0.02em; color: var(--text-primary);
        }
        .rmi-weakness {
          background: linear-gradient(160deg, rgba(245,158,11,0.10), rgba(13,21,40,0.35));
          border-color: rgba(245,158,11,0.3);
        }
        .rmi-weakness-head {
          display: flex; align-items: center; gap: 7px; margin-bottom: 8px;
          font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 11px;
          letter-spacing: 0.05em; text-transform: uppercase; color: var(--amber);
        }
        .rmi-weakness-name {
          font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 26px;
          letter-spacing: 0.02em; color: var(--text-primary);
        }
        .rmi-weakness-score { font-family: 'DM Sans', sans-serif; font-size: 12.5px; color: var(--text-muted); margin-top: 2px; }
        .rmi-section-head {
          display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
          font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 11px;
          letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-primary);
        }
        .rmi-body { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.65; color: var(--text-muted); margin: 0; }
        .rmi-body strong { color: var(--text-primary); font-weight: 600; }
        .rmi-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .rmi-list li { display: flex; gap: 9px; align-items: flex-start; font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.55; color: var(--text-muted); }
        .rmi-list-num {
          flex-shrink: 0; width: 18px; height: 18px; border-radius: 5px; margin-top: 1px;
          background: var(--violet-tint); color: var(--violet);
          font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .rmi-drills { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
        .rmi-drills li {
          display: inline-flex; align-items: center; gap: 5px;
          font-family: 'DM Sans', sans-serif; font-size: 11.5px; color: var(--text-muted);
          background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px;
        }
        .rmi-train-cta { margin-top: 14px; }
        .rmi-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .rmi-actions .btn { flex: 1; min-width: 150px; }
      `}</style>
    </div>
  )
}
