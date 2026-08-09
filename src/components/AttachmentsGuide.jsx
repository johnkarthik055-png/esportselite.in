import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import AttachmentCard from './AttachmentCard.jsx'
import AttachmentDetailModal from './AttachmentDetailModal.jsx'
import {
  bgmiAttachments,
  ATTACHMENT_CATEGORIES_ALL,
} from '../data/bgmiAttachments.js'

/**
 * Attachments tab — category pills, search, grid of AttachmentCards,
 * and an AttachmentDetailModal for the selected entry.
 */
export default function AttachmentsGuide() {
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bgmiAttachments.filter(a => {
      if (category !== 'All' && a.category !== category) return false
      if (!q) return true
      return (
        a.name.toLowerCase().includes(q) ||
        a.bestFor?.toLowerCase().includes(q) ||
        a.effect?.toLowerCase().includes(q) ||
        a.recommendedWeapons?.some(w => w.toLowerCase().includes(q))
      )
    })
  }, [category, query])

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
            placeholder="Search attachments, weapons, effects…"
            className="input-field pl-9"
          />
        </div>

        {/* Category pills — horizontally scrollable on mobile */}
        <div className="flex sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible -mx-1 px-1 whitespace-nowrap">
          {ATTACHMENT_CATEGORIES_ALL.map(c => (
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

      {/* Results */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-1">
        <span className="text-xs text-text-secondary heading uppercase tracking-widest">
          {filtered.length} attachment{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="glass clip-corner-sm p-10 text-center border border-dashed border-border">
          <div className="text-3xl mb-2 opacity-70">🔍</div>
          <p className="text-text-secondary text-sm">No attachments match your filter.</p>
          <p className="text-text-muted text-xs mt-1">Try clearing search or picking a different category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(a => (
            <AttachmentCard key={a.id} attachment={a} onClick={setSelected} />
          ))}
        </div>
      )}

      <AttachmentDetailModal
        open={!!selected}
        attachment={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
