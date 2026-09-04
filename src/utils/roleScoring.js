/*
 * roleScoring.js — deterministic, rule-based scoring for the Role System.
 * NO AI / LLM. Same answers → same Role Profile, every time.
 *
 * Discovery model (doc: "Role Fit — What Esports Elite Should Look At")
 * -------------------------------------------------------------------
 *   Category scores (0-100) from the scale questions:
 *     mechanical · decision · team · consistency
 *   Playstyle trait shares from the choice + team + scenario answers:
 *     aggressive · patient · tactical · infoFocused · supportive · adaptable
 *
 *   Each role carries an explicit weight table:
 *     weights   { mechanical, decision, team, consistency }   0..1
 *     playstyle { aggressive, patient, tactical, infoFocused, supportive, adaptable }
 *
 *     categoryComponent  = Σ(weight·categoryScore) / Σ(weight)      (0..100)
 *     playstyleComponent = Σ(affinity·traitShare)                   (~0..100)
 *     fit                = 0.6·categoryComponent + 0.4·playstyleComponent
 *
 *   Roles ranked by fit → Primary / Secondary. Fit label from the primary.
 *   The doc is explicit that a role is NOT permanent — the result shows a
 *   Primary Role, Secondary Role, Strengths, Weaknesses and a Role
 *   Development Path, never a single locked identity.
 *
 * Role readiness (per-role assessment) reuses roadmapScoring.scoreSection for
 * the 0-100 score, then maps it onto the doc's verbatim four-tier ladder.
 */

import { scoreSection, clampScore } from './roadmapScoring.js'
import { ROLE_READINESS_LEVELS } from '../data/roadmapRoles.js'

/* ── Role-fit label bands — Needs Work / Developing / Strong ──────────── */
export const FIT_BANDS = [
  { key: 'needs-work', label: 'Needs Work', min: 0,  max: 40 },
  { key: 'developing', label: 'Developing', min: 41, max: 70 },
  { key: 'strong',     label: 'Strong',     min: 71, max: 100 },
]

export function fitBand(score) {
  const s = clampScore(score)
  return FIT_BANDS.find(b => s >= b.min && s <= b.max) || FIT_BANDS[0]
}

/* ── Role readiness ladder — VERBATIM from the content doc ────────────── */
export const READINESS_BANDS = ROLE_READINESS_LEVELS.map(l => ({
  key: l.key,
  label: l.label,
  min: l.min,
  max: l.max,
  blurb: l.def,
}))

export function readinessForScore(score) {
  const s = clampScore(score)
  return READINESS_BANDS.find(b => s >= b.min && s <= b.max) || READINESS_BANDS[0]
}

const TRAITS = ['aggressive', 'patient', 'tactical', 'infoFocused', 'supportive', 'adaptable']
const CAT_LABEL = {
  mechanical: 'Mechanical', decision: 'Decision', team: 'Team', consistency: 'Consistency',
}

function scaleValue(idx, count) {
  if (!Number.isInteger(idx)) return null
  if (count <= 1) return 1
  const c = Math.max(0, Math.min(count - 1, idx))
  return c / (count - 1)
}

/* team scale question → playstyle trait it signals when answered high */
const TEAM_TRAIT = {
  'd-team-1': 'supportive',   /* looks for trades */
  'd-team-2': 'infoFocused',  /* relied on for information */
  'd-team-3': 'supportive',   /* enjoys supporting */
  'd-team-4': 'tactical',     /* comfortable leading */
  'd-team-5': 'adaptable',    /* accepts a call and executes */
}

/**
 * Score the Role Discovery assessment.
 * @param groups   DISCOVERY_GROUPS
 * @param roles    ROLES
 * @param answers  { [questionId]: value }   (number | number[] | string)
 * @returns null if nothing answered, else the full Role Profile.
 */
export function scoreDiscovery(groups, roles, answers = {}) {
  const catAgg = {}          /* category -> { sum, n } */
  const traitPts = {}        /* trait -> raw points */
  const scenarioPicks = []
  let answeredAny = false

  const allQ = groups.flatMap(g => g.questions)

  allQ.forEach(q => {
    const raw = answers[q.id]
    if (raw === undefined || raw === null) return

    if (q.type === 'scale') {
      if (!Number.isInteger(raw)) return
      answeredAny = true
      const v = scaleValue(raw, q.options.length)
      if (v === null) return
      const c = q.category
      catAgg[c] = catAgg[c] || { sum: 0, n: 0 }
      catAgg[c].sum += v
      catAgg[c].n += 1

      /* first-contact comfort feeds an aggressive lean */
      if (q.id === 'd-mech-3') traitPts.aggressive = (traitPts.aggressive || 0) + v
      const tt = TEAM_TRAIT[q.id]
      if (tt) traitPts[tt] = (traitPts[tt] || 0) + v
      return
    }

    if (q.type === 'choice') {
      if (!Number.isInteger(raw)) return
      answeredAny = true
      if (q.id === 'd-dec-4') {
        if (raw === 0) traitPts.supportive = (traitPts.supportive || 0) + 1
        else if (raw === 2) traitPts.tactical = (traitPts.tactical || 0) + 1
      }
      /* choice questions do not feed a category score here */
      return
    }

    if (q.type === 'scenario') {
      if (!Number.isInteger(raw)) return
      answeredAny = true
      const traitArr = Array.isArray(q.trait) ? q.trait : []
      let t = traitArr[raw]
      if (t === 'aggressive-trade') t = 'supportive'  /* trading = enabling the team */
      if (t && TRAITS.includes(t)) traitPts[t] = (traitPts[t] || 0) + 1
      scenarioPicks.push({ id: q.id, prompt: q.prompt, answer: q.options[raw], guidance: q.guidance })
      return
    }
  })

  if (!answeredAny) return null

  const categoryScores = {}
  Object.keys(catAgg).forEach(c => {
    categoryScores[c] = clampScore((catAgg[c].sum / catAgg[c].n) * 100)
  })

  const traitTotal = TRAITS.reduce((s, t) => s + (traitPts[t] || 0), 0)
  const traitShare = {}
  TRAITS.forEach(t => {
    traitShare[t] = traitTotal ? Math.round((traitPts[t] || 0) / traitTotal * 100) : 0
  })

  /* ── role fit ── */
  const roleFits = roles.map(role => {
    const w = role.weights || {}
    let wSum = 0, wDot = 0
    Object.keys(w).forEach(cat => {
      const cs = categoryScores[cat]
      if (typeof cs === 'number') { wDot += w[cat] * cs; wSum += w[cat] }
    })
    const categoryComponent = wSum ? wDot / wSum : 0

    const ps = role.playstyle || {}
    let playstyleComponent = 0
    TRAITS.forEach(t => { playstyleComponent += (ps[t] || 0) * (traitShare[t] || 0) })

    const fit = clampScore(0.6 * categoryComponent + 0.4 * playstyleComponent)
    const band = fitBand(fit)
    return {
      roleId: role.id,
      name: role.name,
      icon: role.icon,
      fit,
      fitLabel: band.label,
      fitKey: band.key,
    }
  }).sort((a, b) => b.fit - a.fit || a.roleId.localeCompare(b.roleId))

  const primary = roleFits[0]
  const secondary = roleFits[1] || null
  const primaryRole = roles.find(r => r.id === primary.roleId)

  /* ── strengths / weaknesses from category scores ── */
  const catRank = Object.keys(categoryScores)
    .map(c => ({ id: c, score: categoryScores[c] }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))

  const strengths = catRank.slice(0, 2).map(c => `${CAT_LABEL[c.id] || c.id} (${c.score}%)`)
  const weakest = catRank[catRank.length - 1] || null
  const needsWork = weakest ? `${CAT_LABEL[weakest.id] || weakest.id} (${weakest.score}%)` : '—'

  const traitRank = TRAITS
    .map(t => ({ id: t, share: traitShare[t] }))
    .sort((a, b) => b.share - a.share || a.id.localeCompare(b.id))
  const dominantTrait = traitRank[0] && traitRank[0].share > 0
    ? traitRank[0].id.replace('infoFocused', 'information-focused')
    : 'balanced'

  /* Role Development Path — the doc's "role is not permanent" framing */
  const weakLabel = weakest ? (CAT_LABEL[weakest.id] || weakest.id) : 'your fundamentals'
  const devPath =
    `Primary: ${primary.name}. Secondary: ${secondary ? secondary.name : '—'}. ` +
    `As your ${weakLabel.toLowerCase()} improves, more roles open up — re-take this ` +
    `assessment as you develop and the profile will change with you.`

  return {
    version: 2,
    computedAt: Date.now(),
    categoryScores,
    traitShare,
    dominantTrait,
    roleFits,
    primaryRoleId: primary.roleId,
    primaryRoleName: primary.name,
    secondaryRoleId: secondary?.roleId || null,
    secondaryRoleName: secondary?.name || null,
    roleFit: primary.fitLabel,
    roleFitKey: primary.fitKey,
    roleFitScore: primary.fit,
    strengths,
    needsWork,
    /* verbatim per-role result fields */
    teamValue: primaryRole?.result?.teamValue || '',
    mainRisk: primaryRole?.result?.mainRisk || '',
    nextFocus: primaryRole?.result?.nextFocus || '',
    recommendedTraining: primaryRole?.result?.recommendedTraining || '',
    developmentPath: devPath,
    scenarioPicks,
    explanation:
      `Your answers point to ${primary.name} as your primary role ` +
      `(${primary.fit}% fit, ${primary.fitLabel})${secondary ? `, with ${secondary.name} as a natural secondary` : ''}. ` +
      `You score highest in ${catRank[0] ? (CAT_LABEL[catRank[0].id] || catRank[0].id) : 'no clear area'} ` +
      `and play a ${dominantTrait} style. Role is not permanent — this will move as you improve.`,
  }
}

/**
 * Score a single role's readiness assessment (Role Detail).
 * @returns { score, readinessLabel, ... } or null.
 */
export function scoreRoleAssessment(roleSection, answers = {}) {
  const base = scoreSection(roleSection, answers)
  if (!base || base.score === null) return null
  const band = readinessForScore(base.score)
  return {
    ...base,
    readinessLabel: band.label,
    readinessKey: band.key,
    readinessBlurb: band.blurb,
    understand: base.perQuestion.filter(q => q.value >= 0.67).map(q => q.short),
    needsWork: base.perQuestion.filter(q => q.value <= 0.34).map(q => q.short),
  }
}
