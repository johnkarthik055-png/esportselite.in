import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, X, Crosshair, Search, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { WEAPON_CATEGORIES } from '../utils/constants.js'

const EASE = [0.22, 1, 0.36, 1]

/**
 * Categorized, searchable weapon picker. Selection logic unchanged:
 * up to 2 weapons, a third pick replaces the oldest.
 */
export default function WeaponPicker({ selected = [], onChange }) {
  const [expanded, setExpanded] = useState(() => new Set(['AR']))
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const reduce = useReducedMotion()

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

  /* Search is purely a view filter — it never changes what is selected.
     While searching, every category with a hit is force-opened so results
     aren't hidden behind a collapsed row. */
  const term = search.trim().toLowerCase()
  const categories = useMemo(() => {
    if (!term) return WEAPON_CATEGORIES.map(c => ({ ...c, shown: c.weapons }))
    return WEAPON_CATEGORIES
      .map(c => ({ ...c, shown: c.weapons.filter(w => w.toLowerCase().includes(term)) }))
      .filter(c => c.shown.length > 0)
  }, [term])

  const totalHits = categories.reduce((n, c) => n + c.shown.length, 0)

  return (
    <div className="wp-wrap">
      {/* ── Header ── */}
      <div className="wp-head">
        <div className="wp-head-row">
          <span className="wp-head-icon"><Crosshair size={14} /></span>
          <span className="wp-head-title">Weapons</span>
          <span className="wp-head-hint">select up to 2</span>
        </div>

        {/* Selected chips */}
        <div className="wp-selected">
          <span className="wp-selected-label">Selected</span>
          {selected.length === 0 ? (
            <span className="wp-selected-none">none yet</span>
          ) : (
            <AnimatePresence initial={false}>
              {selected.map(g => (
                <motion.button
                  key={g}
                  onClick={() => removeGun(g)}
                  title={`Remove ${g}`}
                  aria-label={`Remove ${g}`}
                  className="wp-chip"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.2, ease: EASE }}
                >
                  {g}
                  <X size={12} />
                </motion.button>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ── Search ── */}
      <div className="wp-search-wrap">
        <Search size={14} className="wp-search-icon" aria-hidden />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search weapons…"
          className="wp-search"
          aria-label="Search weapons"
        />
        {search && (
          <button onClick={() => setSearch('')} className="wp-search-clear" aria-label="Clear search">
            <X size={13} />
          </button>
        )}
      </div>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="wp-toast"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            <span className="wp-toast-inner">
              <AlertTriangle size={13} /> {toast}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Categories ── */}
      <div>
        {categories.length === 0 ? (
          <div className="wp-empty">No weapon matches “{search.trim()}”.</div>
        ) : (
          categories.map((cat, idx) => {
            const isOpen = term ? true : expanded.has(cat.id)
            const selectedInCat = cat.weapons.filter(w => selected.includes(w)).length
            return (
              <div key={cat.id} className="wp-cat" style={{ borderTop: idx === 0 ? 'none' : '1px solid #E5EAF3' }}>
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="wp-cat-head"
                  aria-expanded={isOpen}
                  disabled={!!term}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <motion.span
                      animate={{ rotate: isOpen ? 0 : -90 }}
                      transition={{ duration: reduce ? 0 : 0.2, ease: EASE }}
                      style={{ display: 'flex', color: isOpen ? '#2563FF' : '#94A3B8' }}
                    >
                      <ChevronDown size={15} />
                    </motion.span>
                    <span className="wp-cat-label">{cat.label}</span>
                    <span className="wp-cat-short">({cat.short})</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                    {selectedInCat > 0 && (
                      <span className="wp-cat-active">{selectedInCat} active</span>
                    )}
                    <span className="wp-cat-count">{term ? cat.shown.length : cat.weapons.length}</span>
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={reduce
                        ? { duration: 0.12 }
                        : {
                            height: { type: 'spring', stiffness: 340, damping: 34 },
                            opacity: { duration: 0.18, ease: EASE },
                          }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="wp-guns">
                        {cat.shown.map(w => (
                          <GunPill
                            key={w}
                            weapon={w}
                            active={selected.includes(w)}
                            onClick={() => toggleGun(w)}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })
        )}
      </div>

      {term && totalHits > 0 && (
        <div className="wp-hits">{totalHits} match{totalHits === 1 ? '' : 'es'}</div>
      )}

      <style>{styles}</style>
    </div>
  )
}

/* Individual gun pill — neutral default, brand-blue active */
function GunPill({ weapon, active, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      className={`wp-gun ${active ? 'is-active' : ''}`}
      aria-pressed={active}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.15, ease: EASE }}
    >
      {weapon}
    </motion.button>
  )
}

const styles = `
  .wp-wrap {
    background: #FFFFFF; border: 1px solid #E5EAF3; border-radius: 14px; overflow: hidden;
  }

  /* ── Header ── */
  .wp-head {
    padding: 13px 16px; background: #F8FAFD; border-bottom: 1px solid #E5EAF3;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; flex-wrap: wrap;
  }
  .wp-head-row { display: flex; align-items: center; gap: 9px; min-width: 0; }
  .wp-head-icon {
    width: 26px; height: 26px; border-radius: 8px; background: #EAF2FF; color: #2563FF;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .wp-head-title {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 15px;
    text-transform: uppercase; letter-spacing: 0.06em; color: #0B1224;
  }
  .wp-head-hint {
    font-family: 'Inter', sans-serif; font-size: 11.5px; color: #94A3B8;
  }

  .wp-selected { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  .wp-selected-label {
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.12em; color: #64748B;
  }
  .wp-selected-none {
    font-family: 'Inter', sans-serif; font-size: 11.5px; color: #94A3B8; font-style: italic;
  }
  .wp-chip {
    background: #EAF2FF; border: 1px solid rgba(37,99,255,0.25); color: #2563FF;
    padding: 3px 8px 3px 11px; border-radius: 999px; cursor: pointer;
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
    display: inline-flex; align-items: center; gap: 5px;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .wp-chip:hover { background: #FFF0F2; border-color: rgba(239,51,64,0.35); color: #EF3340; }
  }

  /* ── Search ── */
  .wp-search-wrap {
    position: relative; padding: 12px 16px; border-bottom: 1px solid #E5EAF3;
  }
  .wp-search-icon {
    position: absolute; left: 28px; top: 50%; transform: translateY(-50%);
    color: #94A3B8; pointer-events: none;
  }
  .wp-search {
    width: 100%; box-sizing: border-box;
    background: #F8FAFD; border: 1px solid #E5EAF3; border-radius: 10px;
    padding: 8px 34px 8px 34px;
    font-family: 'Inter', sans-serif; font-size: 13px; color: #0B1224;
    outline: none; transition: border-color 0.15s ease, background 0.15s ease;
  }
  .wp-search:focus { border-color: #2563FF; background: #FFFFFF; }
  .wp-search::placeholder { color: #94A3B8; }
  .wp-search-clear {
    position: absolute; right: 26px; top: 50%; transform: translateY(-50%);
    width: 20px; height: 20px; border-radius: 50%;
    background: #E5EAF3; border: none; color: #475569; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }

  /* ── Toast ── */
  .wp-toast { overflow: hidden; background: #FFFBEB; border-bottom: 1px solid rgba(245,158,11,0.25); }
  .wp-toast-inner {
    display: flex; align-items: center; gap: 7px; padding: 9px 16px;
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500; color: #D97706;
  }

  /* ── Categories ── */
  .wp-cat-head {
    width: 100%; display: flex; align-items: center; justify-content: space-between;
    gap: 10px; padding: 12px 16px; background: transparent; border: none;
    cursor: pointer; text-align: left; transition: background 0.15s ease;
  }
  .wp-cat-head:disabled { cursor: default; }
  @media (hover: hover) and (pointer: fine) {
    .wp-cat-head:not(:disabled):hover { background: #F8FAFF; }
  }
  .wp-cat-label {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 14px;
    text-transform: uppercase; letter-spacing: 0.06em; color: #0B1224;
  }
  .wp-cat-short { font-family: 'Inter', sans-serif; font-size: 11.5px; color: #94A3B8; }
  .wp-cat-active {
    background: #EAF2FF; border: 1px solid rgba(37,99,255,0.2); color: #2563FF;
    padding: 2px 8px; border-radius: 999px;
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 9.5px;
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .wp-cat-count {
    font-family: 'Inter', sans-serif; font-size: 11.5px; color: #94A3B8;
    font-variant-numeric: tabular-nums;
  }

  .wp-guns { display: flex; flex-wrap: wrap; gap: 7px; padding: 2px 16px 16px; }
  .wp-gun {
    background: #F8FAFD; border: 1px solid #E5EAF3; color: #475569;
    padding: 6px 13px; border-radius: 9px; cursor: pointer;
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .wp-gun:not(.is-active):hover { border-color: #C7D7FB; color: #0B1224; background: #F2F7FF; }
  }
  .wp-gun.is-active {
    background: linear-gradient(135deg, #2563FF, #5B3DF5); border-color: transparent;
    color: #FFFFFF; font-weight: 600;
    box-shadow: 0 3px 10px rgba(37,99,255,0.26);
  }

  .wp-empty {
    padding: 22px 16px; text-align: center;
    font-family: 'Inter', sans-serif; font-size: 12.5px; color: #94A3B8;
  }
  .wp-hits {
    padding: 0 16px 13px;
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.12em; color: #94A3B8;
  }
`
