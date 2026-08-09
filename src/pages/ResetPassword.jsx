/*
 * SETUP REQUIRED in Firebase Console:
 *
 * 1. Go to Firebase Console →
 *    Authentication → Templates
 * 2. Click "Password Reset" → Edit
 * 3. Under "Action URL" change to:
 *    https://esportselite.in/reset-password
 * 4. For localhost testing, also add:
 *    http://localhost:5173 to
 *    Authentication → Settings →
 *    Authorized domains
 * 5. The email template HTML is in
 *    FIREBASE_EMAIL_TEMPLATE.html
 *    at the project root — paste the
 *    body content into Firebase's
 *    email editor.
 */

import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  verifyPasswordResetCode, confirmPasswordReset,
} from 'firebase/auth'
import {
  Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ArrowRight,
} from 'lucide-react'
import { auth } from '../utils/firebase.js'

/**
 * Public route: /reset-password (and /__/auth/action).
 * Reads oobCode from the URL, verifies it via Firebase Auth, then
 * lets the user set a new password. Wraps the four canonical states
 * (verifying / valid / invalid / success) in one component.
 */
export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const oobCode = params.get('oobCode') || ''
  const mode = params.get('mode') || 'resetPassword'

  const [state, setState] = useState('verifying')  /* verifying | valid | invalid | success */
  const [email, setEmail] = useState('')
  const [errMsg, setErrMsg] = useState('')
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function verify() {
      if (!oobCode) { setState('invalid'); setErrMsg('Missing reset code.'); return }
      if (mode && mode !== 'resetPassword') {
        /* Firebase's action page also handles email-verification, sign-in
           links, etc. For anything other than a password reset, bail out. */
        setState('invalid')
        setErrMsg('This link is not a password-reset link.')
        return
      }
      try {
        const em = await verifyPasswordResetCode(auth, oobCode)
        if (cancelled) return
        setEmail(em || '')
        setState('valid')
      } catch (e) {
        if (cancelled) return
        setState('invalid')
        setErrMsg(mapAuthError(e))
      }
    }
    verify()
    return () => { cancelled = true }
  }, [oobCode, mode])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        position: 'relative',
      }}
    >
      {state === 'verifying' && <VerifyingState />}
      {state === 'invalid' && (
        <InvalidState message={errMsg} onRetry={() => navigate('/login')} />
      )}
      {state === 'valid' && (
        <ResetForm
          email={email}
          oobCode={oobCode}
          logoFailed={logoFailed}
          setLogoFailed={setLogoFailed}
          onSuccess={() => setState('success')}
        />
      )}
      {state === 'success' && (
        <SuccessState onSignIn={() => navigate('/login')} />
      )}

      <style>{`
        .animate-spin { animation: ee-rp-spin 0.9s linear infinite; }
        @keyframes ee-rp-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

/* ============================================================
   VERIFYING
   ============================================================ */
function VerifyingState() {
  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <img
        src="/assets/logo.png"
        alt="Esports Elite"
        style={{ width: 64, height: 64, objectFit: 'contain' }}
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
        <Loader2 size={16} className="animate-spin" />
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>
          Verifying reset link…
        </span>
      </div>
    </div>
  )
}

/* ============================================================
   INVALID
   ============================================================ */
function InvalidState({ message, onRetry }) {
  return (
    <div
      style={{
        width: '100%', maxWidth: 380,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '36px 32px',
        boxShadow: 'var(--shadow-modal)',
        textAlign: 'center',
      }}
    >
      <AlertCircle size={48} style={{ color: 'var(--red)', margin: '0 auto 14px' }} />
      <h1
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontWeight: 400,
          fontSize: 24,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-primary)',
          margin: '0 0 10px',
        }}
      >
        Link Expired or Invalid
      </h1>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
        {message || 'This password reset link has expired or already been used. Please request a new one.'}
      </p>
      <button onClick={onRetry} className="btn btn-primary" style={{ width: '100%', minHeight: 42 }}>
        Request New Link
      </button>
    </div>
  )
}

/* ============================================================
   VALID — FORM
   ============================================================ */
function ResetForm({ email, oobCode, logoFailed, setLogoFailed, onSuccess }) {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const strength = computeStrength(pw)
  const mismatch = confirmTouched && confirm.length > 0 && confirm !== pw
  const canSubmit = pw.length >= 8 && confirm === pw && !busy

  async function submit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setErr('')
    try {
      await confirmPasswordReset(auth, oobCode, pw)
      onSuccess()
    } catch (e2) {
      setErr(mapAuthError(e2))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{
        width: '100%', maxWidth: 380,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '36px 32px',
        boxShadow: 'var(--shadow-modal)',
      }}
    >
      {/* Logo block */}
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        {!logoFailed && (
          <img
            src="/assets/logo.png"
            alt=""
            style={{ width: 44, height: 44, objectFit: 'contain', margin: '0 auto 14px', display: 'block' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; setLogoFailed(true) }}
          />
        )}
        <div
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontWeight: 400,
            fontSize: 26,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
          }}
        >
          Reset Password
        </div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Enter your new password below
        </div>
        {email && (
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-subtle)', marginTop: 6 }}>
            for {email}
          </div>
        )}
      </div>

      {/* New password */}
      <div style={{ marginBottom: 12 }}>
        <label className="label" style={{ display: 'block', marginBottom: 6 }}>New Password</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPw ? 'text' : 'password'}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="input-field"
            style={{ paddingRight: 40 }}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, display: 'flex' }}
            tabIndex={-1}
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Strength bars */}
        <StrengthMeter strength={strength} pw={pw} />
      </div>

      {/* Confirm password */}
      <div style={{ marginBottom: 16 }}>
        <label className="label" style={{ display: 'block', marginBottom: 6 }}>Confirm Password</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showConfirm ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onBlur={() => setConfirmTouched(true)}
            className="input-field"
            style={{ paddingRight: 40 }}
            placeholder="Re-enter your new password"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, display: 'flex' }}
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {mismatch && (
          <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>
            Passwords don't match
          </div>
        )}
      </div>

      {err && (
        <div
          style={{
            background: 'var(--red-ghost)',
            border: '1px solid rgba(232,0,28,0.2)',
            color: 'var(--red)',
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={14} /> {err}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="btn btn-primary"
        style={{ width: '100%', minHeight: 42 }}
      >
        {busy ? <><Loader2 size={14} className="animate-spin" /> Resetting…</> : 'Reset Password'}
      </button>
    </form>
  )
}

function StrengthMeter({ strength, pw }) {
  const bars = [1, 2, 3].map((n) => {
    if (strength >= n) {
      const color =
        strength === 1 ? 'var(--red)' :
        strength === 2 ? 'var(--amber)' :
        'var(--green)'
      return { fill: color }
    }
    return { fill: 'var(--bg-elevated)' }
  })
  const label =
    pw.length === 0 ? '' :
    strength === 1 ? 'Weak' :
    strength === 2 ? 'Medium' :
    'Strong'
  const labelColor =
    strength === 1 ? 'var(--red)' :
    strength === 2 ? 'var(--amber)' :
    'var(--green)'

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {bars.map((b, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              background: b.fill,
              transition: 'background 0.15s ease',
            }}
          />
        ))}
      </div>
      {label && (
        <div style={{ fontSize: 11, color: labelColor, marginTop: 4 }}>
          {label} · min 8 characters, use a number and special character for strong.
        </div>
      )}
    </div>
  )
}

/* ============================================================
   SUCCESS
   ============================================================ */
function SuccessState({ onSignIn }) {
  const [countdown, setCountdown] = useState(3)
  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => c - 1), 1000)
    const nav = setTimeout(() => onSignIn(), 3000)
    return () => { clearInterval(t); clearTimeout(nav) }
  }, [onSignIn])

  const safeCount = Math.max(0, countdown)

  return (
    <div
      style={{
        width: '100%', maxWidth: 380,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '36px 32px',
        boxShadow: 'var(--shadow-modal)',
        textAlign: 'center',
      }}
    >
      <CheckCircle2 size={48} style={{ color: 'var(--green)', margin: '0 auto 14px' }} />
      <h1
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontWeight: 400,
          fontSize: 28,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-primary)',
          margin: '0 0 10px',
        }}
      >
        Password Reset!
      </h1>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
        Your password has been updated successfully. You can now sign in with your new password.
      </p>
      <button onClick={onSignIn} className="btn btn-primary" style={{ width: '100%', minHeight: 42 }}>
        Sign In <ArrowRight size={14} />
      </button>
      <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-subtle)', marginTop: 12 }}>
        Redirecting in {safeCount}s…
      </div>
    </div>
  )
}

/* ============================================================
   HELPERS
   ============================================================ */
function computeStrength(pw) {
  if (!pw || pw.length === 0) return 0
  if (pw.length < 8) return 1
  const hasNumber = /\d/.test(pw)
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]`~;']/.test(pw)
  if (hasNumber && hasSpecial) return 3
  return 2
}

function mapAuthError(err) {
  const code = err?.code || ''
  if (code === 'auth/expired-action-code') return 'This reset link has expired.'
  if (code === 'auth/invalid-action-code') return 'This reset link is invalid or has already been used.'
  if (code === 'auth/user-disabled') return 'This account has been disabled.'
  if (code === 'auth/user-not-found') return 'No account matches this reset link.'
  if (code === 'auth/weak-password') return 'That password is too weak — try something longer.'
  return err?.message || 'Something went wrong. Try again.'
}
