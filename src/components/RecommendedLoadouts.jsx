import { Lightbulb } from 'lucide-react'
import { bgmiLoadouts } from '../data/bgmiLoadouts.js'
import { getWeaponImage, INLINE_FALLBACK_IMAGE } from '../utils/weaponImages.js'

/**
 * Recommended loadouts tab — curated weapon + attachment combos.
 * Each card matches the premium dark esports theme: glassmorphism,
 * red gradient left border, gold weapon name, red neon hover glow.
 */
export default function RecommendedLoadouts() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2 px-1">
        <span className="text-xs text-text-secondary heading uppercase tracking-widest">
          {bgmiLoadouts.length} curated loadouts
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {bgmiLoadouts.map(l => (
          <LoadoutCard key={l.id} loadout={l} />
        ))}
      </div>
    </div>
  )
}

function LoadoutCard({ loadout }) {
  /* If the loadout names multiple alt weapons, use the first one for the image. */
  const heroWeapon = Array.isArray(loadout.weapons) && loadout.weapons.length > 0
    ? loadout.weapons[0]
    : loadout.weapon
  const img = getWeaponImage(heroWeapon)

  return (
    <div className="glass clip-corner-sm p-5 relative overflow-hidden border-l-[3px] border-l-accent-primary hover:border-accent-primary hover:shadow-red-glow transition-all">
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-accent-primary opacity-[0.07] blur-3xl rounded-full pointer-events-none" />

      {/* Header — image + name */}
      <div className="relative z-10 flex items-center gap-4 mb-4">
        <div className="w-24 h-20 flex-shrink-0 bg-bg-elevated/60 border border-border rounded-md flex items-center justify-center overflow-hidden">
          <img
            src={img}
            alt={heroWeapon}
            onError={e => { e.currentTarget.src = INLINE_FALLBACK_IMAGE }}
            className="max-h-16 max-w-full object-contain"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="heading text-lg text-white tracking-wide leading-tight">
            {loadout.name}
          </h4>
          <div className="mt-1 text-sm" style={{ color: '#FFD700' }}>
            {loadout.weapon}
          </div>
          {loadout.bestFor && (
            <span className="inline-block mt-2 pill pill-red text-[10px] heading uppercase tracking-widest">
              {loadout.bestFor}
            </span>
          )}
        </div>
      </div>

      <div className="h-px bg-border mb-3 relative z-10" />

      {/* Attachments */}
      <div className="relative z-10">
        <div className="heading text-xs uppercase tracking-[0.18em] text-accent-secondary mb-2">
          Attachments
        </div>
        <ul className="space-y-1.5">
          {loadout.attachments.map((a, i) => (
            <li
              key={i}
              className="flex items-center gap-2 text-sm text-text-primary"
            >
              <span className="text-base flex-shrink-0">{a.icon}</span>
              <span>{a.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="h-px bg-border my-3 relative z-10" />

      {/* Tip */}
      <div className="relative z-10 flex items-start gap-2 text-xs text-text-secondary leading-relaxed">
        <Lightbulb size={14} className="text-accent-secondary flex-shrink-0 mt-0.5" />
        <span>
          <span className="heading uppercase tracking-widest text-text-muted">Tip:</span>{' '}
          {loadout.tip}
        </span>
      </div>
    </div>
  )
}
