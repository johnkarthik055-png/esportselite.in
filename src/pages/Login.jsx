import { useRef, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft, Loader } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '../components/motion/PageTransition.jsx'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { STORAGE_KEYS } from '../utils/constants.js'
import { writeLS } from '../hooks/useLocalStorage.js'
import { uid } from '../utils/helpers.js'
import { auth, googleProvider } from '../utils/firebase.js'
import { setActiveUID, migrateOldData } from '../utils/storage.js'
import { getProfile, saveProfile } from '../utils/db.js'

const LOCAL_USERS_KEY  = 'esportselite_users'
const LOCAL_SESSION_KEY = 'esportselite_session'

function getLocalUsers() {
  try { return JSON.parse(window.localStorage.getItem(LOCAL_USERS_KEY) || '[]') }
  catch { return [] }
}
function setLocalUsers(users) {
  try { window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users)) }
  catch { /* ignore */ }
}
function upsertLocalUser(user) {
  const users = getLocalUsers()
  const idx = users.findIndex(u => (u.email || '').toLowerCase() === (user.email || '').toLowerCase())
  if (idx >= 0) users[idx] = { ...users[idx], ...user }
  else users.push(user)
  setLocalUsers(users)
}
function findLocalUser(email) {
  const lc = (email || '').toLowerCase()
  return getLocalUsers().find(u => (u.email || '').toLowerCase() === lc) || null
}
function setLocalSession(user) {
  try {
    window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({
      userId: user.id, username: user.username, email: user.email, isLoggedIn: true,
    }))
  } catch { /* ignore */ }
}

function mapSignInError(error) {
  const code = error?.code || ''
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials')
    return { field: 'password', message: 'Incorrect email or password' }
  if (code === 'auth/user-not-found')  return { field: 'email',    message: 'No account with this email' }
  if (code === 'auth/invalid-email')   return { field: 'email',    message: 'Enter a valid email address' }
  if (code === 'auth/user-disabled')   return { field: 'form',     message: 'This account has been disabled' }
  if (code === 'auth/too-many-requests') return { field: 'form',   message: 'Too many attempts. Try again later.' }
  if (code === 'auth/network-request-failed') return { field: 'form', message: 'Network error. Check your connection.' }
  return { field: 'form', message: error?.message || 'Sign-in failed. Please try again.' }
}
function mapSignUpError(error) {
  const code = error?.code || ''
  if (code === 'auth/email-already-in-use') return { field: 'email',    message: 'This email is already registered' }
  if (code === 'auth/weak-password')         return { field: 'password', message: 'Password must be at least 6 characters' }
  if (code === 'auth/invalid-email')         return { field: 'email',    message: 'Enter a valid email address' }
  if (code === 'auth/network-request-failed') return { field: 'form',   message: 'Network error. Check your connection.' }
  return { field: 'form', message: error?.message || 'Sign-up failed. Please try again.' }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function setupUserProfile(fbUser) {
  if (!fbUser?.uid) return
  const uidVal = fbUser.uid
  setActiveUID(uidVal)
  migrateOldData(uidVal)
  try {
    const existing = await getProfile(uidVal)
    if (!existing) {
      await saveProfile(uidVal, {
        username: fbUser.displayName || 'Player',
        email: fbUser.email || '',
        phone: '', ign: '', igId: '',
        xp: 0, level: 1,
        streak: { count: 0, lastActiveDate: null },
        createdAt: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.warn('[Login] setupUserProfile error (non-fatal):', err)
  }
}

/* ─── Global styles injected once ─────────────────────────────────────────── */
const GLOBAL_CSS = `
  @keyframes autofillDetect{from{opacity:1}to{opacity:1}}
  input:-webkit-autofill{animation-name:autofillDetect;animation-duration:1ms}
  @keyframes ee-spin{to{transform:rotate(360deg)}}

  .ee-brand { display:flex; width:52%; }
  .ee-form-panel { width:48%; }
  .ee-mobile-logo { display:none; }

  @media(max-width:768px){
    .ee-brand  { display:none !important; }
    .ee-form-panel { width:100% !important; padding:32px 24px !important; }
    .ee-mobile-logo { display:flex !important; }
  }

  /* ── Inputs ── */
  .ee-inp {
    width:100%; background:#F7F9FC;
    border:1.5px solid #DCE4EF; border-radius:10px;
    padding:13px 16px; font-size:15px;
    font-family:'Inter',sans-serif; color:#111827;
    box-sizing:border-box; outline:none;
    transition:border-color 200ms,box-shadow 200ms,background 200ms;
  }
  .ee-inp::placeholder{ color:#9CA3AF; }
  .ee-inp:focus{
    border-color:#1769FF; background:#FFFFFF;
    box-shadow:0 0 0 3px rgba(23,105,255,0.1);
  }
  .ee-inp.err{ border-color:#FF1838; }

  /* ── Labels ── */
  .ee-lbl{
    display:block;
    font-family:'Rajdhani',sans-serif; font-weight:600;
    font-size:11px; color:#536174;
    letter-spacing:0.1em; text-transform:uppercase;
    margin-bottom:8px;
  }

  /* ── Google button ── */
  .ee-g-btn{
    width:100%; background:#FFFFFF;
    border:1.5px solid #DCE4EF; border-radius:10px;
    padding:13px; font-family:'Inter',sans-serif;
    font-weight:600; font-size:15px; color:#111827;
    display:flex; align-items:center; justify-content:center; gap:10px;
    cursor:pointer;
    transition:background 200ms,border-color 200ms,box-shadow 200ms;
  }
  .ee-g-btn:hover:not(:disabled){
    background:#F7F9FC; border-color:#1769FF;
    box-shadow:0 2px 8px rgba(0,0,0,0.06);
  }
  .ee-g-btn:disabled{ opacity:0.6; cursor:not-allowed; }

  /* ── Secondary/cancel button ── */
  .ee-sec-btn{
    background:#F7F9FC; border:1.5px solid #DCE4EF;
    color:#536174; font-family:'Inter',sans-serif;
    font-size:13px; padding:10px 16px; border-radius:8px;
    cursor:pointer; white-space:nowrap;
    transition:background 200ms,border-color 200ms;
  }
  .ee-sec-btn:hover:not(:disabled){ background:#EEF2F7; border-color:#B0BEC5; }
`

export default function Login() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [mode, setMode] = useState(location.state?.signup ? 'signup' : 'signin')
  useEffect(() => { if (location.state?.signup) setMode('signup') }, [location.state])

  /* The app uses HashRouter so the URL looks like:
     /#/login?next=%2Fcheckout
     window.location.search is always empty in HashRouter — the ?next= param
     lives inside window.location.hash after the route path.
     Extract it with a regex on the hash string. Only accept relative paths
     (starting with /) as a guard against open-redirect to external sites. */
  const nextUrl = (() => {
    const hash = window.location.hash
    const m = hash.match(/[?&]next=([^&]*)/)
    const raw = m ? decodeURIComponent(m[1]) : ''
    return raw.startsWith('/') ? raw : '/dashboard'
  })()

  const [username, setUsername]   = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [remember, setRemember]   = useState(true)
  const emailInputRef             = useRef(null)

  const [suUsername, setSuUsername]       = useState('')
  const [suEmail, setSuEmail]             = useState('')
  const [suPhone, setSuPhone]             = useState('')
  const [suPassword, setSuPassword]       = useState('')
  const [suConfirm, setSuConfirm]         = useState('')
  const [showSuPass, setShowSuPass]       = useState(false)
  const [showSuConfirm, setShowSuConfirm] = useState(false)

  const [errors, setErrors]         = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError,   setForgotError]   = useState('')
  const [logoFailed, setLogoFailed]       = useState(false)

  function setFieldError(field, message) { setErrors(prev => ({ ...prev, [field]: message })) }
  function clearFieldError(field) { setErrors(prev => { const n = { ...prev }; delete n[field]; return n }) }
  function clearAllErrors() { setErrors({}) }

  function switchToSignUp() { clearAllErrors(); setForgotSuccess(false); setForgotError(''); setMode('signup') }
  function switchToSignIn() { clearAllErrors(); setForgotSuccess(false); setForgotError(''); setMode('signin') }

  /* Accepts the email to send the reset to (from the inline form input). */
  async function handleForgotPassword(emailParam) {
    const emailValue = (emailParam || '').trim()
    if (!emailValue) { setForgotError('Enter your email address.'); return }
    if (!EMAIL_RE.test(emailValue)) { setForgotError('Enter a valid email address.'); return }
    setForgotError(''); setForgotLoading(true); setForgotSuccess(false)
    try {
      await sendPasswordResetEmail(auth, emailValue)
      setForgotSuccess(true)
    } catch (error) {
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
          setForgotError('No account found with that email.'); break
        case 'auth/invalid-email':
          setForgotError('Enter a valid email address.'); break
        case 'auth/too-many-requests':
          setForgotError('Too many attempts. Wait a few minutes.'); break
        case 'auth/network-request-failed':
          setForgotError('No internet. Check your connection.'); break
        default:
          setForgotError('Could not send reset email. Try again.')
      }
    } finally { setForgotLoading(false) }
  }

  async function handleSignIn(e) {
    e.preventDefault(); clearAllErrors(); setForgotSuccess(false); setForgotError('')
    const email = username.trim(), pw = password.trim()
    if (!email) { setFieldError('email', 'Email is required.'); return }
    if (!pw)    { setFieldError('password', 'Password is required.'); return }
    setSubmitting(true)
    try {
      const result = await signInWithEmailAndPassword(auth, email, pw)
      const fbUser = result?.user
      const existingLocal = findLocalUser(email)
      const uname = fbUser?.displayName || existingLocal?.username || email.split('@')[0] || 'Player'
      const localUser = {
        id: fbUser?.uid || 'user-' + uid(),
        username: uname, email,
        phone: fbUser?.phoneNumber || existingLocal?.phone || '',
        password: pw, createdAt: existingLocal?.createdAt || Date.now(),
      }
      upsertLocalUser(localUser); setLocalSession(localUser)
      writeLS(STORAGE_KEYS.USER, { username: localUser.username, email, phone: localUser.phone, ign: '', igId: '' })
      if (fbUser) await setupUserProfile(fbUser)
      /* navigate() (React Router) — no page reload needed here because
         Firebase's onAuthStateChanged has already updated AuthContext with
         the fresh user by the time we reach this line. The destination page
         will see user as truthy on its first render. */
      navigate(nextUrl, { replace: true })
    } catch (err) {
      const mapped = mapSignInError(err); setFieldError(mapped.field, mapped.message)
    } finally { setSubmitting(false) }
  }

  async function handleSignUp(e) {
    e.preventDefault(); clearAllErrors()
    const u = suUsername.trim(), em = suEmail.trim(), ph = suPhone.trim(), pw = suPassword, cp = suConfirm
    const nextErrors = {}
    if (!u)  nextErrors.username = 'This field is required'
    if (!em) nextErrors.email = 'This field is required'
    else if (!EMAIL_RE.test(em)) nextErrors.email = 'Enter a valid email address'
    if (!ph) nextErrors.phone = 'This field is required'
    if (!pw) nextErrors.password = 'This field is required'
    else if (pw.length < 6) nextErrors.password = 'Password must be at least 6 characters'
    if (!cp) nextErrors.confirmPassword = 'This field is required'
    else if (cp !== pw) nextErrors.confirmPassword = 'Passwords do not match'
    if (Object.keys(nextErrors).length > 0) { setErrors(nextErrors); return }
    setSubmitting(true)
    try {
      const result = await createUserWithEmailAndPassword(auth, em, pw)
      const fbUser = result?.user
      if (fbUser && u) { try { await updateProfile(fbUser, { displayName: u }) } catch {} }
      const localUser = { id: fbUser?.uid || 'user-' + uid(), username: u, email: em, phone: ph, password: pw, createdAt: Date.now() }
      upsertLocalUser(localUser); setLocalSession(localUser)
      writeLS(STORAGE_KEYS.USER, { username: u, email: em, phone: ph, ign: '', igId: '' })
      if (fbUser) await setupUserProfile(fbUser)
      navigate(nextUrl, { replace: true })
    } catch (err) {
      const mapped = mapSignUpError(err); setFieldError(mapped.field, mapped.message)
    } finally { setSubmitting(false) }
  }

  async function handleGoogleSignIn() {
    clearAllErrors(); setSubmitting(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const fbUser = result?.user
      if (fbUser) {
        const localUser = {
          id: fbUser.uid || 'user-' + uid(),
          username: fbUser.displayName || (fbUser.email || '').split('@')[0] || 'Player',
          email: fbUser.email || '',
          phone: fbUser.phoneNumber || '', password: '', createdAt: Date.now(),
        }
        upsertLocalUser(localUser); setLocalSession(localUser)
        writeLS(STORAGE_KEYS.USER, { username: localUser.username, email: localUser.email, phone: localUser.phone, ign: '', igId: '' })
        await setupUserProfile(fbUser)
      }
      navigate(nextUrl, { replace: true })
    } catch (error) {
      if (error?.code !== 'auth/popup-closed-by-user') setFieldError('form', 'Google sign in failed. Try again.')
    } finally { setSubmitting(false) }
  }

  return (
    <PageTransition>
      <style>{GLOBAL_CSS}</style>

      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'stretch', background: '#F7F9FC' }}>

        {/* ════════════════════════════════════════
            LEFT BRAND PANEL  (52%, desktop only)
        ════════════════════════════════════════ */}
        <motion.div
          className="ee-brand"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: 'linear-gradient(160deg, #07111F 0%, #0D1E3D 60%, #1769FF15 100%)',
            position: 'relative',
            overflow: 'hidden',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '64px',
            minHeight: '100vh',
          }}
        >
          {/* Grid overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'linear-gradient(rgba(23,105,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(23,105,255,0.04) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
          {/* Blue glow — bottom-left */}
          <div style={{
            position: 'absolute', bottom: -100, left: -100,
            width: 400, height: 400, pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(23,105,255,0.15) 0%, transparent 70%)',
          }} />

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Logo */}
            {!logoFailed && (
              <img
                src="/assets/logo.png" alt="Esports Elite logo"
                style={{ height: 72, width: 'auto', objectFit: 'contain', display: 'block', marginBottom: 16 }}
                onError={() => setLogoFailed(true)}
              />
            )}

            {/* Wordmark */}
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
              fontSize: 52, color: '#FFFFFF', letterSpacing: '0.06em',
              lineHeight: 1, marginBottom: 8,
            }}>
              ESPORTS ELITE
            </div>

            {/* Tagline */}
            <div style={{
              fontFamily: "'Rajdhani', sans-serif", fontWeight: 600,
              fontSize: 15, color: '#536174', letterSpacing: '0.08em',
              marginBottom: 40,
            }}>
              Where Grind Becomes Greatness
            </div>

            {/* Blue accent divider */}
            <div style={{ width: 48, height: 2, background: '#1769FF', marginBottom: 40 }} />

            {/* Feature bullets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                'AI-powered coaching tailored to your BGMI playstyle',
                'Interactive map strategy & rotation planning tools',
                'Squad analytics, leaderboards & scrim tracking',
              ].map((text) => (
                <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 6, height: 6, background: '#1769FF', borderRadius: '50%',
                    flexShrink: 0, marginTop: 6,
                  }} />
                  <span style={{
                    fontFamily: "'Inter', sans-serif", fontSize: 15,
                    color: '#CBD5E1', lineHeight: 1.6,
                  }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Trust badge — absolute bottom */}
          <div style={{
            position: 'absolute', bottom: 40, left: 64, right: 64,
            zIndex: 1,
            fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#536174',
          }}>
            Trusted by 1,000+ serious BGMI players across India
          </div>
        </motion.div>

        {/* ════════════════════════════════════════
            RIGHT FORM PANEL  (48%)
        ════════════════════════════════════════ */}
        <motion.div
          className="ee-form-panel"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 56px',
            minHeight: '100vh',
            overflowY: 'auto',
          }}
        >
          {/* Mobile logo — hidden on desktop */}
          <div
            className="ee-mobile-logo"
            style={{ alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}
          >
            <img
              src="/assets/logo.png" alt="Esports Elite"
              style={{ height: 40, width: 'auto', objectFit: 'contain' }}
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
              fontSize: 28, color: '#111827', letterSpacing: '0.06em',
            }}>
              ESPORTS ELITE
            </div>
          </div>

          {/* Form container */}
          <div style={{ width: '100%', maxWidth: 400 }}>
            <AnimatePresence mode="wait">
              {mode === 'signin' ? (
                <motion.div
                  key="signin"
                  initial={{ opacity: 0, height: 'auto' }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  <SignInView
                    username={username} setUsername={setUsername}
                    password={password} setPassword={setPassword}
                    showPass={showPass} setShowPass={setShowPass}
                    remember={remember} setRemember={setRemember}
                    errors={errors} clearFieldError={clearFieldError}
                    submitting={submitting}
                    forgotLoading={forgotLoading}
                    forgotSuccess={forgotSuccess}
                    forgotError={forgotError}
                    setForgotError={setForgotError}
                    setForgotSuccess={setForgotSuccess}
                    emailInputRef={emailInputRef}
                    onSubmit={handleSignIn}
                    onForgot={handleForgotPassword}
                    onGetStarted={switchToSignUp}
                    onGoogleSignIn={handleGoogleSignIn}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, height: 'auto' }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  <SignUpView
                    suUsername={suUsername} setSuUsername={setSuUsername}
                    suEmail={suEmail} setSuEmail={setSuEmail}
                    suPhone={suPhone} setSuPhone={setSuPhone}
                    suPassword={suPassword} setSuPassword={setSuPassword}
                    suConfirm={suConfirm} setSuConfirm={setSuConfirm}
                    showSuPass={showSuPass} setShowSuPass={setShowSuPass}
                    showSuConfirm={showSuConfirm} setShowSuConfirm={setShowSuConfirm}
                    errors={errors} clearFieldError={clearFieldError}
                    submitting={submitting}
                    onSubmit={handleSignUp}
                    onBackToSignIn={switchToSignIn}
                    onGoogleSignIn={handleGoogleSignIn}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

      </div>
    </PageTransition>
  )
}

/* ─── Shared sub-components ───────────────────────────────────────────────── */

function ErrorBox({ children }) {
  if (!children) return null
  return (
    <div style={{
      background: 'rgba(255,24,56,0.06)',
      border: '1px solid rgba(255,24,56,0.2)',
      color: '#FF1838',
      padding: '10px 14px',
      borderRadius: 8,
      fontSize: 13,
      fontFamily: "'Inter', sans-serif",
      lineHeight: 1.5,
      marginBottom: 16,
    }}>
      {children}
    </div>
  )
}

function GoogleButton({ onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="ee-g-btn">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
        <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.83v2.07A8 8 0 0 0 8.98 17z"/>
        <path fill="#FBBC05" d="M4.51 10.52A4.8 4.8 0 0 1 4.26 9c0-.52.09-1.02.25-1.52V5.41H1.83a8 8 0 0 0 0 7.18l2.68-2.07z"/>
        <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.48c.64-1.87 2.4-3.9 4.48-3.9z"/>
      </svg>
      Continue with Google
    </button>
  )
}

/* ─── Sign-in view ────────────────────────────────────────────────────────── */

function SignInView({
  username, setUsername, password, setPassword,
  showPass, setShowPass, remember, setRemember,
  errors, clearFieldError, submitting,
  forgotLoading, forgotSuccess, forgotError, setForgotError, setForgotSuccess,
  emailInputRef,
  onSubmit, onForgot, onGetStarted, onGoogleSignIn,
}) {
  const [showForgotForm, setShowForgotForm] = useState(false)
  const [forgotEmail, setForgotEmail]       = useState('')

  function openForgotForm() {
    setForgotEmail(username.trim())
    setForgotError('')
    setForgotSuccess(false)
    setShowForgotForm(true)
  }
  function closeForgotForm() {
    setShowForgotForm(false)
    setForgotEmail('')
    setForgotError('')
    setForgotSuccess(false)
  }

  return (
    <>
      {/* Pill tag */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginBottom: 24 }}
      >
        <span style={{
          display: 'inline-block',
          fontFamily: "'Rajdhani', sans-serif", fontWeight: 600,
          fontSize: 11, color: '#1769FF',
          border: '1px solid rgba(23,105,255,0.3)',
          borderRadius: 20, padding: '4px 12px',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          BGMI Training Platform
        </span>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginBottom: 32 }}
      >
        <h1 style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
          fontSize: 42, color: '#111827', lineHeight: 1, marginBottom: 8,
        }}>
          Welcome back
        </h1>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: '#536174', lineHeight: 1.5 }}>
          Sign in to continue your training
        </p>
      </motion.div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Email */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <label className="ee-lbl" htmlFor="si-email">Username / Email</label>
          <input
            id="si-email"
            ref={emailInputRef} type="text"
            value={username}
            onChange={e => { setUsername(e.target.value); clearFieldError('email') }}
            onAnimationStart={e => { if (e.animationName === 'autofillDetect') { setUsername(e.target.value); clearFieldError('email') } }}
            className={`ee-inp${errors.email ? ' err' : ''}`}
            placeholder="Enter your email"
            autoComplete="username"
          />
          {errors.email && <FieldError>{errors.email}</FieldError>}
        </motion.div>

        {/* Password */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <label className="ee-lbl" htmlFor="si-password">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              id="si-password"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); clearFieldError('password') }}
              onAnimationStart={e => { if (e.animationName === 'autofillDetect') { setPassword(e.target.value); clearFieldError('password') } }}
              className={`ee-inp${errors.password ? ' err' : ''}`}
              style={{ paddingRight: 46 }}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
            <button
              type="button" onClick={() => setShowPass(v => !v)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#536174', padding: 4, display: 'flex', alignItems: 'center',
                transition: 'color 150ms',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#1769FF'}
              onMouseLeave={e => e.currentTarget.style.color = '#536174'}
              tabIndex={-1}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <FieldError>{errors.password}</FieldError>}

          {/* Inline forgot password form */}
          <AnimatePresence>
            {showForgotForm && !forgotSuccess && (
              <motion.div
                key="forgot-form"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                style={{
                  marginTop: 12,
                  padding: '14px',
                  background: '#F7F9FC',
                  border: '1.5px solid #DCE4EF',
                  borderRadius: 10,
                }}
              >
                <p style={{ fontSize: 12, color: '#536174', marginBottom: 10, lineHeight: 1.5, fontFamily: "'Inter', sans-serif" }}>
                  Enter your account email and we'll send a reset link.
                </p>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => { setForgotEmail(e.target.value); setForgotError('') }}
                  className="ee-inp"
                  placeholder="your@email.com"
                  autoComplete="email"
                  style={{ marginBottom: forgotError ? 6 : 10 }}
                />
                {forgotError && <FieldError style={{ marginBottom: 10 }}>{forgotError}</FieldError>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => onForgot(forgotEmail)}
                    disabled={forgotLoading}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #1769FF, #1254CC)',
                      color: '#FFFFFF',
                      fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13,
                      padding: '10px 12px', borderRadius: 8, border: 'none',
                      cursor: forgotLoading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      opacity: forgotLoading ? 0.7 : 1,
                      transition: 'opacity 200ms',
                    }}
                  >
                    {forgotLoading
                      ? <><Loader size={13} style={{ animation: 'ee-spin 1s linear infinite' }} /> Sending…</>
                      : 'Send Reset Link'}
                  </button>
                  <button type="button" onClick={closeForgotForm} disabled={forgotLoading} className="ee-sec-btn">
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reset success */}
          <AnimatePresence>
            {forgotSuccess && (
              <motion.div
                key="forgot-success"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  marginTop: 12,
                  padding: '12px 14px',
                  background: 'rgba(34,197,94,0.06)',
                  border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: 10,
                  fontSize: 13,
                  color: '#15803D',
                  lineHeight: 1.5,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Reset link sent to <strong>{forgotEmail}</strong>. Check your inbox.
                <button
                  type="button" onClick={closeForgotForm}
                  style={{
                    display: 'block', marginTop: 6,
                    background: 'none', border: 'none', padding: 0,
                    color: '#536174', fontSize: 12, cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  Dismiss
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Remember me + Forgot password — same row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}
        >
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: "'Inter', sans-serif", fontSize: 14, color: '#536174',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox" checked={remember}
              onChange={e => setRemember(e.target.checked)}
              style={{ accentColor: '#1769FF', width: 15, height: 15 }}
            />
            Remember me
          </label>

          {!showForgotForm && !forgotSuccess && (
            <button
              type="button" onClick={openForgotForm}
              style={{
                background: 'none', border: 'none', padding: 0,
                cursor: 'pointer', color: '#1769FF',
                fontFamily: "'Inter', sans-serif", fontSize: 13,
                textDecoration: 'none',
                transition: 'text-decoration 150ms',
              }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
            >
              Forgot password?
            </button>
          )}
        </motion.div>

        <ErrorBox>{errors.form}</ErrorBox>

        {/* Sign in button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.button
            type="submit" disabled={submitting}
            whileHover={{ scale: submitting ? 1 : 1.01, y: submitting ? 0 : -1 }}
            whileTap={{ scale: submitting ? 1 : 0.99 }}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #1769FF 0%, #1254CC 100%)',
              color: '#FFFFFF',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
              fontSize: 20, letterSpacing: '0.04em',
              padding: 14, borderRadius: 10, border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 20px rgba(23,105,255,0.3)',
              opacity: submitting ? 0.75 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'opacity 200ms, box-shadow 200ms',
            }}
            onMouseEnter={e => { if (!submitting) e.currentTarget.style.boxShadow = '0 6px 28px rgba(23,105,255,0.45)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(23,105,255,0.3)' }}
          >
            {submitting
              ? <><Loader size={16} style={{ animation: 'ee-spin 1s linear infinite' }} /> Signing in…</>
              : 'Sign in'}
          </motion.button>
        </motion.div>

        {/* OR divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#DCE4EF' }} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#9CA3AF' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#DCE4EF' }} />
        </div>

        {/* Google */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <GoogleButton onClick={onGoogleSignIn} disabled={submitting} />
        </motion.div>

        {/* Bottom link */}
        <p style={{
          textAlign: 'center', marginTop: 12,
          fontFamily: "'Inter', sans-serif", fontSize: 14, color: '#536174',
        }}>
          Don't have an account?{' '}
          <a
            href="#"
            onClick={e => { e.preventDefault(); onGetStarted() }}
            style={{ color: '#1769FF', fontWeight: 600, textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            Create an account
          </a>
        </p>
      </form>
    </>
  )
}

/* ─── Sign-up view ────────────────────────────────────────────────────────── */

function SignUpView({
  suUsername, setSuUsername, suEmail, setSuEmail, suPhone, setSuPhone,
  suPassword, setSuPassword, suConfirm, setSuConfirm,
  showSuPass, setShowSuPass, showSuConfirm, setShowSuConfirm,
  errors, clearFieldError, submitting, onSubmit, onBackToSignIn, onGoogleSignIn,
}) {
  return (
    <>
      {/* Pill tag */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginBottom: 24 }}
      >
        <span style={{
          display: 'inline-block',
          fontFamily: "'Rajdhani', sans-serif", fontWeight: 600,
          fontSize: 11, color: '#1769FF',
          border: '1px solid rgba(23,105,255,0.3)',
          borderRadius: 20, padding: '4px 12px',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          BGMI Training Platform
        </span>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginBottom: 28 }}
      >
        <button
          type="button" onClick={onBackToSignIn}
          style={{
            background: 'transparent', border: 'none', padding: '0 0 12px',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#536174',
            transition: 'color 150ms',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#1769FF'}
          onMouseLeave={e => e.currentTarget.style.color = '#536174'}
        >
          <ArrowLeft size={14} /> Back to sign in
        </button>
        <h1 style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
          fontSize: 42, color: '#111827', lineHeight: 1, marginBottom: 8,
        }}>
          Create account
        </h1>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: '#536174', lineHeight: 1.5 }}>
          Start your training journey today
        </p>
      </motion.div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PField
          id="su-username" label="Username" placeholder="Choose a display name"
          autoComplete="username" value={suUsername} delay={0.4}
          onChange={v => { setSuUsername(v); clearFieldError('username') }}
          error={errors.username}
        />
        <PField
          id="su-email" label="Email" type="email" placeholder="you@example.com"
          autoComplete="email" value={suEmail} delay={0.42}
          onChange={v => { setSuEmail(v); clearFieldError('email') }}
          error={errors.email}
        />
        <PField
          id="su-phone" label="Phone number" type="tel" placeholder="+91 98765 43210"
          autoComplete="tel" value={suPhone} delay={0.44}
          onChange={v => { setSuPhone(v); clearFieldError('phone') }}
          error={errors.phone}
        />
        <PPwdField
          id="su-password" label="Password" placeholder="At least 6 characters"
          autoComplete="new-password" value={suPassword} show={showSuPass}
          setShow={setShowSuPass} delay={0.46}
          onChange={v => { setSuPassword(v); clearFieldError('password') }}
          error={errors.password}
        />
        <PPwdField
          id="su-confirm" label="Confirm password" placeholder="Re-enter your password"
          autoComplete="new-password" value={suConfirm} show={showSuConfirm}
          setShow={setShowSuConfirm} delay={0.48}
          onChange={v => { setSuConfirm(v); clearFieldError('confirmPassword') }}
          error={errors.confirmPassword}
        />

        <ErrorBox>{errors.form}</ErrorBox>

        <motion.button
          type="submit" disabled={submitting}
          whileHover={{ scale: submitting ? 1 : 1.01, y: submitting ? 0 : -1 }}
          whileTap={{ scale: submitting ? 1 : 0.99 }}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #1769FF 0%, #1254CC 100%)',
            color: '#FFFFFF',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
            fontSize: 20, letterSpacing: '0.04em',
            padding: 14, borderRadius: 10, border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 20px rgba(23,105,255,0.3)',
            opacity: submitting ? 0.75 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'opacity 200ms, box-shadow 200ms',
          }}
          onMouseEnter={e => { if (!submitting) e.currentTarget.style.boxShadow = '0 6px 28px rgba(23,105,255,0.45)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(23,105,255,0.3)' }}
        >
          {submitting
            ? <><Loader size={16} style={{ animation: 'ee-spin 1s linear infinite' }} /> Creating…</>
            : 'Create account'}
        </motion.button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#DCE4EF' }} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#9CA3AF' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#DCE4EF' }} />
        </div>

        <GoogleButton onClick={onGoogleSignIn} disabled={submitting} />

        <p style={{
          textAlign: 'center', marginTop: 12,
          fontFamily: "'Inter', sans-serif", fontSize: 14, color: '#536174',
        }}>
          Already have an account?{' '}
          <a
            href="#"
            onClick={e => { e.preventDefault(); onBackToSignIn() }}
            style={{ color: '#1769FF', fontWeight: 600, textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            Sign in
          </a>
        </p>
      </form>
    </>
  )
}

/* ─── Field helpers ───────────────────────────────────────────────────────── */

function FieldError({ children, style }) {
  if (!children) return null
  return (
    <div style={{
      color: '#FF1838', fontSize: 12, marginTop: 5,
      fontFamily: "'Inter', sans-serif", lineHeight: 1.4,
      ...style,
    }}>
      {children}
    </div>
  )
}

function PField({ id, label, value, onChange, placeholder, type, autoComplete, error, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <label className="ee-lbl" htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type || 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`ee-inp${error ? ' err' : ''}`}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <FieldError>{error}</FieldError>
    </motion.div>
  )
}

function PPwdField({ id, label, value, onChange, show, setShow, placeholder, autoComplete, error, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <label className="ee-lbl" htmlFor={id}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`ee-inp${error ? ' err' : ''}`}
          style={{ paddingRight: 46 }}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button" onClick={() => setShow(v => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#536174', padding: 4, display: 'flex', alignItems: 'center',
            transition: 'color 150ms',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#1769FF'}
          onMouseLeave={e => e.currentTarget.style.color = '#536174'}
          tabIndex={-1}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <FieldError>{error}</FieldError>
    </motion.div>
  )
}
