import { useEffect, useRef, useState } from 'react'

/**
 * Hover (desktop) / long-press (mobile) tooltip that wraps a child element.
 * Positions itself above the child with a small arrow.
 */
export default function StatTooltip({ content, children }) {
  const [open, setOpen] = useState(false)
  const lp = useRef(null)
  const wrapRef = useRef(null)

  function startLongPress() {
    cancelLongPress()
    lp.current = setTimeout(() => setOpen(true), 550)
  }
  function cancelLongPress() {
    if (lp.current) {
      clearTimeout(lp.current)
      lp.current = null
    }
  }

  /* Tap outside on mobile closes the tooltip. */
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchCancel={cancelLongPress}
      onTouchMove={cancelLongPress}
    >
      {children}
      {open && (
        <div
          className="absolute left-1/2 z-30 pointer-events-none animate-fade-in"
          style={{ transform: 'translate(-50%, -100%)', top: -6 }}
        >
          <div
            className="px-3 py-2 rounded-md text-[13px] whitespace-pre-line shadow-2xl"
            style={{
              background: '#1A1A24',
              border: '1px solid rgba(232,0,28,0.5)',
              fontFamily: "'Bebas Neue', sans-serif",
              color: '#F0F0F0',
              minWidth: 220,
              maxWidth: 280,
              lineHeight: 1.45,
            }}
          >
            {content}
            {/* Arrow */}
            <span
              className="absolute"
              style={{
                left: '50%',
                bottom: -5,
                transform: 'translateX(-50%) rotate(45deg)',
                width: 8,
                height: 8,
                background: '#1A1A24',
                borderRight: '1px solid rgba(232,0,28,0.5)',
                borderBottom: '1px solid rgba(232,0,28,0.5)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
