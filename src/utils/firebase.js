import { initializeApp, getApps, getApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAnalytics, isSupported as isAnalyticsSupported, logEvent } from 'firebase/analytics'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'

/**
 * Firebase web-SDK config. The `apiKey` and project IDs are *not* secrets —
 * Firebase web config is identifying info, not credentials, and is meant to
 * ship in client bundles. Real authorization is enforced by Firebase Security
 * Rules. We still read from env vars so the same code can target a different
 * project in CI / preview environments, but fall back to the production
 * values so the app boots out-of-the-box.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyD8KitIGBVidSAGkHgzC-A2AVypiIE_7n4',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'esports-elite-daf06.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'esports-elite-daf06',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    'esports-elite-daf06.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '381439809052',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:381439809052:web:ff4bf41ad5a96f10e671d9',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-FNEK371V4Y',
}

/** Singleton — survives Vite HMR without double-initializing. */
const _isFirstInit = !getApps().length
export const firebaseApp = _isFirstInit ? initializeApp(firebaseConfig) : getApp()

/**
 * Firebase App Check — prevents abuse of Cloud Functions and Firestore from
 * outside the app (scripts, Postman, etc.).
 *
 * Production: uses the reCAPTCHA v3 site key from VITE_RECAPTCHA_SITE_KEY (.env).
 * localhost dev: App Check fails because localhost is not an authorized reCAPTCHA
 * domain. Setting FIREBASE_APPCHECK_DEBUG_TOKEN = true makes the SDK generate a
 * debug token and log it to the browser console. Whitelist that token in:
 * Firebase Console → App Check → Apps → your app → Manage debug tokens.
 */
if (typeof window !== 'undefined' && _isFirstInit) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-undef
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
  }
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(
      import.meta.env.VITE_RECAPTCHA_SITE_KEY ||
        '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI',
    ),
    isTokenAutoRefreshEnabled: true,
  })
}

/** Auth instance + pre-configured Google provider for the
    "Continue with Google" button on the Login page. */
export const auth = getAuth(firebaseApp)
export const googleProvider = new GoogleAuthProvider()

/**
 * Firestore instance — single source of truth for persistent user data.
 *
 * Required Firestore Security Rules (set in Firebase Console → Firestore → Rules):
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /users/{userId}/{document=**} {
 *         allow read, write: if
 *           request.auth != null &&
 *           request.auth.uid == userId;
 *       }
 *     }
 *   }
 */
export const db = getFirestore(firebaseApp)

export const functions = getFunctions(firebaseApp, 'us-central1')
export { httpsCallable }

/**
 * Analytics is mutable: it's `null` until `isSupported()` resolves and the
 * browser actually permits analytics (some private-mode / ad-blocked clients
 * will keep it null forever, which is fine — calls just no-op).
 */
export let analytics = null

if (typeof window !== 'undefined') {
  isAnalyticsSupported()
    .then(ok => {
      if (ok) {
        try {
          analytics = getAnalytics(firebaseApp)
        } catch {
          /* swallow — analytics is best-effort */
        }
      }
    })
    .catch(() => {
      /* unsupported environment — ignore */
    })
}

/**
 * Safe event logger. Use this from anywhere in the app:
 *   trackEvent('drill_completed', { module: 'ADS', duration: 120 })
 *
 * No-op until analytics finishes initializing or if it never does.
 */
export function trackEvent(name, params) {
  if (!analytics) return
  try {
    logEvent(analytics, name, params || {})
  } catch {
    /* ignore */
  }
}
