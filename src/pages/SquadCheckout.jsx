import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable, functions } from '../utils/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { AlertCircle, CheckCircle, Loader, Users, ChevronRight } from 'lucide-react'

const SQUAD_TIERS = [
  { size: 2, pricePerPlayer: 129 },
  { size: 3, pricePerPlayer: 119 },
  { size: 4, pricePerPlayer: 109 },
  { size: 5, pricePerPlayer: 99  },
  { size: 6, pricePerPlayer: 89, bestValue: true },
]

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

export default function SquadCheckout() {
  const navigate   = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [size,         setSize]         = useState(4)
  const [memberEmails, setMemberEmails] = useState(['', '', '']) // size - 1
  const [phase,        setPhase]        = useState('idle')       // idle | submitting | success | error
  const [errorMsg,     setErrorMsg]     = useState('')
  const [resultData,   setResultData]   = useState(null)         // { squadId, members }
  const formRef = useRef(null)

  /* ── auth redirect ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      const hashPath = window.location.hash.slice(1) || '/squad-checkout'
      window.location.href = `/#/login?next=${encodeURIComponent(hashPath)}`
    }
  }, [user, authLoading])

  /* ── resize member email array when size changes ───────────────────────── */
  useEffect(() => {
    setMemberEmails(Array(size - 1).fill(''))
    setErrorMsg('')
  }, [size])

  function setEmail(i, value) {
    setMemberEmails((prev) => {
      const next = [...prev]
      next[i] = value
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg('')

    const trimmed = memberEmails.map((e) => e.trim())
    for (const email of trimmed) {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setErrorMsg('Please enter a valid email address for every member.')
        return
      }
    }

    setPhase('submitting')
    try {
      const fn = httpsCallable(functions, 'createSquad')
      const { data } = await fn({ size, memberEmails: trimmed })

      const selectedTier = SQUAD_TIERS.find((t) => t.size === size)
      const allEmails = [user.email, ...trimmed]
      setResultData({
        squadId: data.squadId,
        members: allEmails.map((email) => ({ email, status: 'invited' })),
        pricePerPlayer: selectedTier?.pricePerPlayer,
      })
      setPhase('success')
    } catch (err) {
      console.error('[SquadCheckout] createSquad:', err)
      setPhase('error')
      const code = err?.code || ''
      if (code === 'functions/unauthenticated') {
        setErrorMsg('Your session expired — please log in again.')
      } else if (code === 'functions/invalid-argument') {
        setErrorMsg(err?.message || 'Please check your inputs and try again.')
      } else if (code === 'functions/failed-precondition') {
        setErrorMsg('Squad payments are not available yet. Please try again later.')
      } else {
        setErrorMsg(err?.message || 'Something went wrong. Please try again.')
      }
    }
  }

  function retry() {
    setPhase('idle')
    setErrorMsg('')
  }

  /* ── guards ────────────────────────────────────────────────────────────── */
  if (authLoading || (!user && phase === 'idle')) {
    return <SpinnerScreen label="Checking login…" />
  }

  if (phase === 'submitting') {
    return <SpinnerScreen label="Creating your squad and sending payment links…" />
  }

  /* ── success ────────────────────────────────────────────────────────────── */
  if (phase === 'success' && resultData) {
    return (
      <Shell>
        <div style={{ maxWidth: 520, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <CheckCircle size={32} style={{ color: '#22C55E' }} />
            </div>
            <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: 10 }}>
              Squad Created!
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6 }}>
              Payment links have been sent to all {resultData.members.length} members.
              Each member will receive an email with their individual payment link.
              The squad activates once <strong style={{ color: 'var(--text-primary)' }}>all members complete payment</strong>.
            </p>
          </div>

          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Users size={16} style={{ color: 'var(--blue)' }} />
              <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 15, letterSpacing: '0.06em', color: 'var(--text-primary)' }}>
                SQUAD MEMBERS ({resultData.members.length})
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                ₹{resultData.pricePerPlayer}/player/month
              </span>
            </div>
            {resultData.members.map((m, i) => (
              <div key={m.email} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px',
                borderBottom: i < resultData.members.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--bg-base)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Bebas Neue, sans-serif', fontSize: 13, color: 'var(--blue)',
                }}>
                  {i === 0 ? 'O' : i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.email}
                  </div>
                  {i === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>
                      Owner
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                  padding: '3px 9px', borderRadius: 100,
                  background: 'rgba(234,179,8,0.12)', color: '#EAB308',
                  border: '1px solid rgba(234,179,8,0.25)',
                }}>
                  Invited
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/dashboard')}
            style={{ width: '100%', marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            Go to Dashboard <ChevronRight size={16} />
          </button>
        </div>
      </Shell>
    )
  }

  /* ── error ──────────────────────────────────────────────────────────────── */
  if (phase === 'error') {
    return (
      <Shell>
        <div style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <AlertCircle size={56} style={{ color: 'var(--red)', marginBottom: 24 }} />
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: 12 }}>
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

  /* ── idle form ──────────────────────────────────────────────────────────── */
  const selectedTier = SQUAD_TIERS.find((t) => t.size === size)

  return (
    <Shell>
      <div style={{ maxWidth: 520, width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, marginBottom: 16,
            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)',
          }}>
            <Users size={24} />
          </div>
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: 8 }}>
            Create Your Squad
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
            Choose your squad size, add your teammates, and we'll send each member
            their own payment link via email.
          </p>
        </div>

        <form ref={formRef} onSubmit={handleSubmit}>
          {/* Squad size selector */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
              Squad Size
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {SQUAD_TIERS.map((tier) => {
                const selected = size === tier.size
                return (
                  <button
                    key={tier.size}
                    type="button"
                    onClick={() => setSize(tier.size)}
                    style={{
                      position: 'relative',
                      flex: '1 1 0',
                      padding: '12px 4px',
                      borderRadius: 10,
                      background:   selected ? 'rgba(37,99,235,0.2)'  : 'var(--bg-elevated)',
                      border:       selected ? '2px solid var(--blue)' : '1px solid var(--border)',
                      color:        selected ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, background 0.15s',
                      textAlign: 'center',
                    }}
                  >
                    {tier.bestValue && (
                      <span style={{
                        position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
                        background: 'var(--blue)', color: '#fff',
                        fontSize: 7, fontWeight: 700, letterSpacing: '0.06em',
                        padding: '2px 6px', borderRadius: 100, whiteSpace: 'nowrap',
                      }}>
                        BEST
                      </span>
                    )}
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 20, lineHeight: 1 }}>{tier.size}</div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3, opacity: 0.7 }}>players</div>
                    <div style={{ fontSize: 11, marginTop: 4, color: selected ? '#93C5FD' : 'var(--text-muted)' }}>
                      ₹{tier.pricePerPlayer}
                    </div>
                  </button>
                )
              })}
            </div>
            <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
              ₹{selectedTier?.pricePerPlayer}/player/month ·{' '}
              ₹{(selectedTier?.pricePerPlayer ?? 0) * size}/month total · GST included
            </p>
          </div>

          {/* Member emails */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
              Squad Members
            </label>

            {/* Owner — read-only */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                1 — You (Owner)
              </div>
              <input
                type="email"
                value={user?.email || ''}
                readOnly
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '11px 14px', borderRadius: 10,
                  background: 'var(--bg-base)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', fontSize: 14, cursor: 'default',
                  outline: 'none',
                }}
              />
            </div>

            {/* Other members */}
            {memberEmails.map((email, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  {i + 2} — Member
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(i, e.target.value)}
                  placeholder={`member${i + 2}@email.com`}
                  required
                  autoComplete="off"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '11px 14px', borderRadius: 10,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 14,
                    outline: 'none', transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--blue)' }}
                  onBlur={(e)  => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
            ))}
          </div>

          {/* Error */}
          {errorMsg && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13,
              padding: '11px 14px', borderRadius: 10, marginBottom: 20,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#FCA5A5',
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {errorMsg}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Users size={16} />
            Create Squad &amp; Send Payment Links
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
            Each member receives an email with their own secure payment link.
            You will not be charged until you complete your own payment.
          </p>
        </form>
      </div>
    </Shell>
  )
}
