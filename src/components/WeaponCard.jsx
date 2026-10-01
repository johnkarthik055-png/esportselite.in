import { getWeaponImage, INLINE_FALLBACK_IMAGE } from '../utils/weaponImages.js'

/**
 * Single weapon card — image, category badge, name, ammo, and stat strip.
 * Premium white esports theme.
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
      title={`${weapon.name} — ${weapon.category}`}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5EAF3',
        borderRadius: 16,
        overflow: 'hidden',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
        padding: 0,
        width: '100%',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#2563FF'
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,255,0.15)'
        e.currentTarget.style.transform = 'scale(1.02)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#E5EAF3'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.04)'
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      {/* Image */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: 128,
        background: '#F8FAFD',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(37,99,255,0.03), transparent)', pointerEvents: 'none' }} />
        <img
          src={img}
          alt={weapon.name}
          loading="lazy"
          onError={e => { e.currentTarget.src = INLINE_FALLBACK_IMAGE }}
          style={{ maxHeight: 112, maxWidth: '100%', objectFit: 'contain' }}
        />
      </div>

      {/* Body */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{
            background: '#EEF4FF',
            color: '#2563FF',
            border: '1px solid rgba(37,99,255,0.15)',
            borderRadius: 20,
            padding: '2px 10px',
            fontSize: 10,
            fontFamily: 'Rajdhani, sans-serif',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            {weapon.category}
          </span>
          <span style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', color: '#64748B' }}>
            🔴 {weapon.ammo}
          </span>
        </div>

        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 18, color: '#0B1224', letterSpacing: '0.02em', lineHeight: 1.1 }}>
          {weapon.name}
        </div>

        <div style={{ height: 1, background: '#E5EAF3' }} />

        {/* Stat strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6px 4px',
      borderRadius: 8,
      background: '#F8FAFD',
      border: '1px solid #E5EAF3',
    }}>
      <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, color: '#2563FF', lineHeight: 1 }}>{value}</span>
      <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', marginTop: 2 }}>
        {label}
      </span>
    </div>
  )
}
