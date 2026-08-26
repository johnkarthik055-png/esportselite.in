import { useEffect, useState } from 'react'

/* Single source of truth for the app's mobile/tablet/desktop bucket —
   previously duplicated independently in Sidebar.jsx and Layout.jsx,
   which is exactly how they drifted out of sync with MapKnowledge's
   own separate breakpoint and produced the "sidebar shows in
   landscape" class of bugs.

   ------------------------------------------------------------------
   WIDTH ALONE IS NOT A VALID MOBILE/DESKTOP SIGNAL.
   ------------------------------------------------------------------
   A desktop browser window can legitimately be resized to any width
   — two windows side-by-side, a small monitor, a narrowed DevTools
   panel — and none of that makes it a phone or tablet. The previous
   version of this function bucketed purely on window.innerWidth/
   innerHeight, so narrowing an ordinary desktop Chrome window past
   768px flipped the whole app into the touch-oriented mobile layout
   (bottom nav instead of sidebar, MapKnowledge's full-bleed mobile
   map, Strategy Maker's mobile floating-panel sizing) even though
   the input device was still a mouse. Changing the pixel threshold
   again would only move where that misfire happens, not fix it.

   The actual signal for "is this a touch/mobile device" is the
   pointer type, not the window size: `(pointer: coarse)` reflects
   the PRIMARY input mechanism (a real touchscreen with no precise
   pointer), and is false for a mouse/trackpad regardless of how
   narrow the window gets. Width still matters for CHOOSING mobile
   vs. tablet among touch devices (a phone vs. an iPad), and for
   staying orientation-stable (a phone rotated to landscape still
   reports 'mobile') — it's just no longer sufficient on its own to
   decide "is this even a touch device" in the first place. */
function isCoarsePointerDevice() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(pointer: coarse)').matches
}

export function getViewport() {
  if (typeof window === 'undefined') return 'desktop'

  /* No coarse (touch) pointer as the primary input -> always desktop
     layout, no matter how narrow the window is. This is the fix:
     a mouse-driven browser window never becomes "mobile" just by
     being resized. */
  if (!isCoarsePointerDevice()) return 'desktop'

  /* From here on we know the primary input is touch, so width IS a
     meaningful signal for phone-vs-tablet — use the SHORTER of
     width/height so a phone rotated to landscape (innerWidth easily
     >768px, e.g. 844px) still reads as mobile instead of flipping to
     desktop just because it got rotated. A real tablet's shorter
     side stays >=768 in either orientation. */
  const shortSide = Math.min(window.innerWidth, window.innerHeight)
  if (shortSide < 768) return 'mobile'
  if (window.innerWidth < 1024) return 'tablet'
  return 'desktop'
}

export function isMobileViewport() {
  return getViewport() === 'mobile'
}

/* Shared hook so every consumer (Layout, Sidebar, BottomNav,
   MapKnowledge) re-checks on the same two signals instead of each
   re-implementing its own subset. `resize` catches width changes;
   the `(pointer: coarse)` media query's own `change` event catches
   the input-device signal changing without a resize (e.g. a mouse
   attached to/detached from a hybrid touch laptop, or DevTools'
   "toggle device toolbar" simulating a different primary pointer). */
export function useViewport() {
  const [viewport, setViewport] = useState(getViewport)
  useEffect(() => {
    function check() { setViewport(getViewport()) }
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)') : null
    mq?.addEventListener?.('change', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
      mq?.removeEventListener?.('change', check)
    }
  }, [])
  return viewport
}
