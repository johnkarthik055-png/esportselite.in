import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const EASE = [0.16, 1, 0.3, 1]

/**
 * Scroll-triggered fade + slide reveal.
 *
 * Props:
 *   delay      — seconds before this element animates in
 *   direction  — 'up' | 'down' | 'left' | 'right' | 'none'
 *   distance   — px to slide from (default 24)
 *   duration   — animation length in seconds
 *   once       — only fire the first time we enter view
 */
export default function Reveal({
  children,
  delay = 0,
  direction = 'up',
  distance = 24,
  duration = 0.6,
  once = false,
  style,
  className,
}) {
  const ref = useRef(null)
  const inView = useInView(ref, {
    once,
    margin: '-80px 0px -80px 0px',
  })

  const offsets = {
    up:    { y: distance },
    down:  { y: -distance },
    left:  { x: distance },
    right: { x: -distance },
    none:  {},
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{ opacity: 0, ...offsets[direction] }}
      animate={inView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, ...offsets[direction] }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
