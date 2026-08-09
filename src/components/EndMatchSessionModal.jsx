import { useEffect, useState } from 'react'
import { X, CheckCircle2, Trophy } from 'lucide-react'
import { MATCH_PERFORMANCES } from '../utils/constants.js'

/**
 * "End Match Session" modal — for the Match Logger tab.
 *
 * Props:
 *  - open
 *  - matchCount
 *  - onClose()
 *  - onConfirm({ performance, takeaway })
 */
export default function EndMatchSessionModal({
  open,
  matchCount = 0,
  onClose,
  onConfirm,
}) {
  const [performance, setPerformance] = useState(null)
  const [takeaway, setTakeaway] = useState('')

  useEffect(() => {
    if (open) {
      setPerformance(null)
      setTakeaway('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function submit() {
    onConfirm?.({ performance, takeaway })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg glass-strong clip-corner border border-[rgba(232,0,28,0.4)] shadow-red-glow-lg animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-accent-primary opacity-[0.15] blur-3xl rounded-full pointer-events-none" />
        <div className="absolute top-0 left-0 w-1 h-full bg-red-gradient" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-red-gradient flex items-center justify-center shadow-red-glow">
              <Trophy size={18} className="text-white" />
            </div>
            <h3 className="heading text-xl text-white tracking-wide">
              End Today's Match Session?
            </h3>
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
        <div className="relative z-10 p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Summary */}
          <div className="rounded-md border border-border bg-bg-elevated/50 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest heading text-text-secondary">
              Total matches
            </div>
            <div className="text-2xl text-white mt-1 mono">{matchCount}</div>
          </div>

          {/* Performance */}
          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-text-secondary mb-2 heading">
              Overall performance
            </label>
            <div className="grid grid-cols-3 gap-2">
              {MATCH_PERFORMANCES.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPerformance(p.id)}
                  className={`flex items-center justify-center gap-2 py-3 rounded-md border heading uppercase tracking-widest text-xs transition-all ${
                    performance === p.id
                      ? 'border-accent-primary bg-[rgba(232,0,28,0.12)] text-white shadow-red-glow'
                      : 'border-border bg-bg-elevated/40 text-text-secondary hover:text-white hover:border-accent-secondary'
                  }`}
                >
                  <span className="text-lg">{p.emoji}</span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Takeaway */}
          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-text-secondary mb-2 heading">
              Key takeaway
            </label>
            <textarea
              value={takeaway}
              onChange={e => setTakeaway(e.target.value)}
              rows={3}
              maxLength={400}
              placeholder="What's the single biggest lesson from today's matches?"
              className="input-field resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-end gap-3 px-6 py-5 border-t border-border bg-bg-primary/40">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-md text-sm uppercase tracking-[0.15em] heading font-semibold text-text-secondary hover:text-white border border-border hover:border-text-secondary transition-all"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="btn-red px-5 py-2.5 rounded-md text-sm uppercase tracking-[0.15em] flex items-center gap-2"
          >
            <CheckCircle2 size={15} /> End Session
          </button>
        </div>
      </div>
    </div>
  )
}
