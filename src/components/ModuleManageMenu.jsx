import { useEffect, useRef, useState } from 'react'
import { MoreVertical, Pencil, Trash2, Plus, Copy } from 'lucide-react'

/**
 * Kebab (⋮) menu shown on every module card header.
 *
 * Props:
 *  - onRename()
 *  - onDelete()
 *  - onAddDrill()
 *  - onDuplicate()
 */
export default function ModuleManageMenu({ onRename, onDelete, onAddDrill, onDuplicate }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function wrap(fn) {
    return (e) => {
      e.stopPropagation()
      setOpen(false)
      fn?.()
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className={`p-2 rounded-md transition-all ${
          open
            ? 'bg-[rgba(232,0,28,0.12)] text-accent-secondary'
            : 'text-text-secondary hover:text-white hover:bg-white/5'
        }`}
        title="Manage module"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-52 glass-strong rounded-md overflow-hidden shadow-2xl z-30 animate-fade-in"
          onClick={e => e.stopPropagation()}
        >
          <MenuItem icon={Pencil} label="Rename module" onClick={wrap(onRename)} />
          <MenuItem icon={Plus} label="Add new drill" onClick={wrap(onAddDrill)} />
          <MenuItem icon={Copy} label="Duplicate module" onClick={wrap(onDuplicate)} />
          <div className="h-px bg-border" />
          <MenuItem
            icon={Trash2}
            label="Delete module"
            onClick={wrap(onDelete)}
            destructive
          />
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, destructive }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all ${
        destructive
          ? 'text-accent-secondary hover:bg-[rgba(232,0,28,0.08)]'
          : 'text-text-primary hover:bg-white/5'
      }`}
    >
      <Icon size={15} />
      <span className="heading text-xs tracking-wider uppercase">{label}</span>
    </button>
  )
}
