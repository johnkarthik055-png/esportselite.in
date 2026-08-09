import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Pencil, Trash2, Check, X, Plus, RotateCcw } from 'lucide-react'
import { useTournamentStages } from '../hooks/useTournamentStages.js'
import ConfirmModal from './ConfirmModal.jsx'

/**
 * Custom dropdown for tournament stages.
 * Each row has hover icons for rename / delete. Footer has add-new + restore.
 *
 * Controlled:
 *  - value (string)    → currently selected stage NAME (we store name in matches,
 *                        not id, so renames don't break historical entries)
 *  - onChange(name)
 */
export default function StageManager({ value, onChange }) {
  const { stages, addStage, renameStage, deleteStage, restoreDefaults } = useTournamentStages()

  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const [adding, setAdding] = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const ref = useRef(null)
  const editInputRef = useRef(null)
  const newInputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setEditingId(null)
        setAdding(false)
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        setOpen(false)
        setEditingId(null)
        setAdding(false)
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
    if (editingId) editInputRef.current?.focus()
  }, [editingId])

  useEffect(() => {
    if (adding) newInputRef.current?.focus()
  }, [adding])

  function startEdit(stage) {
    setEditingId(stage.id)
    setEditingValue(stage.name)
  }

  function saveEdit() {
    if (!editingId) return
    const oldName = stages.find(s => s.id === editingId)?.name
    const next = editingValue.trim()
    if (next && next !== oldName) {
      renameStage(editingId, next)
      /* If the renamed stage was currently selected, propagate the new name. */
      if (value === oldName) onChange?.(next)
    }
    setEditingId(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingValue('')
  }

  function saveNew() {
    const trimmed = newStageName.trim()
    if (!trimmed) {
      setAdding(false)
      setNewStageName('')
      return
    }
    const stage = addStage(trimmed)
    if (stage) onChange?.(stage.name)
    setAdding(false)
    setNewStageName('')
  }

  function confirmDelete() {
    if (!deleteTarget) return
    deleteStage(deleteTarget.id)
    if (value === deleteTarget.name) {
      const remaining = stages.filter(s => s.id !== deleteTarget.id)
      onChange?.(remaining[0]?.name || '')
    }
    setDeleteTarget(null)
  }

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="input-field flex items-center justify-between text-left"
      >
        <span className={value ? 'text-text-primary' : 'text-text-muted'}>
          {value || 'Select stage…'}
        </span>
        <ChevronDown
          size={16}
          className={`text-text-secondary transition-transform ${open ? 'rotate-180 text-accent-secondary' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-2 glass-strong rounded-md overflow-hidden shadow-2xl animate-fade-in border border-border">
          <ul className="max-h-72 overflow-y-auto">
            {stages.map(s => {
              const isEditing = editingId === s.id
              const isSelected = value === s.name
              return (
                <li
                  key={s.id}
                  className={`group flex items-center justify-between gap-2 px-3 py-2 transition-all border-l-2 ${
                    isSelected
                      ? 'border-accent-primary bg-[rgba(232,0,28,0.08)]'
                      : 'border-transparent hover:bg-white/[0.04]'
                  }`}
                >
                  {isEditing ? (
                    <>
                      <input
                        ref={editInputRef}
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEdit()
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        className="input-field flex-1 text-sm py-1.5"
                        maxLength={40}
                      />
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
                      <button
                        onClick={() => { onChange?.(s.name); setOpen(false) }}
                        className="flex-1 text-left text-sm text-text-primary py-1"
                      >
                        {s.name}
                        {s.isDefault && (
                          <span className="ml-2 text-[10px] uppercase tracking-widest text-text-muted">
                            default
                          </span>
                        )}
                      </button>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(s)}
                          className="p-1.5 text-text-secondary hover:text-white hover:bg-white/10 rounded transition-all"
                          title="Rename"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(s)}
                          className="p-1.5 text-text-secondary hover:text-accent-secondary hover:bg-[rgba(232,0,28,0.1)] rounded transition-all"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              )
            })}

            {stages.length === 0 && (
              <li className="px-4 py-3 text-sm text-text-muted italic">
                No stages. Add one below or restore defaults.
              </li>
            )}
          </ul>

          {/* Footer */}
          <div className="border-t border-border bg-bg-primary/30">
            {adding ? (
              <div className="flex items-center gap-2 px-3 py-2">
                <input
                  ref={newInputRef}
                  value={newStageName}
                  onChange={e => setNewStageName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveNew()
                    if (e.key === 'Escape') { setAdding(false); setNewStageName('') }
                  }}
                  placeholder="New stage name"
                  className="input-field flex-1 text-sm py-1.5"
                  maxLength={40}
                />
                <button
                  onClick={saveNew}
                  className="p-1.5 text-success hover:bg-success/15 rounded transition-all"
                  title="Add"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => { setAdding(false); setNewStageName('') }}
                  className="p-1.5 text-text-secondary hover:bg-white/10 rounded transition-all"
                  title="Cancel"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-accent-secondary hover:bg-[rgba(232,0,28,0.06)] transition-all heading uppercase tracking-wider text-xs"
              >
                <Plus size={14} /> Add new stage
              </button>
            )}

            <button
              onClick={restoreDefaults}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-text-secondary hover:text-white hover:bg-white/[0.04] transition-all heading uppercase tracking-wider border-t border-border"
            >
              <RotateCcw size={13} /> Restore default stages
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete stage?"
        message={
          deleteTarget && (
            <>
              Remove <strong className="text-white">"{deleteTarget.name}"</strong> from your stage list?
              {' '}Existing tournament logs using this stage will keep showing it.
            </>
          )
        }
        confirmLabel="Delete"
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
