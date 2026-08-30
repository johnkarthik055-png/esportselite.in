import { useEffect } from 'react'
import { X, Save, AlertTriangle } from 'lucide-react'

/* Save-strategy form modal — visual language copied from the app's
   existing ConfirmModal.jsx (same classes: glass-strong, clip-corner,
   shadow-red-glow-lg/bg-red-gradient/btn-red, all of which are
   already blue-branded despite the "red" naming — see
   tailwind.config.js) rather than a native browser prompt, per spec. */
export default function SaveStrategyModal({ open, name, description, onNameChange, onDescriptionChange, onSave, onClose, saving }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const canSave = name.trim().length > 0 && !saving

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md glass-strong clip-corner border border-[rgba(59,130,246,0.4)] shadow-red-glow-lg animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-accent-primary opacity-[0.15] blur-3xl rounded-full pointer-events-none" />
        <div className="absolute top-0 left-0 w-1 h-full bg-red-gradient" />

        <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-red-gradient flex items-center justify-center shadow-red-glow">
              <Save size={18} className="text-white" />
            </div>
            <h3 className="heading text-lg text-white tracking-wide">Save Strategy</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-text-secondary hover:text-white hover:bg-white/5 transition-all"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative z-10 px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1.5">Strategy Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Georgopol Rush — Squad A"
              autoFocus
              className="w-full bg-bg-elevated border border-border rounded-md px-3 py-2.5 text-sm text-white placeholder:text-text-secondary/60 focus:outline-none focus:border-accent-primary"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1.5">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Notes about this strategy…"
              rows={3}
              className="w-full bg-bg-elevated border border-border rounded-md px-3 py-2.5 text-sm text-white placeholder:text-text-secondary/60 focus:outline-none focus:border-accent-primary resize-none"
            />
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-bg-primary/40">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-md text-sm uppercase tracking-[0.15em] heading font-semibold text-text-secondary hover:text-white border border-border hover:border-text-secondary transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!canSave}
            className="btn-red px-5 py-2.5 rounded-md text-sm uppercase tracking-[0.15em] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* Three-way Save / Discard / Cancel prompt shown when the user tries
   to leave Strategy Maker (switch map/mode) with unsaved changes —
   same visual language as above, just three footer actions instead
   of two since ConfirmModal.jsx (Confirm/Cancel only) can't express
   this without changing a shared component used elsewhere. */
export function UnsavedChangesModal({ open, onSave, onDiscard, onCancel }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onCancel?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-md glass-strong clip-corner border border-[rgba(59,130,246,0.4)] shadow-red-glow-lg animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-red-gradient" />
        <div className="relative z-10 flex items-center gap-3 px-6 py-5 border-b border-border">
          <div className="w-9 h-9 rounded-md bg-red-gradient flex items-center justify-center shadow-red-glow">
            <AlertTriangle size={18} className="text-white" />
          </div>
          <h3 className="heading text-lg text-white tracking-wide">Save changes before leaving?</h3>
        </div>
        <div className="relative z-10 px-6 py-5 text-sm text-text-secondary leading-relaxed">
          This strategy has unsaved changes. Save them before leaving, or discard them.
        </div>
        <div className="relative z-10 flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-bg-primary/40 flex-wrap">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-md text-sm uppercase tracking-[0.15em] heading font-semibold text-text-secondary hover:text-white border border-border hover:border-text-secondary transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onDiscard}
            className="btn-outline px-5 py-2.5 rounded-md text-sm uppercase tracking-[0.15em]"
          >
            Discard
          </button>
          <button
            onClick={onSave}
            className="btn-red px-5 py-2.5 rounded-md text-sm uppercase tracking-[0.15em]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
