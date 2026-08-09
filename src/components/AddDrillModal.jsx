import { useEffect, useState } from 'react'
import { X, Save, Plus } from 'lucide-react'

/**
 * Add or edit a custom drill.
 *
 * Props:
 *  - open: boolean
 *  - mode: 'add' | 'edit'
 *  - initial: { name, description } when editing
 *  - moduleName: string — shown for context in the header
 *  - onClose()
 *  - onSubmit({ name, description })
 */
export default function AddDrillModal({
  open,
  mode = 'add',
  initial,
  moduleName,
  onClose,
  onSubmit,
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(initial?.name || '')
      setDescription(initial?.description || '')
      setError('')
    }
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Drill name is required.')
      return
    }
    onSubmit({
      name: trimmed,
      description: description.trim(),
    })
  }

  const title = mode === 'edit' ? 'Edit Drill' : 'Add New Drill'
  const cta = mode === 'edit' ? 'Save Changes' : 'Add Drill'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md glass-strong clip-corner border border-[rgba(232,0,28,0.4)] shadow-red-glow-lg animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-accent-primary opacity-[0.15] blur-3xl rounded-full pointer-events-none" />
        <div className="absolute top-0 left-0 w-1 h-full bg-red-gradient" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-red-gradient flex items-center justify-center shadow-red-glow">
              <Plus size={18} className="text-white" />
            </div>
            <div>
              <h3 className="heading text-xl text-white tracking-wide">{title}</h3>
              {moduleName && (
                <p className="text-xs text-text-secondary uppercase tracking-widest mt-0.5">
                  {moduleName}
                </p>
              )}
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
        <div className="relative z-10 p-6 space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-text-secondary mb-2 heading">
              Drill Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="e.g. KAR98k No-Scope Headshots"
              className="input-field"
              autoFocus
              maxLength={64}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-text-secondary mb-2 heading">
              Description <span className="text-text-muted normal-case">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this drill focus on?"
              rows={3}
              className="input-field resize-none"
              maxLength={200}
            />
          </div>

          {error && (
            <div className="text-sm text-accent-secondary bg-[rgba(232,0,28,0.08)] border border-[rgba(232,0,28,0.3)] rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-end gap-3 px-6 py-5 border-t border-border bg-bg-primary/40">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-md text-sm uppercase tracking-[0.15em] heading font-semibold text-text-secondary hover:text-white border border-border hover:border-text-secondary transition-all"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="btn-red px-5 py-2.5 rounded-md text-sm uppercase tracking-[0.15em] flex items-center gap-2"
          >
            <Save size={15} /> {cta}
          </button>
        </div>
      </div>
    </div>
  )
}
