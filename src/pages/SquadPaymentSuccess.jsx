import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { httpsCallable, functions } from '../utils/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { CheckCircle, AlertCircle, Loader, Users, ChevronRight } from 'lucide-react'

function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', color: 'var(--text-primary)',
      padding: '40px 20px',
    }}>
      {children}
    </div>
  )
}

function SpinnerScreen({ label }) {
  return (
    <Shell>
      <div style={{ textAlign: 'center' }}>
        <Loader size={40} style={{ color: 'var(--blue)', animation: 'spin 1s linear infinite', marginBottom: 20 }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>{label}</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </Shell>
  )
}

export default function SquadPaymentSuccess() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [phase,    setPhase]    = useState('idle')  // idle | confirming | done | error | cancelled
  const [errorMsg, setErrorMsg] = useState('')
  const [allPaid,  setAllPaid]  = useState(false)
  const confirmed = useRef(false)

  const paymentLinkId = searchParams.get('razorpay_payment_link_id')    || ''
  const paymentStatus = searchParams.get('razorpay_payment_link_status') || ''

  /* ── auth redirect — preserve all URL params for after login ───────────── */
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      const hashPath = window.location.hash.slice(1) || '/squad-payment-success'
      window.location.href = `/#/login?next=${encodeURIComponent(hashPath)}`
    }
  }, [user, authLoading])

  /* ── handle non-paid status immediately ───────────────────────────────── */
  useEffect(() => {
    if (!user || authLoading) return
    if (paymentStatus && paymentStatus !== 'paid') {
      setPhase('cancelled')
    }
  }, [user, authLoading, paymentStatus])

  /* ── confirm payment via Cloud Function once authenticated ─────────────── */
  useEffect(() => {
    if (!user || authLoading || confirmed.current) return
    if (paymentStatus !== 'paid' || !paymentLinkId) return
    confirmed.current = true
    confirmPayment()
  }, [user, authLoading, paymentStatus, paymentLinkId])

  async function confirmPayment() {
    setPhase('confirming')
    try {
      const fn = httpsCallable(functions, 'confirmSquadMemberPayment')
      const { data } = await fn({ paymentLinkId })
      setAllPaid(data.allPaid)
      setPhase('done')
    } catch (err) {
      console.error('[SquadPaymentSuccess] confirmSquadMemberPayment:', err)
      setPhase('error')
      setErrorMsg(err?.message || 'Could not confirm your payment. Please contact support.')
    }
  }

  /* ── guards ────────────────────────────────────────────────────────────── */
  if (authLoading || (!user && phase === 'idle')) {
    return <SpinnerScreen label="Verifying your account…" />
  }

  if (phase === 'idle' || phase === 'confirming') {
    return <SpinnerScreen label="Confirming your payment…" />
  }

  /* ── cancelled / wrong status ───────────────────────────────────────────── */
  if (phase === 'cancelled') {
    return (
      <Shell>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <AlertCircle size={56} style={{ color: '#EAB308', marginBottom: 24 }} />
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: 12 }}>
            Payment Not Completed
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
            It looks like the payment was not completed. Your squad slot is still reserved.
            Check your email for the payment link to try again.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      </Shell>
    )
  }

  /* ── error ──────────────────────────────────────────────────────────────── */
  if (phase === 'error') {
    return (
      <Shell>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <AlertCircle size={56} style={{ color: 'var(--red)', marginBottom: 24 }} />
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: 12 }}>
            Confirmation Failed
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, marginBottom: 8 }}>
            {errorMsg}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 32 }}>
            Your payment was received by Razorpay — your squad owner will see it once it processes.
            You can safely close this page.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      </Shell>
    )
  }

  /* ── success ────────────────────────────────────────────────────────────── */
  return (
    <Shell>
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
          background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CheckCircle size={36} style={{ color: '#22C55E' }} />
        </div>

        <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 40, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: 12 }}>
          Payment Confirmed!
        </h1>

        <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.7, marginBottom: 10, maxWidth: 440, margin: '0 auto 10px' }}>
          Your squad subscription payment has been received. 🎮
        </p>

        {allPaid ? (
          <div style={{
            marginTop: 20, marginBottom: 28,
            padding: '16px 20px', borderRadius: 12,
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
              <Users size={20} style={{ color: '#22C55E' }} />
              <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 16, letterSpacing: '0.04em', color: '#22C55E' }}>
                SQUAD FULLY ACTIVATED
              </span>
            </div>
            <p style={{ color: '#86EFAC', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
              All squad members have completed payment. Your squad is now active and every
              member has full access to Esports Elite.
            </p>
          </div>
        ) : (
          <div style={{
            marginTop: 20, marginBottom: 28,
            padding: '16px 20px', borderRadius: 12,
            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
              <Loader size={16} style={{ color: '#93C5FD' }} />
              <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 14, letterSpacing: '0.04em', color: '#93C5FD' }}>
                WAITING FOR OTHER MEMBERS
              </span>
            </div>
            <p style={{ color: '#94A3B8', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
              Your payment is confirmed. The squad will activate automatically once all
              members complete their individual payments. You'll receive a notification
              when the squad is fully active.
            </p>
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/dashboard')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px' }}
        >
          Go to Dashboard <ChevronRight size={16} />
        </button>
      </div>
    </Shell>
  )
}
