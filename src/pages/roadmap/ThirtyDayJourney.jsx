import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check, Lock, Sparkles, ExternalLink, ArrowRight, Info,
} from 'lucide-react'
import { useRoadmap } from '../../hooks/useRoadmap.js'
import { isAnswered } from '../../utils/roadmapScoring.js'
import { ROADMAP_DAYS, JOURNEY_TOTAL_DAYS } from '../../data/roadmapDays.js'

/*
 * 30-DAY JOURNEY — a compact, INFORMATIONAL pace guide over the real
 * roadmap. It cannot lock or unlock anything:
 *   - Each day's "complete" flag is DERIVED from real stage/section
 *     progress (useRoadmap), never from viewing a day or calendar time.
 *   - "You are here" tracks real completed content, shown distinctly from
 *     the cosmetic calendar-based "suggested today" marker. Being ahead of
 *     or behind the suggested day does nothing.
 *   - Days whose underlying content isn't authored yet show an honest
 *     "Coming soon" instead of a broken link.
 */

function padDay(n) {
  return String(n).padStart(2, '0')
}
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

/* ── derive completion from real progress ─────────────────────── */
function sectionComplete(stage, sectionId) {
  if (!stage) return false
  if (stage.state === 'completed') return true
  const sec = (stage.sections || []).find(s => s.id === sectionId)
  if (!sec || sec.status !== 'ready' || !sec.questions?.length) return false
  const ans = stage.answers?.[sectionId] || {}
  return sec.questions.every(q => isAnswered(q, ans[q.id]))
}

function phaseComplete(stage, phase) {
  if (!stage) return false
  if (stage.state === 'completed') return true
  switch (phase) {
    case 'content':
      return !!stage.status || Object.keys(stage.sectionsViewed || {}).length > 0
    case 'assessment':
      return !!stage.result || Object.values(stage.answers || {}).some(a => Object.keys(a || {}).length > 0)
    case 'result':
    case 'next':
      return !!stage.result
    default:
      return false
  }
}

/**
 * Resolve a day's static target against LIVE roadmap data.
 * Returns { state, complete, to?, actionLabel?, note?, stageId?, sectionId?, phase?, openMatchLogger? }
 *   state: 'ready' | 'action' | 'coming-soon' | 'deferred'
 */
function resolveDay(cfg, getStage) {
  const t = cfg.target || {}

  if (t.kind === 'deferred') {
    return { state: 'deferred', complete: false, note: `${t.feature} — coming in a future update` }
  }

  if (t.kind === 'app') {
    return {
      state: 'action',
      complete: false,
      to: t.to,
      actionLabel: `Open ${t.appLabel || 'app'}`,
      openMatchLogger: !!t.openMatchLogger,
      note: `Links out to ${t.appLabel || 'the app'}`,
    }
  }

  const stage = getStage(t.stageId)
  if (!stage) return { state: 'coming-soon', complete: false, note: 'Content coming soon' }

  const stageHasContent = !stage.comingSoon
  const stageLabel = `Stage ${padDay(stage.order)} · ${stage.title}`

  if (t.kind === 'stage-section') {
    const sec = (stage.sections || []).find(s => s.id === t.sectionId)
    const ready = sec && sec.status === 'ready' && sec.questions?.length
    if (!ready) {
      return {
        state: 'coming-soon',
        complete: false,
        stageId: stage.id,
        note: `${sec ? sec.name : 'This section'} — content coming soon`,
      }
    }
    return {
      state: 'ready',
      complete: sectionComplete(stage, t.sectionId),
      stageId: stage.id,
      sectionId: t.sectionId,
      to: `/roadmap/${stage.id}`,
      actionLabel: `Open ${sec.name} section`,
      note: `${stageLabel} · ${sec.name}`,
    }
  }

  if (t.kind === 'stage-phase') {
    if (!stageHasContent) {
      return { state: 'coming-soon', complete: false, stageId: stage.id, note: `${stageLabel} — content coming soon` }
    }
    return {
      state: 'ready',
      complete: phaseComplete(stage, t.phase),
      stageId: stage.id,
      phase: t.phase,
      to: `/roadmap/${stage.id}`,
      actionLabel: `Open Stage ${padDay(stage.order)}`,
      note: `${stageLabel} · ${cap(t.phase)} phase`,
    }
  }

  /* kind === 'stage' */
  if (!stageHasContent) {
    return { state: 'coming-soon', complete: false, stageId: stage.id, note: `${stageLabel} — content coming soon` }
  }
  return {
    state: 'ready',
    complete: stage.state === 'completed',
    stageId: stage.id,
    to: `/roadmap/${stage.id}`,
    actionLabel: `Open Stage ${padDay(stage.order)}`,
    note: stageLabel,
  }
}

export default function ThirtyDayJourney() {
  const navigate = useNavigate()
  const {
    loading, getStage, setActiveSection, setPhase, dayCount,
  } = useRoadmap()

  const detailRef = useRef(null)
  const [selected, setSelected] = useState(null)

  const resolved = useMemo(
    () => ROADMAP_DAYS.map(cfg => ({ cfg, res: resolveDay(cfg, getStage) })),
    [getStage],
  )

  const completeDays = resolved.filter(r => r.res.complete).map(r => r.cfg.day)
  const highestComplete = completeDays.length ? Math.max(...completeDays) : 0
  const youAreHere = Math.max(1, highestComplete)
  const suggestedDay = Math.min(JOURNEY_TOTAL_DAYS, Math.max(1, dayCount || 1))

  const activeDay = selected ?? youAreHere
  const active = resolved.find(r => r.cfg.day === activeDay) || resolved[0]

  function selectDay(d) {
    setSelected(d)
    requestAnimationFrame(() => {
      if (typeof window !== 'undefined' && window.innerWidth < 940) {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    })
  }

  function openDay(entry) {
    const { res } = entry
    if (res.state === 'action') {
      if (res.openMatchLogger) {
        try { sessionStorage.setItem('esportselite_open_match_logger', '1') } catch { /* ignore */ }
      }
      navigate(res.to)
      return
    }
    if (res.state !== 'ready') return
    /* Deep-link into the REAL content. These are public useRoadmap actions —
       Phase 1's stage flow is not modified. */
    if (res.sectionId) setActiveSection(res.stageId, res.sectionId)
    else if (res.phase === 'assessment') setPhase(res.stageId, 'assessment')
    navigate(res.to)
  }

  if (loading) {
    return <div className="card skeleton" style={{ height: 320 }} />
  }

  return (
    <div className="tdj-wrap">
      {/* Header — TWO clearly separate numbers, never merged into one
          "Day N/30" framing that could read as "N objectives complete". */}
      <div className="tdj-head">
        <div className="tdj-numbers">
          <div className="tdj-numbox tdj-numbox--real">
            <div className="tdj-numbox-label">Real progress</div>
            <div className="tdj-numbox-val">{completeDays.length}<span> / {JOURNEY_TOTAL_DAYS} activities complete</span></div>
            <div className="tdj-numbox-sub">Derived from actual stage/section completion</div>
          </div>
          <div className="tdj-numbox tdj-numbox--suggested">
            <div className="tdj-numbox-label">Suggested day (cosmetic)</div>
            <div className="tdj-numbox-val">Day {padDay(suggestedDay)}</div>
            <div className="tdj-numbox-sub">Calendar-based only — never locks or unlocks anything</div>
          </div>
        </div>

        <div className="tdj-legend">
          <span><i className="tdj-dot tdj-dot--done" /> Complete</span>
          <span><i className="tdj-dot tdj-dot--here" /> You are here (real)</span>
          <span><i className="tdj-dot tdj-dot--suggested" /> Suggested today</span>
        </div>

        <div className="road-bar" style={{ marginTop: 10 }}>
          <div
            className="road-bar-fill"
            style={{ width: `${(completeDays.length / JOURNEY_TOTAL_DAYS) * 100}%` }}
          />
        </div>
        <p className="tdj-disclaimer">
          <Info size={12} />
          A suggested pace — go at whatever speed works for you. Nothing here is time-locked.
        </p>
        {suggestedDay !== youAreHere && (
          <p className="tdj-pace-note">
            The calendar suggests Day {padDay(suggestedDay)}, but your REAL progress is
            through Day {padDay(youAreHere)}
            {suggestedDay > youAreHere
              ? " — a bit behind the suggested pace, which is completely fine. "
              : " — ahead of the suggested pace, nice. "}
            Only real progress unlocks anything; the suggested day never blocks or unlocks either way.
          </p>
        )}
      </div>

      {/* Compact day grid */}
      <div className="tdj-grid" role="list">
        {resolved.map(entry => {
          const d = entry.cfg.day
          const isComplete = entry.res.complete
          const isHere = d === youAreHere
          const isSuggested = d === suggestedDay && !isHere && !isComplete
          const isSelected = d === activeDay
          const cls = [
            'tdj-tile',
            `tdj-tile--${entry.res.state}`,
            isComplete ? 'is-complete' : '',
            isHere ? 'is-here' : '',
            isSuggested ? 'is-suggested' : '',
            isSelected ? 'is-selected' : '',
          ].filter(Boolean).join(' ')

          return (
            <button
              key={d}
              type="button"
              className={cls}
              onClick={() => selectDay(d)}
              role="listitem"
              aria-current={isHere ? 'step' : undefined}
              aria-label={`Day ${d}: ${entry.cfg.label}${isComplete ? ' (complete)' : ''}`}
            >
              <span className="tdj-tile-top">
                <span className="tdj-tile-day">{padDay(d)}</span>
                <span className="tdj-tile-mark">
                  {isComplete ? <Check size={12} strokeWidth={3} />
                    : entry.res.state === 'coming-soon' ? <Lock size={10} />
                    : entry.res.state === 'deferred' ? <Sparkles size={10} />
                    : entry.res.state === 'action' ? <ExternalLink size={10} />
                    : null}
                </span>
              </span>
              <span className="tdj-tile-label">{entry.cfg.label}</span>
              {isHere && <span className="tdj-tile-here">You are here</span>}
            </button>
          )
        })}
      </div>

      {/* Detail for the selected / current day */}
      <div className="card tdj-detail" ref={detailRef}>
        <div className="tdj-detail-head">
          <span className="tdj-detail-day">Day {padDay(active.cfg.day)}</span>
          {active.res.complete && (
            <span className="tdj-badge tdj-badge--done"><Check size={11} strokeWidth={3} /> Complete</span>
          )}
          {active.cfg.day === youAreHere && (
            <span className="tdj-badge tdj-badge--here">You are here</span>
          )}
          {active.res.state === 'coming-soon' && (
            <span className="tdj-badge tdj-badge--soon">Coming soon</span>
          )}
          {active.res.state === 'deferred' && (
            <span className="tdj-badge tdj-badge--soon">Future update</span>
          )}
          {active.res.state === 'action' && (
            <span className="tdj-badge tdj-badge--action"><ExternalLink size={10} /> Links out</span>
          )}
        </div>

        <h3 className="tdj-detail-title">{active.cfg.label}</h3>
        <p className="tdj-detail-obj">{active.cfg.objective}</p>
        {active.res.note && <div className="tdj-detail-note">{active.res.note}</div>}

        {(active.res.state === 'ready' || active.res.state === 'action') ? (
          <button className="btn btn-primary btn-sm tdj-detail-cta" onClick={() => openDay(active)}>
            {active.res.actionLabel} <ArrowRight size={13} />
          </button>
        ) : (
          <div className="tdj-detail-soon">
            {active.res.state === 'deferred'
              ? `${active.cfg.target.feature} isn't built yet — this day will link straight to it once it ships.`
              : "This part of the roadmap doesn't have content yet. It'll open here as soon as it's written — nothing about this day blocks the rest."}
          </div>
        )}
      </div>
    </div>
  )
}
