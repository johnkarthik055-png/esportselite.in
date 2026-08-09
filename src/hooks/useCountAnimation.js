import { useEffect, useRef, useState } from 'react'

/* ease-out cubic — fast start, slow finish. */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Animate a numeric value from 0 → target using requestAnimationFrame.
 *
 * Options:
 *  - duration  — ms (default 1500)
 *  - delay     — ms before start (default 0)
 *  - trigger   — number; bumping it re-triggers the animation from 0
 *
 * Returns the current animated value (float). Caller is responsible for
 * formatting (truncating to int / formatting time / etc).
 */
export function useCountAnimation(target, options = {}) {
  const { duration = 1500, delay = 0, trigger = 0 } = options
  const safeTarget = Number.isFinite(Number(target)) ? Number(target) : 0
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setValue(0)
    let cancelled = false

    const startTimer = setTimeout(() => {
      const startTs = performance.now()
      const step = now => {
        if (cancelled) return
        const t = Math.min(1, (now - startTs) / duration)
        const eased = easeOutCubic(t)
        setValue(safeTarget * eased)
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step)
        } else {
          setValue(safeTarget)
        }
      }
      rafRef.current = requestAnimationFrame(step)
    }, delay)

    return () => {
      cancelled = true
      clearTimeout(startTimer)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [safeTarget, duration, delay, trigger])

  return value
}
