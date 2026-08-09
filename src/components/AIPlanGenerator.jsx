import { useEffect, useRef, useState } from 'react'
import {
  Sparkles,
  Bot,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  WifiOff,
} from 'lucide-react'
import { readLS } from '../hooks/useLocalStorage.js'
import { STORAGE_KEYS } from '../utils/constants.js'
import { uid } from '../utils/helpers.js'

/* ============================================================
   CONSTANTS
   ============================================================ */
const DAY_FULL = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]
const DAY_INDEX = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
}

const GOAL_OPTIONS = [
  'Improve spray control',
  'Better close range fights',
  'Long range accuracy',
  'Overall improvement',
]
const SKILL_OPTIONS = ['Beginner', 'Intermediate', 'Pro']
const DAYS_OPTIONS = [
  { label: '3 days', value: 3 },
  { label: '5 days', value: 5 },
  { label: '7 days', value: 7 },
]
const DURATION_OPTIONS = [
  { label: '30 mins', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
]

const LOADING_MESSAGES = [
  'Analyzing your match data...',
  'Checking your weakest areas...',
  'Matching training modules...',
  'Building your personalized plan...',
  'Almost ready...',
]

const REST_TIPS = [
  'Recovery is part of the grind. Review your VODs today.',
  'Rest day — let your aim muscle memory consolidate.',
  'Light day. Watch a pro match and study rotations.',
]
const DAY_TIPS = [
  'Warm up for 5 minutes before every session.',
  'Focus on quality reps over quantity.',
  'Record your screen and review your mistakes.',
  'Keep your sensitivity consistent across drills.',
  'End each session on a successful rep.',
  'Hydrate and reset your wrist between sets.',
  'Visualize the fight before you take it.',
]
const DEFAULT_FOCUS = ['Consistency and control', 'Precision and timing', 'Movement and tracking']
const OVERALL_TIPS = {
  beginner:
    'Stay consistent. Short daily sessions beat occasional long grinds. Master fundamentals first.',
  intermediate:
    'Push your weak areas deliberately. Track your match stats weekly and adjust your focus.',
  pro:
    'Marginal gains win tournaments. Fine-tune crosshair placement and decision speed under pressure.',
}

/* ============================================================
   DATA GATHERING
   ============================================================ */
function gatherContext() {
  const matches = readLS(STORAGE_KEYS.MATCHES, [])
  const modules = readLS(STORAGE_KEYS.MODULES, [])
  const sessions = readLS(STORAGE_KEYS.SESSIONS, [])
  const suggestions = readLS(STORAGE_KEYS.SUGGESTIONS, [])
  const daily = readLS(STORAGE_KEYS.DAILY_SESSIONS, {})
  const storedStreak = Number(readLS(STORAGE_KEYS.STREAK, 0)) || 0

  /* Top 3 weaknesses by frequency. Weaknesses are stored as suggestion IDs;
     fall back to legacy free-text strings. */
  const counts = {}
  matches.forEach(m => {
    const ids = Array.isArray(m.weakestPoints)
      ? m.weakestPoints
      : m.weakestPoint
      ? [m.weakestPoint]
      : []
    ids.forEach(id => {
      counts[id] = (counts[id] || 0) + 1
    })
  })
  const topWeaknesses = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => suggestions.find(s => s.id === id)?.name || id)

  /* Current streak — compute from completed daily sessions, prefer stored. */
  const computedStreak = currentStreakFromDaily(daily)
  const streak = Math.max(storedStreak, computedStreak)

  return {
    matches,
    modules,
    suggestions,
    sessionCount: sessions.length,
    topWeaknesses,
    streak,
    hasMatchData: matches.length > 0,
    moduleNames: modules.map(m => m.name),
  }
}

function currentStreakFromDaily(daily) {
  if (!daily || typeof daily !== 'object') return 0
  const days = Object.entries(daily)
    .filter(([, v]) => v && v.status === 'completed')
    .map(([k]) => k)
    .sort()
  if (!days.length) return 0
  const msPerDay = 86400000
  const dayDiff = (a, b) => {
    const da = new Date(a)
    const db = new Date(b)
    da.setHours(0, 0, 0, 0)
    db.setHours(0, 0, 0, 0)
    return Math.round((db - da) / msPerDay)
  }
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(today.getDate()).padStart(2, '0')}`
  const latest = days[days.length - 1]
  if (dayDiff(latest, todayKey) > 1) return 0
  let streak = 1
  for (let i = days.length - 1; i > 0; i--) {
    if (dayDiff(days[i - 1], days[i]) === 1) streak++
    else break
  }
  return streak
}

/* ============================================================
   PROMPT
   ============================================================ */
function buildPrompt(inputs, ctx) {
  const weaknessLines =
    ctx.topWeaknesses.length > 0
      ? ctx.topWeaknesses.map((w, i) => `${i + 1}. ${w}`).join('\n')
      : '1. (no match data logged yet)'
  const moduleList =
    ctx.moduleNames.length > 0 ? ctx.moduleNames.join(', ') : 'ADS, Spray Training, Car Spray, Close Range'

  return `You are a professional BGMI esports coach.
Create a detailed weekly training plan for a player with the following profile:

Skill Level: ${inputs.skill.toLowerCase()}
Goal: ${inputs.goalText}
Available days per week: ${inputs.daysPerWeek}
Session duration: ${inputs.sessionDurationLabel}
Total sessions completed so far: ${ctx.sessionCount}
Current training streak: ${ctx.streak} days

Top weaknesses from match data:
${weaknessLines}

Available training modules:
${moduleList}

Generate a 7-day training plan.
For each day specify:
- Which modules to train
- Duration for each module
- Specific drills to focus on
- A daily goal/tip

Format your response as JSON only.
No explanation text outside JSON.
Use this exact structure:
{
  "planName": string,
  "goal": string,
  "days": [
    {
      "day": "Monday",
      "isRestDay": boolean,
      "sessions": [
        {
          "moduleName": string,
          "duration": number,
          "focus": string,
          "drills": [string]
        }
      ],
      "dailyTip": string
    }
  ],
  "overallTip": string
}`
}

/* ============================================================
   ANTHROPIC API CALL
   ============================================================ */
async function callAnthropic(prompt) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    const err = new Error('NO_API_KEY')
    err.code = 'NO_API_KEY'
    throw err
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      /* Required for direct browser-origin calls. */
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) throw new Error(`API ${response.status}`)

  const data = await response.json()
  const text = (data.content || []).map(i => i.text || '').join('')
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

/* ============================================================
   LOCAL FALLBACK GENERATOR
   Builds a genuine plan from the user's own modules + weaknesses
   when no API key is configured (the default for a static deploy).
   ============================================================ */
function chooseModulePool(goalText, modules) {
  const lower = (goalText || '').toLowerCase()
  const find = keywords =>
    modules.filter(m => keywords.some(k => m.name.toLowerCase().includes(k)))

  let pool = []
  if (lower.includes('spray') || lower.includes('recoil')) pool = find(['spray', 'car', 'recoil'])
  else if (lower.includes('close')) pool = find(['close', 'aim', 'ads'])
  else if (lower.includes('long') || lower.includes('range') || lower.includes('accuracy'))
    pool = find(['ads', 'aim', 'spray'])
  else pool = modules.slice()

  if (!pool.length) pool = modules.slice()
  return pool
}

function pickTrainDays(daysPerWeek) {
  if (daysPerWeek >= 7) return [0, 1, 2, 3, 4, 5, 6]
  if (daysPerWeek >= 5) return [0, 1, 2, 3, 4]
  return [0, 2, 4]
}

function splitDuration(total, n) {
  if (n <= 1) return [total]
  const part = Math.round(total / n / 5) * 5
  return Array.from({ length: n }, (_, i) =>
    i === n - 1 ? Math.max(total - part * (n - 1), 5) : part
  )
}

function buildLocalPlan(inputs, ctx) {
  const { goalText, skill, daysPerWeek, sessionDuration } = inputs
  const pool = chooseModulePool(goalText, ctx.modules)
  const trainDays = pickTrainDays(daysPerWeek)
  const modsPerDay = sessionDuration >= 60 ? Math.min(2, pool.length || 1) : 1

  let cursor = 0
  const days = DAY_FULL.map((name, idx) => {
    if (!trainDays.includes(idx)) {
      return {
        day: name,
        isRestDay: true,
        sessions: [],
        dailyTip: REST_TIPS[idx % REST_TIPS.length],
      }
    }
    const dayMods = []
    for (let k = 0; k < modsPerDay && pool.length > 0; k++) {
      dayMods.push(pool[cursor % pool.length])
      cursor++
    }
    const durs = splitDuration(sessionDuration, dayMods.length || 1)
    const sessions = dayMods.map((m, i) => ({
      moduleName: m.name,
      duration: durs[i],
      focus: ctx.topWeaknesses.length
        ? `Work on ${ctx.topWeaknesses[idx % ctx.topWeaknesses.length]}`
        : DEFAULT_FOCUS[i % DEFAULT_FOCUS.length],
      drills: (m.drills || []).slice(0, 3).map(d => d.name),
    }))
    return {
      day: name,
      isRestDay: false,
      sessions,
      dailyTip: DAY_TIPS[idx % DAY_TIPS.length],
    }
  })

  const skillKey = skill.toLowerCase()
  return {
    planName: `${labelForGoal(goalText)} — ${skill}`,
    goal: goalText,
    days,
    overallTip: OVERALL_TIPS[skillKey] || OVERALL_TIPS.intermediate,
  }
}

function labelForGoal(goalText) {
  if (!goalText) return 'Weekly Training Plan'
  return goalText.length > 28 ? goalText.slice(0, 28) + '…' : goalText
}

/* ============================================================
   AI SHAPE → STORAGE SCHEMA
   ============================================================ */
/**
 * Resolve an AI-suggested module name to an existing module name from
 * esportselite_modules when possible (exact, then case-insensitive
 * contains in either direction). Falls back to the AI name unchanged.
 * Keeps the TODAY'S PLAN highlight matching real module cards.
 */
function matchModuleName(aiName, moduleNames) {
  if (!aiName) return 'Training'
  const lower = aiName.trim().toLowerCase()
  const exact = moduleNames.find(n => n.toLowerCase() === lower)
  if (exact) return exact
  const contains = moduleNames.find(n => {
    const nl = n.toLowerCase()
    return nl.includes(lower) || lower.includes(nl)
  })
  return contains || aiName
}

function toStoragePlan(aiPlan, inputs) {
  const moduleNames = readLS(STORAGE_KEYS.MODULES, [])
    .map(m => m.name)
    .filter(Boolean)

  const byIndex = {}
  ;(aiPlan.days || []).forEach(d => {
    const key = (d.day || '').trim().toLowerCase()
    if (key in DAY_INDEX) byIndex[DAY_INDEX[key]] = d
  })

  const days = DAY_FULL.map((name, idx) => {
    const d = byIndex[idx]
    if (!d) {
      return {
        dayIndex: idx,
        dayName: name,
        isRestDay: false,
        sessions: [],
        matchPractice: false,
        notes: '',
        dailyTip: '',
      }
    }
    return {
      dayIndex: idx,
      dayName: name,
      isRestDay: !!d.isRestDay,
      sessions: (d.sessions || []).map(s => ({
        id: 'sess-' + uid(),
        moduleName: matchModuleName(s.moduleName, moduleNames),
        duration: Number(s.duration) || 30,
        focus: s.focus || '',
        drills: Array.isArray(s.drills) ? s.drills : [],
        completed: false,
      })),
      matchPractice: false,
      notes: '',
      dailyTip: d.dailyTip || '',
    }
  })

  return {
    id: 'plan-' + uid(),
    name: aiPlan.planName || 'AI Training Plan',
    goal: aiPlan.goal || inputs.goalText || '',
    duration: 7,
    startDate: new Date().toISOString(),
    isActive: false,
    isAiGenerated: true,
    createdAt: Date.now(),
    days,
    overallTip: aiPlan.overallTip || '',
  }
}

const delay = ms => new Promise(r => setTimeout(r, ms))

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
export default function AIPlanGenerator({ onSavePlan }) {
  const [modules] = useState(() => readLS(STORAGE_KEYS.MODULES, []))

  /* Form state */
  const [goalChoice, setGoalChoice] = useState(GOAL_OPTIONS[0])
  const [customGoal, setCustomGoal] = useState('')
  const [skill, setSkill] = useState('Intermediate')
  const [daysPerWeek, setDaysPerWeek] = useState(5)
  const [sessionDuration, setSessionDuration] = useState(60)

  /* Flow state */
  const [phase, setPhase] = useState('form') // form | loading | result | error
  const [aiPlan, setAiPlan] = useState(null)
  const [source, setSource] = useState('ai') // ai | local
  const [hadMatchData, setHadMatchData] = useState(true)
  const [error, setError] = useState('')
  const [loadingMsg, setLoadingMsg] = useState(0)
  const [expanded, setExpanded] = useState({ 0: true })
  const [savedToast, setSavedToast] = useState(false)

  const lastInputsRef = useRef(null)

  /* Rotate loading messages while generating. */
  useEffect(() => {
    if (phase !== 'loading') return
    setLoadingMsg(0)
    const t = setInterval(() => {
      setLoadingMsg(i => (i + 1) % LOADING_MESSAGES.length)
    }, 1500)
    return () => clearInterval(t)
  }, [phase])

  function currentInputs() {
    const goalText = goalChoice === 'custom' ? customGoal.trim() || 'Overall improvement' : goalChoice
    const durLabel =
      DURATION_OPTIONS.find(d => d.value === sessionDuration)?.label || `${sessionDuration} mins`
    return {
      goalText,
      skill,
      daysPerWeek,
      sessionDuration,
      sessionDurationLabel: durLabel,
    }
  }

  function iconFor(name) {
    return modules.find(m => m.name === name)?.icon || '🎯'
  }

  async function generate() {
    const inputs = currentInputs()
    lastInputsRef.current = inputs
    const ctx = gatherContext()
    setHadMatchData(ctx.hasMatchData)
    setError('')
    setPhase('loading')

    try {
      const prompt = buildPrompt(inputs, ctx)
      const plan = await callAnthropic(prompt)
      setAiPlan(plan)
      setSource('ai')
      setExpanded({ 0: true })
      setPhase('result')
    } catch (e) {
      if (e.code === 'NO_API_KEY') {
        /* No key configured — generate a solid plan locally. */
        await delay(1400) // let the loading animation breathe
        const local = buildLocalPlan(inputs, ctx)
        setAiPlan(local)
        setSource('local')
        setExpanded({ 0: true })
        setPhase('result')
      } else {
        setError('Could not generate plan. Try again.')
        setPhase('error')
      }
    }
  }

  function buildOffline() {
    const inputs = lastInputsRef.current || currentInputs()
    const ctx = gatherContext()
    setHadMatchData(ctx.hasMatchData)
    const local = buildLocalPlan(inputs, ctx)
    setAiPlan(local)
    setSource('local')
    setExpanded({ 0: true })
    setPhase('result')
  }

  function savePlan() {
    if (!aiPlan) return
    const inputs = lastInputsRef.current || currentInputs()
    const storagePlan = toStoragePlan(aiPlan, inputs)
    onSavePlan?.(storagePlan)
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2600)
  }

  function toggleDay(i) {
    setExpanded(prev => ({ ...prev, [i]: !prev[i] }))
  }

  /* ---------------- RENDER ---------------- */
  if (phase === 'loading') return <LoadingState messageIndex={loadingMsg} />

  if (phase === 'error') {
    return (
      <div className="glass clip-corner-sm p-8 text-center border border-[rgba(232,0,28,0.4)] animate-fade-in">
        <div className="w-14 h-14 mx-auto rounded-full bg-[rgba(232,0,28,0.12)] border border-[rgba(232,0,28,0.4)] flex items-center justify-center mb-4">
          <AlertTriangle size={26} className="text-accent-secondary" />
        </div>
        <h4 className="heading text-lg text-white">{error}</h4>
        <p className="text-text-secondary text-sm mt-2 max-w-md mx-auto">
          The AI service couldn't be reached. Retry, or build a plan offline from your
          own modules and match data.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={generate}
            className="btn-red px-5 py-2.5 rounded-md text-xs uppercase tracking-[0.15em] flex items-center gap-2"
          >
            <RefreshCw size={14} /> Retry
          </button>
          <button
            onClick={buildOffline}
            className="btn-outline px-5 py-2.5 rounded-md text-xs uppercase tracking-[0.15em] flex items-center gap-2"
          >
            <WifiOff size={14} /> Build Offline Instead
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'result' && aiPlan) {
    return (
      <div className="space-y-5 animate-fade-in">
        {/* Result header */}
        <div className="glass clip-corner-sm p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-gradient" />
          <div className="pl-2">
            <h3 className="heading text-xl text-white tracking-wide flex items-center gap-2">
              <Bot size={20} className="text-accent-secondary" /> YOUR AI TRAINING PLAN
            </h3>
            <p className="heading text-base text-gradient-red mt-1">{aiPlan.planName}</p>
            {aiPlan.goal && (
              <p className="text-sm text-text-secondary mt-1">
                Goal: <span className="text-text-primary">{aiPlan.goal}</span>
              </p>
            )}
            {source === 'local' && (
              <p className="text-[11px] text-text-muted mt-2 inline-flex items-center gap-1.5 bg-bg-elevated/60 border border-border rounded-md px-2.5 py-1.5">
                <WifiOff size={12} /> Built locally from your data. Add an Anthropic API
                key for fully AI-crafted plans.
              </p>
            )}
            {!hadMatchData && (
              <p className="text-[11px] text-warning mt-2">
                Log matches for a more personalized plan.
              </p>
            )}
          </div>
        </div>

        {/* Days */}
        <div className="space-y-3">
          {(aiPlan.days || []).map((d, i) => {
            const isOpen = !!expanded[i]
            const isRest = !!d.isRestDay
            return (
              <div
                key={`${d.day}-${i}`}
                className="glass clip-corner-sm overflow-hidden border border-border"
              >
                <button
                  onClick={() => toggleDay(i)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      size={16}
                      className={`text-text-secondary transition-transform ${
                        isOpen ? 'rotate-0 text-accent-secondary' : '-rotate-90'
                      }`}
                    />
                    <span className="heading text-base text-white tracking-wide uppercase">
                      {d.day}
                    </span>
                    {isRest ? (
                      <span className="pill text-[10px] bg-bg-elevated/60 border-border text-text-muted">
                        😴 Rest Day
                      </span>
                    ) : (
                      <span className="text-xs text-text-secondary">
                        {(d.sessions || []).length} session
                        {(d.sessions || []).length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 space-y-3 animate-fade-in">
                    {isRest ? (
                      <div className="text-center py-4">
                        <div className="text-3xl mb-1">😴</div>
                        <p className="heading text-sm text-text-secondary tracking-wide uppercase">
                          Rest Day
                        </p>
                        {d.dailyTip && (
                          <p className="text-xs text-text-muted mt-1">{d.dailyTip}</p>
                        )}
                      </div>
                    ) : (
                      <>
                        {(d.sessions || []).map((s, si) => (
                          <div
                            key={si}
                            className="rounded-md border border-border bg-bg-elevated/50 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-lg">{iconFor(s.moduleName)}</span>
                                <span className="text-white font-medium truncate">
                                  {s.moduleName}
                                </span>
                              </div>
                              <span className="mono text-accent-secondary text-sm whitespace-nowrap">
                                {s.duration} mins
                              </span>
                            </div>
                            {s.focus && (
                              <p className="text-xs text-text-secondary mt-2">
                                <span className="text-text-muted uppercase tracking-widest heading">
                                  Focus:
                                </span>{' '}
                                {s.focus}
                              </p>
                            )}
                            {Array.isArray(s.drills) && s.drills.length > 0 && (
                              <p className="text-xs text-text-secondary mt-1">
                                <span className="text-text-muted uppercase tracking-widest heading">
                                  Drills:
                                </span>{' '}
                                {s.drills.join(', ')}
                              </p>
                            )}
                          </div>
                        ))}
                        {d.dailyTip && (
                          <div className="text-xs text-text-secondary bg-[rgba(255,215,0,0.06)] border border-[rgba(255,215,0,0.25)] rounded-md px-3 py-2">
                            💡 <span className="text-gold heading uppercase tracking-widest text-[10px]">Daily Tip:</span>{' '}
                            {d.dailyTip}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Overall tip */}
        {aiPlan.overallTip && (
          <div className="glass clip-corner-sm p-5">
            <div className="text-[10px] uppercase tracking-[0.15em] text-text-muted heading mb-1">
              💬 Overall Coach Tip
            </div>
            <p className="text-sm text-text-primary leading-relaxed">{aiPlan.overallTip}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={savePlan}
            className="btn-red px-6 py-3 rounded-md text-sm uppercase tracking-[0.15em] flex items-center gap-2"
          >
            <CheckCircle2 size={16} /> Save This Plan
          </button>
          <button
            onClick={generate}
            className="btn-outline px-6 py-3 rounded-md text-sm uppercase tracking-[0.15em] flex items-center gap-2"
          >
            <RefreshCw size={16} /> Regenerate
          </button>
          {savedToast && (
            <span className="toast-success px-3 py-2 rounded-md text-xs mono">
              Plan saved to My Plan! ✅
            </span>
          )}
        </div>
      </div>
    )
  }

  /* ---- FORM ---- */
  return (
    <div className="glass clip-corner-sm p-6 lg:p-7 relative overflow-hidden animate-fade-in">
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-accent-primary opacity-[0.08] blur-[100px] pointer-events-none" />

      <div className="relative z-10">
        <h3 className="heading text-xl text-white tracking-wide flex items-center gap-2">
          <Bot size={20} className="text-accent-secondary" /> AI TRAINING PLAN GENERATOR
        </h3>
        <p className="text-xs text-text-secondary mt-1 uppercase tracking-widest">
          Personalized from your match data and modules
        </p>

        <div className="mt-6 space-y-6">
          {/* Goal */}
          <Field label="Tell us your goal">
            <div className="space-y-2">
              {GOAL_OPTIONS.map(g => (
                <RadioRow
                  key={g}
                  active={goalChoice === g}
                  onClick={() => setGoalChoice(g)}
                  label={g}
                />
              ))}
              <RadioRow
                active={goalChoice === 'custom'}
                onClick={() => setGoalChoice('custom')}
                label={
                  <div className="flex items-center gap-2 w-full">
                    <span className="whitespace-nowrap">Custom:</span>
                    <input
                      type="text"
                      value={customGoal}
                      onFocus={() => setGoalChoice('custom')}
                      onChange={e => setCustomGoal(e.target.value)}
                      placeholder="type your goal..."
                      className="input-field py-1.5 text-sm flex-1"
                      maxLength={80}
                    />
                  </div>
                }
              />
            </div>
          </Field>

          {/* Skill */}
          <Field label="Skill level">
            <Pills options={SKILL_OPTIONS} value={skill} onChange={setSkill} />
          </Field>

          {/* Days per week */}
          <Field label="Days per week available">
            <Pills
              options={DAYS_OPTIONS.map(d => d.label)}
              value={DAYS_OPTIONS.find(d => d.value === daysPerWeek)?.label}
              onChange={label =>
                setDaysPerWeek(DAYS_OPTIONS.find(d => d.label === label)?.value || 5)
              }
            />
          </Field>

          {/* Duration */}
          <Field label="Session duration per day">
            <Pills
              options={DURATION_OPTIONS.map(d => d.label)}
              value={DURATION_OPTIONS.find(d => d.value === sessionDuration)?.label}
              onChange={label =>
                setSessionDuration(
                  DURATION_OPTIONS.find(d => d.label === label)?.value || 60
                )
              }
            />
          </Field>

          <button
            onClick={generate}
            className="btn-red w-full sm:w-auto px-6 py-3 rounded-md text-sm uppercase tracking-[0.15em] flex items-center justify-center gap-2"
          >
            <Sparkles size={16} /> Generate My Plan
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   LOADING STATE
   ============================================================ */
function LoadingState({ messageIndex }) {
  return (
    <div className="glass clip-corner-sm p-10 text-center relative overflow-hidden animate-fade-in">
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-accent-primary opacity-[0.1] blur-[100px] pointer-events-none" />
      <div className="relative z-10">
        <div className="text-5xl mb-4 animate-pulse">🤖</div>
        <h4 className="heading text-lg text-white tracking-wide">
          {LOADING_MESSAGES[messageIndex]}
        </h4>

        {/* Indeterminate red bar */}
        <div className="mt-6 max-w-sm mx-auto h-2 rounded-full bg-bg-elevated overflow-hidden relative">
          <div className="ee-loading-bar absolute inset-y-0 w-1/3 bg-red-gradient rounded-full" />
        </div>

        <div className="mt-6 space-y-1 text-xs text-text-muted">
          <p>Checking weaknesses...</p>
          <p>Matching modules...</p>
          <p>Crafting your plan...</p>
        </div>
      </div>

      <style>{`
        @keyframes eeLoadingSlide {
          0% { left: -35%; }
          100% { left: 100%; }
        }
        .ee-loading-bar {
          animation: eeLoadingSlide 1.1s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

/* ============================================================
   FORM HELPERS
   ============================================================ */
function Field({ label, children }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.15em] text-text-secondary heading mb-3">
        {label}
      </div>
      {children}
    </div>
  )
}

function RadioRow({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md border text-left transition-all ${
        active
          ? 'border-accent-primary bg-[rgba(232,0,28,0.08)]'
          : 'border-border bg-bg-elevated/40 hover:border-accent-secondary'
      }`}
    >
      <span
        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
          active ? 'border-accent-primary' : 'border-text-muted'
        }`}
      >
        {active && <span className="w-2 h-2 rounded-full bg-accent-primary" />}
      </span>
      <span className="text-sm text-text-primary flex-1">{label}</span>
    </button>
  )
}

function Pills({ options, value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(opt => {
        const active = value === opt
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={
              'px-4 py-2 rounded-full text-xs uppercase tracking-widest heading transition-all ' +
              (active
                ? 'bg-red-gradient text-white shadow-red-glow'
                : 'bg-bg-elevated/60 border border-border text-text-secondary hover:text-white hover:border-accent-primary')
            }
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}
