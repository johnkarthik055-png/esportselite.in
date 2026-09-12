/**
 * anthropicProxy — Firebase Callable (v2)
 *
 * Server-side proxy for the Anthropic Claude API. The web client MUST
 * NOT call the Anthropic API directly — doing so would expose the key
 * in the client bundle. All Claude calls go through this function.
 *
 * Secrets:
 *   ANTHROPIC_KEY  — Anthropic API key
 *   Set once with: firebase functions:secrets:set ANTHROPIC_KEY
 *
 * Input:
 *   { prompt: string, systemPrompt?: string, maxTokens?: number }
 *
 * Returns:
 *   { text: string }
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2'

const ANTHROPIC_KEY = defineSecret('ANTHROPIC_KEY')

setGlobalOptions({ region: 'us-central1', maxInstances: 10 })

const MODEL         = 'claude-sonnet-4-5-20250609'
const MAX_PROMPT    = 10000
const MAX_SYS_PROMPT = 5000
const DEFAULT_TOKENS = 1024
const MAX_TOKENS    = 4096
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

export const anthropicProxy = onCall(
  {
    secrets: [ANTHROPIC_KEY],
    cors: ['https://esportselite.in', 'https://app.esportselite.in'],
    memory: '256MiB',
    timeoutSeconds: 120,
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

    const body = {
      model:      MODEL,
      max_tokens: tokens,
      messages:   [{ role: 'user', content: String(prompt) }],
    }
    if (systemPrompt && systemPrompt.trim()) {
      body.system = systemPrompt.trim()
    }

    let response
    try {
      response = await fetch(ANTHROPIC_API, {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          'x-api-key':       ANTHROPIC_KEY.value(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      })
    } catch (err) {
      console.error('[anthropicProxy] network error:', err?.message || err)
      throw new HttpsError('internal', 'Could not reach the AI service. Try again.')
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error(`[anthropicProxy] API error ${response.status}:`, errorText.slice(0, 200))
      if (response.status === 401) {
        throw new HttpsError('failed-precondition', 'The AI service is not configured. Contact support.')
      }
      if (response.status === 429) {
        throw new HttpsError('resource-exhausted', 'The AI service is busy — try again shortly.')
      }
      throw new HttpsError('internal', `AI service returned error ${response.status}.`)
    }

    let data
    try {
      data = await response.json()
    } catch {
      throw new HttpsError('internal', 'AI service returned an unreadable response.')
    }

    const text = (data.content || []).map(c => c.text || '').join('').trim()
    if (!text) {
      throw new HttpsError('internal', 'AI service returned an empty response.')
    }

    console.log(`[anthropicProxy] uid=${req.auth.uid} tokens_used=${data.usage?.output_tokens ?? '?'}`)

    return { text }
  },
)
