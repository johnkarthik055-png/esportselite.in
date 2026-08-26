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
import { useViewport } from '../utils/viewport.js'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/training': 'Training Center',
  '/training-plan': 'Training Plan',
  '/profile': 'My Profile',
  '/weapons': 'Weapons Guide',
  '/analytics': 'Analytics',
}

export default function Layout() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [toast, setToast] = useState('')
  const viewport = useViewport()
  const edgeRef = useRef({ x: 0, y: 0, active: false })
  const topbarWrapRef = useRef(null)
  const [topbarHeight, setTopbarHeight] = useState(64)
  const title = PAGE_TITLES[location.pathname] || 'Esports Elite'

  useEffect(() => { bootTheme() }, [])

  /* Real measured TopBar height, exposed as --app-topbar-height below —
     TopBar's content (trial badge, responsive padding) isn't a fixed
     constant across breakpoints, so pages that need to know where it
     ends (e.g. Map Knowledge's full-bleed mobile map) measure it here
     once instead of guessing a px value that drifts out of sync. */
  useEffect(() => {
    const el = topbarWrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height
      if (h) setTopbarHeight(h)
    })
    ro.observe(el)
    return () => ro.disconnect()
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
    <div
      style={{
        minHeight: '100vh', background: 'var(--bg-base)', display: 'flex',
        /* Single source of truth for the sidebar's current rendered
           width, exposed as a CSS custom property so any descendant —
           including position:fixed elements like Strategy Maker's
           mobile tool drawer, which sit outside the .main-content flow
           this component already offsets via marginLeft — can reserve
           space next to the sidebar instead of rendering underneath
           it. Custom properties inherit down the DOM tree regardless
           of position:fixed (that only affects the containing block
           for layout, not CSS variable inheritance), so this reaches
           every page without each one re-deriving the same viewport
           breakpoint independently. */
        '--app-sidebar-width': `${mainMl}px`,
        /* Mirrors --app-sidebar-width for TopBar's real measured
           height — see the ResizeObserver above. Full-bleed mobile
           layouts (e.g. Map Knowledge's Strategy Maker) size
           themselves against this instead of a guessed 64px. */
        '--app-topbar-height': `${topbarHeight}px`,
      }}
    >
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <div
        style={{
          display: 'flex', flexDirection: 'column',
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
          /* Sidebar is position:fixed, so it never consumes space in
             this flex row — `flex:1` alone resolved to 100% of the
             row's width regardless of mainMl, and marginLeft then
             shifted that full-width box mainMl px to the right,
             overflowing the viewport's right edge by exactly mainMl
             px (tablet width, or desktop with the sidebar manually
             collapsed). That overflow is what let the sidebar visually
             overlap page content instead of content reflowing beside
             it — width has to shrink by the same amount margin pushes
             it over, not just flex:1's default 100%. */
          width: `calc(100% - ${mainMl}px)`,
          marginLeft: mainMl,
          transition: 'margin-left 0.25s ease, width 0.25s ease',
        }}
      >
        <div ref={topbarWrapRef}>
          <TopBar title={title} />
        </div>
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
