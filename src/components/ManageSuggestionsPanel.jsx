import { useEffect, useMemo, useState } from 'react'
import { X, Settings, Eye, EyeOff, Pencil, Trash2, Check } from 'lucide-react'
import { useSuggestions } from '../hooks/useSuggestions.js'
import { useModules } from '../hooks/useModules.js'
import { SUGGESTION_CATEGORIES } from '../utils/constants.js'
import ConfirmModal from './ConfirmModal.jsx'

/**
 * Side-panel for managing the full suggestion catalog.
 * - Defaults can be HIDDEN (toggle) but not deleted
 * - Custom can be renamed / re-categorised / linked to a module / deleted
 */
export default function ManageSuggestionsPanel({ open, onClose }) {
  const {
    suggestions,
    updateSuggestion,
    deleteSuggestion,
    toggleHidden,
  } = useSuggestions()
  const { modules } = useModules()

  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
    } else if (mounted) {
      setClosing(true)
      const t = setTimeout(() => setMounted(false), 250)
      return () => clearTimeout(t)
    }
  }, [open, mounted])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const grouped = useMemo(() => {
    const groups = {}
    SUGGESTION_CATEGORIES.forEach(c => { groups[c.name] = [] })
    suggestions.forEach(s => {
      if (!groups[s.category]) groups[s.category] = []
      groups[s.category].push(s)
    })
    return SUGGESTION_CATEGORIES
      .map(c => ({
        name: c.name,
        icon: c.icon,
        items: (groups[c.name] || []).sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter(g => g.items.length > 0)
  }, [suggestions])

  if (!mounted) return null

  function startEdit(s) {
    setEditingId(s.id)
    setEditName(s.name)
  }
  function saveEdit() {
    if (!editingId) return
    const trimmed = editName.trim()
    if (trimmed) updateSuggestion(editingId, { name: trimmed })
    setEditingId(null)
  }
  function cancelEdit() {
    setEditingId(null)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    deleteSuggestion(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 animate-fade-in" onClick={onClose} />

      <aside
        className={`fixed top-0 right-0 h-screen w-full max-w-[480px] z-50 glass-strong border-l-2 border-accent-primary shadow-2xl flex flex-col ${
          closing ? 'panel-slide-out' : 'panel-slide-in'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg-elevated/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-red-gradient flex items-center justify-center shadow-red-glow">
              <Settings size={16} className="text-white" />
            </div>
            <div>
              <h3 className="heading text-base text-white tracking-wide uppercase">
                Manage Suggestions
              </h3>
              <p className="text-[10px] text-text-secondary uppercase tracking-widest mt-0.5">
                Weakness & strength catalog
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-text-secondary hover:text-white hover:bg-white/5 transition-all"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3">
          {grouped.map(group => (
            <div key={group.name} className="mb-5">
              <div className="px-3 py-1.5 heading text-[10px] uppercase tracking-[0.18em] text-text-muted flex items-center gap-2">
                <span>{group.icon}</span>
                <span>{group.name}</span>
              </div>

              <ul className="space-y-1.5">
                {group.items.map(s => {
                  const isEditing = editingId === s.id
                  return (
                    <li
                      key={s.id}
                      className={`rounded-md border px-3 py-2.5 transition-all ${
                        s.hidden
                          ? 'border-border bg-bg-elevated/20 opacity-60'
                          : 'border-border bg-bg-elevated/40 hover:border-accent-primary'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg flex-shrink-0">{s.icon}</span>

                        {isEditing && !s.isDefault ? (
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit()
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            autoFocus
                            className="input-field flex-1 text-sm py-1.5"
                            maxLength={48}
                          />
                        ) : (
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">{s.name}</div>
                            <div className="text-[10px] uppercase tracking-widest text-text-muted heading mt-0.5">
                              {s.isDefault ? 'default' : 'custom'}
                            </div>
                          </div>
                        )}

                        {/* Linked module dropdown */}
                        <select
                          value={s.linkedModuleId || ''}
                          onChange={e =>
                            updateSuggestion(s.id, {
                              linkedModuleId: e.target.value || null,
                            })
                          }
                          className="input-field py-1.5 text-xs"
                          style={{ maxWidth: 140 }}
                          title="Linked module"
                        >
                          <option value="">— No module —</option>
                          {modules.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.short || m.name}
                            </option>
                          ))}
                        </select>

                        {/* Actions */}
                        {isEditing ? (
                          <>
                            <button
                              onClick={saveEdit}
                              className="p-1.5 text-success hover:bg-success/15 rounded transition-all"
                              title="Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 text-text-secondary hover:bg-white/10 rounded transition-all"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            {!s.isDefault && (
                              <button
                                onClick={() => startEdit(s)}
                                className="p-1.5 text-text-secondary hover:text-white hover:bg-white/10 rounded transition-all"
                                title="Rename"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => toggleHidden(s.id)}
                              className="p-1.5 text-text-secondary hover:text-white hover:bg-white/10 rounded transition-all"
                              title={s.hidden ? 'Show' : 'Hide'}
                            >
                              {s.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            {!s.isDefault && (
                              <button
                                onClick={() => setDeleteTarget(s)}
                                className="p-1.5 text-text-secondary hover:text-accent-secondary hover:bg-[rgba(232,0,28,0.1)] rounded transition-all"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border bg-bg-primary/30 px-5 py-3 text-[11px] text-text-secondary leading-snug">
          Defaults can be <span className="text-text-primary">hidden</span> from suggestions
          but not deleted. Custom items can be fully edited or removed.
        </div>
      </aside>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete suggestion?"
        message={
          deleteTarget && (
            <>
              Permanently remove <strong className="text-white">"{deleteTarget.name}"</strong>.
              Existing match logs that reference it will keep their data but lose the label.
            </>
          )
        }
        confirmLabel="Delete"
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </>
  )
}
