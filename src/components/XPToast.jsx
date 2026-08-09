import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { XP_EVENT } from '../utils/xp.js'

let _id = 0

/**
 * Global host that listens for XP_EVENT and stacks small bottom-right
 * "+X XP" toasts. Mount once.
 */
export default function XPToast() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    function on(e) {
      const id = ++_id
      const t = { id, amount: e.detail?.amount || 0, action: e.detail?.action || 'XP gained' }
      setToasts(prev => [...prev, t])
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== id))
      }, 2000)
    }
    window.addEventListener(XP_EVENT, on)
    return () => window.removeEventListener(XP_EVENT, on)
  }, [])

  if (toasts.length === 0 || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed bottom-6 right-6 z-[99] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          className="pointer-events-auto px-4 py-2.5 rounded-md shadow-2xl text-sm flex items-center gap-2 animate-slide-in"
          style={{
            background: 'rgba(0,230,118,0.12)',
            border: '1px solid rgba(0,230,118,0.5)',
            color: '#00E676',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <span className="mono font-bold">+{t.amount} XP</span>
          <span className="text-text-primary text-xs">— {t.action}</span>
        </div>
      ))}
    </div>,
    document.body
  )
}
