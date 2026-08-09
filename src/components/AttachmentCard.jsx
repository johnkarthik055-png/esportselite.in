import { INLINE_FALLBACK_IMAGE } from '../utils/weaponImages.js'

/**
 * Compact attachment card — image, category badge, name, best-for line,
 * and a "Recommended" preview row.
 */
export default function AttachmentCard({ attachment, onClick }) {
  return (
    <button
      onClick={() => onClick?.(attachment)}
      className="group glass clip-corner-sm overflow-hidden text-left transition-all hover:border-accent-primary hover:shadow-red-glow hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
      title={attachment.name}
    >
      {/* Image */}
      <div className="relative w-full h-28 bg-bg-elevated/60 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(232,0,28,0.04)] to-transparent pointer-events-none" />
        <img
          src={attachment.image}
          alt={attachment.name}
          loading="lazy"
          onError={e => { e.currentTarget.src = INLINE_FALLBACK_IMAGE }}
          className="max-h-24 max-w-full object-contain transition-transform group-hover:scale-105"
        />
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-1.5">
        <span className="pill pill-red text-[10px] heading uppercase tracking-widest">
          {attachment.category}
        </span>

        <div className="heading text-base text-white tracking-wide leading-tight">
          {attachment.name}
        </div>

        <div className="text-xs text-text-secondary leading-snug">
          <span className="text-text-muted heading uppercase tracking-widest">Best for:</span>{' '}
          {attachment.bestFor}
        </div>

        <div className="h-px bg-border my-1.5" />

        <div className="text-[11px] text-text-muted leading-snug">
          <span className="heading uppercase tracking-widest text-text-secondary">Recommended:</span>{' '}
          <span className="mono">
            {attachment.recommendedWeapons?.slice(0, 3).join(', ')}
            {attachment.recommendedWeapons?.length > 3 && '…'}
          </span>
        </div>
      </div>
    </button>
  )
}
