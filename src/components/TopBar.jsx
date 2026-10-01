import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Bell, Search, ChevronDown } from 'lucide-react'
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
  const [searchFocused, setSearchFocused] = useState(false)

  function openMobileSidebar() {
    window.dispatchEvent(new Event('esports-elite:sidebar-open'))
  }

  const displayName = getDisplayName()
  const initials = getInitials(displayName)

  return (
    <>
      <header style={{
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E5EAF3',
        height: 76,
        position: 'sticky',
        top: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        gap: 16,
      }}>

        {/* ── LEFT: mobile menu + search ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, maxWidth: 520 }}>
          <button
            onClick={openMobileSidebar}
            aria-label="Open menu"
            className="mobile-menu-btn"
            style={{
              padding: 4,
              background: 'transparent', border: 'none',
              cursor: 'pointer', color: '#64748B',
              display: 'none', flexShrink: 0,
            }}
          >
            <Menu size={20} />
          </button>

          {/* Search bar */}
          <div style={{
            flex: 1,
            height: 44,
            background: '#F8FAFD',
            border: `1px solid ${searchFocused ? '#2563FF' : '#E3E9F3'}`,
            borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '0 16px',
            transition: 'border-color 0.15s ease',
            cursor: 'text',
          }}
            className="topbar-search"
          >
            <Search size={20} color="#94A3B8" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search training modules, guides, or matches..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                flex: 1, border: 'none', background: 'transparent', outline: 'none',
                fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#0B1224',
              }}
            />
          </div>
        </div>

        {/* ── RIGHT: bell + avatar + CTA ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexShrink: 0,
        }}>
          {/* Bell */}
          <button
            onClick={() => setPanelOpen(true)}
            aria-label="Notifications"
            style={{
              position: 'relative',
              width: 40, height: 40,
              background: '#F8FAFF',
              border: '1px solid #E5EAF3',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#475569',
              flexShrink: 0,
              transition: 'color 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#2563FF'; e.currentTarget.style.borderColor = '#2563FF' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#E5EAF3' }}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: 6,
                width: 8, height: 8, borderRadius: '50%',
                background: '#2563FF',
                border: '2px solid #fff',
              }} />
            )}
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: '#E5EAF3', flexShrink: 0 }} />

          {/* Avatar + name */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}
            onClick={() => navigate('/profile')}
          >
            {avatar ? (
              <img
                src={avatar}
                alt=""
                style={{
                  width: 40, height: 40, borderRadius: '50%',
                  objectFit: 'cover', border: '1px solid #E5EAF3',
                }}
              />
            ) : (
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: '#EAF2FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700, fontSize: 14,
                color: '#2563FF',
                flexShrink: 0,
              }}>
                {initials}
              </div>
            )}
            <span className="topbar-name" style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600, fontSize: 15,
              color: '#0B1224',
            }}>
              {displayName}
            </span>
            <ChevronDown size={16} color="#64748B" className="topbar-name" />
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: '#E5EAF3', flexShrink: 0 }} className="topbar-name" />

          {/* Start Training CTA */}
          <button
            type="button"
            onClick={() => navigate('/training')}
            style={{
              background: 'linear-gradient(90deg, #2563FF, #EF3340)',
              color: '#FFFFFF',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600, fontSize: 14,
              padding: '0 24px',
              height: 44,
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: '0 4px 14px rgba(37,99,255,0.25)',
              transition: 'opacity 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.92'; e.currentTarget.style.transform = 'scale(1.01)' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
          >
            Start Training →
          </button>
        </div>
      </header>

      <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
          .topbar-name { display: none !important; }
          .topbar-search { display: none !important; }
        }
        @media (min-width: 769px) {
          .topbar-name { display: inline-flex !important; }
          .topbar-search { display: flex !important; }
        }
        input::placeholder { color: #94A3B8; }
      `}</style>
    </>
  )
}
