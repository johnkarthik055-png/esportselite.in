import { useRef, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
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
import { initTrial } from '../utils/trial.js'
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
  initTrial(uidVal)
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

  const [errors, setErrors]       = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [forgotLoading, setForgotLoading]   = useState(false)
  const [forgotSuccess, setForgotSuccess]   = useState(false)
  const [logoFailed, setLogoFailed]         = useState(false)

  function setFieldError(field, message) { setErrors(prev => ({ ...prev, [field]: message })) }
  function clearFieldError(field) { setErrors(prev => { const n = { ...prev }; delete n[field]; return n }) }
  function clearAllErrors() { setErrors({}) }

  function switchToSignUp() { clearAllErrors(); setForgotSuccess(false); setMode('signup') }
  function switchToSignIn()  { clearAllErrors(); setForgotSuccess(false); setMode('signin') }

  async function handleForgotPassword() {
    const emailValue = (username || '').trim()
    if (!emailValue) { setFieldError('email', 'Enter your email address first.'); emailInputRef.current?.focus(); return }
    if (!EMAIL_RE.test(emailValue)) { setFieldError('email', 'Enter a valid email address.'); emailInputRef.current?.focus(); return }
    clearFieldError('email'); setForgotLoading(true); setForgotSuccess(false)
    try {
      await sendPasswordResetEmail(auth, emailValue)
      setForgotSuccess(true)
    } catch (error) {
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/invalid-credential': setFieldError('email', 'No account found with this email.'); break
        case 'auth/invalid-email': setFieldError('email', 'Enter a valid email address.'); break
        case 'auth/too-many-requests': setFieldError('email', 'Too many attempts. Wait a few minutes.'); break
        case 'auth/network-request-failed': setFieldError('email', 'No internet. Check your connection.'); break
        default: setFieldError('email', 'Could not send reset email. Try again.')
      }
    } finally { setForgotLoading(false) }
  }

  async function handleSignIn(e) {
    e.preventDefault(); clearAllErrors(); setForgotSuccess(false)
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
      /* Hard redirect instead of navigate(): forces a full page
         reload so AuthContext re-initialises with the fresh
         Firebase user before the dashboard mounts. Prevents the
         race where /dashboard sees a stale user=null on the tick
         after successful sign-in. */
      window.location.href = '/dashboard'
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
      /* Hard redirect instead of navigate(): forces a full page
         reload so AuthContext re-initialises with the fresh
         Firebase user before the dashboard mounts. Prevents the
         race where /dashboard sees a stale user=null on the tick
         after successful sign-in. */
      window.location.href = '/dashboard'
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
      /* Hard redirect instead of navigate(): forces a full page
         reload so AuthContext re-initialises with the fresh
         Firebase user before the dashboard mounts. Prevents the
         race where /dashboard sees a stale user=null on the tick
         after successful sign-in. */
      window.location.href = '/dashboard'
    } catch (error) {
      if (error?.code !== 'auth/popup-closed-by-user') setFieldError('form', 'Google sign in failed. Try again.')
    } finally { setSubmitting(false) }
  }

  return (
    <PageTransition>
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg-base)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: 'linear-gradient(135deg, rgba(10,10,15,0.96) 0%, rgba(10,10,15,0.75) 100%)',
          }}
        />

        <Reveal direction="up" duration={0.7} style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 380 }}>
          <StaggerGroup
            staggerChildren={0.08}
            delayChildren={0.05}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              padding: '36px 32px',
              boxShadow: 'var(--shadow-modal)',
            }}
          >
            {/* Logo block */}
            <StaggerItem>
              <div style={{ textAlign: 'center', marginBottom: 26 }}>
                {!logoFailed && (
                  <img
                    src="/assets/logo.png" alt=""
                    style={{ width: 44, height: 44, objectFit: 'contain', margin: '0 auto 14px', display: 'block' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; setLogoFailed(true) }}
                  />
                )}
                <div
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif', fontWeight: 400,
                    fontSize: 26, color: 'var(--text-primary)',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}
                >
                  Esports Elite
                </div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-subtle)', marginTop: 4 }}>
                  Pro training for BGMI players
                </div>
              </div>
            </StaggerItem>

            <StaggerItem>
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
                      forgotLoading={forgotLoading} forgotSuccess={forgotSuccess}
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
            </StaggerItem>
          </StaggerGroup>
        </Reveal>
      </div>
    </PageTransition>
  )
}

function ErrorBox({ children }) {
  if (!children) return null
  return (
    <div
      style={{
        background: 'var(--red-ghost)',
        border: '1px solid rgba(232,0,28,0.2)',
        color: 'var(--red)',
        padding: '10px 12px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  )
}

function GoogleButton({ onClick, disabled }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className="btn btn-secondary"
      style={{ width: '100%', minHeight: 44 }}
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
  forgotLoading, forgotSuccess, emailInputRef,
  onSubmit, onForgot, onGetStarted, onGoogleSignIn,
}) {
  return (
    <>
      <div style={{ marginBottom: 22, textAlign: 'center' }}>
        <h2 className="heading" style={{ fontSize: 28, letterSpacing: '0.04em', marginBottom: 4 }}>Welcome back</h2>
        <p style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text-muted)', fontSize: 13 }}>Sign in to your account</p>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="label" style={{ display: 'block', marginBottom: 6 }}>Username / Email</label>
          <input
            ref={emailInputRef} type="text"
            value={username}
            onChange={e => { setUsername(e.target.value); clearFieldError('email') }}
            className="input" placeholder="Enter your email" autoComplete="username"
          />
          {errors.email && !forgotSuccess && (
            <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.email}</div>
          )}
          {forgotSuccess && (
            <div style={{ color: 'var(--green)', fontSize: 12, marginTop: 4 }}>
              Reset link sent. Check your inbox.
            </div>
          )}
        </div>

        <div>
          <label className="label" style={{ display: 'block', marginBottom: 6 }}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); clearFieldError('password') }}
              className="input" style={{ paddingRight: 40 }}
              placeholder="Enter your password" autoComplete="current-password"
            />
            <button
              type="button" onClick={() => setShowPass(v => !v)}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 6, display: 'flex',
              }}
              tabIndex={-1}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.password}</div>
          )}
        </div>

        <ErrorBox>{errors.form}</ErrorBox>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox" checked={remember}
              onChange={e => setRemember(e.target.checked)}
              style={{ accentColor: 'var(--red)' }}
            />
            Remember me
          </label>
          <button
            type="button" onClick={onForgot} disabled={forgotLoading}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 12, padding: 0,
            }}
          >
            {forgotLoading ? 'Sending…' : 'Forgot password?'}
          </button>
        </div>

        <button type="submit" disabled={submitting} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <GoogleButton onClick={onGoogleSignIn} disabled={submitting} />

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          New here?{' '}
          <a
            href="#" onClick={e => { e.preventDefault(); onGetStarted() }}
            style={{ color: 'var(--text-primary)', fontWeight: 600 }}
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
      <div style={{ marginBottom: 18 }}>
        <button
          type="button" onClick={onBackToSignIn}
          style={{
            padding: '4px 8px', background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h2 className="heading" style={{ fontSize: 28, letterSpacing: '0.04em', marginTop: 8, marginBottom: 4 }}>Create account</h2>
        <p style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text-muted)', fontSize: 13 }}>Set up your training account</p>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field
          label="Username" placeholder="Choose a display name" autoComplete="username"
          value={suUsername} onChange={(v) => { setSuUsername(v); clearFieldError('username') }}
          error={errors.username}
        />
        <Field
          label="Email" type="email" placeholder="you@example.com" autoComplete="email"
          value={suEmail} onChange={(v) => { setSuEmail(v); clearFieldError('email') }}
          error={errors.email}
        />
        <Field
          label="Phone number" type="tel" placeholder="+91 98765 43210" autoComplete="tel"
          value={suPhone} onChange={(v) => { setSuPhone(v); clearFieldError('phone') }}
          error={errors.phone}
        />
        <PasswordField
          label="Password" placeholder="At least 6 characters" autoComplete="new-password"
          value={suPassword} onChange={(v) => { setSuPassword(v); clearFieldError('password') }}
          show={showSuPass} setShow={setShowSuPass}
          error={errors.password}
        />
        <PasswordField
          label="Confirm password" placeholder="Re-enter your password" autoComplete="new-password"
          value={suConfirm} onChange={(v) => { setSuConfirm(v); clearFieldError('confirmPassword') }}
          show={showSuConfirm} setShow={setShowSuConfirm}
          error={errors.confirmPassword}
        />

        <ErrorBox>{errors.form}</ErrorBox>

        <button type="submit" disabled={submitting} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
          {submitting ? 'Creating…' : 'Create account'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <GoogleButton onClick={onGoogleSignIn} disabled={submitting} />

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Already have an account?{' '}
          <a
            href="#" onClick={e => { e.preventDefault(); onBackToSignIn() }}
            style={{ color: 'var(--text-primary)', fontWeight: 600 }}
          >
            Sign in
          </a>
        </p>
      </form>
    </>
  )
}

function Field({ label, value, onChange, placeholder, type, autoComplete, error }) {
  return (
    <div>
      <label className="label" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
      <input
        type={type || 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      {error && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  )
}

function PasswordField({ label, value, onChange, show, setShow, placeholder, autoComplete, error }) {
  return (
    <div>
      <label className="label" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input"
          style={{ paddingRight: 40 }}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button" onClick={() => setShow(v => !v)}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 6, display: 'flex',
          }}
          tabIndex={-1}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  )
}
