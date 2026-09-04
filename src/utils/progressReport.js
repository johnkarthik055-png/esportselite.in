/*
 * progressReport.js — deterministic derivation for the Progress Report
 * (Section C). NO AI. Everything is computed from stored per-attempt score
 * history (roadmap stage attempts + role discovery attempts) plus a couple
 * of live snapshots (streak, match count).
 *
 * A "delta" is only produced when a category has AT LEAST TWO attempts.
 * With one attempt it reports { status: 'one' } and with none { status: 'none' }
 * — never a fabricated number.
 */

import { levelForScore } from './roadmapScoring.js'

/*
 * Each reported category maps to a source series.
 *   kind 'section' — a section score inside a roadmap stage's attempts
 *   kind 'role'    — the primary role-fit score across role discovery attempts
 *   kind 'snapshot'— a single current value, no history kept (delta N/A)
 */
/* Categories from the content doc's "Player Progress Report" (lines 488-498).
   Each maps to a real stored series (roadmap section attempts / role discovery
   attempts) or a live snapshot. */
export const REPORT_CATEGORIES = [
  { id: 'mechanical',     label: 'Mechanical progress',    kind: 'section', stageId: 'master-your-mechanics', sectionId: 'game-mechanics' },
  { id: 'gameSense',      label: 'Game-sense progress',    kind: 'section', stageId: 'develop-game-sense',    sectionId: 'game-sense' },
  { id: 'communication',  label: 'Communication progress', kind: 'section', stageId: 'play-as-a-team',        sectionId: 'communication' },
  { id: 'teamwork',       label: 'Teamwork progress',      kind: 'section', stageId: 'play-as-a-team',        sectionId: 'teamwork' },
  { id: 'consistency',    label: 'Consistency',            kind: 'section', stageId: 'build-your-foundation',  sectionId: 'consistency' },
  { id: 'roleReadiness',  label: 'Role readiness',         kind: 'role' },
  { id: 'trainingConsistency',  label: 'Training consistency',  kind: 'snapshot', snap: 'streak' },
  { id: 'competitionReadiness', label: 'Competition readiness', kind: 'section', stageId: 'compete', sectionId: 'compete-readiness' },
]

function sectionSeries(stages, stageId, sectionId) {
  const stage = (stages || []).find(s => s.id === stageId)
  if (!stage || !Array.isArray(stage.attempts)) return []
  const out = []
  stage.attempts.forEach(a => {
    const sec = (a.sections || []).find(s => s.id === sectionId)
    if (sec && typeof sec.score === 'number') out.push({ at: a.at, score: sec.score })
  })
  return out
}

function roleSeries(roleAttempts) {
  return (roleAttempts || [])
    .filter(a => typeof a.roleFitScore === 'number')
    .map(a => ({ at: a.at, score: a.roleFitScore }))
}

function summariseSeries(series) {
  if (!series.length) return { status: 'none' }
  const sorted = [...series].sort((a, b) => (a.at || 0) - (b.at || 0))
  const start = sorted[0].score
  const current = sorted[sorted.length - 1].score
  if (sorted.length === 1) {
    return { status: 'one', current, attempts: 1 }
  }
  return {
    status: 'delta',
    start,
    current,
    delta: current - start,
    attempts: sorted.length,
  }
}

/**
 * @param opts.roadmapStages  useRoadmap().stages   (derived list, each with .attempts)
 * @param opts.roleAttempts   useRoles().discovery.attempts
 * @param opts.discoveryResult useRoles().discovery.result   (latest, for Primary Role)
 * @param opts.streak         useStreak() result   ({ current })
 * @param opts.matchCount     number of logged matches (for competition context)
 */
export function computeProgressReport(opts = {}) {
  const {
    roadmapStages = [], roleAttempts = [], discoveryResult = null,
    streak = null, matchCount = 0,
  } = opts

  /* Overall level: from Stage 1's overall attempt history. */
  const stage1 = roadmapStages.find(s => s.id === 'know-yourself')
  const s1Attempts = (stage1?.attempts || []).slice().sort((a, b) => (a.at || 0) - (b.at || 0))
  let startingLevel = null
  let currentLevel = null
  if (s1Attempts.length) {
    startingLevel = {
      label: s1Attempts[0].level || levelForScore(s1Attempts[0].overall).label,
      score: s1Attempts[0].overall,
    }
    const last = s1Attempts[s1Attempts.length - 1]
    currentLevel = {
      label: last.level || levelForScore(last.overall).label,
      score: last.overall,
    }
  }

  /* Per-category deltas. */
  const categories = REPORT_CATEGORIES.map(cat => {
    if (cat.kind === 'section') {
      return { ...cat, ...summariseSeries(sectionSeries(roadmapStages, cat.stageId, cat.sectionId)) }
    }
    if (cat.kind === 'role') {
      return { ...cat, ...summariseSeries(roleSeries(roleAttempts)) }
    }
    /* snapshot */
    if (cat.snap === 'streak') {
      const v = streak?.current ?? 0
      return { ...cat, status: 'snapshot', current: v, unit: 'day streak' }
    }
    return { ...cat, status: 'none' }
  })

  const withDelta = categories.filter(c => c.status === 'delta')

  let biggestImprovement = null
  let biggestWeakness = null
  if (withDelta.length) {
    biggestImprovement = withDelta.reduce((a, b) => (b.delta > a.delta ? b : a))
    if (biggestImprovement.delta <= 0) biggestImprovement = null
    /* weakness = lowest current score among tracked categories */
    biggestWeakness = withDelta.reduce((a, b) => (b.current < a.current ? b : a))
  } else {
    /* fall back to any category with a current value */
    const withCurrent = categories.filter(c => typeof c.current === 'number' && c.status !== 'snapshot')
    if (withCurrent.length) {
      biggestWeakness = withCurrent.reduce((a, b) => (b.current < a.current ? b : a))
    }
  }

  const primaryRole = discoveryResult?.primaryRoleName || null
  const primaryRoleId = discoveryResult?.primaryRoleId || null
  const secondaryRole = discoveryResult?.secondaryRoleName || null
  const roleFit = discoveryResult?.roleFit || null

  /* Next training priority + next step, from the real data. */
  let nextPriority
  if (biggestWeakness) {
    nextPriority = `${biggestWeakness.label} — it is currently your lowest tracked score${typeof biggestWeakness.current === 'number' ? ` (${biggestWeakness.current}%)` : ''}.`
  } else if (!s1Attempts.length) {
    nextPriority = 'Complete the Stage 1 assessment so there is a real baseline to build from.'
  } else {
    nextPriority = 'Keep a steady daily block — you have a baseline but not enough repeat data yet to spot a trend.'
  }

  let nextStep
  if (!s1Attempts.length) {
    nextStep = 'Take the Stage 1 "Know Yourself" assessment.'
  } else if (withDelta.length < 2) {
    nextStep = 'Re-take an assessment you have done before — a second data point turns a score into a trend.'
  } else if (!primaryRole) {
    nextStep = 'Run Role Discovery so Role Readiness starts tracking too.'
  } else {
    nextStep = `Focus this week on ${biggestWeakness ? biggestWeakness.label.toLowerCase() : 'your weakest area'}, then re-assess.`
  }

  return {
    computedAt: Date.now(),
    startingLevel,
    currentLevel,
    hasBaseline: !!s1Attempts.length,
    categories,
    trackedCount: withDelta.length,
    biggestImprovement,
    biggestWeakness,
    primaryRole,
    primaryRoleId,
    secondaryRole,
    roleFit,
    matchCount,
    nextPriority,
    nextStep,
  }
}
