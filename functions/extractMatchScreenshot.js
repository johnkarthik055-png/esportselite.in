/**
 * extractMatchScreenshot — Firebase Callable (v2)
 *
 * Reads a BGMI end-of-match screenshot with GPT-4o mini (vision) and
 * returns ONLY the stat fields relevant to the selected match type /
 * sub-mode. The web client sends the image as base64 (the image itself
 * is never persisted). For Tournament matches the caller also passes
 * the current squad roster's IGNs so per-player kills can be attributed
 * to real registered teammates — the model attempts the match, and this
 * function runs a fuzzy fallback afterward and flags anything unmatched
 * for manual review.
 *
 * The result is a suggestion only — the client shows a mandatory
 * review/confirm step before anything is saved.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2'
import OpenAI from 'openai'

const OPENAI_KEY = defineSecret('OPENAI_KEY')

setGlobalOptions({ region: 'us-central1', maxInstances: 10 })

const MODEL = 'gpt-4o-mini'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 /* ~5 MB of raw bytes (~6.7 MB base64) */
const MATCH_TYPES = ['Classic', 'Scrims', 'Tournament']
const CLASSIC_SUBMODES = ['Solo', 'Duo', 'Squad', 'solo_vs_squad']

/* ------------------------------------------------------------------ */
/* prompts                                                            */
/* ------------------------------------------------------------------ */

const IGNORE_RULE =
  'Ignore every other on-screen element — season/tier/rank-point text, XP and BP rewards, ' +
  'mission popups, buttons, watermarks, ads, player level, assists, revives, and ' +
  'anything not listed above. Return numbers as plain numbers (no "#", "x", "kills", or "m" suffixes). ' +
  'If a value is not clearly visible, use null.'

function classicPrompt(subMode, userIgns) {
  const individual = subMode === 'Solo' || subMode === 'solo_vs_squad'
  const killsDesc = individual
    ? 'kills: the number of kills for the user\'s own player only.'
    : 'kills: the TEAM\'s total kills for this match (sum of the squad).'
  return [
    `This is a BGMI Classic ${subMode === 'solo_vs_squad' ? 'Solo vs Squad' : subMode} end-of-match result screen.`,
    userIgns.length
      ? `The user plays under one of these in-game names: ${userIgns.join(', ')}. Use them to identify the user's own row if several players are shown.`
      : '',
    'Extract EXACTLY these fields as JSON:',
    '- map: the map name (Erangel, Miramar, Sanhok, Vikendi, Livik, Rondo, Nusa, Karakin) or null.',
    '- position: the final placement / rank for this match as a number (1 = winner / "WINNER WINNER CHICKEN DINNER").',
    `- ${killsDesc.split(':')[0]}: ${killsDesc.split(':').slice(1).join(':').trim()}`,
    '- damage: the total damage dealt by the user\'s player in this match as a number, or null.',
    '- survivalTime: the user\'s survival time as a string in "MM:SS" format, or null. Keep the colon — do not convert to a plain number.',
    '- matchType: the detected game sub-mode shown on screen: "Solo", "Duo", or "Squad" — or null if not clearly visible.',
    IGNORE_RULE,
    'Respond with a JSON object: { "map": string|null, "position": number|null, "kills": number|null, "damage": number|null, "survivalTime": string|null, "matchType": string|null }.',
  ].filter(Boolean).join('\n')
}

function scrimsPrompt(userIgns) {
  return [
    'This is a BGMI custom-room / scrims squad end-of-match result screen.',
    userIgns.length
      ? `The user plays under one of these in-game names: ${userIgns.join(', ')}. If the user's own row is visible, also read their individual kills and damage.`
      : '',
    'Extract EXACTLY these fields as JSON:',
    '- map: the map name (Erangel, Miramar, Sanhok, Vikendi, Livik, Rondo, Nusa, Karakin) or null.',
    '- teamPosition: the squad\'s final placement in the lobby as a number.',
    '- teamKills: the squad\'s total kills for this match.',
    '- individualKills: the user\'s own kills if their row is identifiable, else null.',
    '- damage: the total damage dealt by the user\'s player in this match as a number, or null.',
    '- placement_points: the placement points awarded for the team\'s finishing position as a number, or null.',
    IGNORE_RULE,
    'Respond with a JSON object: { "map": string|null, "teamPosition": number|null, "teamKills": number|null, "individualKills": number|null, "damage": number|null, "placement_points": number|null }.',
  ].filter(Boolean).join('\n')
}

function tournamentPrompt(rosterIgns) {
  const rosterList = rosterIgns
    .map(r => {
      const names = (r.igns && r.igns.length ? r.igns : [r.ign]).filter(Boolean)
      return names.length ? `  - ${names.join(' / ')}` : null
    })
    .filter(Boolean)
    .join('\n')
  return [
    'This is a BGMI tournament / scrims match result screen showing a full squad breakdown.',
    'Extract EXACTLY these fields as JSON:',
    '- map: the map name (Erangel, Miramar, Sanhok, Vikendi, Livik, Rondo, Nusa, Karakin) or null.',
    '- teamPosition: the squad\'s final placement in the lobby as a number.',
    '- teamKills: the squad\'s total kills for this match.',
    '- players: an array with ONE entry per visible player of the user\'s own squad, each ' +
      '{ "name": string (exactly as written on screen), "kills": number|null }.',
    rosterList
      ? `The user's registered squad roster uses these in-game names:\n${rosterList}\n` +
        'For each player, set "matchedName" to the roster name it corresponds to (copy it ' +
        'verbatim from the list above) when you are confident, otherwise set "matchedName" to null. ' +
        'Do NOT invent roster names.'
      : '',
    IGNORE_RULE,
    'Respond with a JSON object: { "map": string|null, "teamPosition": number|null, "teamKills": number|null, ' +
      '"players": [{ "name": string, "kills": number|null, "matchedName": string|null }] }.',
  ].filter(Boolean).join('\n')
}

/* ------------------------------------------------------------------ */
/* fuzzy roster matching (safety net)                                 */
/* ------------------------------------------------------------------ */

const norm = s => String(s || '').toLowerCase().replace(/[\s._\-|~*]+/g, '').trim()

function buildRosterIndex(rosterIgns) {
  /* name-variant -> { uid, ign } */
  const exact = new Map()
  const loose = new Map()
  for (const r of rosterIgns || []) {
    const names = [...(r.igns || []), r.ign].filter(Boolean)
    for (const n of names) {
      exact.set(n, { uid: r.uid, ign: n })
      exact.set(n.toLowerCase(), { uid: r.uid, ign: n })
      loose.set(norm(n), { uid: r.uid, ign: n })
    }
  }
  return { exact, loose }
}

function matchPlayer(player, index) {
  const raw = player.name || ''
  /* 1. model already told us which roster name */
  if (player.matchedName) {
    const hit = index.exact.get(player.matchedName) || index.exact.get(player.matchedName.toLowerCase()) || index.loose.get(norm(player.matchedName))
    if (hit) return { ...player, matchedUid: hit.uid, matchedIgn: hit.ign, unmatched: false }
  }
  /* 2. exact */
  const e = index.exact.get(raw) || index.exact.get(raw.toLowerCase())
  if (e) return { ...player, matchedUid: e.uid, matchedIgn: e.ign, unmatched: false }
  /* 3. whitespace / punctuation-tolerant */
  const l = index.loose.get(norm(raw))
  if (l) return { ...player, matchedUid: l.uid, matchedIgn: l.ign, unmatched: false }
  /* 4. prefix / contains (last resort, still surfaced for review) */
  const nr = norm(raw)
  if (nr.length >= 3) {
    for (const [k, v] of index.loose) {
      if (k.startsWith(nr) || nr.startsWith(k)) {
        return { ...player, matchedUid: v.uid, matchedIgn: v.ign, unmatched: false, matchConfidence: 'low' }
      }
    }
  }
  return { ...player, matchedUid: null, matchedIgn: null, unmatched: true }
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

const num = v => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function approxBytes(base64) {
  const len = (base64 || '').length
  return Math.floor(len * 3 / 4)
}

/* ------------------------------------------------------------------ */
/* handler                                                            */
/* ------------------------------------------------------------------ */

export const extractMatchScreenshot = onCall(
  {
    secrets: [OPENAI_KEY],
    cors: true,
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (req) => {
    if (!req.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in to import a screenshot.')
    }

    const {
      imageBase64 = '',
      mimeType = 'image/png',
      matchType,
      subMode = '',
      userIgns = [],
      rosterIgns = [],
    } = req.data || {}

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new HttpsError('invalid-argument', 'No screenshot provided.')
    }
    if (approxBytes(imageBase64) > MAX_IMAGE_BYTES) {
      throw new HttpsError('invalid-argument', 'Screenshot is too large — please use an image under 5 MB.')
    }
    if (!MATCH_TYPES.includes(matchType)) {
      throw new HttpsError('invalid-argument', `matchType must be one of ${MATCH_TYPES.join(', ')}.`)
    }
    if (matchType === 'Classic' && subMode && !CLASSIC_SUBMODES.includes(subMode)) {
      throw new HttpsError('invalid-argument', 'Unknown Classic sub-mode.')
    }

    const cleanUserIgns = (Array.isArray(userIgns) ? userIgns : []).map(s => String(s).trim()).filter(Boolean).slice(0, 3)
    const cleanRoster = (Array.isArray(rosterIgns) ? rosterIgns : [])
      .filter(r => r && r.uid)
      .map(r => ({
        uid: String(r.uid),
        ign: String(r.ign || '').trim(),
        igns: (Array.isArray(r.igns) ? r.igns : []).map(s => String(s).trim()).filter(Boolean),
      }))

    let prompt
    if (matchType === 'Classic') prompt = classicPrompt(subMode || 'Squad', cleanUserIgns)
    else if (matchType === 'Scrims') prompt = scrimsPrompt(cleanUserIgns)
    else prompt = tournamentPrompt(cleanRoster)

    const openai = new OpenAI({ apiKey: OPENAI_KEY.value() })

    let modelJson
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a precise OCR/vision extractor for BGMI (Battlegrounds Mobile India) ' +
              'match result screenshots. You only return the JSON object requested — no prose, ' +
              'no markdown. If the image is not a match result screen, return every field as null.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' } },
            ],
          },
        ],
      })
      const text = completion.choices?.[0]?.message?.content || '{}'
      modelJson = JSON.parse(text)
    } catch (err) {
      console.error('[extractMatchScreenshot] model/parse error:', err?.message || err)
      if (err?.status === 401) throw new HttpsError('failed-precondition', 'The AI service is not configured. Contact support.')
      if (err?.status === 429) throw new HttpsError('resource-exhausted', 'The AI service is busy — try again in a moment.')
      throw new HttpsError('internal', 'Could not read that screenshot. Try a clearer, full-screen image.')
    }

    const warnings = []
    let fields = {}
    let players
    let unmatched

    if (matchType === 'Classic') {
      fields = {
        map: modelJson.map || '',
        position: num(modelJson.position),
        kills: num(modelJson.kills),
        damage: num(modelJson.damage),
        survivalTime: modelJson.survivalTime || null,
        matchType: modelJson.matchType || null,
      }
    } else if (matchType === 'Scrims') {
      fields = {
        map: modelJson.map || '',
        teamPosition: num(modelJson.teamPosition),
        teamKills: num(modelJson.teamKills),
        individualKills: num(modelJson.individualKills),
        damage: num(modelJson.damage),
        placement_points: num(modelJson.placement_points),
      }
    } else {
      fields = {
        map: modelJson.map || '',
        teamPosition: num(modelJson.teamPosition),
        teamKills: num(modelJson.teamKills),
      }
      const index = buildRosterIndex(cleanRoster)
      const rawPlayers = Array.isArray(modelJson.players) ? modelJson.players : []
      players = rawPlayers
        .filter(p => p && (p.name || p.name === 0))
        .map((p, i) => matchPlayer({ name: String(p.name).trim(), kills: num(p.kills), matchedName: p.matchedName || null }, index))
      unmatched = players.filter(p => p.unmatched).map(p => p.name)
      if (!players.length) warnings.push('No per-player rows could be read from this screenshot.')
      if (unmatched.length) warnings.push(`${unmatched.length} player name(s) did not match the squad roster — assign them manually.`)
    }

    if (matchType !== 'Tournament') {
      const nulls = Object.entries(fields).filter(([, v]) => v === null || v === '').map(([k]) => k)
      if (nulls.length) warnings.push(`Could not read: ${nulls.join(', ')} — fill these in manually.`)
    }

    console.log(`[extractMatchScreenshot] uid=${req.auth.uid} type=${matchType} sub=${subMode || '-'} players=${players?.length ?? '-'} unmatched=${unmatched?.length ?? 0}`)

    return {
      matchType,
      subMode: subMode || null,
      fields,
      ...(players ? { players } : {}),
      ...(unmatched ? { unmatched } : {}),
      warnings,
      raw: modelJson,
    }
  },
)
