import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Target, ChevronLeft, ChevronRight,
  LogOut, Crosshair, X, BarChart2, Bell, Shield,
  Users, Map, Trophy, Calendar, BookOpen, Settings,
  Award, Brain, Compass, Gamepad2, CreditCard, Crown,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useAvatar } from '../hooks/useAvatar.js'
import { useNotifications } from '../hooks/useNotifications.js'
import { getInitials } from '../utils/helpers.js'
import { getDisplayName, clearAllUserData, setActiveUID } from '../utils/storage.js'
import { getLevelName, XP_PER_LEVEL } from '../utils/db.js'
import { useUserData } from '../hooks/useUserData.js'
import { useViewport } from '../utils/viewport.js'
import NotificationPanel from './NotificationPanel.jsx'

const ADMIN_EMAILS = [
  'karthikreddyy2010@gmail.com',
  'johnkarthik055@gmail.com',
]

const NAV_SECTIONS = [
  {
    title: 'Main',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/roadmap',   label: 'Roadmap',   icon: Map },
    ],
  },
  {
    title: 'Training',
    items: [
      { to: '/training',      label: 'Training Center', icon: Target },
      { to: '/ai-coach',      label: 'AI Coach',        icon: Brain },
      { to: '/scheduler',     label: 'Scheduler',       icon: Calendar },
      { to: '/match-logger',  label: 'Match Logger',    icon: Gamepad2 },
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
    title: 'Account',
    items: [
      { to: '/billing',  label: 'Billing',  icon: CreditCard },
      { to: '/profile',  label: 'Settings', icon: Settings },
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

const EO_SB = [0.23, 1, 0.32, 1]
const SB_ANIM = {
  navList: { hidden: {}, visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } },
  navItem: { hidden: { opacity: 0, transform: 'translateX(-12px)' }, visible: { opacity: 1, transform: 'translateX(0px)', transition: { duration: 0.3, ease: EO_SB } } },
  navItemReduced: { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.15 } } },
}

export default function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user: authUser, logout: signOutFb } = useAuth()
  const isAdmin = !!authUser?.email && ADMIN_EMAILS.includes(authUser.email)
  const viewport = useViewport()
  const reduce = useReducedMotion()
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
  const sidebarWidth = isMobile ? 260 : isTablet ? 60 : (collapsed ? 60 : 250)

  const sidebarStyle = {
    position: 'fixed',
    left: 0, top: 0,
    height: '100dvh',
    width: sidebarWidth,
    background: '#FFFFFF',
    borderRight: '1px solid #E5EAF3',
    zIndex: isMobile ? 9999 : 50,
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.25s ease, width 0.25s ease',
    transform: isMobile && !mobileOpen ? 'translateX(-100%)' : 'translateX(0)',
    overflow: 'hidden',
    boxShadow: '2px 0 16px rgba(15,23,42,0.04)',
  }

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(11,18,36,0.5)', backdropFilter: 'blur(4px)',
          }}
        />
      )}

      <aside className="sidebar" style={sidebarStyle}>

        {/* ── Brand row ─────────────────────── */}
        <div style={{
          height: 78,
          padding: '18px 24px',
          borderBottom: '1px solid #E5EAF3',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          {!logoFailed && (
            <img
              src="/assets/logo.png"
              alt="Esports Elite"
              style={{ height: 40, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; setLogoFailed(true) }}
            />
          )}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              style={{
                marginLeft: 'auto', padding: 6,
                background: 'transparent', border: 'none',
                cursor: 'pointer', color: '#64748B',
                display: 'flex',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* ── Nav ──────────────────────────── */}
        <nav style={{ flex: 1, overflowY: 'auto', paddingTop: 8, paddingBottom: 8 }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.title} style={{ marginBottom: 4 }}>
              {!labelsHidden && (
                <div style={{
                  fontFamily: 'Rajdhani, sans-serif',
                  fontWeight: 600, fontSize: 10,
                  textTransform: 'uppercase', letterSpacing: '0.15em',
                  color: '#64748B',
                  padding: '20px 20px 6px',
                }}>
                  {section.title}
                </div>
              )}
              <motion.ul
                initial="hidden" animate="visible"
                variants={SB_ANIM.navList}
                style={{ listStyle: 'none', margin: 0, padding: 0 }}
              >
                {section.items.map(item => {
                  const Icon = item.icon
                  return (
                    <motion.li key={item.to} variants={reduce ? SB_ANIM.navItemReduced : SB_ANIM.navItem}>
                      <NavLink
                        to={item.to}
                        title={labelsHidden ? item.label : undefined}
                        style={({ isActive }) => ({
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          height: 44,
                          padding: labelsHidden ? '0' : '0 14px',
                          justifyContent: labelsHidden ? 'center' : 'flex-start',
                          margin: '2px 10px',
                          borderRadius: 10,
                          background: isActive
                            ? 'linear-gradient(90deg, #EEF4FF, #F7F9FF)'
                            : 'transparent',
                          borderLeft: isActive ? '3px solid #2563FF' : '3px solid transparent',
                          color: isActive ? '#2563FF' : '#475569',
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 500, fontSize: 14,
                          textDecoration: 'none',
                          transition: 'all 0.15s ease',
                          cursor: 'pointer',
                          position: 'relative',
                        })}
                        onMouseEnter={e => {
                          if (!e.currentTarget.style.background.includes('EEF4FF')) {
                            e.currentTarget.style.background = '#F8FAFF'
                            e.currentTarget.style.color = '#0B1224'
                          }
                        }}
                        onMouseLeave={e => {
                          if (!e.currentTarget.style.background.includes('EEF4FF')) {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = '#475569'
                          }
                        }}
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              size={18}
                              strokeWidth={2}
                              style={{
                                flexShrink: 0,
                                color: isActive ? '#2563FF' : '#64748B',
                              }}
                            />
                            {!labelsHidden && (
                              <span style={{ flex: 1 }}>{item.label}</span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </motion.li>
                  )
                })}
              </motion.ul>
            </div>
          ))}

          {isAdmin && !labelsHidden && (
            <div style={{ marginBottom: 4 }}>
              <div style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 600, fontSize: 10,
                textTransform: 'uppercase', letterSpacing: '0.15em',
                color: '#64748B',
                padding: '20px 20px 6px',
              }}>
                Admin
              </div>
              <NavLink
                to="/admin"
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 12,
                  height: 44, padding: '0 14px',
                  margin: '2px 10px',
                  borderRadius: 10,
                  background: isActive ? 'linear-gradient(90deg, #EEF4FF, #F7F9FF)' : 'transparent',
                  borderLeft: isActive ? '3px solid #2563FF' : '3px solid transparent',
                  color: isActive ? '#2563FF' : '#475569',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500, fontSize: 14,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                })}
              >
                {({ isActive }) => (
                  <>
                    <Shield size={18} strokeWidth={2} style={{ flexShrink: 0, color: isActive ? '#2563FF' : '#64748B' }} />
                    <span>Admin Panel</span>
                  </>
                )}
              </NavLink>
            </div>
          )}
        </nav>

        {/* ── Upgrade card ─────────────────── */}
        {!labelsHidden && (
          <div style={{
            margin: '0 10px 4px',
            background: 'linear-gradient(135deg, #EEF4FF, #FFF0F3)',
            border: '1px solid #DCE5FA',
            borderRadius: 12,
            padding: 14,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Crown size={20} color="#2563FF" />
              <span style={{
                fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14,
                color: '#0B1224',
              }}>
                Upgrade to Elite
              </span>
            </div>
            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: 13,
              color: '#64748B', lineHeight: 1.5, marginBottom: 8,
            }}>
              Unlock AI Coach, advanced analytics and more.
            </p>
            <button
              onClick={() => navigate('/billing')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13,
                color: '#EF3340', padding: 0,
              }}
            >
              Upgrade →
            </button>
          </div>
        )}

        {/* ── User card ────────────────────── */}
        {!labelsHidden && (
          <div style={{
            padding: 16,
            borderTop: '1px solid #E5EAF3',
            flexShrink: 0,
          }}>
            {/* Avatar + name + level */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  style={{
                    width: 40, height: 40, borderRadius: '50%',
                    objectFit: 'cover', border: '1px solid #E5EAF3',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: '#EAF2FF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14,
                  color: '#2563FF',
                  flexShrink: 0,
                }}>
                  {initials}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14,
                  color: '#0B1224',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  marginBottom: 4,
                }}>
                  {displayName}
                </div>
                <span style={{
                  display: 'inline-block',
                  background: '#EAF2FF',
                  borderRadius: 999, padding: '2px 8px',
                  fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 10,
                  color: '#2563FF',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Level {levelNum + 1}
                </span>
              </div>
            </div>

            {/* XP label + bar */}
            <div style={{
              fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 12,
              color: '#64748B', marginBottom: 6,
            }}>
              {xp.toLocaleString()} / {(ceil || xp).toLocaleString()} XP
            </div>
            <div style={{
              width: '100%', height: 4,
              background: '#E5EAF3',
              borderRadius: 999, overflow: 'hidden', marginBottom: 10,
            }}>
              <div style={{
                height: '100%', width: `${xpPct}%`,
                background: 'linear-gradient(90deg, #2563FF, #5B3DF5)',
                borderRadius: 999,
                transition: 'width 0.4s ease',
              }} />
            </div>

            {/* Icon buttons row */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { icon: <Settings size={16} />, title: 'Settings', onClick: () => navigate('/profile') },
                { icon: <Bell size={16} />, title: 'Notifications', onClick: () => setPanelOpen(true), badge: unreadCount > 0 },
                { icon: <LogOut size={16} />, title: 'Logout', onClick: logout, danger: true },
              ].map(({ icon, title, onClick, badge, danger }) => (
                <button
                  key={title}
                  onClick={onClick}
                  title={title}
                  aria-label={title}
                  style={{
                    flex: 1, height: 32,
                    background: '#F8FAFF',
                    border: '1px solid #E5EAF3',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#64748B',
                    position: 'relative',
                    transition: 'color 0.15s ease, border-color 0.15s ease',
                    minWidth: 32, maxWidth: 32,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = danger ? '#EF3340' : '#2563FF'
                    e.currentTarget.style.borderColor = danger ? '#EF3340' : '#2563FF'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = '#64748B'
                    e.currentTarget.style.borderColor = '#E5EAF3'
                  }}
                >
                  {icon}
                  {badge && (
                    <span style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 6, height: 6, borderRadius: '50%',
                      background: '#2563FF',
                    }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Collapsed icon-only bottom */}
        {labelsHidden && !isMobile && (
          <div style={{
            padding: '8px 0 12px',
            borderTop: '1px solid #E5EAF3',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <button onClick={() => navigate('/profile')} title="Settings" style={{ padding: 9, background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex' }}>
              <Settings size={16} />
            </button>
            <button onClick={() => setPanelOpen(true)} title="Notifications" style={{ padding: 9, background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', position: 'relative' }}>
              <Bell size={16} />
              {unreadCount > 0 && <span style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: '50%', background: '#2563FF' }} />}
            </button>
            <button onClick={logout} title="Logout" style={{ padding: 9, background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex' }}>
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
              position: 'absolute', top: 24, right: -12,
              width: 24, height: 24, borderRadius: '50%',
              background: '#FFFFFF',
              border: '1px solid #E5EAF3',
              color: '#64748B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 51,
              boxShadow: '0 2px 8px rgba(15,23,42,0.1)',
              transition: 'border-color 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563FF'; e.currentTarget.style.color = '#2563FF' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5EAF3'; e.currentTarget.style.color = '#64748B' }}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        )}

        {/* Subtle bottom gradient */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
          background: 'linear-gradient(to top, rgba(37,99,255,0.03), transparent)',
          pointerEvents: 'none',
        }} />
      </aside>

      <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}
