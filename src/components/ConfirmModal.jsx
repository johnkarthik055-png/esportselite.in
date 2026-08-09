import { useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'

/**
 * Reusable confirmation modal for destructive actions.
 *
 * Props:
 *  - open
 *  - title       — heading text
 *  - message     — body text (string or JSX)
 *  - confirmLabel
 *  - cancelLabel
 *  - destructive — apply red gradient to confirm button (default true)
 *  - onClose()
 *  - onConfirm()
 */
export default function ConfirmModal({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  onClose,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md glass-strong clip-corner border border-[rgba(232,0,28,0.4)] shadow-red-glow-lg animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-accent-primary opacity-[0.15] blur-3xl rounded-full pointer-events-none" />
        <div className="absolute top-0 left-0 w-1 h-full bg-red-gradient" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-red-gradient flex items-center justify-center shadow-red-glow">
              <AlertTriangle size={18} className="text-white" />
            </div>
            <h3 className="heading text-lg text-white tracking-wide">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-text-secondary hover:text-white hover:bg-white/5 transition-all"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="relative z-10 px-6 py-5 text-sm text-text-secondary leading-relaxed">
          {message}
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-bg-primary/40">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-md text-sm uppercase tracking-[0.15em] heading font-semibold text-text-secondary hover:text-white border border-border hover:border-text-secondary transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => { onConfirm?.(); }}
            className={
              destructive
                ? 'btn-red px-5 py-2.5 rounded-md text-sm uppercase tracking-[0.15em]'
                : 'btn-outline px-5 py-2.5 rounded-md text-sm uppercase tracking-[0.15em]'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
