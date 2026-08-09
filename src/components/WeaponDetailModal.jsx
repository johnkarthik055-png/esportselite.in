import { useEffect } from 'react'
import { X, Crosshair, Target, Sparkles, Lightbulb, Leaf, Flame } from 'lucide-react'
import { getWeaponImage, INLINE_FALLBACK_IMAGE } from '../utils/weaponImages.js'

/**
 * Weapon detail modal. Logic untouched — visuals rebuilt against the
 * new pivaga-style design system. No red borders or coloured glows.
 */
export default function WeaponDetailModal({ open, weapon, onClose }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !weapon) return null

  const img = getWeaponImage(weapon.name)
  const rof = weapon.rateOfFire ? Math.round(60 / weapon.rateOfFire) : null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: 720,
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 40, height: 40,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Crosshair size={18} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    fontWeight: 700,
                    fontSize: 22,
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  {weapon.name}
                </h3>
                <span className="badge">{weapon.category}</span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-subtle)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginTop: 4,
                }}
              >
                {weapon.ammo}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close (Esc)"
            style={{
              width: 32, height: 32,
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              border: '1px solid transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body grid */}
        <div
          style={{
            padding: 24,
            display: 'grid',
            gap: 24,
            gridTemplateColumns: '1fr',
          }}
          className="weapon-body-grid"
        >
          {/* Image panel */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 180,
            }}
          >
            <img
              src={img}
              alt={weapon.name}
              onError={(e) => { e.currentTarget.src = INLINE_FALLBACK_IMAGE }}
              style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
            />
          </div>

          {/* Stats panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <SectionTitle icon={<Sparkles size={13} />} label="Stats" />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <StatBadge label="Damage"      value={weapon.damage || '—'} />
                <StatBadge label="DPS"         value={weapon.dps || '—'} />
                <StatBadge label="Magazine"    value={weapon.magazine ?? '—'} />
                <StatBadge label="Firing Mode" value={weapon.firingMode || '—'} small />
                <StatBadge label="Range"       value={weapon.range || '—'} />
                <StatBadge label="Bullet Speed" value={weapon.bulletSpeed ? `${weapon.bulletSpeed} m/s` : '—'} />
                <StatBadge label="Rate of Fire" value={rof ? `${rof} rpm` : '—'} />
                <StatBadge label="ROF (s/shot)" value={weapon.rateOfFire ? `${weapon.rateOfFire.toFixed(2)}s` : '—'} />
              </div>
            </div>

            <div>
              <SectionTitle icon={<Target size={13} />} label="Damage Table (Level 2 Armor)" />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <DamageRow label="Body hits to kill" value={weapon.hitsToKill?.body ?? '—'} />
                <DamageRow label="Head hits to kill" value={weapon.hitsToKill?.head ?? '—'} />
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        {(weapon.tips?.beginner || weapon.tips?.pro) && (
          <div style={{ padding: '0 24px 24px' }}>
            <SectionTitle icon={<Lightbulb size={13} />} label="Tips" />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 10,
                marginTop: 8,
              }}
            >
              {weapon.tips?.beginner && (
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderLeft: '3px solid var(--green)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.10em',
                      textTransform: 'uppercase',
                      color: 'var(--green)',
                      marginBottom: 8,
                    }}
                  >
                    <Leaf size={12} /> Beginner Tip
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    {weapon.tips.beginner}
                  </p>
                </div>
              )}
              {weapon.tips?.pro && (
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderLeft: '3px solid var(--blue)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.10em',
                      textTransform: 'uppercase',
                      color: 'var(--blue)',
                      marginBottom: 8,
                    }}
                  >
                    <Flame size={12} /> Pro Tip
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    {weapon.tips.pro}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recommended attachments */}
        {weapon.recommendedAttachments?.length > 0 && (
          <div style={{ padding: '0 24px 24px' }}>
            <SectionTitle icon={<Crosshair size={13} />} label="Recommended Attachments" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {weapon.recommendedAttachments.map(a => (
                <span key={a} className="badge">{a}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 768px) {
          .weapon-body-grid { grid-template-columns: 2fr 3fr; }
        }
      `}</style>
    </div>
  )
}

function SectionTitle({ icon, label }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 600,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.10em',
        color: 'var(--text-subtle)',
      }}
    >
      {icon && <span style={{ color: 'var(--text-subtle)' }}>{icon}</span>}
      {label}
    </div>
  )
}

function StatBadge({ label, value, small }) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 12px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-subtle)',
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontWeight: 700,
          fontSize: small ? 13 : 15,
          color: 'var(--text-primary)',
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function DamageRow({ label, value }) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-subtle)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontWeight: 700,
          fontSize: 16,
          color: 'var(--text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  )
}
