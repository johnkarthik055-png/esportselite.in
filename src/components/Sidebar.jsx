import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Home, Target, User, ChevronLeft, ChevronRight,
  LogOut, Crosshair, X, ClipboardList, BarChart2, Bell, Shield,
  Users, Map, Trophy, CalendarClock, BookOpen, ChevronDown, Settings,
  Award,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useAvatar } from '../hooks/useAvatar.js'
import { useNotifications } from '../hooks/useNotifications.js'
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
  {
    title: 'Main',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: Home },
    ],
  },
  {
    title: 'Training',
    items: [
      { to: '/training',      label: 'Training Center', icon: Target },
      { to: '/scheduler',     label: 'Scheduler',       icon: CalendarClock },
      { to: '/analytics',     label: 'Analytics',       icon: BarChart2 },
      { to: '/training-plan', label: 'Training Plan',   icon: BookOpen },
    ],
  },
  {
    title: 'Team',
    items: [
      { to: '/team', label: 'My Team', icon: Users },
    ],
  },
  {
    title: 'Esports',
    items: [
      { to: '/tournaments',  label: 'Tournaments',  icon: Trophy },
      { to: '/leaderboards', label: 'Leaderboards', icon: Award },
    ],
  },
  {
    title: 'Game Knowledge',
    items: [
      { to: '/map-knowledge', label: 'Map Knowledge', icon: Map },
      { to: '/weapons',       label: 'Weapons Guide',  icon: Crosshair },
    ],
  },
  {
    title: 'Profile',
    items: [
      { to: '/profile', label: 'My Profile', icon: User },
    ],
  },
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
  const floor = XP_PER_LEVEL[levelNum] ?? 0
  const ceil  = XP_PER_LEVEL[levelNum + 1] ?? floor
  const xpPct = ceil > floor ? Math.round(Math.min(1, (xp - floor) / (ceil - floor)) * 100) : 100
  const initials = getInitials(displayName)

  useEffect(() => {
    function check() { setViewport(getViewport()) }
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    function onOpen()      { setMobileOpen(true) }
    function onClose()     { setMobileOpen(false) }
    function onToggleEvt() { setMobileOpen(v => !v) }
    window.addEventListener('esports-elite:sidebar-open',   onOpen)
    window.addEventListener('esports-elite:sidebar-close',  onClose)
    window.addEventListener('esports-elite:sidebar-toggle', onToggleEvt)
    return () => {
      window.removeEventListener('esports-elite:sidebar-open',   onOpen)
      window.removeEventListener('esports-elite:sidebar-close',  onClose)
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
  const labelsHidden = isTablet || (!isMobile && collapsed)
  const sidebarWidth = isMobile ? 260 : isTablet ? 60 : (collapsed ? 60 : 220)

  const sidebarStyle = {
    position: 'fixed',
    left: 0, top: 0,
    /* dvh tracks the browser's actual visible viewport (shrinks
       when a mobile toolbar is showing) instead of the old 100vh,
       which is pinned to the tallest possible viewport and can let
       a fixed drawer's bottom edge sit below the visible fold. */
    height: '100dvh',
    width: sidebarWidth,
    background: 'var(--sidebar)',
    borderRight: '1px solid var(--border)',
    zIndex: isMobile ? 9999 : 50,
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.25s ease, width 0.25s ease',
    transform: isMobile && !mobileOpen ? 'translateX(-100%)' : 'translateX(0)',
    overflow: 'hidden',
  }

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          }}
        />
      )}

      <aside className="sidebar" style={sidebarStyle}>

        {/* ── Logo row ─────────────────────── */}
        <div style={{
          height: 60, padding: '0 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
          flexShrink: 0,
        }}>
          {!logoFailed && (
            <img
              src="/assets/logo.png"
              alt=""
              style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; setLogoFailed(true) }}
            />
          )}
          {!labelsHidden && (
            <span style={{
              fontFamily: 'Oxanium, sans-serif',
              fontWeight: 700, fontSize: 14,
              color: 'var(--text-primary)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              flex: 1,
            }}>
              Esports Elite
            </span>
          )}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              style={{
                marginLeft: 'auto', padding: 6,
                background: 'transparent', border: 'none',
                cursor: 'pointer', color: 'var(--text-subtle)',
                display: 'flex',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* ── Nav ──────────────────────────── */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.title} style={{ marginBottom: 16 }}>
              {!labelsHidden && (
                <div style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500, fontSize: 11,
                  textTransform: 'uppercase', letterSpacing: '0.10em',
                  color: 'var(--text-subtle)',
                  padding: '0 8px 6px',
                }}>
                  {section.title}
                </div>
              )}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {section.items.map(item => {
                  const Icon = item.icon
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        title={labelsHidden ? item.label : undefined}
                        style={({ isActive }) => ({
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: labelsHidden ? '10px 0' : '10px 16px',
                          justifyContent: labelsHidden ? 'center' : 'flex-start',
                          borderRadius: isActive ? '0 8px 8px 0' : '8px',
                          background: isActive ? 'rgba(59,130,246,0.10)' : 'transparent',
                          borderLeft: isActive ? '3px solid var(--blue)' : '3px solid transparent',
                          color: isActive ? 'var(--text-primary)' : 'var(--text-subtle)',
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 500, fontSize: 14,
                          textDecoration: 'none',
                          transition: 'all 0.15s ease',
                          cursor: 'pointer',
                        })}
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              size={18}
                              strokeWidth={2}
                              style={{
                                flexShrink: 0,
                                color: isActive ? 'var(--blue)' : 'currentColor',
                              }}
                            />
                            {!labelsHidden && (
                              <span style={{ flex: 1 }}>{item.label}</span>
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

          {isAdmin && !labelsHidden && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500, fontSize: 11,
                textTransform: 'uppercase', letterSpacing: '0.10em',
                color: 'var(--text-subtle)',
                padding: '0 8px 6px',
              }}>
                Admin
              </div>
              <NavLink
                to="/admin"
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px',
                  borderRadius: isActive ? '0 8px 8px 0' : '8px',
                  background: isActive ? 'rgba(59,130,246,0.10)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--blue)' : '3px solid transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-subtle)',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500, fontSize: 14,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                })}
              >
                {({ isActive }) => (
                  <>
                    <Shield size={18} strokeWidth={2} style={{ flexShrink: 0, color: isActive ? 'var(--blue)' : 'currentColor' }} />
                    <span>Admin Panel</span>
                  </>
                )}
              </NavLink>
            </div>
          )}
        </nav>

        {/* ── User card ────────────────────── */}
        {!labelsHidden && (
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            {/* Avatar + name + level row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  style={{
                    width: 40, height: 40, borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid var(--border)',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(59,130,246,0.10)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 14,
                  color: 'var(--blue)',
                  flexShrink: 0,
                }}>
                  {initials}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13,
                  color: '#F8FAFC',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  marginBottom: 4,
                }}>
                  {displayName}
                </div>
                {/* Level badge pill */}
                <span style={{
                  display: 'inline-block',
                  background: '#101A30', border: '1px solid #1B2A45',
                  borderRadius: 999, padding: '2px 8px',
                  fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 11,
                  color: '#3B82F6',
                }}>
                  Level {levelNum + 1}
                </span>
              </div>
            </div>

            {/* XP bar */}
            <div style={{ marginBottom: 4 }}>
              <div style={{
                width: '100%', height: 3,
                background: 'var(--border)',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${xpPct}%`,
                  background: '#3B82F6',
                  borderRadius: 2,
                  boxShadow: '0 0 6px rgba(59,130,246,0.5)',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
            <div style={{
              fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 10,
              color: '#94A3B8', marginBottom: 10,
            }}>
              {xp.toLocaleString()} / {(ceil || xp).toLocaleString()} XP
            </div>

            {/* Icons row: settings + notifications + logout */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => navigate('/profile')}
                title="Settings"
                style={{
                  flex: 1, padding: '7px 0',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-subtle)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--divider)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-subtle)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <Settings size={15} />
              </button>
              <button
                onClick={() => setPanelOpen(true)}
                title="Notifications"
                style={{
                  flex: 1, padding: '7px 0',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 4,
                  color: 'var(--text-subtle)',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--divider)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-subtle)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <Bell size={15} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, right: 10,
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--blue)',
                  }} />
                )}
              </button>
              <button
                onClick={logout}
                title="Logout"
                style={{
                  flex: 1, padding: '7px 0',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-subtle)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-subtle)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Collapsed: icon-only bottom row */}
        {labelsHidden && !isMobile && (
          <div style={{
            padding: '8px 0 12px',
            borderTop: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <button
              onClick={() => navigate('/profile')}
              title="Settings"
              style={{
                padding: '9px', background: 'transparent',
                border: 'none', cursor: 'pointer',
                color: 'var(--text-subtle)', display: 'flex',
              }}
            >
              <Settings size={16} />
            </button>
            <button
              onClick={() => setPanelOpen(true)}
              title="Notifications"
              style={{
                padding: '9px', background: 'transparent',
                border: 'none', cursor: 'pointer',
                color: 'var(--text-subtle)',
                display: 'flex', position: 'relative',
              }}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--blue)',
                }} />
              )}
            </button>
            <button
              onClick={logout}
              title="Logout"
              style={{
                padding: '9px', background: 'transparent',
                border: 'none', cursor: 'pointer',
                color: 'var(--text-subtle)', display: 'flex',
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}

        {/* Desktop collapse toggle */}
        {!isMobile && !isTablet && (
          <button
            onClick={onToggle}
            title={collapsed ? 'Expand' : 'Collapse'}
            style={{
              position: 'absolute', top: 18, right: -12,
              width: 24, height: 24, borderRadius: '50%',
              background: '#101A30',
              border: '1px solid #1B2A45',
              color: 'var(--text-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 51,
              boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
              transition: 'border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#3B82F6'
              e.currentTarget.style.color = '#3B82F6'
              e.currentTarget.style.boxShadow = '0 0 12px rgba(59,130,246,0.35)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#1B2A45'
              e.currentTarget.style.color = 'var(--text-subtle)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.45)'
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
