import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Plus, Trash2, Gamepad2 } from 'lucide-react'
import { uid } from '../utils/helpers.js'

/**
 * Modal to edit a single day's planned sessions.
 *
 * Rendered through a portal to document.body so it always floats above
 * everything — escaping the PlanCard's backdrop-filter / clip-path
 * containing block (which would otherwise trap a fixed-position child
 * inside the card).
 *
 * Props:
 *  - open
 *  - dayName  — e.g. "Monday"
 *  - day      — the day object being edited { sessions, matchPractice, notes, ... }
 *  - modules  — all modules from esportselite_modules (for the dropdown)
 *  - onClose()
 *  - onSave(updatedDay)
 */
export default function DayEditor({ open, dayName = 'Day', day, modules = [], onClose, onSave }) {
  const [sessions, setSessions] = useState([])
  const [selectedModule, setSelectedModule] = useState('')
  const [duration, setDuration] = useState(30)
  const [matchPractice, setMatchPractice] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setSessions(Array.isArray(day?.sessions) ? day.sessions.map(s => ({ ...s })) : [])
      setMatchPractice(!!day?.matchPractice)
      setNotes(day?.notes || '')
      setSelectedModule(modules[0]?.name || '')
      setDuration(30)
    }
  }, [open, day, modules])

  /* ESC closes. */
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  /* Lock body scroll while open. */
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  function moduleIcon(name) {
    return modules.find(m => m.name === name)?.icon || '🎯'
  }

  function addModule() {
    if (!selectedModule) return
    const mod = modules.find(m => m.name === selectedModule)
    setSessions(prev => [
      ...prev,
      {
        id: 'sess-' + uid(),
        moduleName: selectedModule,
        duration: Number(duration) || 30,
        focus: '',
        drills: mod ? (mod.drills || []).slice(0, 2).map(d => d.name) : [],
        completed: false,
      },
    ])
  }

  function removeSession(id) {
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  function save() {
    onSave({
      ...day,
      sessions,
      matchPractice,
      notes: notes.trim(),
      isRestDay: false,
    })
  }

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full h-full sm:h-auto sm:w-[560px] sm:max-w-[560px] sm:max-h-[85vh] overflow-y-auto bg-bg-elevated border border-[rgba(232,0,28,0.3)] sm:rounded-xl shadow-red-glow-lg animate-slide-in flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border sticky top-0 bg-bg-elevated z-10">
          <div>
            <h3 className="heading text-xl text-white tracking-wide">{dayName}</h3>
            <p className="text-xs text-text-secondary uppercase tracking-widest mt-0.5">
              Edit sessions
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-text-secondary hover:text-white hover:bg-white/5 transition-all"
            title="Close"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 flex-1">
          {/* Add module */}
          <div className="rounded-md border border-border bg-bg-surface/60 p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.15em] text-text-muted heading">
              Add module
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedModule}
                onChange={e => setSelectedModule(e.target.value)}
                className="input-field flex-1"
              >
                {modules.length === 0 && <option value="">No modules available</option>}
                {modules.map(m => (
                  <option key={m.id} value={m.name}>
                    {m.icon} {m.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="240"
                  step="5"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  className="input-field w-24 text-center"
                />
                <span className="text-xs text-text-secondary whitespace-nowrap">mins</span>
              </div>
            </div>
            <button
              onClick={addModule}
              disabled={!selectedModule}
              className="btn-outline px-4 py-2 rounded-md text-xs uppercase tracking-[0.15em] flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={14} /> Add Module
            </button>
          </div>

          {/* Planned sessions */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-text-muted heading mb-2">
              Planned sessions for {dayName}
            </div>
            {sessions.length === 0 ? (
              <div className="text-center py-6 text-text-muted text-sm border border-dashed border-border rounded-md">
                No sessions yet. Add a module above.
              </div>
            ) : (
              <ul className="space-y-2">
                {sessions.map(s => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-bg-surface/60 border border-border"
                  >
                    <span className="text-lg flex-shrink-0">{moduleIcon(s.moduleName)}</span>
                    <span className="flex-1 text-white text-sm truncate">{s.moduleName}</span>
                    <span className="mono text-accent-secondary text-sm whitespace-nowrap">
                      {s.duration} mins
                    </span>
                    <button
                      onClick={() => removeSession(s.id)}
                      className="p-1.5 text-text-muted hover:text-accent-secondary hover:bg-[rgba(232,0,28,0.08)] rounded transition-all flex-shrink-0"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Match practice toggle */}
          <div className="flex items-center justify-between rounded-md border border-border bg-bg-surface/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <Gamepad2 size={16} className="text-accent-secondary" />
              <span className="text-sm text-white heading tracking-wide">Match Practice</span>
            </div>
            <button
              onClick={() => setMatchPractice(v => !v)}
              role="switch"
              aria-checked={matchPractice}
              className={`relative w-12 h-6 rounded-full transition-all flex-shrink-0 ${
                matchPractice ? 'bg-red-gradient shadow-red-glow' : 'bg-bg-surface border border-border'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                  matchPractice ? 'left-[26px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-text-secondary mb-2 heading">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="input-field resize-none"
              placeholder="Any focus notes for this day..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-border bg-bg-elevated sticky bottom-0 z-10">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-md text-sm uppercase tracking-[0.15em] heading font-semibold text-text-secondary hover:text-white border border-border hover:border-text-secondary transition-all"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="btn-red px-5 py-2.5 rounded-md text-sm uppercase tracking-[0.15em] flex items-center gap-2"
          >
            <Save size={15} /> Save Day
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
