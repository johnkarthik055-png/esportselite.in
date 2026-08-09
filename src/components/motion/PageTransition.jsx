import { motion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1]

/**
 * Route-level fade + slide transition. Wrap each public page's
 * outermost element in this so AnimatePresence can detect mount/unmount.
 */
export default function PageTransition({ children, className, style }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
