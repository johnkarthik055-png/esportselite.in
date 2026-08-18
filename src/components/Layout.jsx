import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import Sidebar from './Sidebar.jsx'
import TopBar from './TopBar.jsx'
import BottomNav from './BottomNav.jsx'
import FABMenu from './FABMenu.jsx'
import XPToast from './XPToast.jsx'
import LevelUpModal from './LevelUpModal.jsx'
import { readLS, writeLS } from '../hooks/useLocalStorage.js'
import { STORAGE_KEYS } from '../utils/constants.js'
import { bootTheme } from '../hooks/useTheme.js'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/training': 'Training Center',
  '/training-plan': 'Training Plan',
  '/profile': 'My Profile',
  '/weapons': 'Weapons Guide',
  '/analytics': 'Analytics',
}

function getViewport() {
  if (typeof window === 'undefined') return 'desktop'
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

export default function Layout() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [toast, setToast] = useState('')
  const [viewport, setViewport] = useState(getViewport())
  const edgeRef = useRef({ x: 0, y: 0, active: false })
  const title = PAGE_TITLES[location.pathname] || 'Esports Elite'

  useEffect(() => { bootTheme() }, [])

  useEffect(() => {
    function check() { setViewport(getViewport()) }
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const pending = readLS(STORAGE_KEYS.PENDING_TOAST, '')
    if (pending) {
      setToast(pending)
      writeLS(STORAGE_KEYS.PENDING_TOAST, '')
      const t = setTimeout(() => setToast(''), 5500)
      return () => clearTimeout(t)
    }
  }, [])

  /* Edge-swipe to open mobile sidebar. */
  useEffect(() => {
    if (viewport !== 'mobile') return
    function onTouchStart(e) {
      const t = e.touches[0]
      if (!t) return
      if (t.clientX <= 20) edgeRef.current = { x: t.clientX, y: t.clientY, active: true }
    }
    function onTouchEnd(e) {
      if (!edgeRef.current.active) return
      const t = e.changedTouches[0]
      if (!t) return
      const dx = t.clientX - edgeRef.current.x
      const dy = Math.abs(t.clientY - edgeRef.current.y)
      edgeRef.current.active = false
      if (dx > 50 && dy < 30) {
        window.dispatchEvent(new Event('esports-elite:sidebar-open'))
      }
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [viewport])

  /* Match new Sidebar widths: 220/60 expanded/collapsed */
  const mainMl =
    viewport === 'mobile' ? 0 :
    viewport === 'tablet' ? 60 :
    collapsed ? 60 : 220

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <div
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          minHeight: '100vh',
          /* Flex items default to min-width:auto, which floors their
             shrink at their content's min-content size. This column
             is the ONLY flow-participating child of the outer flex
             row (Sidebar/FABMenu/BottomNav are all position:fixed),
             so without this it silently grows to fit whatever page
             content refuses to wrap — the root cause of every
             per-page "topbar/content cut off on mobile" report,
             since every protected page renders through this one
             wrapper. */
          minWidth: 0,
          marginLeft: mainMl,
          transition: 'margin-left 0.25s ease',
        }}
      >
        <TopBar title={title} />
        <main
          className="main-content"
          style={{
            flex: 1,
            minWidth: 0,
            padding: '24px clamp(16px, 4vw, 36px)',
            background: 'var(--bg-base)',
            position: 'relative',
          }}
        >
          <div
            key={location.pathname}
            className="page-transition page-body"
            style={{ maxWidth: 1400, margin: '0 auto', width: '100%' }}
          >
            <Outlet />
          </div>
        </main>
      </div>

      {toast && (
        <div className="toast-container">
          <div className="toast-item">{toast}</div>
        </div>
      )}

      <FABMenu />
      <XPToast />
      <LevelUpModal />
      <BottomNav />
    </div>
  )
}
