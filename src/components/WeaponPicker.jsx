import { useState, useEffect } from 'react'
import { ChevronDown, X, Crosshair } from 'lucide-react'
import { WEAPON_CATEGORIES } from '../utils/constants.js'

/**
 * Categorized weapon picker. Logic unchanged.
 * Visuals: neutral selected chips, muted "N active" badge, clear gun pills.
 */
export default function WeaponPicker({ selected = [], onChange }) {
  const [expanded, setExpanded] = useState(() => new Set(['AR']))
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(t)
  }, [toast])

  function toggleCategory(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGun(weapon) {
    const isSelected = selected.includes(weapon)
    if (isSelected) {
      onChange(selected.filter(g => g !== weapon))
      return
    }
    if (selected.length < 2) {
      onChange([...selected, weapon])
      return
    }
    /* Already 2 selected — replace the oldest. */
    const oldest = selected[0]
    onChange([selected[1], weapon])
    setToast(`Max 2 weapons. Replaced ${oldest}.`)
  }

  function removeGun(weapon) {
    onChange(selected.filter(g => g !== weapon))
  }

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Crosshair size={15} style={{ color: 'var(--text-muted)' }} />
          <span
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontWeight: 700,
              fontSize: 13,
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
            }}
          >
            Weapons
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>(select up to 2)</span>
        </div>

        {/* Selected chip strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="label">Selected:</span>
          {selected.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--text-subtle)', fontStyle: 'italic' }}>none</span>
          ) : (
            selected.map(g => (
              <SelectedChip key={g} weapon={g} onRemove={() => removeGun(g)} />
            ))
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            padding: '8px 16px',
            background: 'var(--amber-tint)',
            borderBottom: '1px solid rgba(245,158,11,0.25)',
            color: 'var(--amber)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ⚠ {toast}
        </div>
      )}

      {/* Categories */}
      <div>
        {WEAPON_CATEGORIES.map((cat, idx) => {
          const isOpen = expanded.has(cat.id)
          const selectedInCat = cat.weapons.filter(w => selected.includes(w)).length
          return (
            <div
              key={cat.id}
              style={{
                borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
              }}
            >
              <button
                onClick={() => toggleCategory(cat.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ChevronDown
                    size={15}
                    style={{
                      color: isOpen ? 'var(--text-muted)' : 'var(--text-subtle)',
                      transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.15s, color 0.15s',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'Bebas Neue, sans-serif',
                      fontWeight: 700,
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.10em',
                    }}
                  >
                    {cat.label}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>({cat.short})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {selectedInCat > 0 && (
                    <span
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {selectedInCat} active
                    </span>
                  )}
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: 'var(--text-subtle)' }}
                  >
                    {cat.weapons.length}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: '4px 16px 16px' }} className="animate-fade-in">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {cat.weapons.map(w => {
                      const active = selected.includes(w)
                      return (
                        <GunPill
                          key={w}
                          weapon={w}
                          active={active}
                          onClick={() => toggleGun(w)}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* Selected weapon chip (top strip) — neutral elevated style */
function SelectedChip({ weapon, onRemove }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onRemove}
      title="Remove"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${hover ? 'var(--text-primary)' : 'var(--text-subtle)'}`,
        color: 'var(--text-primary)',
        padding: '3px 8px 3px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      {weapon}
      <X size={12} style={{ color: 'var(--text-muted)' }} />
    </button>
  )
}

/* Individual gun pill — neutral default, distinct active */
function GunPill({ weapon, active, onClick }) {
  const [hover, setHover] = useState(false)

  let background, borderColor, color, fontWeight
  if (active) {
    background = 'var(--bg-surface)'
    borderColor = 'var(--text-primary)'
    color = 'var(--text-primary)'
    fontWeight = 600
  } else if (hover) {
    background = 'var(--bg-elevated)'
    borderColor = 'var(--text-subtle)'
    color = 'var(--text-primary)'
    fontWeight = 500
  } else {
    background = 'var(--bg-elevated)'
    borderColor = 'var(--border)'
    color = 'var(--text-muted)'
    fontWeight = 500
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background,
        border: `1px solid ${borderColor}`,
        color,
        padding: '5px 12px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 12,
        fontWeight,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      {weapon}
    </button>
  )
}
