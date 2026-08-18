import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, X, FileText, BarChart3, Timer, Save } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { STORAGE_KEYS } from '../utils/constants.js'
import { todayKey } from '../utils/helpers.js'

/**
 * Mobile-only floating action button. Hides on desktop and on /login.
 * Lives in Layout (so it renders on every protected route).
 */
export default function FABMenu() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [daily, setDaily] = useLocalStorage(STORAGE_KEYS.DAILY_SESSIONS, {})
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    function check() {
      setMobile(window.innerWidth < 768)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  /* Close the radial menu on route change. */
  useEffect(() => {
    setOpen(false)
    setNoteOpen(false)
  }, [location.pathname])

  if (!mobile) return null
  if (location.pathname === '/login') return null

  function quickDrill() {
    setOpen(false)
    navigate('/training')
  }

  function logMatch() {
    setOpen(false)
    /* Hint Training.jsx to land on the Match Logger tab. */
    try {
      sessionStorage.setItem('esportselite_open_match_logger', '1')
    } catch {
      /* ignore */
    }
    navigate('/training')
  }

  function saveNote() {
    const text = noteText.trim()
    if (!text) return
    const t = todayKey()
    setDaily(prev => {
      const existing = prev[t] || {}
      const merged = existing.notes ? existing.notes + '\n' + text : text
      return { ...prev, [t]: { ...existing, notes: merged } }
    })
    setNoteText('')
    setNoteOpen(false)
    setOpen(false)
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[55]"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className="fixed z-[60] flex flex-col items-end gap-2"
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom) + 12px)', right: 16 }}
      >
        {open && (
          <>
            <button
              onClick={() => setNoteOpen(true)}
              className="fab-menu-item flex items-center gap-2 px-4 py-2.5 rounded-md glass-strong text-white text-sm shadow-2xl whitespace-nowrap"
              style={{ animationDelay: '60ms' }}
            >
              <FileText size={16} className="text-accent-secondary" /> Add Note
            </button>
            <button
              onClick={logMatch}
              className="fab-menu-item flex items-center gap-2 px-4 py-2.5 rounded-md glass-strong text-white text-sm shadow-2xl whitespace-nowrap"
              style={{ animationDelay: '30ms' }}
            >
              <BarChart3 size={16} className="text-accent-secondary" /> Log Match
            </button>
            <button
              onClick={quickDrill}
              className="fab-menu-item flex items-center gap-2 px-4 py-2.5 rounded-md glass-strong text-white text-sm shadow-2xl whitespace-nowrap"
            >
              <Timer size={16} className="text-accent-secondary" /> Quick Drill
            </button>
          </>
        )}
        <button
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'Close quick menu' : 'Open quick menu'}
          className="w-14 h-14 rounded-full text-white flex items-center justify-center active:scale-95 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #E8001C, #FF2D44)',
            boxShadow: '0 4px 20px rgba(232,0,28,0.5)',
          }}
        >
          {open ? <X size={24} /> : <Plus size={24} />}
        </button>
      </div>

      {noteOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setNoteOpen(false)}
        >
          <div
            className="bg-bg-elevated border border-[rgba(232,0,28,0.3)] rounded-xl p-5 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="heading text-lg text-white mb-3">Add Quick Note</h3>
            <textarea
              autoFocus
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              rows={4}
              className="input-field resize-none"
              placeholder="Today's quick note…"
              maxLength={500}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setNoteOpen(false)
                  setNoteText('')
                }}
                className="px-4 py-2 rounded-md text-xs uppercase tracking-widest text-text-secondary hover:text-white border border-border hover:border-text-secondary heading"
              >
                Cancel
              </button>
              <button
                onClick={saveNote}
                disabled={!noteText.trim()}
                className="btn-red px-4 py-2 rounded-md text-xs uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={13} /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
