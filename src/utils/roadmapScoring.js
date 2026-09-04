/*
 * roadmapScoring.js — deterministic, rule-based scoring for the Roadmap
 * assessments. NO AI / LLM. Given the same answers, always the same result.
 *
 * The content doc's assessment design rules:
 *   "Use practical questions, not only 1-10 ratings. Mix self-report
 *    questions, scenarios, knowledge checks, and observable tasks."
 *   "Assessment results should not end as a score. Return a useful starting
 *    point such as Strong, Developing, Needs Work, and Priority Focus,
 *    followed by a recommended action."
 *
 * QUESTION TYPES
 * -------------
 *   'scale'    ordered options worst -> best. Scored: value = idx/(n-1).
 *   'choice'   categorical options. Scored ONLY if `scored: true` (then the
 *              options are treated as ordinal, worst -> best). If `multi:true`
 *              the answer is an array and it is never scored — just captured.
 *   'scenario' the player picks the response they would make. Captured, plus
 *              `guidance` text shown in the result. Scored only if `scored`.
 *   'text'     free-text reflection. Captured, never scored, shown back in
 *              the result as the player's own notes.
 *
 * An `answers` value may therefore be a number (scale / single choice /
 * scenario), a number[] (multi choice), or a string (text).
 *
 * LEVEL BANDS  (0-100 from the scored questions):
 *     0-40    Needs Work
 *     41-70   Developing
 *     71-100  Strong
 *   ...followed by a Priority Focus line (a recommended action, not a tier).
 *
 * Dependency-free — safe to run under plain `node`.
 */

export const LEVEL_BANDS = [
  {
    key: 'needs-work',
    label: 'Needs Work',
    min: 0,
    max: 40,
    blurb:
      'This is a priority area right now. Focused, deliberate practice here ' +
      'pays off faster than anywhere else.',
  },
  {
    key: 'developing',
    label: 'Developing',
    min: 41,
    max: 70,
    blurb:
      'The basics are there. Tightening the weak spots is what moves this ' +
      'into a real strength.',
  },
  {
    key: 'strong',
    label: 'Strong',
    min: 71,
    max: 100,
    blurb:
      'A genuine strength. Keep it sharp and lean on it while you round out ' +
      'the rest of your game.',
  },
]

export function clampScore(n) {
  const v = Math.round(Number(n) || 0)
  return Math.max(0, Math.min(100, v))
}

export function levelForScore(score) {
  const s = clampScore(score)
  return LEVEL_BANDS.find(b => s >= b.min && s <= b.max) || LEVEL_BANDS[0]
}

/** Linear 0..1 value for a chosen option index. */
export function questionValue(optionIndex, optionCount) {
  if (!Number.isInteger(optionIndex)) return null
  if (optionCount <= 1) return 1
  const clamped = Math.max(0, Math.min(optionCount - 1, optionIndex))
  return clamped / (optionCount - 1)
}

/** Is this question one that feeds the numeric level score? */
export function isScored(q) {
  if (!q) return false
  if (q.type === 'scale') return true
  if ((q.type === 'choice' || q.type === 'scenario') && q.scored && !q.multi) return true
  return false
}

/** Has the player provided an answer for this question? */
export function isAnswered(q, value) {
  if (value === undefined || value === null) return false
  if (q?.type === 'text') return String(value).trim().length > 0
  if (q?.multi) return Array.isArray(value) && value.length > 0
  return Number.isInteger(value)
}

function optionLabel(q, idx) {
  const opt = q.options?.[idx]
  if (opt == null) return ''
  return typeof opt === 'string' ? opt : (opt.label || '')
}

/**
 * Score a single section.
 * @returns null if nothing at all was answered, else a section result.
 *          `score`/`level` are null when the section has no scored questions
 *          (e.g. the Stage 1 overview is mostly reflective).
 */
export function scoreSection(section, answers = {}) {
  const questions = (section && section.questions) || []
  if (!questions.length) return null

  const perQuestion = []       /* scored questions only */
  const reflections = []       /* text questions */
  const choices = []           /* choice / scenario questions (captured) */
  let sum = 0
  let answeredAny = false

  questions.forEach(q => {
    const raw = answers[q.id]
    const answered = isAnswered(q, raw)
    if (answered) answeredAny = true

    if (q.type === 'text') {
      if (answered) reflections.push({ id: q.id, prompt: q.prompt, answer: String(raw).trim() })
      return
    }

    if (q.multi) {
      if (answered) {
        choices.push({
          id: q.id, prompt: q.prompt, multi: true,
          answers: raw.map(i => optionLabel(q, i)),
        })
      }
      return
    }

    if (isScored(q)) {
      if (!answered) return
      const value = questionValue(raw, q.options.length)
      if (value === null) return
      sum += value
      perQuestion.push({
        id: q.id,
        short: q.short || q.prompt,
        prompt: q.prompt,
        choice: optionLabel(q, raw),
        choiceIndex: raw,
        value,
        pct: Math.round(value * 100),
        area: q.area || null,
        guidance: q.guidance || null,
      })
      return
    }

    /* unscored choice / scenario — capture it */
    if (answered) {
      choices.push({
        id: q.id,
        prompt: q.prompt,
        answer: optionLabel(q, raw),
        guidance: q.guidance || null,
      })
    }
  })

  if (!answeredAny) return null

  const scoredCount = perQuestion.length
  const score = scoredCount ? clampScore((sum / scoredCount) * 100) : null
  const band = score === null ? null : levelForScore(score)
  const ranked = [...perQuestion].sort((a, b) => b.value - a.value || a.id.localeCompare(b.id))

  return {
    sectionId: section.id,
    name: section.name,
    score,
    level: band ? band.label : null,
    levelKey: band ? band.key : null,
    scoredCount,
    questionCount: questions.length,
    answeredCount:
      perQuestion.length + reflections.length + choices.length,
    complete: questions.every(q => isAnswered(q, answers[q.id])),
    best: ranked[0] || null,
    worst: ranked[ranked.length - 1] || null,
    perQuestion,
    reflections,
    choices,
    /* Per-"area" rollup for stages that tag questions (Stage 3 mechanics). */
    areas: rollupAreas(perQuestion),
  }
}

function rollupAreas(perQuestion) {
  const byArea = {}
  perQuestion.forEach(q => {
    if (!q.area) return
    byArea[q.area] = byArea[q.area] || { area: q.area, sum: 0, n: 0 }
    byArea[q.area].sum += q.value
    byArea[q.area].n += 1
  })
  return Object.values(byArea).map(a => {
    const s = clampScore((a.sum / a.n) * 100)
    return { area: a.area, score: s, level: levelForScore(s).label }
  }).sort((a, b) => b.score - a.score || a.area.localeCompare(b.area))
}

/* Per-section "what to work on" copy (the Priority Focus recommended action).
   Falls back to a generic-but-still-data-driven line. */
const FOCUS_BY_SECTION = {
  'game-mechanics':
    'the weakest mechanical area from your result — short focused drills, then test it in real matches and review',
  'game-sense':
    'Information -> Decision -> Action -> Result: before every major play, ask what you know and do not know',
  discipline:
    'a realistic routine at a fixed training time, tracked, without skipping the difficult skills',
  consistency:
    'finding what causes your bad games and keeping the same warm-up and review process every time',
  training:
    'giving every session a clear purpose and splitting time across mechanics, matches, team play, scrims and review',
  learning:
    'the Mistake -> Reason -> Fix -> Practice -> Review loop, and tracking repeated mistakes',
  communication:
    'the What? -> Where? -> How many? -> What are they doing? callout structure until it is automatic',
  teamwork:
    'asking "what does my team need from me right now?" instead of "how many kills can I get?"',
  'mental-strength':
    'the Reset -> Breathe -> Focus -> Next Play routine, and not carrying the previous fight into the next one',
  scrims:
    'setting a purpose before each scrim, focusing on role execution over kills, and reviewing team fights',
  'purposeful-training':
    'choosing 1-2 priorities per session and writing down what improved afterwards',
  'gameplay-review':
    'answering Choke Point / Strong Point / What would I improve / Why did the mistake happen / What will I do differently after important games',
}

export function recommendedFocus(weakSection) {
  if (!weakSection) {
    return 'Keep a short, consistent daily practice block and review one game after every session.'
  }
  const base =
    FOCUS_BY_SECTION[weakSection.sectionId] ||
    `${weakSection.name.toLowerCase()} — pick one small, repeatable habit and run it this week`
  const w = weakSection.worst
  const flat = weakSection.best && w && weakSection.best.value === w.value
  const tail = w && !flat
    ? ` Your lowest answer was on ${String(w.short).toLowerCase()} ("${w.choice}") — start there.`
    : ''
  return `Priority Focus: ${base}.${tail}`
}

/**
 * Assemble the result explanation from the actual answers — a template
 * filled with data, never hardcoded prose.
 */
export function buildExplanation({ overall, overallBand, strongest, weakest, sectionResults }) {
  const scored = (sectionResults || []).filter(s => s.score !== null)
  if (!scored.length) {
    return 'This assessment is about mapping where you stand — read your starting point below and take the recommended next step.'
  }

  if (scored.length === 1) {
    const s = scored[0]
    const strong = s.best ? `${String(s.best.short).toLowerCase()} ("${s.best.choice}")` : 'the fundamentals'
    const grow = s.worst ? `${String(s.worst.short).toLowerCase()} ("${s.worst.choice}")` : 'consistency'
    const flat = s.best && s.worst && (s.best.id === s.worst.id || s.best.value === s.worst.value)
    if (flat) {
      return `Your ${s.name} answers put you at ${withArticle(s.level)} level (${s.score}%). Your answers were even across the board — the next step is lifting all of them together.`
    }
    return `Your ${s.name} answers put you at ${withArticle(s.level)} level (${s.score}%). You look most comfortable with ${strong}, and the most room to grow is ${grow}.`
  }

  const strongBit = strongest ? `${strongest.name} (${strongest.score}%)` : ''
  const weakBit = weakest ? `${weakest.name} (${weakest.score}%)` : ''
  return `Across ${scored.length} areas you are at ${withArticle(overallBand.label)} level overall (${overall}%). You show real strength in ${strongBit}, and the most room to grow is in ${weakBit}.`
}

function withArticle(label) {
  return /^[AEIOU]/i.test(label || '') ? `an ${label}` : `a ${label}`
}

/**
 * Score a whole stage.
 * @param answersBySection  { [sectionId]: { [questionId]: value } }
 */
export function scoreStage(stage, answersBySection = {}) {
  const ready = ((stage && stage.sections) || []).filter(
    s => s.status === 'ready' && s.questions && s.questions.length,
  )

  const sectionResults = []
  ready.forEach(s => {
    const r = scoreSection(s, answersBySection[s.id] || {})
    if (r) sectionResults.push(r)
  })

  if (!sectionResults.length) return null

  const scored = sectionResults.filter(s => s.score !== null)
  const overall = scored.length
    ? clampScore(scored.reduce((a, r) => a + r.score, 0) / scored.length)
    : null
  const overallBand = overall === null ? null : levelForScore(overall)

  const ranked = [...scored].sort(
    (a, b) => b.score - a.score || a.sectionId.localeCompare(b.sectionId),
  )
  const strongest = ranked[0] || null
  const weakest = ranked[ranked.length - 1] || null

  return {
    version: 2,
    computedAt: Date.now(),
    overall,
    overallLevel: overallBand ? overallBand.label : null,
    overallLevelKey: overallBand ? overallBand.key : null,
    overallBlurb: overallBand ? overallBand.blurb : null,
    strongest,
    weakest,
    sectionResults,
    explanation: buildExplanation({ overall, overallBand, strongest, weakest, sectionResults }),
    recommendedFocus: recommendedFocus(weakest || strongest),
  }
}
