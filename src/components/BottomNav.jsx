import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Swords, Users, Map, Menu,
  BarChart3, ClipboardList, Crosshair,
  User, Shield, Bell, LogOut, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotifications } from '../hooks/useNotifications.js'
import { clearAllUserData, setActiveUID } from '../utils/storage.js'

const ADMIN_EMAILS = [
  'karthikreddyy2010@gmail.com',
  'johnkarthik055@gmail.com',
]

const PRIMARY = [
  { to: '/dashboard',     label: 'Home',     icon: LayoutDashboard },
  { to: '/training',      label: 'Training', icon: Swords },
  { to: '/team',          label: 'Team',     icon: Users },
  { to: '/map-knowledge', label: 'Map',      icon: Map },
]

/* Kept in sync with the Sidebar sections that don't have room in the
   5-slot bottom bar. Order matches the sidebar so returning users
   find things where they expect. */
const DRAWER_ITEMS = [
  { to: '/analytics',     label: 'Analytics',      icon: BarChart3 },
  { to: '/training-plan', label: 'Training Plan',  icon: ClipboardList },
  { to: '/weapons',       label: 'Weapons Guide',  icon: Crosshair },
  { to: '/profile',       label: 'My Profile',     icon: User },
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

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout: signOutFb } = useAuth()
  const { unreadCount } = useNotifications()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email)

  /* Close the drawer whenever the route changes so opening it,
     tapping a link, and landing on the next page all feel like one
     gesture — no lingering overlay after navigation. */
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  /* Lock body scroll while the drawer is up. */
  useEffect(() => {
    if (!drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [drawerOpen])

  async function handleLogout() {
    clearAllUserData()
    setActiveUID(null)
    await signOutFb()
    clearLocalAppData()
    navigate('/', { replace: true })
  }

  function openNotifications() {
    setDrawerOpen(false)
    window.dispatchEvent(new Event('esports-elite:notifications-open'))
  }

  return (
    <>
      <nav className="bottom-nav" aria-label="Primary">
        {PRIMARY.map(item => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={22} strokeWidth={2} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
        <button
          type="button"
          onClick={() => setDrawerOpen(v => !v)}
          className={`bottom-nav-item ${drawerOpen ? 'active' : ''}`}
          aria-expanded={drawerOpen}
          aria-label="More"
        >
          <Menu size={22} strokeWidth={2} />
          <span>More</span>
        </button>
      </nav>

      {drawerOpen && (
        <>
          <div
            className="bottom-nav-scrim"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div
            className="bottom-nav-drawer"
            role="dialog"
            aria-label="More menu"
          >
            <div className="bottom-nav-drawer-header">
              <span className="bottom-nav-drawer-title">More</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="bottom-nav-drawer-close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bottom-nav-drawer-grid">
              {DRAWER_ITEMS.map(item => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `bottom-nav-drawer-cell ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={22} strokeWidth={2} />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
              {isAdmin && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) => `bottom-nav-drawer-cell ${isActive ? 'active' : ''}`}
                >
                  <Shield size={22} strokeWidth={2} />
                  <span>Admin</span>
                </NavLink>
              )}
              <button
                type="button"
                onClick={openNotifications}
                className="bottom-nav-drawer-cell"
              >
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  <Bell size={22} strokeWidth={2} />
                  {unreadCount > 0 && (
                    <span className="bottom-nav-badge">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
                <span>Notifications</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="bottom-nav-drawer-cell"
              >
                <LogOut size={22} strokeWidth={2} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
