/**
 * aiCoachChat — Firebase Callable (v2)
 *
 * The AI Coach chatbot backend. Same conventions as
 * extractMatchScreenshot.js (onCall, defineSecret('OPENAI_KEY'), auth
 * check, defensive input validation, structured HttpsError handling).
 * This function is stateless — the web client fetches the user's prior
 * `classicStats` history + the running chat thread from Firestore and
 * passes them in, exactly like Pass 1 does for the roster IGNs. No
 * Firebase Admin SDK, no Firestore access from here, no image storage.
 *
 * Two call shapes:
 *
 *  1. NEW ANALYSIS  — `{ imageBase64, mimeType, priorStats?[] }`
 *     → GPT-4o mini reads ONLY headshots / headshot rate / accuracy
 *       from the Classic Stats screenshot,
 *     → then GPT-4o produces a direct coaching message seeded with the
 *       fresh stats + up to 2 prior entries for improvement comparison.
 *     Returns `{ stats, coachMessage, warnings }`.
 *
 *  2. FOLLOW-UP     — `{ message, stats, priorStats?[], history?[] }`
 *     → skips extraction; GPT-4o answers the new question using the
 *       stats context + the conversation so far.
 *     Returns `{ coachMessage, warnings }`  (no `stats`).
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2'
import OpenAI from 'openai'

const OPENAI_KEY = defineSecret('OPENAI_KEY')

setGlobalOptions({ region: 'us-central1', maxInstances: 10 })

const VISION_MODEL = 'gpt-4o-mini'   /* cheap, fine for 3-number OCR */
const COACH_MODEL = 'gpt-4o'         /* the actual advice quality */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_HISTORY_MSGS = 20
const MAX_MSG_LEN = 2000

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

const approxBytes = b64 => Math.floor((b64 || '').length * 3 / 4)

/* number, tolerating "42", "42%", "42 %", "  42.5 " */
const num = v => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/* keep only what the coach prompt needs from a stats object */
function tidyStats(s) {
  if (!s || typeof s !== 'object') return null
  return {
    headshots: num(s.headshots),
    headshotRate: num(s.headshotRate),
    accuracy: num(s.accuracy),
  }
}

function statsLine(label, s) {
  if (!s) return `${label}: (none)`
  const hr = s.headshotRate == null ? '?' : `${s.headshotRate}%`
  const ac = s.accuracy == null ? '?' : `${s.accuracy}%`
  const hs = s.headshots == null ? '?' : s.headshots
  return `${label}: headshots ${hs}, headshot rate ${hr}, accuracy ${ac}`
}

const EXTRACT_PROMPT =
  'This is a BGMI (Battlegrounds Mobile India) player CAREER / CLASSIC STATS screen.\n' +
  'Extract EXACTLY these three fields as JSON and nothing else:\n' +
  '- headshots: the total headshots count (a whole number).\n' +
  '- headshotRate: the headshot rate / headshot percentage as a number (no "%").\n' +
  '- accuracy: the accuracy / hit rate as a number (no "%").\n' +
  'Ignore every other element on screen: mode tabs (Classic/TDM/Arena), season number, ' +
  'tier/rank, matches played, wins, K/D, top 10, average survival time, damage, MVP count, ' +
  'finishes, assists, and any button/label. If a value is not clearly visible use null.\n' +
  'Respond with a JSON object: { "headshots": number|null, "headshotRate": number|null, "accuracy": number|null }.'

const COACH_SYSTEM =
  'You are an experienced competitive BGMI / PUBG Mobile aim coach talking directly to one ' +
  'player about their Classic career stats (headshots, headshot rate, accuracy). Be direct and ' +
  'conversational — like a coach in a scrim debrief, not a written report. No headings, no ' +
  'bullet-point templates, no "Dear player". In a few short paragraphs: say what is genuinely ' +
  'good, what is weak, name the SINGLE highest-priority thing to fix first, give one concrete ' +
  'practice routine for it (drill, sensitivity/gyro check, or in-game focus), and call out one ' +
  'thing they should NOT waste time on right now. If prior stats are provided, explicitly ' +
  'compare ("your accuracy went from X to Y since last time"). Keep it under ~180 words. ' +
  'Only discuss aim/gunplay from these numbers — do not invent stats you were not given.'

/* build the messages array for the coaching call */
function buildCoachMessages({ current, prior, history, followUpText }) {
  const msgs = [{ role: 'system', content: COACH_SYSTEM }]

  const ctxLines = []
  ctxLines.push(statsLine('Current stats', current))
  ;(prior || []).slice(0, 2).forEach((p, i) => ctxLines.push(statsLine(`Previous upload #${i + 1}`, p)))
  msgs.push({ role: 'system', content: ctxLines.join('\n') })

  /* replay the existing thread so follow-ups stay in context */
  for (const m of (history || []).slice(-MAX_HISTORY_MSGS)) {
    if (!m || !m.text) continue
    msgs.push({ role: m.role === 'coach' ? 'assistant' : 'user', content: String(m.text).slice(0, MAX_MSG_LEN) })
  }

  if (followUpText) {
    msgs.push({ role: 'user', content: String(followUpText).slice(0, MAX_MSG_LEN) })
  } else {
    msgs.push({
      role: 'user',
      content:
        'I just uploaded my latest Classic stats (above). Give me your read on where my aim is ' +
        'at and exactly what to work on next.',
    })
  }
  return msgs
}

/* ------------------------------------------------------------------ */
/* handler                                                            */
/* ------------------------------------------------------------------ */

export const aiCoachChat = onCall(
  {
    secrets: [OPENAI_KEY],
    cors: true,
    memory: '512MiB',
    timeoutSeconds: 90,
  },
  async (req) => {
    if (!req.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in to use the AI Coach.')
    }

    const {
      imageBase64 = '',
      mimeType = 'image/png',
      message = '',
      stats: incomingStats = null,
      priorStats = [],
      history = [],
    } = req.data || {}

    const isNewAnalysis = !!imageBase64
    const prior = (Array.isArray(priorStats) ? priorStats : []).map(tidyStats).filter(Boolean)
    const thread = (Array.isArray(history) ? history : [])
      .filter(m => m && (m.role === 'user' || m.role === 'coach') && typeof m.text === 'string')

    if (!isNewAnalysis && !String(message).trim()) {
      throw new HttpsError('invalid-argument', 'Send a screenshot or a message.')
    }
    if (isNewAnalysis) {
      if (typeof imageBase64 !== 'string') throw new HttpsError('invalid-argument', 'Bad image data.')
      if (approxBytes(imageBase64) > MAX_IMAGE_BYTES) {
        throw new HttpsError('invalid-argument', 'Screenshot is too large — use an image under 5 MB.')
      }
    }
    if (String(message).length > MAX_MSG_LEN) {
      throw new HttpsError('invalid-argument', 'Message is too long.')
    }

    const openai = new OpenAI({ apiKey: OPENAI_KEY.value() })
    const warnings = []
    let stats = incomingStats ? tidyStats(incomingStats) : null

    /* ---- 1. extraction (new analysis only) ---- */
    if (isNewAnalysis) {
      let extractJson
      try {
        const c = await openai.chat.completions.create({
          model: VISION_MODEL,
          temperature: 0,
          max_tokens: 200,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are a precise OCR/vision extractor for BGMI stats screens. Return only the ' +
                'requested JSON object — no prose, no markdown. If the image is not a stats screen, ' +
                'return every field as null.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: EXTRACT_PROMPT },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' } },
              ],
            },
          ],
        })
        extractJson = JSON.parse(c.choices?.[0]?.message?.content || '{}')
      } catch (err) {
        console.error('[aiCoachChat] extraction error:', err?.message || err)
        if (err?.status === 401) throw new HttpsError('failed-precondition', 'The AI service is not configured. Contact support.')
        if (err?.status === 429) throw new HttpsError('resource-exhausted', 'The AI service is busy — try again shortly.')
        throw new HttpsError('internal', 'Could not read that stats screenshot. Try a clearer, full-screen image.')
      }

      stats = tidyStats(extractJson)
      const missing = Object.entries(stats).filter(([, v]) => v == null).map(([k]) => k)
      if (missing.length === 3) {
        throw new HttpsError('internal', "That doesn't look like a Classic stats screen — none of headshots / headshot rate / accuracy were readable.")
      }
      if (missing.length) warnings.push(`Couldn't read: ${missing.join(', ')} — the coaching below works with what was found.`)
    }

    /* ---- 2. coaching call ---- */
    let coachMessage
    try {
      const c = await openai.chat.completions.create({
        model: COACH_MODEL,
        temperature: 0.6,
        max_tokens: 500,
        messages: buildCoachMessages({
          current: stats,
          prior,
          history: thread,
          followUpText: isNewAnalysis ? '' : message,
        }),
      })
      coachMessage = (c.choices?.[0]?.message?.content || '').trim()
    } catch (err) {
      console.error('[aiCoachChat] coaching error:', err?.message || err)
      if (err?.status === 401) throw new HttpsError('failed-precondition', 'The AI service is not configured. Contact support.')
      if (err?.status === 429) throw new HttpsError('resource-exhausted', 'The AI service is busy — try again shortly.')
      throw new HttpsError('internal', 'The coach could not respond right now. Try again.')
    }
    if (!coachMessage) {
      throw new HttpsError('internal', 'The coach returned an empty response. Try again.')
    }

    console.log(`[aiCoachChat] uid=${req.auth.uid} mode=${isNewAnalysis ? 'analysis' : 'followup'} prior=${prior.length} history=${thread.length}`)

    return {
      ...(isNewAnalysis ? { stats } : {}),
      coachMessage,
      warnings,
    }
  },
)
