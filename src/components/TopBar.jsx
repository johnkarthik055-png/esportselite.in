import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import { useAvatar } from '../hooks/useAvatar.js'
import { getInitials } from '../utils/helpers.js'
import { getDisplayName } from '../utils/storage.js'
import { getTrialStatus } from '../utils/trial.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function TopBar({ title }) {
  const { user: authUser } = useAuth()
  const { avatar } = useAvatar()
  const [trial, setTrial] = useState(null)

  useEffect(() => {
    let cancelled = false
    const loadTrial = async () => {
      if (!authUser?.uid) { if (!cancelled) setTrial(null); return }
      const status = await getTrialStatus(authUser.uid)
      if (!cancelled) setTrial(status)
    }
    loadTrial()
    return () => { cancelled = true }
  }, [authUser?.uid])

  function openMobileSidebar() {
    window.dispatchEvent(new Event('esports-elite:sidebar-open'))
  }

  const displayName = getDisplayName()
  const initials = getInitials(displayName)

  function TrialBadge() {
    if (!trial) return null
    if (trial.expired) return <span className="badge badge-red">Trial Expired</span>
    if (trial.daysLeft <= 7) return <span className="badge badge-amber">{trial.daysLeft} days left</span>
    return <span className="badge">FREE TRIAL · {trial.daysLeft} days left</span>
  }

  return (
    <header
      style={{
        height: 56,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <button
          onClick={openMobileSidebar}
          aria-label="Open menu"
          style={{
            padding: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex',
          }}
        >
          <Menu size={20} />
        </button>
        <h1
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontWeight: 400,
            fontSize: 22,
            color: 'var(--text-primary)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </h1>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <TrialBadge />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {avatar ? (
            <img
              src={avatar}
              alt=""
              style={{
                width: 32, height: 32, borderRadius: '50%',
                objectFit: 'cover', border: '1px solid var(--border)',
              }}
            />
          ) : (
            <div
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {initials}
            </div>
          )}
          <span
            style={{
              fontFamily: 'DM Sans, sans-serif',
              fontWeight: 500,
              fontSize: 13,
              color: 'var(--text-muted)',
              display: 'none',
            }}
            className="topbar-name"
          >
            {displayName}
          </span>
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .topbar-name { display: inline !important; }
        }
      `}</style>
    </header>
  )
}
