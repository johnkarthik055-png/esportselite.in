import { useEffect, useRef, useState } from 'react'
import { X, KeyRound, CheckCircle2, Mail } from 'lucide-react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../utils/firebase.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPasswordModal({ onClose }) {
  const [screen, setScreen] = useState('enter')   // 'enter' | 'success'
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState('')
  const emailRef = useRef(null)
  const cooldownRef = useRef(null)

  /* Auto-focus the email field when the modal opens. */
  useEffect(() => {
    const t = setTimeout(() => emailRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [])

  /* Close on Escape key. */
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  /* Clean up cooldown interval on unmount. */
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [])

  function startResendCooldown() {
    setResendCooldown(30)
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  async function handleSendReset() {
    setError('')
    const emailValue = email.trim()

    if (!emailValue) {
      setError('Please enter your email address.')
      emailRef.current?.focus()
      return
    }
    if (!EMAIL_RE.test(emailValue)) {
      setError('Please enter a valid email address.')
      emailRef.current?.focus()
      return
    }

    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, emailValue)
      setScreen('success')
      startResendCooldown()
    } catch (err) {
      switch (err.code) {
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
          setError('No account found with this email. Please create an account first.')
          break
        case 'auth/invalid-email':
          setError('Invalid email format.')
          break
        case 'auth/too-many-requests':
          setError('Too many attempts. Wait a few minutes.')
          break
        case 'auth/network-request-failed':
          setError('No internet. Check your connection.')
          break
        default:
          setError('Something went wrong. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || loading) return
    setError('')
    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      startResendCooldown()
    } catch {
      setError('Could not resend. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Modal card */}
      <div
        className="relative w-full max-w-sm rounded-xl shadow-2xl animate-fade-in"
        style={{
          background: '#13131C',
          border: '1px solid #202030',
          borderTop: '3px solid #E8001C',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgot-title"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-md text-text-secondary hover:text-white hover:bg-white/10 transition-all"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {screen === 'enter' ? (
          <div className="p-6 sm:p-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-md bg-red-gradient flex items-center justify-center shadow-red-glow flex-shrink-0">
                <KeyRound size={19} className="text-white" />
              </div>
              <div>
                <h2
                  id="forgot-title"
                  className="heading text-xl text-white tracking-wide uppercase"
                >
                  Reset Password
                </h2>
                <p className="text-text-secondary text-xs mt-0.5">
                  We'll send a reset link to your email.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-text-secondary mb-2 heading">
                  Email Address
                </label>
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSendReset() }}
                  className="input-field min-h-[44px]"
                  placeholder="Enter your email…"
                  autoComplete="email"
                />
                {error && (
                  <p className="mt-2 text-xs text-accent-secondary leading-snug">{error}</p>
                )}
              </div>

              <button
                onClick={handleSendReset}
                disabled={loading}
                className="btn-red w-full py-3 rounded-md text-sm uppercase tracking-[0.15em] disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 text-xs text-text-secondary hover:text-white heading uppercase tracking-widest transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-8">
            {/* Success header */}
            <div className="flex flex-col items-center text-center mb-6">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.4)' }}
              >
                <CheckCircle2 size={32} className="text-success" />
              </div>
              <h2
                id="forgot-title"
                className="heading text-xl text-white tracking-wide uppercase"
              >
                Email Sent!
              </h2>
            </div>

            <div className="space-y-3 text-sm text-center">
              <p className="text-text-secondary">
                We sent a password reset link to:
              </p>
              <p
                className="mono text-accent-secondary px-3 py-2 rounded-md"
                style={{ background: 'rgba(232,0,28,0.08)', border: '1px solid rgba(232,0,28,0.2)' }}
              >
                {email}
              </p>
              <p className="text-text-secondary leading-relaxed text-xs">
                Check your inbox and spam folder. Click the link to reset your
                password, then come back and sign in with your new password.
              </p>
            </div>

            {error && (
              <p className="mt-3 text-xs text-accent-secondary text-center">{error}</p>
            )}

            <div className="mt-6 space-y-2">
              <p className="text-center text-xs text-text-muted">Didn't receive it?</p>
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="w-full py-2.5 rounded-md text-sm uppercase tracking-[0.15em] heading border border-border text-text-secondary hover:text-white hover:border-accent-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                {loading
                  ? 'Sending…'
                  : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : 'Resend Email'}
              </button>

              <button
                onClick={onClose}
                className="btn-red w-full py-3 rounded-md text-sm uppercase tracking-[0.15em] min-h-[44px]"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
