import { useEffect } from 'react'
import { X, Flame, Sparkles, Target, Crosshair } from 'lucide-react'
import { INLINE_FALLBACK_IMAGE } from '../utils/weaponImages.js'

/**
 * Detail modal for a single attachment — image, effect, best-for badge,
 * recommended weapon chips, and a pro tip panel.
 */
export default function AttachmentDetailModal({ open, attachment, onClose }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !attachment) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full sm:h-auto sm:max-w-2xl glass-strong sm:clip-corner border border-[rgba(232,0,28,0.4)] shadow-red-glow-lg animate-slide-in sm:max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-accent-primary opacity-[0.15] blur-3xl rounded-full pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-1 bg-red-gradient" />

        {/* Header */}
        <div className="relative z-10 flex items-start justify-between gap-3 px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-md bg-red-gradient flex items-center justify-center shadow-red-glow">
              <Crosshair size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="heading text-2xl text-white tracking-wide">{attachment.name}</h3>
                <span className="pill pill-red text-[10px] heading uppercase tracking-widest">
                  {attachment.category}
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">{attachment.bestFor}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-text-secondary hover:text-accent-secondary hover:bg-white/5 transition-all"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="relative z-10 p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Image */}
          <div className="flex items-center justify-center bg-bg-elevated/40 border border-border rounded-md p-6 min-h-[180px]">
            <img
              src={attachment.image}
              alt={attachment.name}
              onError={e => { e.currentTarget.src = INLINE_FALLBACK_IMAGE }}
              className="max-w-full max-h-48 object-contain"
            />
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div>
              <SectionTitle icon={<Sparkles size={14} />} label="Effect" />
              <p className="mt-2 text-sm text-text-primary leading-relaxed">
                {attachment.effect}
              </p>
            </div>

            <div>
              <SectionTitle icon={<Target size={14} />} label="Best For" />
              <span className="inline-block mt-2 px-3 py-1.5 rounded-md bg-[rgba(232,0,28,0.12)] border border-[rgba(232,0,28,0.4)] text-accent-secondary heading text-xs uppercase tracking-widest">
                {attachment.bestFor}
              </span>
            </div>
          </div>
        </div>

        {/* Recommended Weapons */}
        {attachment.recommendedWeapons?.length > 0 && (
          <div className="relative z-10 px-6 pb-4 space-y-2">
            <SectionTitle icon={<Crosshair size={14} />} label="Recommended Weapons" />
            <div className="flex flex-wrap gap-2 mt-1">
              {attachment.recommendedWeapons.map(w => (
                <span key={w} className="pill pill-red text-xs mono">
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Pro tip */}
        {attachment.proTip && (
          <div className="relative z-10 px-6 pb-7 mt-1">
            <div className="rounded-md border border-accent-primary/50 bg-[rgba(232,0,28,0.08)] px-4 py-3">
              <div className="flex items-center gap-2 text-accent-secondary heading text-xs uppercase tracking-widest mb-1.5">
                <Flame size={12} /> Pro Tip
              </div>
              <p className="text-sm text-text-primary leading-relaxed">{attachment.proTip}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionTitle({ icon, label }) {
  return (
    <div className="flex items-center gap-2 text-accent-secondary heading text-xs uppercase tracking-[0.18em]">
      {icon}
      {label}
    </div>
  )
}
