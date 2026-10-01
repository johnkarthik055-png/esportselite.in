import { useRef, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Eye, EyeOff, ArrowLeft, Loader,
  Mail, Lock, BarChart2, Target, Users, ArrowRight,
  User, Phone,
} from 'lucide-react'
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

/* ─── Local auth helpers ──────────────────────────────────────────────────── */
const LOCAL_USERS_KEY   = 'esportselite_users'
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
  if (code === 'auth/user-not-found')  return { field: 'email',  message: 'No account with this email' }
  if (code === 'auth/invalid-email')   return { field: 'email',  message: 'Enter a valid email address' }
  if (code === 'auth/user-disabled')   return { field: 'form',   message: 'This account has been disabled' }
  if (code === 'auth/too-many-requests') return { field: 'form', message: 'Too many attempts. Try again later.' }
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

/* ─── Global styles ───────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  @keyframes autofillDetect{from{opacity:1}to{opacity:1}}
  input:-webkit-autofill{animation-name:autofillDetect;animation-duration:1ms}
  @keyframes ee-spin{to{transform:rotate(360deg)}}

  .ee-layout {
    display:flex; flex-direction:row; min-height:100vh; background:#F0F4FF;
  }
  .ee-left {
    flex:0 0 55%; display:flex; flex-direction:column; justify-content:center;
    padding:48px 48px; overflow:hidden; position:relative; min-height:100vh;
    background:#FFFFFF;
  }
  .ee-right {
    flex:0 0 45%; display:flex; flex-direction:column;
    justify-content:center; align-items:center;
    padding:48px 56px; background:#FFFFFF; min-height:100vh; position:relative;
    overflow-y:auto; border-left:1px solid rgba(23,105,255,0.12);
  }
  .ee-mobile-logo { display:none; }
  .ee-topbar-right { display:flex; }

  @media(max-width:768px){
    .ee-layout { flex-direction:column; }
    .ee-left { display:none !important; }
    .ee-right { flex:1; width:100%; padding:32px 24px !important; }
    .ee-topbar-right { display:none !important; }
    .ee-mobile-logo { display:flex !important; }
  }

  .ee-inp {
    width:100%; background:#F7F9FC;
    border:1.5px solid #DCE4EF; border-radius:10px;
    padding:13px 16px 13px 42px;
    font-size:15px; font-family:'Inter',sans-serif; color:#111827;
    box-sizing:border-box; outline:none;
    transition:border-color 200ms,box-shadow 200ms,background 200ms;
  }
  .ee-inp.no-icon { padding-left:16px; }
  .ee-inp::placeholder { color:#9CA3AF; }
  .ee-inp:focus {
    border-color:#1769FF; background:#FFFFFF;
    box-shadow:0 0 0 3px rgba(23,105,255,0.1);
  }
  .ee-inp.err { border-color:#FF1838; }

  .ee-lbl {
    display:block;
    font-family:'Rajdhani',sans-serif; font-weight:600;
    font-size:11px; color:#536174;
    letter-spacing:0.1em; text-transform:uppercase;
    margin-bottom:8px;
  }

  .ee-g-btn {
    width:100%; background:#FFFFFF;
    border:1.5px solid #DCE4EF; border-radius:10px;
    padding:13px; font-family:'Inter',sans-serif;
    font-weight:600; font-size:15px; color:#111827;
    display:flex; align-items:center; justify-content:center; gap:10px;
    cursor:pointer;
    transition:background 200ms,border-color 200ms,box-shadow 200ms;
  }
  .ee-g-btn:hover:not(:disabled) {
    background:#F7F9FC; border-color:#1769FF;
    box-shadow:0 2px 8px rgba(0,0,0,0.06);
  }
  .ee-g-btn:disabled { opacity:0.6; cursor:not-allowed; }

  .ee-sec-btn {
    background:#F7F9FC; border:1.5px solid #DCE4EF;
    color:#536174; font-family:'Inter',sans-serif;
    font-size:13px; padding:10px 16px; border-radius:8px;
    cursor:pointer; white-space:nowrap;
    transition:background 200ms,border-color 200ms;
  }
  .ee-sec-btn:hover:not(:disabled) { background:#EEF2F7; border-color:#B0BEC5; }
`

const HEADING_WORDS = ['WHERE', 'GRIND', 'BECOMES', 'GREATNESS.']
const FEATURE_ITEMS = [
  { Icon: BarChart2, label: 'TRACK',   sub: 'Your Progress' },
  { Icon: Target,    label: 'IMPROVE', sub: 'With AI Coaching' },
  { Icon: Users,     label: 'CLIMB',   sub: 'With Your Squad' },
]

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState(location.state?.signup ? 'signup' : 'signin')
  useEffect(() => { if (location.state?.signup) setMode('signup') }, [location.state])

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

  const [suUsername, setSuUsername]         = useState('')
  const [suEmail, setSuEmail]               = useState('')
  const [suPhone, setSuPhone]               = useState('')
  const [suPassword, setSuPassword]         = useState('')
  const [suConfirm, setSuConfirm]           = useState('')
  const [showSuPass, setShowSuPass]         = useState(false)
  const [showSuConfirm, setShowSuConfirm]   = useState(false)

  const [errors, setErrors]         = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError,   setForgotError]   = useState('')

  function setFieldError(field, message) { setErrors(prev => ({ ...prev, [field]: message })) }
  function clearFieldError(field) { setErrors(prev => { const n = { ...prev }; delete n[field]; return n }) }
  function clearAllErrors() { setErrors({}) }

  function switchToSignUp() { clearAllErrors(); setForgotSuccess(false); setForgotError(''); setMode('signup') }
  function switchToSignIn() { clearAllErrors(); setForgotSuccess(false); setForgotError(''); setMode('signin') }

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
      const code = error?.code
      if (code === 'auth/popup-blocked') {
        setFieldError('form', 'Popup was blocked. Please allow popups for this site and try again.')
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // user dismissed — no error message needed
      } else {
        setFieldError('form', 'Google sign in failed. Please try again.')
      }
    } finally { setSubmitting(false) }
  }

  return (
    <PageTransition>
      <style>{GLOBAL_CSS}</style>

      <div className="ee-layout">

        {/* ════════════════════════════════════════
            LEFT PANEL — flex column, no absolute positioning
        ════════════════════════════════════════ */}
        <motion.div
          className="ee-left"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Glow effects — absolute, behind content */}
          <div style={{ position: 'absolute', top: -100, left: -100, width: 500, height: 500, background: 'radial-gradient(circle, rgba(23,105,255,0.12) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />
          <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, background: 'radial-gradient(circle, rgba(255,24,56,0.08) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />
          <div style={{ position: 'absolute', bottom: -80, left: '50%', transform: 'translateX(-50%)', width: 400, height: 400, background: 'radial-gradient(circle, rgba(113,55,255,0.07) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(23,105,255,0.07) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none', zIndex: 0 }} />

          {/* Content wrapper — above glows */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* 1. Logo — floating animation, centered */}
          <motion.img
            src="/assets/logo.png" alt="Esports Elite"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ height: 130, width: 'auto', display: 'block', margin: '0 auto 28px auto', objectFit: 'contain', filter: 'drop-shadow(0 0 20px rgba(23,105,255,0.25)) drop-shadow(0 0 40px rgba(255,24,56,0.15))' }}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />

          {/* 2. Platform pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ width: 6, height: 6, background: '#1769FF', borderRadius: '50%', flexShrink: 0, boxShadow: '0 0 6px #1769FF' }} />
            <span style={{
              fontFamily: "'Rajdhani', sans-serif", fontWeight: 600,
              fontSize: 11, color: '#536174', letterSpacing: '0.14em', textTransform: 'uppercase',
            }}>
              INDIA'S #1 BGMI TRAINING PLATFORM
            </span>
          </div>

          {/* 3. Heading block */}
          <div style={{ marginBottom: 20 }}>
            {HEADING_WORDS.map((word, i) => (
              <motion.div
                key={word}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05, ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
              >
                {word === 'GRIND' ? (
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                    fontSize: 56, lineHeight: 0.9, display: 'block',
                    background: 'linear-gradient(90deg, #1769FF, #7137FF, #FF1838)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                    {word}
                  </span>
                ) : (
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                    fontSize: 56, color: '#111827', lineHeight: 0.9, display: 'block',
                  }}>
                    {word}
                  </span>
                )}
              </motion.div>
            ))}
            <div style={{ width: 64, height: 3, background: 'linear-gradient(90deg, #1769FF, #FF1838)', borderRadius: 2, marginTop: 16, marginBottom: 20 }} />
          </div>

          {/* 4. Description */}
          <p style={{
            fontFamily: "'Inter', sans-serif", fontSize: 15, color: '#536174',
            lineHeight: 1.65, maxWidth: 320, margin: '0 0 32px',
          }}>
            Sign in to continue your training journey with AI coaching, structured roadmaps and real-time match analytics.
          </p>

          {/* 5. Feature icons row */}
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {FEATURE_ITEMS.map(({ Icon, label, sub }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'rgba(23,105,255,0.08)',
                  border: '1px solid rgba(23,105,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={20} color="#1769FF" />
                </div>
                <div style={{
                  fontFamily: "'Rajdhani', sans-serif", fontWeight: 600,
                  fontSize: 11, color: '#111827',
                  textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center',
                }}>
                  {label}
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#536174', textAlign: 'center' }}>
                  {sub}
                </div>
              </div>
            ))}
          </div>

          </div>{/* end content wrapper */}
        </motion.div>

        {/* ════════════════════════════════════════
            RIGHT PANEL
        ════════════════════════════════════════ */}
        <motion.div
          className="ee-right"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Right panel subtle tints */}
          <div style={{ position: 'absolute', top: 0, right: 0, width: 300, height: 300, background: 'radial-gradient(circle at top right, rgba(23,105,255,0.05), transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: 200, height: 200, background: 'radial-gradient(circle at bottom left, rgba(255,24,56,0.04), transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

          {/* Top-right strip — absolute inside right panel */}
          <div
            className="ee-topbar-right"
            style={{ position: 'absolute', top: 24, right: 24, alignItems: 'center', gap: 12, zIndex: 1 }}
          >
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: '#536174' }}>
              {mode === 'signin' ? 'New to Esports Elite?' : 'Already have an account?'}
            </span>
            <button
              onClick={mode === 'signin' ? switchToSignUp : switchToSignIn}
              style={{
                border: '1.5px solid #1769FF', color: '#1769FF',
                fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14,
                padding: '8px 18px', borderRadius: 8, background: 'transparent',
                cursor: 'pointer', transition: 'background 200ms, color 200ms',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1769FF'; e.currentTarget.style.color = '#FFFFFF' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#1769FF' }}
            >
              {mode === 'signin' ? 'Create account' : 'Sign in'} →
            </button>
          </div>

          {/* Mobile logo */}
          <div className="ee-mobile-logo" style={{ justifyContent: 'center', marginBottom: 24 }}>
            <img
              src="/assets/logo.png" alt="Esports Elite"
              style={{ height: 48, width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto' }}
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
          </div>

          {/* Form area */}
          <div style={{ width: '100%', maxWidth: 400 }}>
            <AnimatePresence mode="wait">
              {mode === 'signin' ? (
                <motion.div
                  key="signin"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
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
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
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

/* ─── Shared utilities ────────────────────────────────────────────────────── */

function ErrorBox({ children }) {
  if (!children) return null
  return (
    <div style={{
      background: 'rgba(255,24,56,0.06)', border: '1px solid rgba(255,24,56,0.2)',
      color: '#FF1838', padding: '10px 14px', borderRadius: 8,
      fontSize: 13, fontFamily: "'Inter', sans-serif", lineHeight: 1.5, marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

function FieldError({ children }) {
  if (!children) return null
  return (
    <div style={{ color: '#FF1838', fontSize: 12, marginTop: 5, fontFamily: "'Inter', sans-serif", lineHeight: 1.4 }}>
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

function InputIcon({ icon: Icon }) {
  return (
    <Icon size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
  )
}

/* ─── Sign-in view ────────────────────────────────────────────────────────── */

function SignInView({
  username, setUsername, password, setPassword,
  showPass, setShowPass, remember, setRemember,
  errors, clearFieldError, submitting,
  forgotLoading, forgotSuccess, forgotError, setForgotError, setForgotSuccess,
  emailInputRef, onSubmit, onForgot, onGetStarted, onGoogleSignIn,
}) {
  const [showForgotForm, setShowForgotForm] = useState(false)
  const [forgotEmail, setForgotEmail]       = useState('')

  function openForgotForm() { setForgotEmail(username.trim()); setForgotError(''); setForgotSuccess(false); setShowForgotForm(true) }
  function closeForgotForm() { setShowForgotForm(false); setForgotEmail(''); setForgotError(''); setForgotSuccess(false) }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} style={{ marginBottom: 20 }}>
        <span style={{
          display: 'inline-block', fontFamily: "'Rajdhani', sans-serif", fontWeight: 600,
          fontSize: 11, color: '#1769FF', border: '1px solid rgba(23,105,255,0.25)',
          borderRadius: 20, padding: '4px 14px', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          BGMI Training Platform
        </span>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 44, color: '#111827', lineHeight: 1, marginBottom: 6 }}>
          Welcome back
        </h1>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: '#536174', lineHeight: 1.5 }}>
          Sign in to continue your training
        </p>
      </motion.div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Email */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <label className="ee-lbl" htmlFor="si-email">Email</label>
          <div style={{ position: 'relative' }}>
            <InputIcon icon={Mail} />
            <input
              id="si-email" ref={emailInputRef} type="text" value={username}
              onChange={e => { setUsername(e.target.value); clearFieldError('email') }}
              onAnimationStart={e => { if (e.animationName === 'autofillDetect') { setUsername(e.target.value); clearFieldError('email') } }}
              className={`ee-inp${errors.email ? ' err' : ''}`}
              placeholder="Enter your email" autoComplete="username"
            />
          </div>
          <FieldError>{errors.email}</FieldError>
        </motion.div>

        {/* Password */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <label className="ee-lbl" htmlFor="si-password">Password</label>
          <div style={{ position: 'relative' }}>
            <InputIcon icon={Lock} />
            <input
              id="si-password" type={showPass ? 'text' : 'password'} value={password}
              onChange={e => { setPassword(e.target.value); clearFieldError('password') }}
              onAnimationStart={e => { if (e.animationName === 'autofillDetect') { setPassword(e.target.value); clearFieldError('password') } }}
              className={`ee-inp${errors.password ? ' err' : ''}`}
              style={{ paddingRight: 46 }} placeholder="Enter your password" autoComplete="current-password"
            />
            <button
              type="button" onClick={() => setShowPass(v => !v)} tabIndex={-1}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#536174', padding: 4, display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.color = '#111827'}
              onMouseLeave={e => e.currentTarget.style.color = '#536174'}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <FieldError>{errors.password}</FieldError>

          <AnimatePresence>
            {showForgotForm && !forgotSuccess && (
              <motion.div key="ff" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}
                style={{ marginTop: 12, padding: 14, background: '#F7F9FC', border: '1.5px solid #DCE4EF', borderRadius: 10 }}
              >
                <p style={{ fontSize: 12, color: '#536174', marginBottom: 10, lineHeight: 1.5, fontFamily: "'Inter', sans-serif" }}>
                  Enter your account email and we'll send a reset link.
                </p>
                <input type="email" value={forgotEmail} onChange={e => { setForgotEmail(e.target.value); setForgotError('') }}
                  className="ee-inp no-icon" placeholder="your@email.com" autoComplete="email"
                  style={{ marginBottom: forgotError ? 6 : 10 }}
                />
                {forgotError && <FieldError>{forgotError}</FieldError>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={() => onForgot(forgotEmail)} disabled={forgotLoading}
                    style={{ flex: 1, background: '#1769FF', color: '#FFFFFF', fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, padding: '10px 12px', borderRadius: 8, border: 'none', cursor: forgotLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: forgotLoading ? 0.7 : 1 }}
                  >
                    {forgotLoading ? <><Loader size={13} style={{ animation: 'ee-spin 1s linear infinite' }} /> Sending…</> : 'Send Reset Link'}
                  </button>
                  <button type="button" onClick={closeForgotForm} disabled={forgotLoading} className="ee-sec-btn">Cancel</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {forgotSuccess && (
              <motion.div key="fs" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, fontSize: 13, color: '#15803D', lineHeight: 1.5, fontFamily: "'Inter', sans-serif" }}
              >
                Reset link sent to <strong>{forgotEmail}</strong>. Check your inbox.
                <button type="button" onClick={closeForgotForm} style={{ display: 'block', marginTop: 6, background: 'none', border: 'none', padding: 0, color: '#536174', fontSize: 12, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                  Dismiss
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Remember + Forgot */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}
        >
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'Inter', sans-serif", fontSize: 14, color: '#536174', cursor: 'pointer' }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ accentColor: '#1769FF', width: 15, height: 15 }} />
            Remember me
          </label>
          {!showForgotForm && !forgotSuccess && (
            <button type="button" onClick={openForgotForm}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1769FF', fontFamily: "'Inter', sans-serif", fontSize: 13 }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
            >
              Forgot password?
            </button>
          )}
        </motion.div>

        <ErrorBox>{errors.form}</ErrorBox>

        {/* Sign in button */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <motion.button
            type="submit" disabled={submitting}
            whileHover={{ scale: submitting ? 1 : 1.01 }}
            whileTap={{ scale: submitting ? 1 : 0.99 }}
            style={{ width: '100%', background: submitting ? '#4A90D9' : 'linear-gradient(135deg, #1769FF 0%, #1254CC 100%)', color: '#FFFFFF', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: '0.04em', padding: 14, borderRadius: 10, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 250ms', boxShadow: submitting ? 'none' : '0 4px 24px rgba(23,105,255,0.35)' }}
            onMouseEnter={e => { if (!submitting) { e.currentTarget.style.boxShadow = '0 6px 32px rgba(23,105,255,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = submitting ? 'none' : '0 4px 24px rgba(23,105,255,0.35)'; e.currentTarget.style.transform = 'none' }}
          >
            {submitting ? <><Loader size={16} style={{ animation: 'ee-spin 1s linear infinite' }} /> Signing in…</> : <>Sign in <ArrowRight size={18} /></>}
          </motion.button>
        </motion.div>

        {/* OR divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#DCE4EF' }} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#9CA3AF', whiteSpace: 'nowrap' }}>or continue with</span>
          <div style={{ flex: 1, height: 1, background: '#DCE4EF' }} />
        </div>

        <GoogleButton onClick={onGoogleSignIn} />

        <p style={{ textAlign: 'center', marginTop: 8, fontFamily: "'Inter', sans-serif", fontSize: 14, color: '#536174' }}>
          New here?{' '}
          <a href="#" onClick={e => { e.preventDefault(); onGetStarted() }}
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
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} style={{ marginBottom: 20 }}>
        <span style={{ display: 'inline-block', fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: 11, color: '#1769FF', border: '1px solid rgba(23,105,255,0.25)', borderRadius: 20, padding: '4px 14px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          BGMI Training Platform
        </span>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} style={{ marginBottom: 28 }}>
        <button type="button" onClick={onBackToSignIn}
          style={{ background: 'transparent', border: 'none', padding: '0 0 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#536174' }}
          onMouseEnter={e => e.currentTarget.style.color = '#1769FF'}
          onMouseLeave={e => e.currentTarget.style.color = '#536174'}
        >
          <ArrowLeft size={14} /> Back to sign in
        </button>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 44, color: '#111827', lineHeight: 1, marginBottom: 6 }}>
          Create account
        </h1>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: '#536174', lineHeight: 1.5 }}>Start your training journey today</p>
      </motion.div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <IconField id="su-username" label="Username" placeholder="Choose a display name" autoComplete="username" icon={User} value={suUsername} delay={0.4} onChange={v => { setSuUsername(v); clearFieldError('username') }} error={errors.username} />
        <IconField id="su-email" label="Email" type="email" placeholder="you@example.com" autoComplete="email" icon={Mail} value={suEmail} delay={0.42} onChange={v => { setSuEmail(v); clearFieldError('email') }} error={errors.email} />
        <IconField id="su-phone" label="Phone number" type="tel" placeholder="+91 98765 43210" autoComplete="tel" icon={Phone} value={suPhone} delay={0.44} onChange={v => { setSuPhone(v); clearFieldError('phone') }} error={errors.phone} />
        <IconPwdField id="su-password" label="Password" placeholder="At least 6 characters" autoComplete="new-password" value={suPassword} show={showSuPass} setShow={setShowSuPass} delay={0.46} onChange={v => { setSuPassword(v); clearFieldError('password') }} error={errors.password} />
        <IconPwdField id="su-confirm" label="Confirm password" placeholder="Re-enter your password" autoComplete="new-password" value={suConfirm} show={showSuConfirm} setShow={setShowSuConfirm} delay={0.48} onChange={v => { setSuConfirm(v); clearFieldError('confirmPassword') }} error={errors.confirmPassword} />

        <ErrorBox>{errors.form}</ErrorBox>

        <motion.button
          type="submit" disabled={submitting}
          whileHover={{ scale: submitting ? 1 : 1.01 }}
          whileTap={{ scale: submitting ? 1 : 0.99 }}
          style={{ width: '100%', background: submitting ? '#4A90D9' : 'linear-gradient(135deg, #1769FF 0%, #1254CC 100%)', color: '#FFFFFF', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: '0.04em', padding: 14, borderRadius: 10, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 250ms', boxShadow: submitting ? 'none' : '0 4px 20px rgba(23,105,255,0.3)' }}
          onMouseEnter={e => { if (!submitting) { e.currentTarget.style.boxShadow = '0 6px 28px rgba(23,105,255,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = submitting ? 'none' : '0 4px 20px rgba(23,105,255,0.3)'; e.currentTarget.style.transform = 'none' }}
        >
          {submitting ? <><Loader size={16} style={{ animation: 'ee-spin 1s linear infinite' }} /> Creating…</> : <>Create account <ArrowRight size={18} /></>}
        </motion.button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#DCE4EF' }} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#9CA3AF', whiteSpace: 'nowrap' }}>or continue with</span>
          <div style={{ flex: 1, height: 1, background: '#DCE4EF' }} />
        </div>

        <GoogleButton onClick={onGoogleSignIn} />

        <p style={{ textAlign: 'center', marginTop: 8, fontFamily: "'Inter', sans-serif", fontSize: 14, color: '#536174' }}>
          Already have an account?{' '}
          <a href="#" onClick={e => { e.preventDefault(); onBackToSignIn() }}
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

function IconField({ id, label, value, onChange, placeholder, type, autoComplete, icon: Icon, error, delay = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, ease: [0.22, 1, 0.36, 1] }}>
      <label className="ee-lbl" htmlFor={id}>{label}</label>
      <div style={{ position: 'relative' }}>
        {Icon && <InputIcon icon={Icon} />}
        <input id={id} type={type || 'text'} value={value} onChange={e => onChange(e.target.value)}
          className={`ee-inp${!Icon ? ' no-icon' : ''}${error ? ' err' : ''}`}
          placeholder={placeholder} autoComplete={autoComplete}
        />
      </div>
      <FieldError>{error}</FieldError>
    </motion.div>
  )
}

function IconPwdField({ id, label, value, onChange, show, setShow, placeholder, autoComplete, error, delay = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, ease: [0.22, 1, 0.36, 1] }}>
      <label className="ee-lbl" htmlFor={id}>{label}</label>
      <div style={{ position: 'relative' }}>
        <InputIcon icon={Lock} />
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
          className={`ee-inp${error ? ' err' : ''}`}
          style={{ paddingRight: 46 }} placeholder={placeholder} autoComplete={autoComplete}
        />
        <button type="button" onClick={() => setShow(v => !v)} tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#536174', padding: 4, display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => e.currentTarget.style.color = '#111827'}
          onMouseLeave={e => e.currentTarget.style.color = '#536174'}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <FieldError>{error}</FieldError>
    </motion.div>
  )
}
