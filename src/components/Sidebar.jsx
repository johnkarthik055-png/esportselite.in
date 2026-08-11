import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Home, Target, User, ChevronLeft, ChevronRight,
  LogOut, Crosshair, X, ClipboardList, BarChart3, TrendingUp, Bell, Shield,
  Users, Map, Trophy, CalendarClock, Brain, Gamepad2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useAvatar } from '../hooks/useAvatar.js'
import { useNotifications } from '../hooks/useNotifications.js'
import { getInitials } from '../utils/helpers.js'
import { getDisplayName, clearAllUserData, setActiveUID } from '../utils/storage.js'
import { getLevelName, XP_PER_LEVEL } from '../utils/db.js'
import { useUserData } from '../hooks/useUserData.js'
import { getTrialStatus } from '../utils/trial.js'
import NotificationPanel from './NotificationPanel.jsx'

const ADMIN_EMAILS = [
  'karthikreddyy2010@gmail.com',
  'johnkarthik055@gmail.com',
]

/* Section groups match the v2 spec's MAIN / ANALYTICS / TOOLS split
   while preserving every route that already exists in App.jsx. */
const NAV_SECTIONS = [
  {
    title: 'Main',
    items: [
      { to: '/dashboard',    label: 'Dashboard',        icon: Home },
      { to: '/training',     label: 'Training Center',  icon: Target },
      { to: '/scheduler',    label: 'Scheduler',        icon: CalendarClock },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/progress',  label: 'Progress',  icon: TrendingUp },
    ],
  },
  {
    title: 'Compete',
    items: [
      { to: '/team',        label: 'My Team',     icon: Users },
      { to: '/tournaments', label: 'Tournaments', icon: Trophy },
    ],
  },
  {
    title: 'Tools',
    items: [
      { to: '/map-knowledge', label: 'Map Knowledge', icon: Map },
      { to: '/weapons',       label: 'Weapons Guide', icon: Crosshair },
      { to: '/training-plan', label: 'Training Plan', icon: ClipboardList },
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
  const ceil = XP_PER_LEVEL[levelNum + 1] ?? floor
  const xpPct = ceil > floor ? Math.round(Math.min(1, (xp - floor) / (ceil - floor)) * 100) : 100

  /* Trial badge at bottom — matches v2 spec's "Trial badge (days left)". */
  const [trial, setTrial] = useState(null)
  useEffect(() => {
    let cancelled = false
    async function loadTrial() {
      if (!authUser?.uid) { if (!cancelled) setTrial(null); return }
      try {
        const status = await getTrialStatus(authUser.uid)
        if (!cancelled) setTrial(status)
      } catch { if (!cancelled) setTrial(null) }
    }
    loadTrial()
    return () => { cancelled = true }
  }, [authUser?.uid])

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
  /* v2 spec: 240px sidebar on desktop. Kept the 60px icon-rail
     collapsed / tablet mode so power users still get the reclaim. */
  const width = isMobile ? 280 : isTablet ? 60 : (collapsed ? 60 : 240)
  const labelsHidden = isTablet || (!isMobile && collapsed)

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0, 0, 0, 0.7)',
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
          background: 'var(--graphite)',
          borderRight: '1px solid var(--border)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.25s ease, width 0.25s ease',
          transform: isMobile && !mobileOpen ? 'translateX(-100%)' : 'translateX(0)',
        }}
      >
        {/* Brand block — logo + wordmark + tagline. */}
        <div
          style={{
            padding: labelsHidden ? '18px 0' : '18px 16px',
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
              style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; setLogoFailed(true) }}
            />
          )}
          {!labelsHidden && (
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontFamily: "'Oxanium', sans-serif",
                  fontWeight: 700,
                  fontSize: 15,
                  color: 'var(--ivory)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Esports Elite
              </span>
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 9,
                  color: 'var(--muted)',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Train · Analyze · Dominate
              </span>
            </div>
          )}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              style={{
                marginLeft: 'auto', padding: 6,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', display: 'flex',
              }}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Nav sections */}
        <nav style={{ flex: 1, padding: '16px 10px', overflowY: 'auto' }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.title} style={{ marginBottom: 18 }}>
              {!labelsHidden && (
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.14em',
                    color: 'var(--muted)',
                    padding: '0 10px 8px',
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
                        className={({ isActive }) => `v2-nav-item ${isActive ? 'active' : ''}`}
                        style={labelsHidden
                          ? { justifyContent: 'center', padding: '10px 0' }
                          : undefined}
                      >
                        <Icon size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
                        {!labelsHidden && <span style={{ flex: 1 }}>{item.label}</span>}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Trial badge — bottom of sidebar per spec. */}
        {!labelsHidden && trial && !trial.expired && (
          <div style={{ padding: '0 14px 10px' }}>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: trial.daysLeft <= 7 ? 'var(--warning)' : 'var(--gold)',
                background: trial.daysLeft <= 7
                  ? 'rgba(245, 158, 11, 0.08)'
                  : 'rgba(201, 162, 39, 0.08)',
                border: `1px solid ${trial.daysLeft <= 7 ? 'var(--warning)' : 'var(--gold)'}`,
                borderRadius: 4,
                padding: '6px 10px',
                textAlign: 'center',
              }}
            >
              {trial.daysLeft <= 7
                ? `${trial.daysLeft} day${trial.daysLeft === 1 ? '' : 's'} left`
                : `Trial · ${trial.daysLeft} days`}
            </div>
          </div>
        )}

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
                  fontFamily: "'Oxanium', sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  color: 'var(--gold)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {levelName}
              </span>
              <span
                style={{
                  fontFamily: "'Oxanium', sans-serif",
                  fontWeight: 600,
                  fontSize: 11,
                  color: 'var(--muted)',
                }}
              >
                {xp.toLocaleString()} / {(ceil || xp).toLocaleString()}
              </span>
            </div>
            <div
              style={{
                height: 4,
                background: 'var(--border)',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${xpPct}%`,
                  background: 'var(--gold)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
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
                  width: 32, height: 32, borderRadius: '50%',
                  objectFit: 'cover', border: '1px solid var(--border)',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--card)', border: '1px solid var(--border)',
                  color: 'var(--ivory)',
                  fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {getInitials(displayName)}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 600,
                  color: 'var(--ivory)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "'Inter', sans-serif",
                  color: 'var(--muted)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Pro Player
              </div>
            </div>
          </div>
        )}

        {/* Bottom controls */}
        <div style={{ padding: '8px 10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {isAdmin && (
            <NavLink
              to="/admin"
              title={labelsHidden ? 'Admin' : undefined}
              className={({ isActive }) => `v2-nav-item ${isActive ? 'active' : ''}`}
              style={labelsHidden ? { justifyContent: 'center', padding: '9px 0' } : undefined}
            >
              <Shield size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
              {!labelsHidden && <span>Admin</span>}
            </NavLink>
          )}
          <button
            onClick={() => setPanelOpen(true)}
            title={labelsHidden ? 'Notifications' : undefined}
            className="v2-nav-item"
            style={labelsHidden ? { justifyContent: 'center', padding: '9px 0' } : undefined}
          >
            <Bell size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
            {!labelsHidden && <span style={{ flex: 1 }}>Notifications</span>}
            {unreadCount > 0 && (
              <span
                style={{
                  background: 'var(--gold)',
                  color: 'var(--obsidian)',
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
            className="v2-nav-item"
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
              top: 22,
              right: -12,
              width: 24, height: 24,
              borderRadius: '50%',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 51,
            }}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        )}

        {/* v2 nav-item hover / active styles — scoped so we don't
            override the legacy .nav-item class other pages may use. */}
        <style>{`
          .v2-nav-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 9px 12px 9px 12px;
            border-radius: 0 6px 6px 0;
            background: transparent;
            border: none;
            border-left: 2px solid transparent;
            color: var(--muted);
            cursor: pointer;
            font-family: 'Inter', sans-serif;
            font-size: 13px;
            font-weight: 500;
            text-decoration: none;
            transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
            width: 100%;
            text-align: left;
          }
          .v2-nav-item:hover {
            color: var(--ivory);
            background: rgba(255, 255, 255, 0.04);
          }
          .v2-nav-item.active {
            color: var(--gold);
            background: rgba(201, 162, 39, 0.08);
            border-left-color: var(--gold);
          }
        `}</style>
      </aside>

      <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}
