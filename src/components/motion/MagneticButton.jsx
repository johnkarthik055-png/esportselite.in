import { motion } from 'framer-motion'
import { useRef, useState } from 'react'

/**
 * Button that subtly drifts toward the cursor on hover.
 * Reserved for primary CTAs — use sparingly (max 2 per page).
 */
export default function MagneticButton({
  children,
  className,
  onClick,
  style,
  strength = 0.25,
  disabled = false,
  type = 'button',
  ...rest
}) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  function handleMouseMove(e) {
    if (!ref.current || disabled) return
    const rect = ref.current.getBoundingClientRect()
    const x = (e.clientX - rect.left - rect.width / 2) * strength
    const y = (e.clientY - rect.top - rect.height / 2) * strength
    setPos({ x, y })
  }

  function handleMouseLeave() {
    setPos({ x: 0, y: 0 })
  }

  return (
    <motion.button
      ref={ref}
      type={type}
      className={className}
      style={style}
      onClick={onClick}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: 'spring', stiffness: 150, damping: 12, mass: 0.1 }}
      {...rest}
    >
      {children}
    </motion.button>
  )
}
