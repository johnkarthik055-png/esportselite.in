import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const EASE = [0.16, 1, 0.3, 1]

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE },
  },
}

/**
 * Wraps children that should animate in sequence with a small delay
 * between each. Use with <StaggerItem> children.
 *
 * Optional `staggerChildren` override for places that need a faster
 * cascade (e.g. the login card uses 0.08).
 */
export function StaggerGroup({
  children,
  className,
  style,
  staggerChildren,
  delayChildren,
  once = false,
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once, margin: '-80px 0px' })

  const variants =
    staggerChildren != null || delayChildren != null
      ? {
          hidden: {},
          show: {
            transition: {
              staggerChildren: staggerChildren ?? 0.12,
              delayChildren:   delayChildren   ?? 0.1,
            },
          },
        }
      : container

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      variants={variants}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className, style }) {
  return (
    <motion.div className={className} style={style} variants={item}>
      {children}
    </motion.div>
  )
}
