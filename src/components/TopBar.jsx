import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Bell } from 'lucide-react'
import { useAvatar } from '../hooks/useAvatar.js'
import { getInitials } from '../utils/helpers.js'
import { getDisplayName } from '../utils/storage.js'
import { useUserData } from '../hooks/useUserData.js'
import { useNotifications } from '../hooks/useNotifications.js'
import NotificationPanel from './NotificationPanel.jsx'

export default function TopBar({ title }) {
  const navigate = useNavigate()
  const { avatar } = useAvatar()
  const { xp } = useUserData()
  const { unreadCount } = useNotifications()
  const [panelOpen, setPanelOpen] = useState(false)

  function openMobileSidebar() {
    window.dispatchEvent(new Event('esports-elite:sidebar-open'))
  }

  const displayName = getDisplayName()
  const initials = getInitials(displayName)

  return (
    <>
      <header style={{
        background: 'var(--header)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        padding: '0 clamp(12px, 4vw, 24px)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          padding: '16px 0 14px',
        }}>

          {/* ── LEFT: mobile menu button only ── */}
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={openMobileSidebar}
              aria-label="Open menu"
              className="mobile-menu-btn"
              style={{
                padding: 4,
                background: 'transparent', border: 'none',
                cursor: 'pointer', color: 'var(--text-subtle)',
                display: 'none',
              }}
            >
              <Menu size={20} />
            </button>
          </div>

          {/* ── RIGHT: bell + avatar + CTA ── */}
          <div className="topbar-actions" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            flex: '1 1 auto',
            minWidth: 0,
            overflowX: 'auto',
          }}>
            {/* Bell */}
            <button
              onClick={() => setPanelOpen(true)}
              aria-label="Notifications"
              style={{
                position: 'relative',
                padding: 8, background: 'transparent',
                border: 'none', cursor: 'pointer',
                color: 'var(--text-subtle)',
                display: 'flex',
                flexShrink: 0,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-subtle)'}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--blue)',
                }} />
              )}
            </button>

            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  style={{
                    width: 34, height: 34, borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid var(--border)',
                  }}
                />
              ) : (
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'rgba(59,130,246,0.12)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Oxanium, sans-serif',
                  fontWeight: 700, fontSize: 12,
                  color: 'var(--blue)',
                }}>
                  {initials}
                </div>
              )}
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500, fontSize: 13,
                color: 'var(--text-muted)',
                display: 'none',
              }} className="topbar-name">
                {displayName}
              </span>
            </div>

            {/* Start Training CTA */}
            <button
              type="button"
              onClick={() => navigate('/training')}
              style={{
                background: 'linear-gradient(135deg, var(--blue-bright) 0%, var(--blue) 100%)',
                color: '#fff',
                fontFamily: 'Oxanium, sans-serif',
                fontWeight: 700, fontSize: 14,
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                position: 'relative',
                zIndex: 10,
                pointerEvents: 'auto',
                transition: 'opacity 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.opacity = '0.9'
                e.currentTarget.style.boxShadow = '0 0 20px rgba(37,99,235,0.4)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = '1'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              ▶ Start Training
            </button>
          </div>
        </div>
      </header>

      <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
          .topbar-name { display: none !important; }
        }
        @media (min-width: 769px) {
          .topbar-name { display: inline !important; }
        }
        .topbar-actions { scrollbar-width: none; -ms-overflow-style: none; }
        .topbar-actions::-webkit-scrollbar { display: none; }
      `}</style>
    </>
  )
}

