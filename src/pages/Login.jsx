import { useRef, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft, ArrowRight } from 'lucide-react'
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
        xp: 0, level: 0,
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
         Firebase user before the dashboard mounts. */
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
      window.location.href = '/dashboard'
    } catch (error) {
      if (error?.code !== 'auth/popup-closed-by-user') setFieldError('form', 'Google sign in failed. Try again.')
    } finally { setSubmitting(false) }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--obsidian)',
        display: 'flex',
        color: 'var(--ivory)',
      }}
    >
      {/* Left panel — 55% video background on desktop, hidden on mobile */}
      <aside
        className="login-hero"
        style={{
          position: 'relative',
          width: '55%',
          overflow: 'hidden',
          background: 'var(--graphite)',
        }}
      >
        {/* Video falls back gracefully to the poster / flat bg if
            /assets/login-bg.mp4 isn't present. */}
        <video
          autoPlay
          muted
          loop
          playsInline
          poster="/assets/logo.png"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 1,
            opacity: 0.55,
          }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        >
          <source src="/assets/login-bg.mp4" type="video/mp4" />
        </video>

        {/* Dark overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.85) 100%)',
            zIndex: 2,
          }}
        />

        {/* Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 3,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 48,
            textAlign: 'center',
          }}
        >
          {!logoFailed && (
            <img
              src="/assets/logo.png"
              alt="Esports Elite"
              style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: 28 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; setLogoFailed(true) }}
            />
          )}
          <h1
            style={{
              fontFamily: "'Oxanium', sans-serif",
              fontWeight: 800,
              fontSize: 'clamp(28px, 3vw, 42px)',
              color: '#ffffff',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              margin: 0,
              maxWidth: 560,
              lineHeight: 1.1,
            }}
          >
            Where grind becomes greatness
          </h1>
          <div
            style={{
              marginTop: 16,
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              color: 'var(--gold)',
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Train · Analyze · Dominate
          </div>
        </div>
      </aside>

      {/* Right panel — 45% form */}
      <main
        className="login-form-panel"
        style={{
          width: '45%',
          background: 'var(--graphite)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <div style={{ width: '100%', maxWidth: 380 }}>
          {mode === 'signin' ? (
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
          ) : (
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
          )}
        </div>
      </main>

      <style>{`
        @media (max-width: 899px) {
          .login-hero { display: none; }
          .login-form-panel { width: 100% !important; background: var(--obsidian) !important; }
        }
      `}</style>
    </div>
  )
}

/* ============================================================
   SIGN IN
   ============================================================ */
function SignInView({
  username, setUsername, password, setPassword,
  showPass, setShowPass, remember, setRemember,
  errors, clearFieldError, submitting,
  forgotLoading, forgotSuccess, emailInputRef,
  onSubmit, onForgot, onGetStarted, onGoogleSignIn,
}) {
  return (
    <>
      <div style={{ marginBottom: 26 }}>
        <h2 style={h2Style}>Welcome Back</h2>
        <p style={subStyle}>Sign in to your account</p>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FieldWrap label="Email">
          <input
            ref={emailInputRef} type="text"
            value={username}
            onChange={e => { setUsername(e.target.value); clearFieldError('email') }}
            style={inputStyle}
            placeholder="you@example.com"
            autoComplete="username"
          />
          {errors.email && !forgotSuccess && <ErrorLine>{errors.email}</ErrorLine>}
          {forgotSuccess && (
            <div style={{ color: 'var(--success)', fontSize: 12, marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
              Reset link sent. Check your inbox.
            </div>
          )}
        </FieldWrap>

        <FieldWrap label="Password">
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); clearFieldError('password') }}
              style={{ ...inputStyle, paddingRight: 40 }}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShowPass(v => !v)} style={eyeBtnStyle} tabIndex={-1}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <ErrorLine>{errors.password}</ErrorLine>}
        </FieldWrap>

        <ErrorBox>{errors.form}</ErrorBox>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontFamily: "'Inter', sans-serif" }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--muted)', cursor: 'pointer' }}>
            <input
              type="checkbox" checked={remember}
              onChange={e => setRemember(e.target.checked)}
              style={{ accentColor: 'var(--gold)' }}
            />
            Remember me
          </label>
          <button
            type="button" onClick={onForgot} disabled={forgotLoading}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--gold)', fontSize: 12, padding: 0,
              fontFamily: "'Inter', sans-serif", fontWeight: 500,
            }}
          >
            {forgotLoading ? 'Sending…' : 'Forgot password?'}
          </button>
        </div>

        <button type="submit" disabled={submitting} style={primaryBtnStyle}>
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>

        <Divider />

        <GoogleButton onClick={onGoogleSignIn} disabled={submitting} />

        <button
          type="button" onClick={onGetStarted} disabled={submitting}
          style={outlinedGoldBtnStyle}
        >
          Get Started <ArrowRight size={14} />
        </button>
      </form>
    </>
  )
}

/* ============================================================
   SIGN UP
   ============================================================ */
function SignUpView({
  suUsername, setSuUsername, suEmail, setSuEmail, suPhone, setSuPhone,
  suPassword, setSuPassword, suConfirm, setSuConfirm,
  showSuPass, setShowSuPass, showSuConfirm, setShowSuConfirm,
  errors, clearFieldError, submitting, onSubmit, onBackToSignIn, onGoogleSignIn,
}) {
  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <button
          type="button" onClick={onBackToSignIn}
          style={{
            padding: '4px 0', background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h2 style={{ ...h2Style, marginTop: 12 }}>Create Account</h2>
        <p style={subStyle}>Set up your training account</p>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FieldWrap label="Username">
          <input
            type="text" value={suUsername}
            onChange={e => { setSuUsername(e.target.value); clearFieldError('username') }}
            style={inputStyle}
            placeholder="Choose a display name"
            autoComplete="username"
          />
          {errors.username && <ErrorLine>{errors.username}</ErrorLine>}
        </FieldWrap>

        <FieldWrap label="Email">
          <input
            type="email" value={suEmail}
            onChange={e => { setSuEmail(e.target.value); clearFieldError('email') }}
            style={inputStyle}
            placeholder="you@example.com"
            autoComplete="email"
          />
          {errors.email && <ErrorLine>{errors.email}</ErrorLine>}
        </FieldWrap>

        <FieldWrap label="Phone">
          <input
            type="tel" value={suPhone}
            onChange={e => { setSuPhone(e.target.value); clearFieldError('phone') }}
            style={inputStyle}
            placeholder="+91 98765 43210"
            autoComplete="tel"
          />
          {errors.phone && <ErrorLine>{errors.phone}</ErrorLine>}
        </FieldWrap>

        <FieldWrap label="Password">
          <div style={{ position: 'relative' }}>
            <input
              type={showSuPass ? 'text' : 'password'}
              value={suPassword}
              onChange={e => { setSuPassword(e.target.value); clearFieldError('password') }}
              style={{ ...inputStyle, paddingRight: 40 }}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowSuPass(v => !v)} style={eyeBtnStyle} tabIndex={-1}>
              {showSuPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <ErrorLine>{errors.password}</ErrorLine>}
        </FieldWrap>

        <FieldWrap label="Confirm password">
          <div style={{ position: 'relative' }}>
            <input
              type={showSuConfirm ? 'text' : 'password'}
              value={suConfirm}
              onChange={e => { setSuConfirm(e.target.value); clearFieldError('confirmPassword') }}
              style={{ ...inputStyle, paddingRight: 40 }}
              placeholder="Re-enter your password"
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowSuConfirm(v => !v)} style={eyeBtnStyle} tabIndex={-1}>
              {showSuConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmPassword && <ErrorLine>{errors.confirmPassword}</ErrorLine>}
        </FieldWrap>

        <ErrorBox>{errors.form}</ErrorBox>

        <button type="submit" disabled={submitting} style={primaryBtnStyle}>
          {submitting ? 'Creating…' : 'Create Account'}
        </button>

        <Divider />

        <GoogleButton onClick={onGoogleSignIn} disabled={submitting} />

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
          Already have an account?{' '}
          <a
            href="#" onClick={e => { e.preventDefault(); onBackToSignIn() }}
            style={{ color: 'var(--gold)', fontWeight: 600 }}
          >
            Sign in
          </a>
        </p>
      </form>
    </>
  )
}

/* ============================================================
   PRIMITIVES
   ============================================================ */
function FieldWrap({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: 'var(--ivory)',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

function ErrorLine({ children }) {
  return (
    <span style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
      {children}
    </span>
  )
}

function ErrorBox({ children }) {
  if (!children) return null
  return (
    <div
      style={{
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid var(--danger)',
        color: 'var(--danger)',
        padding: '10px 12px',
        borderRadius: 6,
        fontSize: 13,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {children}
    </div>
  )
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'Inter', sans-serif", letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        Or
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

function GoogleButton({ onClick, disabled }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={{
        width: '100%',
        minHeight: 44,
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 6,
        color: 'var(--ivory)',
        fontFamily: "'Inter', sans-serif",
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'border-color 0.15s ease, color 0.15s ease',
      }}
      onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--ivory)' }}
      onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
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

/* ============================================================
   STYLE CONSTANTS
   ============================================================ */
const h2Style = {
  fontFamily: "'Oxanium', sans-serif",
  fontWeight: 700,
  fontSize: 28,
  color: 'var(--ivory)',
  letterSpacing: '0.02em',
  margin: 0,
}
const subStyle = {
  fontFamily: "'Inter', sans-serif",
  fontSize: 13,
  color: 'var(--muted)',
  marginTop: 6,
  margin: 0,
}
const inputStyle = {
  width: '100%',
  height: 44,
  padding: '0 12px',
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--ivory)',
  fontFamily: "'Inter', sans-serif",
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.15s ease',
  boxSizing: 'border-box',
}
const eyeBtnStyle = {
  position: 'absolute',
  right: 8,
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--muted)',
  padding: 6,
  display: 'flex',
}
const primaryBtnStyle = {
  width: '100%',
  minHeight: 46,
  background: 'var(--gold)',
  color: 'var(--obsidian)',
  border: 'none',
  borderRadius: 6,
  fontFamily: "'Oxanium', sans-serif",
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'background 0.15s ease',
}
const outlinedGoldBtnStyle = {
  width: '100%',
  minHeight: 44,
  background: 'transparent',
  border: '1px solid var(--gold)',
  borderRadius: 6,
  color: 'var(--gold)',
  fontFamily: "'Oxanium', sans-serif",
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
}
