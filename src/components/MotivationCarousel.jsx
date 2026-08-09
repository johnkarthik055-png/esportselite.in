import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { uid } from '../utils/helpers.js'

/* Local key — not in STORAGE_KEYS yet so we keep it inline per the task scope. */
const QUOTES_KEY = 'esportselite_quotes'

const DEFAULT_QUOTES = [
  "The grind you put in today is the gap your enemies can't close tomorrow.",
  "Every spray you master is a death sentence for whoever pushes you.",
  "Discipline beats talent when talent doesn't show up to practice.",
  "Champions are made in the hours no one is watching.",
  "You don't rise to the level of the tournament. You fall to the level of your training.",
  "One more drill. One more match. One more step closer to the top.",
  "Your crosshair placement is your mindset. Keep it sharp.",
  "Losing is just data. Learn it. Fix it. Come back harder.",
  "The best players in the world were once exactly where you are right now.",
  "Consistency is the only cheat code that actually works.",
]

const ROTATE_MS = 5000
const FADE_MS = 600
const MAX_LEN = 150

function buildDefaults() {
  const now = Date.now()
  return DEFAULT_QUOTES.map((text, i) => ({
    id: `default-quote-${i + 1}`,
    text,
    isDefault: true,
    createdAt: now + i, // stable but unique
  }))
}

export default function MotivationCarousel() {
  const [quotes, setQuotes] = useLocalStorage(QUOTES_KEY, [])
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  /* Seed defaults the first time the carousel mounts. */
  useEffect(() => {
    if (!Array.isArray(quotes) || quotes.length === 0) {
      setQuotes(buildDefaults())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const list = useMemo(() => (Array.isArray(quotes) ? quotes : []), [quotes])
  const safeIndex = list.length > 0 ? Math.min(index, list.length - 1) : 0
  const current = list[safeIndex] || null

  /* Auto-rotate every ROTATE_MS unless paused, add-mode open, or only 1 quote. */
  useEffect(() => {
    if (paused || addOpen || list.length < 2) return
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % list.length)
        setVisible(true)
      }, FADE_MS)
    }, ROTATE_MS)
    return () => clearInterval(interval)
  }, [paused, addOpen, list.length])

  /* Jump to a specific dot. */
  function goTo(i) {
    if (i === safeIndex) return
    setVisible(false)
    setTimeout(() => {
      setIndex(i)
      setVisible(true)
    }, FADE_MS / 2)
  }

  /* Submit a custom quote. */
  function submitDraft() {
    const text = draft.trim()
    if (!text) {
      setError('')
      return
    }
    if (text.length > MAX_LEN) {
      setError(`Max ${MAX_LEN} characters.`)
      return
    }
    const dup = list.some(
      q => q.text.trim().toLowerCase() === text.toLowerCase()
    )
    if (dup) {
      setError('This quote already exists.')
      return
    }
    const entry = {
      id: uid(),
      text,
      isDefault: false,
      createdAt: Date.now(),
    }
    const next = [...list, entry]
    setQuotes(next)
    setIndex(next.length - 1)
    setVisible(true)
    setDraft('')
    setError('')
    setAddOpen(false)
    setToast('Quote added! 🔥')
    setTimeout(() => setToast(''), 2200)
  }

  function cancelDraft() {
    setDraft('')
    setError('')
    setAddOpen(false)
  }

  /* Remove a custom quote (defaults are protected). */
  function removeQuote(id) {
    const target = list.find(q => q.id === id)
    if (!target || target.isDefault) return
    const targetIndex = list.findIndex(q => q.id === id)
    const next = list.filter(q => q.id !== id)
    setQuotes(next)
    if (targetIndex < safeIndex) {
      setIndex(i => Math.max(0, i - 1))
    } else if (safeIndex >= next.length) {
      setIndex(Math.max(0, next.length - 1))
    }
  }

  if (list.length === 0) return null

  return (
    <section
      className="relative glass clip-corner-sm overflow-hidden animate-fade-in"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Red left border accent */}
      <div
        className="absolute top-0 left-0 h-full w-1 bg-red-gradient pointer-events-none"
        aria-hidden="true"
      />

      <div className="px-5 sm:px-6 py-4 sm:py-5 pl-6 sm:pl-7 space-y-3">
        {/* Quote */}
        <div className="min-h-[52px] sm:min-h-[58px] flex items-center justify-center">
          <p
            className="font-body italic text-center"
            style={{
              color: '#CCCCDD',
              fontSize: 'clamp(13px, 2.4vw, 15px)',
              lineHeight: 1.55,
              transition: `opacity ${FADE_MS}ms ease`,
              opacity: visible ? 1 : 0,
            }}
          >
            <span
              className="mr-1 align-middle"
              style={{
                color: '#E8001C',
                fontSize: '24px',
                lineHeight: 1,
                fontStyle: 'normal',
              }}
            >
              ❝
            </span>
            {current?.text}
            <span
              className="ml-1 align-middle"
              style={{
                color: '#E8001C',
                fontSize: '24px',
                lineHeight: 1,
                fontStyle: 'normal',
              }}
            >
              ❞
            </span>
          </p>
        </div>

        {/* Dot indicators */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {list.map((q, i) => {
            const active = i === safeIndex
            return (
              <div
                key={q.id}
                className="relative group"
                style={{ width: 24, height: 24 }}
              >
                <button
                  onClick={() => goTo(i)}
                  aria-label={`Show quote ${i + 1}`}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span
                    className={`block rounded-full transition-all ${
                      active
                        ? 'w-2.5 h-2.5 bg-accent-primary shadow-red-glow'
                        : 'w-2 h-2 bg-border hover:bg-text-secondary'
                    }`}
                  />
                </button>
                {!q.isDefault && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      removeQuote(q.id)
                    }}
                    title="Remove quote"
                    aria-label="Remove custom quote"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-bg-elevated border border-[rgba(232,0,28,0.5)] text-accent-secondary text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Add custom quote */}
        {!addOpen ? (
          <div className="flex items-center justify-center">
            <button
              onClick={() => setAddOpen(true)}
              className="text-[11px] sm:text-xs text-text-muted hover:text-accent-secondary inline-flex items-center gap-1 transition-all heading uppercase tracking-widest"
            >
              <Plus size={12} /> Add your quote
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-w-xl mx-auto w-full">
            <input
              type="text"
              autoFocus
              maxLength={MAX_LEN}
              value={draft}
              onChange={e => {
                setDraft(e.target.value)
                if (error) setError('')
              }}
              placeholder="Type your motivation line..."
              className="input-field text-sm w-full"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submitDraft()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelDraft()
                }
              }}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={submitDraft}
                disabled={!draft.trim()}
                className="btn-red px-4 py-2 rounded-md text-xs uppercase tracking-[0.15em] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add
              </button>
              <button
                onClick={cancelDraft}
                className="btn-outline px-4 py-2 rounded-md text-xs uppercase tracking-[0.15em]"
              >
                Cancel
              </button>
              <span
                className={`text-[10px] ml-auto mono ${
                  draft.length >= MAX_LEN
                    ? 'text-accent-secondary'
                    : 'text-text-muted'
                }`}
              >
                {draft.length}/{MAX_LEN}
              </span>
            </div>
            {error && (
              <p className="text-[11px] text-accent-secondary">{error}</p>
            )}
          </div>
        )}

        {toast && (
          <div className="text-center">
            <span className="toast-success px-3 py-1.5 rounded-md text-[11px] mono inline-block">
              {toast}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
