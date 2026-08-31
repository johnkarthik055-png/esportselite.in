/**
 * Client-side handles for the AI Cloud Functions.
 *
 * Every OpenAI call happens server-side in `functions/` — the browser
 * only ever invokes these callables (Firebase attaches the signed-in
 * user's auth token automatically). No API key is present anywhere in
 * this bundle.
 *
 * If the Functions project has not been deployed yet, these calls fail
 * with `functions/not-found` / `internal` — callers should surface a
 * friendly "AI Coach isn't set up yet" message.
 */
import { getFunctions, httpsCallable } from 'firebase/functions'
import { firebaseApp } from './firebase.js'

/* Matches the region in functions/extractMatchScreenshot.js */
const fns = getFunctions(firebaseApp, 'us-central1')

/**
 * Extract match stats from a BGMI end-of-match screenshot.
 * @param {{ imageBase64: string, mimeType: string, matchType: 'Classic'|'Scrims'|'Tournament',
 *           subMode?: string, userIgns?: string[],
 *           rosterIgns?: {uid:string, ign?:string, igns?:string[]}[] }} payload
 * @returns {Promise<{ matchType:string, subMode:string|null, fields:object,
 *           players?:object[], unmatched?:string[], warnings:string[], raw:object }>}
 */
export async function extractMatchScreenshot(payload) {
  const call = httpsCallable(fns, 'extractMatchScreenshot')
  const res = await call(payload)
  return res.data
}

/**
 * AI Coach chat backend (see functions/aiCoachChat.js).
 *
 * New analysis:  { imageBase64, mimeType, priorStats?: object[] }
 *                → { stats: {headshots, headshotRate, accuracy}, coachMessage, warnings }
 * Follow-up:     { message: string, stats: object, priorStats?: object[],
 *                  history: {role:'user'|'coach', text:string}[] }
 *                → { coachMessage, warnings }
 */
export async function aiCoachChat(payload) {
  const call = httpsCallable(fns, 'aiCoachChat')
  const res = await call(payload)
  return res.data
}

/**
 * Read a File/Blob as base64 (no `data:` prefix) + its mime type.
 * @param {File|Blob} file
 * @returns {Promise<{ base64: string, mimeType: string }>}
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the image file.'))
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve({
        base64: comma >= 0 ? result.slice(comma + 1) : result,
        mimeType: file.type || 'image/png',
      })
    }
    reader.readAsDataURL(file)
  })
}
