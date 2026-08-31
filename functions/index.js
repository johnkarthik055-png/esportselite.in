/**
 * Esports Elite — Cloud Functions entry point.
 *
 * All OpenAI calls live here, server-side. The API key is a Firebase
 * Functions secret (OPENAI_KEY) — set it once with:
 *
 *   firebase functions:secrets:set OPENAI_KEY
 *
 * and it is injected only into the functions that declare it in
 * `secrets: [...]`. It is never bundled into the web client.
 *
 * Deploy:  firebase deploy --only functions
 * (Requires the Blaze plan on the Firebase project.)
 */
export { extractMatchScreenshot } from './extractMatchScreenshot.js'
export { aiCoachChat } from './aiCoachChat.js'
