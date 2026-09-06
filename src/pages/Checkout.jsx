import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { httpsCallable, functions } from '../utils/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { CheckCircle, AlertCircle, Loader } from 'lucide-react'

const SQUAD_PRICE_PER_PLAYER = { 2: 129, 3: 119, 4: 109, 5: 99, 6: 89 }

function planLabel(plan, members) {
  if (plan === 'individual') return 'Individual Elite — ₹149/month'
  const ppp = SQUAD_PRICE_PER_PLAYER[members] ?? 89
  return `Squad Elite (${members} members) — ₹${ppp * members}/month`
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return }
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export default function Checkout() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const plan    = params.get('plan') || 'individual'
  const members = parseInt(params.get('members') || '6', 10)

  const [phase, setPhase] = useState('idle') // idle | loading | open | success | error
  const [errorMsg, setErrorMsg] = useState('')
  const started = useRef(false)

  /* Redirect unauthenticated visitors to login, passing back the full hash
     path so Login can return here after a successful sign-in.
     Uses window.location.href (hard redirect) so the hash is set correctly
     for HashRouter — React Router's navigate() would not produce the
     /#/login prefix that the browser needs to interpret as a hash route. */
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      /* window.location.hash = '#/checkout' or '#/checkout?plan=individual'
         Slice off the leading '#' to get the internal path for the next param. */
      const hashPath = window.location.hash.slice(1) || '/checkout'
      window.location.href = `/#/login?next=${encodeURIComponent(hashPath)}`
    }
  }, [user, authLoading])

  /* Start checkout once we know the user is logged in */
  useEffect(() => {
    if (!user || started.current) return
    started.current = true
    startCheckout()
  }, [user])

  async function startCheckout() {
    setPhase('loading')
    setErrorMsg('')

    const loaded = await loadRazorpayScript()
    if (!loaded) {
      setPhase('error')
      setErrorMsg('Could not load the payment gateway. Check your connection and try again.')
      return
    }

    try {
      const createOrder = httpsCallable(functions, 'createRazorpayOrder')
      const { data } = await createOrder({
        plan,
        members: plan === 'squad' ? members : undefined,
        email: user.email || '',
        name: user.displayName || '',
      })

      const options = {
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: 'Esports Elite',
        description: data.amountDisplay || planLabel(plan, members),
        handler() {
          setPhase('success')
        },
        prefill: data.prefill || {},
        theme: { color: '#3B82F6' },
        modal: {
          ondismiss() {
            /* If the user closes without paying, go back to idle so they can retry */
            setPhase(p => p === 'success' ? 'success' : 'idle')
          },
        },
      }

      setPhase('open')
      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', () => {
        setPhase('error')
        setErrorMsg('Payment failed. You were not charged. Please try again.')
      })
      rzp.open()
    } catch (err) {
      console.error('[Checkout] createRazorpayOrder:', err)
      setPhase('error')
      setErrorMsg(err?.message || 'Something went wrong. Please try again.')
    }
  }

  function retry() {
    started.current = false
    setPhase('idle')
    if (user) {
      started.current = true
      startCheckout()
    }
  }

  /* ---- render ------------------------------------------------------------ */

  if (authLoading || (!user && phase === 'idle')) {
    return <Shell><Spinner label="Checking login…" /></Shell>
  }

  if (phase === 'success') {
    return (
      <Shell>
        <div style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <CheckCircle size={56} style={{ color: '#22C55E', marginBottom: 24 }} />
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 40, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: 12 }}>
            Payment received!
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 8 }}>
            Your subscription is being activated. This usually takes under a minute.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32 }}>
            {planLabel(plan, members)}
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            Go to dashboard
          </button>
        </div>
      </Shell>
    )
  }

  if (phase === 'error') {
    return (
      <Shell>
        <div style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <AlertCircle size={56} style={{ color: 'var(--red)', marginBottom: 24 }} />
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 40, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: 12 }}>
            Something went wrong
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 32 }}>{errorMsg}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={retry}>Try again</button>
            <button className="btn btn-ghost" onClick={() => navigate(-1)}>Go back</button>
          </div>
        </div>
      </Shell>
    )
  }

  if (phase === 'idle') {
    /* Returned from dismissed modal — offer to re-open */
    return (
      <Shell>
        <div style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 40, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: 12 }}>
            Complete your subscription
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 32 }}>
            {planLabel(plan, members)}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={retry}>Continue to payment</button>
            <button className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
          </div>
        </div>
      </Shell>
    )
  }

  /* loading | open */
  const label = phase === 'open' ? 'Complete the payment in the checkout window…' : 'Preparing checkout…'
  return <Shell><Spinner label={label} /></Shell>
}

function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', color: 'var(--text-primary)', padding: '40px 20px',
    }}>
      {children}
    </div>
  )
}

function Spinner({ label }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <Loader size={40} style={{ color: '#3B82F6', animation: 'spin 1s linear infinite', marginBottom: 20 }} />
      <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>{label}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
