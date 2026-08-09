import { getWeaponImage, INLINE_FALLBACK_IMAGE } from '../utils/weaponImages.js'

/**
 * Single weapon card — image, category badge, name, ammo, and stat strip.
 * Premium dark esports theme — red gradient accents, glassmorphism card.
 *
 * Props:
 *  - weapon: { id, name, category, ammo, damage, dps, magazine, rateOfFire }
 *  - onClick(weapon) — opens detail modal in parent
 */
export default function WeaponCard({ weapon, onClick }) {
  const img = getWeaponImage(weapon.name)
  const rof = weapon.rateOfFire ? Math.round(60 / weapon.rateOfFire) : 0

  return (
    <button
      onClick={() => onClick?.(weapon)}
      className="group glass clip-corner-sm overflow-hidden text-left transition-all hover:border-accent-primary hover:shadow-red-glow hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
      title={`${weapon.name} — ${weapon.category}`}
    >
      {/* Image */}
      <div className="relative w-full h-32 bg-bg-elevated/60 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(232,0,28,0.04)] to-transparent pointer-events-none" />
        <img
          src={img}
          alt={weapon.name}
          loading="lazy"
          onError={e => { e.currentTarget.src = INLINE_FALLBACK_IMAGE }}
          className="max-h-28 max-w-full object-contain transition-transform group-hover:scale-105"
        />
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="pill pill-red text-[10px] heading uppercase tracking-widest">
            {weapon.category}
          </span>
          <span className="text-[10px] mono text-text-secondary">
            🔴 {weapon.ammo}
          </span>
        </div>

        <div className="heading text-lg text-white tracking-wide leading-tight">
          {weapon.name}
        </div>

        <div className="h-px bg-border my-2" />

        {/* Stat strip */}
        <div className="grid grid-cols-4 gap-1">
          <Stat label="DMG" value={weapon.damage || '—'} />
          <Stat label="DPS" value={weapon.dps || '—'} />
          <Stat label="MAG" value={weapon.magazine ?? '—'} />
          <Stat label="ROF" value={rof || '—'} />
        </div>
      </div>
    </button>
  )
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col items-center justify-center px-1 py-1.5 rounded bg-bg-elevated/60 border border-border">
      <span className="mono text-[13px] text-accent-secondary leading-none">{value}</span>
      <span className="heading text-[9px] uppercase tracking-widest text-text-muted mt-0.5">
        {label}
      </span>
    </div>
  )
}
