/**
 * anthropicProxy — Firebase Callable (v2)
 *
 * Server-side proxy for AI plan/schedule generation. The web client MUST
 * NOT call an AI provider directly — doing so would expose the key in
 * the client bundle. All calls go through this function.
 *
 * Uses OpenAI (gpt-4o-mini) via the OPENAI_KEY secret — the same secret
 * already used by aiCoachChat.js and extractMatchScreenshot.js. The
 * export name is kept as `anthropicProxy` because AIPlanGenerator.jsx
 * and Scheduler.jsx call it by that name via httpsCallable.
 *
 * Secrets:
 *   OPENAI_KEY  — OpenAI API key
 *
 * Input:
 *   { prompt: string, systemPrompt?: string, maxTokens?: number }
 *
 * Returns:
 *   { text: string }
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import OpenAI from 'openai'

const OPENAI_KEY = defineSecret('OPENAI_KEY')

const MODEL          = 'gpt-4o-mini'
const MAX_PROMPT     = 10000
const MAX_SYS_PROMPT = 5000
const DEFAULT_TOKENS = 1024
const MAX_TOKENS     = 4096

export const anthropicProxy = onCall(
  {
    secrets: [OPENAI_KEY],
    cors: ['https://esportselite.in', 'https://app.esportselite.in'],
    memory: '256MiB',
    timeoutSeconds: 120,
    enforceAppCheck: true,
  },
  async (req) => {
    if (!req.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in to use AI features.')
    }

    const {
      prompt       = '',
      systemPrompt = '',
      maxTokens,
    } = req.data || {}

    if (typeof prompt !== 'string' || !prompt.trim()) {
      throw new HttpsError('invalid-argument', 'prompt is required.')
    }
    if (prompt.length > MAX_PROMPT) {
      throw new HttpsError('invalid-argument', `prompt must be under ${MAX_PROMPT} characters.`)
    }
    if (systemPrompt && typeof systemPrompt !== 'string') {
      throw new HttpsError('invalid-argument', 'systemPrompt must be a string.')
    }
    if (systemPrompt && systemPrompt.length > MAX_SYS_PROMPT) {
      throw new HttpsError('invalid-argument', `systemPrompt must be under ${MAX_SYS_PROMPT} characters.`)
    }

    const tokens = maxTokens
      ? Math.min(Math.max(1, Number(maxTokens) || DEFAULT_TOKENS), MAX_TOKENS)
      : DEFAULT_TOKENS

    const openai = new OpenAI({ apiKey: OPENAI_KEY.value() })

    const messages = []
    if (systemPrompt && systemPrompt.trim()) {
      messages.push({ role: 'system', content: systemPrompt.trim() })
    }
    messages.push({ role: 'user', content: String(prompt) })

    let completion
    try {
      completion = await openai.chat.completions.create({
        model:      MODEL,
        max_tokens: tokens,
        messages,
      })
    } catch (err) {
      console.error('[anthropicProxy] OpenAI error:', err?.message || err)
      if (err?.status === 401) {
        throw new HttpsError('failed-precondition', 'The AI service is not configured. Contact support.')
      }
      if (err?.status === 429) {
        throw new HttpsError('resource-exhausted', 'The AI service is busy — try again shortly.')
      }
      throw new HttpsError('internal', 'Could not reach the AI service. Try again.')
    }

    const text = (completion.choices?.[0]?.message?.content || '').trim()
    if (!text) {
      throw new HttpsError('internal', 'AI service returned an empty response.')
    }

    console.log(`[anthropicProxy] uid=${req.auth.uid} tokens_used=${completion.usage?.total_tokens ?? '?'}`)

    return { text }
  },
)
