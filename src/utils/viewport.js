/* Single source of truth for the app's mobile/tablet/desktop bucket —
   previously duplicated independently in Sidebar.jsx and Layout.jsx,
   which is exactly how they drifted out of sync with MapKnowledge's
   own separate breakpoint and produced the "sidebar shows in
   landscape" class of bugs.

   The mobile check uses the SHORTER of width/height, not width alone.
   A phone rotated to landscape can easily report innerWidth > 768
   (e.g. 844px) while still being a phone — its shorter side (390px)
   is what actually tells you that. A real tablet's shorter side stays
   >=768 in either orientation. This is what makes the sidebar/bottom
   nav decision orientation-stable instead of flipping to "desktop"
   just because the phone got rotated. */
export function getViewport() {
  if (typeof window === 'undefined') return 'desktop'
  const shortSide = Math.min(window.innerWidth, window.innerHeight)
  if (shortSide < 768) return 'mobile'
  if (window.innerWidth < 1024) return 'tablet'
  return 'desktop'
}

export function isMobileViewport() {
  return getViewport() === 'mobile'
}
