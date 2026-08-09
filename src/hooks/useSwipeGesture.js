import { useRef, useCallback } from 'react'

/**
 * Touch swipe gesture hook. Returns { onTouchStart, onTouchMove, onTouchEnd }
 * spreadable on any element.
 *
 * Options:
 *  - onSwipeLeft / onSwipeRight / onSwipeUp / onSwipeDown
 *  - minDistance (default 50) — pixels required to trigger
 *  - maxOffAxis  (default 30) — perpendicular drift limit (prevents
 *                                conflict with scroll)
 *  - onMove(deltaX, deltaY)   — called continuously during the gesture
 *                                so consumers can preview the swipe (e.g.
 *                                translating a row in real time)
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onMove,
  minDistance = 50,
  maxOffAxis = 30,
} = {}) {
  const start = useRef({ x: 0, y: 0, t: 0, active: false })

  const onTouchStart = useCallback(e => {
    const touch = e.touches[0]
    if (!touch) return
    start.current = { x: touch.clientX, y: touch.clientY, t: Date.now(), active: true }
  }, [])

  const onTouchMove = useCallback(
    e => {
      if (!start.current.active) return
      const touch = e.touches[0]
      if (!touch || !onMove) return
      const dx = touch.clientX - start.current.x
      const dy = touch.clientY - start.current.y
      onMove(dx, dy, e)
    },
    [onMove]
  )

  const onTouchEnd = useCallback(
    e => {
      if (!start.current.active) return
      start.current.active = false
      const touch = e.changedTouches[0]
      if (!touch) return
      const dx = touch.clientX - start.current.x
      const dy = touch.clientY - start.current.y
      const adx = Math.abs(dx)
      const ady = Math.abs(dy)

      if (adx > minDistance && ady < maxOffAxis) {
        if (dx > 0) onSwipeRight?.(e)
        else onSwipeLeft?.(e)
      } else if (ady > minDistance && adx < maxOffAxis) {
        if (dy > 0) onSwipeDown?.(e)
        else onSwipeUp?.(e)
      } else {
        /* Tap or aborted swipe — let consumers reset transform via onMove. */
        onMove?.(0, 0, e)
      }
    },
    [minDistance, maxOffAxis, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onMove]
  )

  return { onTouchStart, onTouchMove, onTouchEnd }
}
