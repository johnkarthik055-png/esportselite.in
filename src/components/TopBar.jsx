import { useState, useEffect } from 'react'
import { Menu, Search, Bell } from 'lucide-react'
import { useAvatar } from '../hooks/useAvatar.js'
import { getInitials } from '../utils/helpers.js'
import { getDisplayName } from '../utils/storage.js'
import { getTrialStatus } from '../utils/trial.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useUserData } from '../hooks/useUserData.js'
import { getLevelName } from '../utils/db.js'
import { useNotifications } from '../hooks/useNotifications.js'

export default function TopBar({ title }) {
  const { user: authUser } = useAuth()
  const { avatar } = useAvatar()
  const { level: levelNum } = useUserData()
  const { unreadCount } = useNotifications()
  const [trial, setTrial] = useState(null)
  const [search, setSearch] = useState('')

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
  function openNotifications() {
    window.dispatchEvent(new Event('esports-elite:notifications-open'))
  }

  const displayName = getDisplayName()
  const initials = getInitials(displayName)
  const levelName = getLevelName(levelNum)

  function TrialBadge() {
    if (!trial) return null
    const base = {
      fontFamily: "'Inter', sans-serif",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      padding: '4px 10px',
      borderRadius: 4,
      whiteSpace: 'nowrap',
    }
    if (trial.expired) {
      return (
        <span style={{
          ...base,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--danger)',
          color: 'var(--danger)',
        }}>
          Trial Expired
        </span>
      )
    }
    if (trial.daysLeft <= 7) {
      return (
        <span style={{
          ...base,
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid var(--warning)',
          color: 'var(--warning)',
        }}>
          {trial.daysLeft} day{trial.daysLeft === 1 ? '' : 's'} left
        </span>
      )
    }
    return (
      <span style={{
        ...base,
        background: 'rgba(201, 162, 39, 0.08)',
        border: '1px solid var(--gold)',
        color: 'var(--gold)',
      }}>
        Free Trial · {trial.daysLeft}d
      </span>
    )
  }

  return (
    <header
      style={{
        height: 64,
        background: 'var(--graphite)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        gap: 16,
      }}
    >
      {/* Left — hamburger + page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flexShrink: 0 }}>
        <button
          onClick={openMobileSidebar}
          aria-label="Open menu"
          className="topbar-hamburger"
          style={{
            padding: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', display: 'flex',
          }}
        >
          <Menu size={20} />
        </button>
        <h1
          style={{
            fontFamily: "'Oxanium', sans-serif",
            fontWeight: 700,
            fontSize: 18,
            color: 'var(--ivory)',
            letterSpacing: '0.04em',
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

      {/* Center — search bar (hidden on narrow screens) */}
      <div
        className="topbar-search"
        style={{
          flex: 1,
          maxWidth: 480,
          position: 'relative',
        }}
      >
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 12, top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--muted)',
            pointerEvents: 'none',
          }}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search anything…"
          style={{
            width: '100%',
            height: 36,
            padding: '0 12px 0 34px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--ivory)',
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            outline: 'none',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--gold)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
        />
      </div>

      {/* Right — trial + notif + avatar + name + level */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <TrialBadge />

        <button
          onClick={openNotifications}
          aria-label="Notifications"
          style={{
            position: 'relative',
            padding: 8,
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -4, right: -4,
                background: 'var(--gold)',
                color: 'var(--obsidian)',
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 999,
                minWidth: 16,
                textAlign: 'center',
                lineHeight: 1.3,
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {avatar ? (
            <img
              src={avatar}
              alt=""
              style={{
                width: 34, height: 34, borderRadius: '50%',
                objectFit: 'cover', border: '1px solid var(--border)',
              }}
            />
          ) : (
            <div
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'var(--card)', border: '1px solid var(--border)',
                color: 'var(--ivory)',
                fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {initials}
            </div>
          )}
          <div className="topbar-name-block" style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                color: 'var(--ivory)',
                lineHeight: 1.2,
              }}
            >
              {displayName}
            </span>
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 10,
                color: 'var(--muted)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                lineHeight: 1.3,
              }}
            >
              Pro Player
            </span>
          </div>
          <span
            style={{
              fontFamily: "'Oxanium', sans-serif",
              fontWeight: 700,
              fontSize: 11,
              color: 'var(--gold)',
              background: 'rgba(201, 162, 39, 0.08)',
              border: '1px solid var(--gold)',
              padding: '3px 8px',
              borderRadius: 4,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {levelName}
          </span>
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .topbar-search { display: none; }
          .topbar-name-block { display: none !important; }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .topbar-name-block { display: none !important; }
        }
      `}</style>
    </header>
  )
}
