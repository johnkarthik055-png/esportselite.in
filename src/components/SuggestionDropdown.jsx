import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, X, Plus, Settings, Check, Search } from 'lucide-react'
import { useSuggestions } from '../hooks/useSuggestions.js'
import ManageSuggestionsPanel from './ManageSuggestionsPanel.jsx'

/**
 * Multi-select dropdown for weakness / strength tags.
 *
 * Controlled:
 *  - value:  string[] of suggestion IDs
 *  - onChange(ids)
 *  - placeholder
 */
export default function SuggestionDropdown({
  value = [],
  onChange,
  placeholder = 'Pick one or type to add…',
}) {
  const { suggestions, groupedByCategory, getById, addCustom } = useSuggestions()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [managerOpen, setManagerOpen] = useState(false)
  const ref = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  const selectedSuggestions = useMemo(
    () => value.map(id => getById(id)).filter(Boolean),
    [value, getById]
  )

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groupedByCategory
    return groupedByCategory
      .map(g => ({
        ...g,
        items: g.items.filter(s => s.name.toLowerCase().includes(q)),
      }))
      .filter(g => g.items.length > 0)
  }, [groupedByCategory, query])

  const trimmedQuery = query.trim()
  const exactMatch = trimmedQuery
    ? suggestions.find(s => s.name.toLowerCase() === trimmedQuery.toLowerCase())
    : null
  const canAddCustom = trimmedQuery.length > 0 && !exactMatch

  function toggle(id) {
    if (!onChange) return
    if (value.includes(id)) onChange(value.filter(v => v !== id))
    else onChange([...value, id])
  }

  function removeChip(id) {
    if (!onChange) return
    onChange(value.filter(v => v !== id))
  }

  function addCustomFromQuery() {
    if (!canAddCustom) return
    const sug = addCustom({ name: trimmedQuery, category: 'Custom' })
    if (sug && onChange) onChange([...value, sug.id])
    setQuery('')
  }

  return (
    <div className="relative" ref={ref}>
      {/* Chips of selected items */}
      {selectedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedSuggestions.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => removeChip(s.id)}
              className="pill pill-red text-xs flex items-center gap-1.5 hover:bg-[rgba(232,0,28,0.2)] transition-all"
              title="Remove"
            >
              <span>{s.icon}</span>
              <span>{s.name}</span>
              <X size={11} />
            </button>
          ))}
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="input-field flex items-center justify-between text-left"
      >
        <span className="text-text-muted flex items-center gap-2 truncate">
          <Search size={14} />
          {selectedSuggestions.length === 0
            ? placeholder
            : `Add another${selectedSuggestions.length > 0 ? ` (${selectedSuggestions.length} selected)` : ''}…`}
        </span>
        <ChevronDown
          size={16}
          className={`text-text-secondary transition-transform ${open ? 'rotate-180 text-accent-secondary' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-2 glass-strong rounded-md overflow-hidden shadow-2xl dropdown-in border border-border">
          {/* Search input */}
          <div className="px-3 py-2 border-b border-border bg-bg-elevated/60">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search or type to add custom…"
              className="input-field text-sm py-1.5"
              onKeyDown={e => {
                if (e.key === 'Enter' && canAddCustom) {
                  e.preventDefault()
                  addCustomFromQuery()
                }
              }}
            />
          </div>

          <div className="max-h-72 overflow-y-auto">
            {/* Add custom row */}
            {canAddCustom && (
              <button
                onClick={addCustomFromQuery}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-accent-secondary hover:bg-[rgba(232,0,28,0.08)] transition-all border-b border-border"
              >
                <Plus size={14} />
                <span className="heading uppercase tracking-wider text-xs">Add custom:</span>
                <span className="text-white">"{trimmedQuery}"</span>
              </button>
            )}

            {filteredGroups.length === 0 && !canAddCustom && (
              <div className="px-4 py-6 text-center text-sm text-text-muted">
                No matches. Type to add a custom tag.
              </div>
            )}

            {/* Groups */}
            {filteredGroups.map(group => (
              <div key={group.name}>
                <div className="px-4 py-1.5 bg-bg-primary/40 border-y border-border heading text-[10px] uppercase tracking-[0.18em] text-text-muted flex items-center gap-2">
                  <span>{group.icon}</span>
                  <span>{group.name}</span>
                </div>
                <ul>
                  {group.items.map(s => {
                    const selected = value.includes(s.id)
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => toggle(s.id)}
                          className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-sm transition-all border-l-2 ${
                            selected
                              ? 'border-accent-primary bg-[rgba(232,0,28,0.08)] text-white'
                              : 'border-transparent text-text-primary hover:bg-white/[0.03]'
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <span>{s.icon}</span>
                            <span className="truncate">{s.name}</span>
                          </span>
                          {selected && (
                            <Check size={14} className="text-accent-secondary flex-shrink-0" />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-border bg-bg-primary/40 flex items-center justify-between px-3 py-2">
            <button
              onClick={() => { setOpen(false); setQuery(''); setManagerOpen(true) }}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-secondary hover:text-accent-secondary heading uppercase tracking-widest transition-all"
            >
              <Settings size={12} /> Manage suggestions
            </button>
            <button
              onClick={() => { setOpen(false); setQuery('') }}
              className="px-3 py-1 text-xs text-text-secondary hover:text-white heading uppercase tracking-widest transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <ManageSuggestionsPanel
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
      />
    </div>
  )
}
