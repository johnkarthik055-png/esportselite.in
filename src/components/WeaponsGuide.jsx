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
    <section className="space-y-6">
      {/* Section header — scanline overlay matches Training Center style */}
      <div className="glass clip-corner p-4 sm:p-6 lg:p-8 relative overflow-hidden bg-scanlines">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-accent-primary opacity-[0.10] blur-[100px] pointer-events-none" />
        <div className="absolute top-0 left-0 h-full w-1 bg-red-gradient" />
        <div className="relative z-10">
          <h2 className="heading text-xl sm:text-2xl lg:text-3xl text-white tracking-wide flex items-center gap-3 flex-wrap">
            <Crosshair className="text-accent-secondary" size={22} />
            WEAPONS &amp; ATTACHMENTS{' '}
            <span className="text-gradient-red">GUIDE</span>
          </h2>
          <p className="text-text-secondary mt-2 max-w-2xl text-sm sm:text-base">
            Master every weapon with stats, recoil tips, and loadouts.
          </p>
        </div>
      </div>

      {/* Sub-tabs — horizontally scrollable on mobile */}
      <div className="flex gap-2 border-b border-border overflow-x-auto whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`tab-btn flex items-center gap-2 flex-shrink-0 ${tab === t.id ? 'active' : ''}`}
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

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Controls */}
      <div className="glass clip-corner-sm p-4 lg:p-5 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search weapons, category, ammo…"
            className="input-field pl-9"
          />
        </div>

        {/* Category pills — horizontally scrollable on mobile */}
        <div>
          <div className="text-[10px] heading uppercase tracking-widest text-text-muted mb-1.5">
            Category
          </div>
          <div className="flex sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible -mx-1 px-1 whitespace-nowrap">
            {WEAPON_CATEGORIES_ALL.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`pill text-xs heading uppercase tracking-widest transition-all flex-shrink-0 ${
                  category === c
                    ? 'pill-red shadow-red-glow'
                    : 'hover:border-accent-primary hover:text-white'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Ammo pills — horizontally scrollable on mobile */}
        <div>
          <div className="text-[10px] heading uppercase tracking-widest text-text-muted mb-1.5">
            Ammo
          </div>
          <div className="flex sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible -mx-1 px-1 whitespace-nowrap">
            {WEAPON_AMMO_ALL.map(a => (
              <button
                key={a}
                onClick={() => setAmmo(a)}
                className={`pill text-xs mono transition-all flex-shrink-0 ${
                  ammo === a
                    ? 'pill-red shadow-red-glow'
                    : 'hover:border-accent-primary hover:text-white'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] heading uppercase tracking-widest text-text-muted flex items-center gap-1">
            <ArrowUpDown size={12} /> Sort by
          </span>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value)}
            className="input-field py-1.5 text-sm w-auto"
            style={{ minWidth: 180 }}
          >
            {WEAPON_SORTS.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-1">
        <span className="text-xs text-text-secondary heading uppercase tracking-widest">
          {filtered.length} weapon{filtered.length === 1 ? '' : 's'}
        </span>
        <span className="text-[10px] mono text-text-muted">
          Click a card for full stats & loadout tips
        </span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="glass clip-corner-sm p-10 text-center border border-dashed border-border">
          <Sparkles className="inline-block text-accent-secondary" size={32} />
          <p className="text-text-secondary text-sm mt-3">No weapons match your filter.</p>
          <p className="text-text-muted text-xs mt-1">Try clearing the search or picking a different category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
