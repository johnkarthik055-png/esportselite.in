import { useRef, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft, Loader } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Reveal from '../components/motion/Reveal.jsx'
import { StaggerGroup, StaggerItem } from '../components/motion/Stagger.jsx'
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

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState(location.state?.signup ? 'signup' : 'signin')
  useEffect(() => { if (location.state?.signup) setMode('signup') }, [location.state])

  /* The app uses HashRouter so the URL looks like:
     /#/login?next=%2Fcheckout
     window.location.search is always empty in HashRouter — the ?next= param
     lives inside window.location.hash after the route path.
     Extract it with a regex on the hash string. Only accept relative paths
     (starting with /) as a guard against open-redirect to external sites. */
  const nextUrl = (() => {
    const hash = window.location.hash  // e.g. '#/login?next=%2Fcheckout'
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

  function switchToSignUp() {
    clearAllErrors()
    setForgotSuccess(false)
    setForgotError('')
    setMode('signup')
  }
  function switchToSignIn() {
    clearAllErrors()
    setForgotSuccess(false)
    setForgotError('')
    setMode('signin')
  }

  /* Accepts the email to send the reset to (from the inline form input). */
  async function handleForgotPassword(emailParam) {
    const emailValue = (emailParam || '').trim()
    if (!emailValue) {
      setForgotError('Enter your email address.')
      return
    }
    if (!EMAIL_RE.test(emailValue)) {
      setForgotError('Enter a valid email address.')
      return
    }
    setForgotError('')
    setForgotLoading(true)
    setForgotSuccess(false)
    try {
      await sendPasswordResetEmail(auth, emailValue)
      setForgotSuccess(true)
    } catch (error) {
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
          setForgotError('No account found with that email.')
          break
        case 'auth/invalid-email':
          setForgotError('Enter a valid email address.')
          break
        case 'auth/too-many-requests':
          setForgotError('Too many attempts. Wait a few minutes.')
          break
        case 'auth/network-request-failed':
          setForgotError('No internet. Check your connection.')
          break
        default:
          setForgotError('Could not send reset email. Try again.')
      }
    } finally {
      setForgotLoading(false)
    }
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
      {/* Chrome autofill detection — fires onAnimationStart so React controlled inputs pick up autofilled values */}
      <style>{`
        @keyframes autofillDetect{from{opacity:1}to{opacity:1}}
        input:-webkit-autofill{animation-name:autofillDetect;animation-duration:1ms}
        @keyframes ee-spin { to { transform: rotate(360deg) } }
        .ee-login-brand { display: flex; }
        .ee-login-form { width: 50%; }
        .ee-mobile-logo { display: none; }
        @media (max-width: 768px) {
          .ee-login-brand { display: none !important; }
          .ee-login-form { width: 100% !important; padding: 24px !important; }
          .ee-mobile-logo { display: flex !important; }
        }
        .ee-input {
          background: #F7F9FC;
          border: 1.5px solid #DCE4EF;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 15px;
          font-family: 'Inter', sans-serif;
          color: #111827;
          width: 100%;
          box-sizing: border-box;
          outline: none;
          transition: border-color 200ms, box-shadow 200ms;
        }
        .ee-input::placeholder { color: #9CA3AF; }
        .ee-input:focus { border-color: #1769FF; box-shadow: 0 0 0 3px rgba(23,105,255,0.1); }
        .ee-input-error { border-color: #FF1838 !important; }
        .ee-label {
          display: block;
          font-family: 'Rajdhani', sans-serif;
          font-weight: 600;
          font-size: 12px;
          color: #536174;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .ee-btn-google {
          background: #FFFFFF;
          border: 1.5px solid #DCE4EF;
          color: #111827;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 15px;
          padding: 12px;
          border-radius: 8px;
          width: 100%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: background 200ms, border-color 200ms;
        }
        .ee-btn-google:hover:not(:disabled) { background: #F7F9FC; border-color: #1769FF; }
        .ee-btn-google:disabled { opacity: 0.6; cursor: not-allowed; }
        .ee-btn-secondary-sm {
          background: #F7F9FC;
          border: 1.5px solid #DCE4EF;
          color: #536174;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 200ms, border-color 200ms;
          white-space: nowrap;
        }
        .ee-btn-secondary-sm:hover:not(:disabled) { background: #EEF2F7; border-color: #B0BEC5; }
      `}</style>

      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'stretch', background: '#F7F9FC' }}>

        {/* ── Left brand panel (desktop only) ── */}
        <motion.div
          className="ee-login-brand"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: '50%',
            background: 'linear-gradient(135deg, #07111F 0%, #0D1E3D 100%)',
            padding: '48px 40px',
            flexDirection: 'column',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle grid overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'linear-gradient(rgba(23,105,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(23,105,255,0.04) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
          {/* Blue glow bottom-right */}
          <div style={{
            position: 'absolute', bottom: -80, right: -80, width: 320, height: 320,
            background: 'radial-gradient(circle, rgba(23,105,255,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Logo + wordmark */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
              {!logoFailed && (
                <img
                  src="/assets/logo.png" alt="Esports Elite"
                  style={{ width: 64, height: 64, objectFit: 'contain', flexShrink: 0 }}
                  onError={() => setLogoFailed(true)}
                />
              )}
              <div>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                  fontSize: 48, color: '#FFFFFF', letterSpacing: '0.06em', lineHeight: 1,
                }}>
                  ESPORTS ELITE
                </div>
                <div style={{
                  fontFamily: "'Rajdhani', sans-serif", fontWeight: 600,
                  fontSize: 16, color: '#536174', marginTop: 6,
                }}>
                  Where Grind Becomes Greatness
                </div>
              </div>
            </div>

            {/* Feature bullets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 56 }}>
              {[
                'AI-powered BGMI coaching',
                'Map strategy & rotation tools',
                'Squad analytics & leaderboards',
              ].map((bullet) => (
                <div key={bullet} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#1769FF', flexShrink: 0,
                    boxShadow: '0 0 8px rgba(23,105,255,0.6)',
                  }} />
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: '#CBD5E1', lineHeight: 1.5 }}>
                    {bullet}
                  </span>
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div style={{
              fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#536174',
              paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
              Join 1,000+ serious BGMI players
            </div>
          </div>
        </motion.div>

        {/* ── Right form panel ── */}
        <motion.div
          className="ee-login-form"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px',
            overflowY: 'auto',
            minHeight: '100vh',
          }}
        >
          {/* Mobile logo — hidden on desktop, shown on mobile */}
          <div className="ee-mobile-logo" style={{ alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <img
              src="/assets/logo.png" alt="Esports Elite"
              style={{ width: 40, height: 40, objectFit: 'contain' }}
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
              fontSize: 24, color: '#111827', letterSpacing: '0.06em',
            }}>
              ESPORTS ELITE
            </div>
          </div>

          <div style={{ width: '100%', maxWidth: 420 }}>
            <AnimatePresence mode="wait">
              {mode === 'signin' ? (
                <motion.div
                  key="signin"
                  initial={{ opacity: 0, height: 'auto' }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
    }}>
      {children}
    </div>
  )
}

function GoogleButton({ onClick, disabled }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className="ee-btn-google"
    >
      <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
        <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.83v2.07A8 8 0 0 0 8.98 17z"/>
        <path fill="#FBBC05" d="M4.51 10.52A4.8 4.8 0 0 1 4.26 9c0-.52.09-1.02.25-1.52V5.41H1.83a8 8 0 0 0 0 7.18l2.68-2.07z"/>
        <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.48c.64-1.87 2.4-3.9 4.48-3.9z"/>
      </svg>
      Continue with Google
    </button>
  )
}

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
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginBottom: 28 }}
      >
        <h2 style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
          fontSize: 36, color: '#111827', letterSpacing: '0.02em',
          marginBottom: 6, lineHeight: 1.1,
        }}>
          Welcome back
        </h2>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: '#536174', lineHeight: 1.5 }}>
          Sign in to your account
        </p>
      </motion.div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Email field */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <label className="ee-label">Username / Email</label>
          <input
            ref={emailInputRef} type="text"
            value={username}
            onChange={e => { setUsername(e.target.value); clearFieldError('email') }}
            onAnimationStart={e => { if (e.animationName === 'autofillDetect') { setUsername(e.target.value); clearFieldError('email') } }}
            className={`ee-input${errors.email ? ' ee-input-error' : ''}`}
            placeholder="Enter your email"
            autoComplete="username"
          />
          {errors.email && (
            <div style={{ color: '#FF1838', fontSize: 12, marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
              {errors.email}
            </div>
          )}
        </motion.div>

        {/* Password field */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <label className="ee-label">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); clearFieldError('password') }}
              onAnimationStart={e => { if (e.animationName === 'autofillDetect') { setPassword(e.target.value); clearFieldError('password') } }}
              className={`ee-input${errors.password ? ' ee-input-error' : ''}`}
              style={{ paddingRight: 44 }}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
            <button
              type="button" onClick={() => setShowPass(v => !v)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#9CA3AF', padding: 6, display: 'flex', alignItems: 'center',
                transition: 'color 150ms',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#536174'}
              onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}
              tabIndex={-1}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <div style={{ color: '#FF1838', fontSize: 12, marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
              {errors.password}
            </div>
          )}

          {/* Forgot password link */}
          {!showForgotForm && !forgotSuccess && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                onClick={openForgotForm}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  cursor: 'pointer', color: '#1769FF',
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 400, fontSize: 13,
                  textDecoration: 'none',
                  transition: 'text-decoration 150ms',
                }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
              >
                Forgot password?
              </button>
            </div>
          )}

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
                  marginTop: 10,
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
                  className="ee-input"
                  placeholder="your@email.com"
                  autoComplete="email"
                  style={{ marginBottom: forgotError ? 6 : 10 }}
                />
                {forgotError && (
                  <div style={{ color: '#FF1838', fontSize: 12, marginBottom: 10, fontFamily: "'Inter', sans-serif" }}>
                    {forgotError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => onForgot(forgotEmail)}
                    disabled={forgotLoading}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #1769FF, #1254CC)',
                      color: '#FFFFFF',
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 600, fontSize: 13,
                      padding: '10px 12px',
                      borderRadius: 8, border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      opacity: forgotLoading ? 0.7 : 1,
                      transition: 'opacity 200ms',
                    }}
                  >
                    {forgotLoading
                      ? <><Loader size={13} style={{ animation: 'ee-spin 1s linear infinite' }} /> Sending…</>
                      : 'Send Reset Link'}
                  </button>
                  <button
                    type="button"
                    onClick={closeForgotForm}
                    disabled={forgotLoading}
                    className="ee-btn-secondary-sm"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success message */}
          <AnimatePresence>
            {forgotSuccess && (
              <motion.div
                key="forgot-success"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  marginTop: 10,
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
                  type="button"
                  onClick={closeForgotForm}
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

        <ErrorBox>{errors.form}</ErrorBox>

        {/* Remember me */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}
        >
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            color: '#536174', cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
          }}>
            <input
              type="checkbox" checked={remember}
              onChange={e => setRemember(e.target.checked)}
              style={{ accentColor: '#1769FF', width: 15, height: 15 }}
            />
            Remember me
          </label>
        </motion.div>

        {/* Sign in button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.button
            type="submit" disabled={submitting}
            whileHover={{ scale: submitting ? 1 : 1.01 }}
            whileTap={{ scale: submitting ? 1 : 0.98 }}
            style={{
              background: 'linear-gradient(135deg, #1769FF, #1254CC)',
              color: '#FFFFFF',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 900, fontSize: 18, letterSpacing: '0.04em',
              padding: '14px',
              borderRadius: 8, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
              width: '100%',
              opacity: submitting ? 0.7 : 1,
              transition: 'opacity 200ms',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {submitting
              ? <><Loader size={16} style={{ animation: 'ee-spin 1s linear infinite' }} /> Signing in…</>
              : 'Sign in'}
          </motion.button>
        </motion.div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#DCE4EF' }} />
          <span style={{ fontSize: 12, color: '#9CA3AF', fontFamily: "'Inter', sans-serif" }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#DCE4EF' }} />
        </div>

        <GoogleButton onClick={onGoogleSignIn} disabled={submitting} />

        <p style={{ textAlign: 'center', fontSize: 14, color: '#536174', marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
          New here?{' '}
          <a
            href="#" onClick={e => { e.preventDefault(); onGetStarted() }}
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

function SignUpView({
  suUsername, setSuUsername, suEmail, setSuEmail, suPhone, setSuPhone,
  suPassword, setSuPassword, suConfirm, setSuConfirm,
  showSuPass, setShowSuPass, showSuConfirm, setShowSuConfirm,
  errors, clearFieldError, submitting, onSubmit, onBackToSignIn, onGoogleSignIn,
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginBottom: 24 }}
      >
        <button
          type="button" onClick={onBackToSignIn}
          style={{
            padding: '4px 0', background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: 13, color: '#536174', display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: "'Inter', sans-serif",
            transition: 'color 150ms',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#1769FF'}
          onMouseLeave={e => e.currentTarget.style.color = '#536174'}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h2 style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
          fontSize: 36, color: '#111827', letterSpacing: '0.02em',
          marginTop: 10, marginBottom: 6, lineHeight: 1.1,
        }}>
          Create account
        </h2>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: '#536174', lineHeight: 1.5 }}>
          Set up your training account
        </p>
      </motion.div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field
          label="Username" placeholder="Choose a display name" autoComplete="username"
          value={suUsername} onChange={(v) => { setSuUsername(v); clearFieldError('username') }}
          error={errors.username} delay={0.25}
        />
        <Field
          label="Email" type="email" placeholder="you@example.com" autoComplete="email"
          value={suEmail} onChange={(v) => { setSuEmail(v); clearFieldError('email') }}
          error={errors.email} delay={0.3}
        />
        <Field
          label="Phone number" type="tel" placeholder="+91 98765 43210" autoComplete="tel"
          value={suPhone} onChange={(v) => { setSuPhone(v); clearFieldError('phone') }}
          error={errors.phone} delay={0.32}
        />
        <PasswordField
          label="Password" placeholder="At least 6 characters" autoComplete="new-password"
          value={suPassword} onChange={(v) => { setSuPassword(v); clearFieldError('password') }}
          show={showSuPass} setShow={setShowSuPass}
          error={errors.password} delay={0.34}
        />
        <PasswordField
          label="Confirm password" placeholder="Re-enter your password" autoComplete="new-password"
          value={suConfirm} onChange={(v) => { setSuConfirm(v); clearFieldError('confirmPassword') }}
          show={showSuConfirm} setShow={setShowSuConfirm}
          error={errors.confirmPassword} delay={0.36}
        />

        <ErrorBox>{errors.form}</ErrorBox>

        <motion.button
          type="submit" disabled={submitting}
          whileHover={{ scale: submitting ? 1 : 1.01 }}
          whileTap={{ scale: submitting ? 1 : 0.98 }}
          style={{
            background: 'linear-gradient(135deg, #1769FF, #1254CC)',
            color: '#FFFFFF',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900, fontSize: 18, letterSpacing: '0.04em',
            padding: '14px',
            borderRadius: 8, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
            width: '100%',
            opacity: submitting ? 0.7 : 1,
            transition: 'opacity 200ms',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {submitting
            ? <><Loader size={16} style={{ animation: 'ee-spin 1s linear infinite' }} /> Creating…</>
            : 'Create account'}
        </motion.button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#DCE4EF' }} />
          <span style={{ fontSize: 12, color: '#9CA3AF', fontFamily: "'Inter', sans-serif" }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#DCE4EF' }} />
        </div>

        <GoogleButton onClick={onGoogleSignIn} disabled={submitting} />

        <p style={{ textAlign: 'center', fontSize: 14, color: '#536174', marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
          Already have an account?{' '}
          <a
            href="#" onClick={e => { e.preventDefault(); onBackToSignIn() }}
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

function Field({ label, value, onChange, placeholder, type, autoComplete, error, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <label className="ee-label">{label}</label>
      <input
        type={type || 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`ee-input${error ? ' ee-input-error' : ''}`}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      {error && (
        <div style={{ color: '#FF1838', fontSize: 12, marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
          {error}
        </div>
      )}
    </motion.div>
  )
}

function PasswordField({ label, value, onChange, show, setShow, placeholder, autoComplete, error, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <label className="ee-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`ee-input${error ? ' ee-input-error' : ''}`}
          style={{ paddingRight: 44 }}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button" onClick={() => setShow(v => !v)}
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#9CA3AF', padding: 6, display: 'flex', alignItems: 'center',
            transition: 'color 150ms',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#536174'}
          onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}
          tabIndex={-1}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && (
        <div style={{ color: '#FF1838', fontSize: 12, marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
          {error}
        </div>
      )}
    </motion.div>
  )
}
