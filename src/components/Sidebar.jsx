import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Home, Target, User, ChevronLeft, ChevronRight,
  LogOut, Crosshair, X, ClipboardList, BarChart3, TrendingUp, Bell, Shield,
  Users, Map, Trophy, CalendarClock,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useAvatar } from '../hooks/useAvatar.js'
import { useNotifications } from '../hooks/useNotifications.js'
import { STORAGE_KEYS } from '../utils/constants.js'
import { getInitials } from '../utils/helpers.js'
import { getDisplayName, clearAllUserData, setActiveUID } from '../utils/storage.js'
import { getLevelName, XP_PER_LEVEL } from '../utils/db.js'
import { useUserData } from '../hooks/useUserData.js'
import NotificationPanel from './NotificationPanel.jsx'

const ADMIN_EMAILS = [
  'karthikreddyy2010@gmail.com',
  'johnkarthik055@gmail.com',
]

const NAV_SECTIONS = [
  { title: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: Home }] },
  {
    title: 'Training',
    items: [
      { to: '/training', label: 'Training Center', icon: Target },
      { to: '/scheduler', label: 'Scheduler', icon: CalendarClock },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/progress', label: 'Progress', icon: TrendingUp },
      { to: '/training-plan', label: 'Training Plan', icon: ClipboardList },
    ],
  },
  { title: 'Team',    items: [{ to: '/team', label: 'My Team', icon: Users }] },
  {
    title: 'Esports',
    items: [
      { to: '/tournaments', label: 'Tournaments', icon: Trophy },
    ],
  },
  {
    title: 'Game Knowledge',
    items: [
      { to: '/map-knowledge', label: 'Map Knowledge',  icon: Map },
      { to: '/weapons',       label: 'Weapons Guide',  icon: Crosshair },
    ],
  },
  { title: 'Profile', items: [{ to: '/profile', label: 'My Profile', icon: User }] },
]

function clearLocalAppData() {
  try {
    const toRemove = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith('esportselite_')) continue
      if (/^esportselite_[A-Za-z0-9-]{20,}_/.test(key)) continue
      if (key === 'esportselite_users') continue
      if (key.startsWith('esportselite_migrated_')) continue
      toRemove.push(key)
    }
    toRemove.forEach(k => window.localStorage.removeItem(k))
  } catch { /* ignore */ }
}

function getViewport() {
  if (typeof window === 'undefined') return 'desktop'
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

export default function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user: authUser, logout: signOutFb } = useAuth()
  const isAdmin = !!authUser?.email && ADMIN_EMAILS.includes(authUser.email)
  const [viewport, setViewport] = useState(getViewport())
  const [mobileOpen, setMobileOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  const { avatar } = useAvatar()
  const { unreadCount } = useNotifications()
  const displayName = getDisplayName()
  const { xp, level: levelNum } = useUserData()
  const levelName = getLevelName(levelNum)
  /* Levels are 0-indexed here — see utils/db.js. XP_PER_LEVEL[N] is
     the threshold for level N, so the current-level floor is
     [levelNum] and the next-level ceiling is [levelNum + 1]. */
  const floor = XP_PER_LEVEL[levelNum] ?? 0
  const ceil = XP_PER_LEVEL[levelNum + 1] ?? floor
  const xpPct = ceil > floor ? Math.round(Math.min(1, (xp - floor) / (ceil - floor)) * 100) : 100

  useEffect(() => {
    function check() { setViewport(getViewport()) }
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    function onOpen()  { setMobileOpen(true) }
    function onClose() { setMobileOpen(false) }
    function onToggleEvt() { setMobileOpen(v => !v) }
    window.addEventListener('esports-elite:sidebar-open', onOpen)
    window.addEventListener('esports-elite:sidebar-close', onClose)
    window.addEventListener('esports-elite:sidebar-toggle', onToggleEvt)
    return () => {
      window.removeEventListener('esports-elite:sidebar-open', onOpen)
      window.removeEventListener('esports-elite:sidebar-close', onClose)
      window.removeEventListener('esports-elite:sidebar-toggle', onToggleEvt)
    }
  }, [])

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  useEffect(() => {
    if (viewport === 'mobile' && mobileOpen) {
      const original = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = original }
    }
  }, [viewport, mobileOpen])

  async function logout() {
    clearAllUserData()
    setActiveUID(null)
    await signOutFb()
    clearLocalAppData()
    navigate('/', { replace: true })
  }

  const isMobile = viewport === 'mobile'
  const isTablet = viewport === 'tablet'
  const width = isMobile ? 280 : isTablet ? 60 : (collapsed ? 60 : 220)
  const labelsHidden = isTablet || (!isMobile && collapsed)

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          }}
        />
      )}

      <aside
        className="sidebar"
        style={{
          position: 'fixed',
          left: 0, top: 0,
          height: '100vh',
          width,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.25s ease, width 0.25s ease',
          transform: isMobile && !mobileOpen ? 'translateX(-100%)' : 'translateX(0)',
        }}
      >
        {/* Logo row */}
        <div
          style={{
            height: 60,
            padding: '0 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {!logoFailed && (
            <img
              src="/assets/logo.png"
              alt=""
              style={{ width: 26, height: 26, objectFit: 'contain', flexShrink: 0 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; setLogoFailed(true) }}
            />
          )}
          {!labelsHidden && (
            <span
              style={{
                fontFamily: 'Bebas Neue, sans-serif',
                fontWeight: 400,
                fontSize: 16,
                color: 'var(--text-primary)',
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              Esports Elite
            </span>
          )}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              style={{
                marginLeft: 'auto', padding: 6,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', display: 'flex',
              }}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.title} style={{ marginBottom: 18 }}>
              {!labelsHidden && (
                <div
                  style={{
                    fontFamily: 'DM Sans, sans-serif',
                    fontWeight: 600,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: 'var(--text-subtle)',
                    padding: '0 12px 5px',
                  }}
                >
                  {section.title}
                </div>
              )}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {section.items.map(item => {
                  const Icon = item.icon
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        title={labelsHidden ? item.label : undefined}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        style={labelsHidden ? { justifyContent: 'center', padding: '9px 0' } : undefined}
                      >
                        <Icon size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
                        {!labelsHidden && (
                          <>
                            <span style={{ flex: 1 }}>{item.label}</span>
                            {item.soon && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 600,
                                  color: 'var(--text-subtle)',
                                  background: 'var(--bg-elevated)',
                                  border: '1px solid var(--border)',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  marginLeft: 'auto',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.06em',
                                }}
                              >
                                SOON
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* XP block */}
        {!labelsHidden && (
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontFamily: 'Bebas Neue, sans-serif',
                  fontWeight: 400,
                  fontSize: 14,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                {levelName}
              </span>
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'var(--text-subtle)' }}>
                {xp.toLocaleString()} / {(ceil || xp).toLocaleString()}
              </span>
            </div>
            <div className="xp-bar-track"><div className="xp-bar-fill" style={{ width: `${xpPct}%` }} /></div>
          </div>
        )}

        {/* User row */}
        {!labelsHidden && (
          <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            {avatar ? (
              <img
                src={avatar}
                alt=""
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  objectFit: 'cover', border: '1px solid var(--border)',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 11,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {getInitials(displayName)}
              </div>
            )}
            <div
              style={{
                fontSize: 12,
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: 500,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {displayName}
            </div>
          </div>
        )}

        {/* Bottom controls */}
        <div style={{ padding: '8px 10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {isAdmin && (
            <NavLink
              to="/admin"
              title={labelsHidden ? 'Admin' : undefined}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              style={labelsHidden ? { justifyContent: 'center', padding: '9px 0' } : undefined}
            >
              <Shield size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
              {!labelsHidden && <span>Admin</span>}
            </NavLink>
          )}
          <button
            onClick={() => setPanelOpen(true)}
            title={labelsHidden ? 'Notifications' : undefined}
            className="nav-item"
            style={labelsHidden ? { justifyContent: 'center', padding: '9px 0' } : undefined}
          >
            <Bell size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
            {!labelsHidden && <span style={{ flex: 1 }}>Notifications</span>}
            {unreadCount > 0 && (
              <span
                style={{
                  background: 'var(--red)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 999,
                  minWidth: 18,
                  textAlign: 'center',
                  marginLeft: labelsHidden ? 0 : 'auto',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={logout}
            title={labelsHidden ? 'Logout' : undefined}
            className="nav-item"
            style={labelsHidden ? { justifyContent: 'center', padding: '9px 0' } : undefined}
          >
            <LogOut size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
            {!labelsHidden && <span>Logout</span>}
          </button>
        </div>

        {/* Desktop collapse toggle */}
        {!isMobile && !isTablet && (
          <button
            onClick={onToggle}
            title={collapsed ? 'Expand' : 'Collapse'}
            style={{
              position: 'absolute',
              top: 18,
              right: -12,
              width: 24, height: 24,
              borderRadius: '50%',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 51,
            }}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        )}
      </aside>

      <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}
