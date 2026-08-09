import { useEffect, useState } from 'react'
import { X, Save, Sparkles } from 'lucide-react'
import { MODULE_ICON_OPTIONS } from '../utils/constants.js'

/**
 * Create or edit a custom module.
 *
 * Props:
 *  - open: boolean
 *  - initial: { name, description, icon } when editing (optional)
 *  - mode: 'create' | 'edit'
 *  - onClose()
 *  - onSubmit({ name, description, icon })
 */
export default function CreateModuleModal({ open, mode = 'create', initial, onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('🎯')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(initial?.name || '')
      setDescription(initial?.description || '')
      setIcon(initial?.icon || '🎯')
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
      setError('Module name is required.')
      return
    }
    onSubmit({
      name: trimmed,
      description: description.trim(),
      icon: icon || '🎯',
    })
  }

  const title = mode === 'edit' ? 'Edit Module' : 'Create New Module'
  const cta = mode === 'edit' ? 'Save Changes' : 'Create Module'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg glass-strong clip-corner border border-[rgba(232,0,28,0.4)] shadow-red-glow-lg animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-accent-primary opacity-[0.15] blur-3xl rounded-full pointer-events-none" />
        <div className="absolute top-0 left-0 w-1 h-full bg-red-gradient" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-red-gradient flex items-center justify-center shadow-red-glow">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h3 className="heading text-xl text-white tracking-wide">{title}</h3>
              <p className="text-xs text-text-secondary uppercase tracking-widest mt-0.5">
                Custom training
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
        <div className="relative z-10 p-6 space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-text-secondary mb-2 heading">
              Module Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="e.g. Long Range Snipes"
              className="input-field"
              autoFocus
              maxLength={48}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-text-secondary mb-2 heading">
              Description <span className="text-text-muted normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="One-line description of this module"
              className="input-field"
              maxLength={120}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-text-secondary mb-2 heading">
              Module Icon
            </label>
            <div className="grid grid-cols-11 gap-2">
              {MODULE_ICON_OPTIONS.map(em => (
                <button
                  key={em}
                  onClick={() => setIcon(em)}
                  className={`aspect-square rounded-md border text-xl flex items-center justify-center transition-all ${
                    icon === em
                      ? 'border-accent-primary bg-[rgba(232,0,28,0.15)] shadow-red-glow scale-110'
                      : 'border-border bg-bg-elevated/40 hover:border-accent-secondary hover:scale-105'
                  }`}
                  title={em}
                >
                  {em}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-text-muted uppercase tracking-widest heading">Or paste:</span>
              <input
                type="text"
                value={icon}
                onChange={e => setIcon(e.target.value.slice(0, 4))}
                className="input-field w-20 text-center text-lg py-1.5"
                maxLength={4}
              />
            </div>
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
