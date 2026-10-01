import { useMemo, useState } from 'react'
import {
  Crosshair,
  Sparkles,
  Target,
  Layers,
  Search,
  ArrowUpDown,
} from 'lucide-react'
import WeaponCard from './WeaponCard.jsx'
import WeaponDetailModal from './WeaponDetailModal.jsx'
import AttachmentsGuide from './AttachmentsGuide.jsx'
import RecommendedLoadouts from './RecommendedLoadouts.jsx'
import {
  pivagaWeapons,
  WEAPON_CATEGORIES_ALL,
  WEAPON_AMMO_ALL,
  WEAPON_SORTS,
} from '../data/pivagaWeapons.js'

/* ============================================================
   WEAPONS & ATTACHMENTS GUIDE — section header + 3-tab switcher
   ============================================================ */
const TABS = [
  { id: 'weapons',     label: 'Weapons',              icon: Crosshair },
  { id: 'attachments', label: 'Attachments',          icon: Target },
  { id: 'loadouts',    label: 'Recommended Loadouts', icon: Layers },
]

export default function WeaponsGuide() {
  const [tab, setTab] = useState('weapons')

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Section header */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E5EAF3',
        borderRadius: 16,
        padding: '24px 28px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(37,99,255,0.04) 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: -40, left: -40, width: 200, height: 200, background: 'radial-gradient(circle, rgba(37,99,255,0.07) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Crosshair size={22} style={{ color: '#2563FF', flexShrink: 0 }} />
          <div>
            <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 24, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
              WEAPONS &amp; ATTACHMENTS <span style={{ color: '#EF3340' }}>GUIDE</span>
            </h2>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#64748B', margin: '4px 0 0' }}>
              Master every weapon with stats, recoil tips, and loadouts.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E5EAF3',
        borderRadius: 12,
        padding: 4,
        display: 'flex',
        gap: 4,
        overflowX: 'auto',
      }}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 13,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.2s',
                ...(active ? {
                  background: 'linear-gradient(135deg,#2563FF,#5B3DF5)',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(37,99,255,0.25)',
                } : {
                  background: 'transparent',
                  color: '#475569',
                }),
              }}
            >
              <Icon size={16} /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'weapons' && <WeaponsTab />}
      {tab === 'attachments' && <AttachmentsGuide />}
      {tab === 'loadouts' && <RecommendedLoadouts />}
    </section>
  )
}

/* ============================================================
   WEAPONS TAB — search + category + ammo + sort + grid
   ============================================================ */
function WeaponsTab() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [ammo, setAmmo] = useState('All')
  const [sortKey, setSortKey] = useState('damage')
  const [selected, setSelected] = useState(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = pivagaWeapons.filter(w => {
      if (category !== 'All' && w.category !== category) return false
      if (ammo !== 'All' && w.ammo !== ammo) return false
      if (!q) return true
      return (
        w.name.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q) ||
        (w.ammo || '').toLowerCase().includes(q)
      )
    })

    /* Sort descending on the chosen stat (treat missing as 0). */
    list = [...list].sort((a, b) => {
      const av = Number(a[sortKey]) || 0
      const bv = Number(b[sortKey]) || 0
      return bv - av
    })

    return list
  }, [query, category, ammo, sortKey])

  const inputStyle = {
    background: '#FFFFFF',
    border: '1px solid #E5EAF3',
    borderRadius: 8,
    padding: '8px 12px',
    fontFamily: 'Inter, sans-serif',
    fontSize: 14,
    color: '#0B1224',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const pillBase = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 11,
    fontFamily: 'Rajdhani, sans-serif',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    cursor: 'pointer',
    border: '1px solid #E5EAF3',
    transition: 'all 0.15s',
    flexShrink: 0,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Controls */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E5EAF3', borderRadius: 16, padding: 20, boxShadow: '0 4px 20px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search weapons, category, ammo…"
            style={{ ...inputStyle, paddingLeft: 36 }}
          />
        </div>

        {/* Category pills */}
        <div>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94A3B8', marginBottom: 8 }}>
            Category
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {WEAPON_CATEGORIES_ALL.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                style={{
                  ...pillBase,
                  ...(category === c ? {
                    background: '#2563FF',
                    borderColor: '#2563FF',
                    color: '#fff',
                  } : {
                    background: '#F8FAFD',
                    color: '#475569',
                  }),
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Ammo pills */}
        <div>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94A3B8', marginBottom: 8 }}>
            Ammo
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {WEAPON_AMMO_ALL.map(a => (
              <button
                key={a}
                onClick={() => setAmmo(a)}
                style={{
                  ...pillBase,
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  textTransform: 'none',
                  letterSpacing: 0,
                  ...(ammo === a ? {
                    background: '#2563FF',
                    borderColor: '#2563FF',
                    color: '#fff',
                  } : {
                    background: '#F8FAFD',
                    color: '#475569',
                  }),
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94A3B8', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
            <ArrowUpDown size={12} /> Sort by
          </span>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value)}
            style={{ ...inputStyle, width: 'auto', minWidth: 180, padding: '6px 12px' }}
          >
            {WEAPON_SORTS.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Result count */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '0 4px' }}>
        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569' }}>
          {filtered.length} weapon{filtered.length === 1 ? '' : 's'}
        </span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#94A3B8' }}>
          Click a card for full stats &amp; loadout tips
        </span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px dashed #E5EAF3', borderRadius: 16, padding: 40, textAlign: 'center' }}>
          <Sparkles style={{ color: '#2563FF', display: 'inline-block' }} size={32} />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#475569', marginTop: 12 }}>No weapons match your filter.</p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Try clearing the search or picking a different category.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {filtered.map(w => (
            <WeaponCard key={w.id} weapon={w} onClick={setSelected} />
          ))}
        </div>
      )}

      <WeaponDetailModal
        open={!!selected}
        weapon={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
