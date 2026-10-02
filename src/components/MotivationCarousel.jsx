import { useEffect, useMemo, useState } from 'react'
import { Plus, Quote } from 'lucide-react'
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
    setToast('Quote added')
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

  /* Dots are capped visually so a long custom list can't blow out the card. */
  const DOT_WINDOW = 8
  const dotStart = Math.max(0, Math.min(safeIndex - Math.floor(DOT_WINDOW / 2), list.length - DOT_WINDOW))
  const visibleDots = list.slice(Math.max(0, dotStart), Math.max(0, dotStart) + DOT_WINDOW)

  return (
    <section
      className="mc-card"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Gradient left accent */}
      <span className="mc-accent" aria-hidden />

      <div className="mc-inner">
        <div className="mc-head">
          <span className="mc-label">Motivation</span>
          {paused && list.length > 1 && <span className="mc-paused">Paused</span>}
        </div>

        {/* Quote */}
        <div className="mc-quote-wrap">
          <Quote size={16} className="mc-quote-mark" aria-hidden />
          <p
            className="mc-quote"
            style={{ opacity: visible ? 1 : 0 }}
          >
            {current?.text}
          </p>
        </div>

        {/* Dot indicators */}
        <div className="mc-dots">
          {visibleDots.map((q) => {
            const i = list.indexOf(q)
            const active = i === safeIndex
            return (
              <span key={q.id} className="mc-dot-wrap">
                <button
                  onClick={() => goTo(i)}
                  aria-label={`Show quote ${i + 1}`}
                  aria-current={active ? 'true' : undefined}
                  className={`mc-dot ${active ? 'is-active' : ''}`}
                />
                {!q.isDefault && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      removeQuote(q.id)
                    }}
                    title="Remove quote"
                    aria-label="Remove custom quote"
                    className="mc-dot-remove"
                  >
                    ×
                  </button>
                )}
              </span>
            )
          })}
        </div>

        {/* Add custom quote */}
        {!addOpen ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => setAddOpen(true)} className="mc-add-btn">
              <Plus size={12} /> Add your quote
            </button>
          </div>
        ) : (
          <div className="mc-form">
            <input
              type="text"
              autoFocus
              maxLength={MAX_LEN}
              value={draft}
              onChange={e => {
                setDraft(e.target.value)
                if (error) setError('')
              }}
              placeholder="Type your motivation line…"
              className="mc-input"
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
            <div className="mc-form-row">
              <button
                onClick={submitDraft}
                disabled={!draft.trim()}
                className="mc-btn mc-btn--primary"
              >
                Add
              </button>
              <button onClick={cancelDraft} className="mc-btn mc-btn--ghost">
                Cancel
              </button>
              <span className={`mc-count ${draft.length >= MAX_LEN ? 'is-max' : ''}`}>
                {draft.length}/{MAX_LEN}
              </span>
            </div>
            {error && <p className="mc-error">{error}</p>}
          </div>
        )}

        {toast && (
          <div style={{ textAlign: 'center' }}>
            <span className="mc-toast">{toast}</span>
          </div>
        )}
      </div>

      <style>{`
        .mc-card {
          position: relative; overflow: hidden;
          background: linear-gradient(135deg, #EEF4FF, #FFF0F3);
          border: 1px solid #DCE5FA; border-radius: 16px;
          box-shadow: 0 4px 20px rgba(15,23,42,0.04);
        }
        .mc-accent {
          position: absolute; top: 0; left: 0; width: 3px; height: 100%;
          background: linear-gradient(180deg, #2563FF 0%, #5B3DF5 50%, #EF3340 100%);
          pointer-events: none;
        }
        .mc-inner {
          padding: 18px 20px 18px 22px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .mc-head {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        .mc-label {
          font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.14em; color: #2563FF;
        }
        .mc-paused {
          font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 9.5px;
          text-transform: uppercase; letter-spacing: 0.1em; color: #94A3B8;
        }

        .mc-quote-wrap {
          position: relative; min-height: 64px;
          display: flex; align-items: center; gap: 10px;
        }
        .mc-quote-mark { color: #2563FF; opacity: 0.35; flex-shrink: 0; align-self: flex-start; margin-top: 2px; }
        .mc-quote {
          margin: 0; font-family: 'Inter', sans-serif; font-weight: 500;
          font-size: 14px; line-height: 1.6; color: #0B1224;
          transition: opacity ${FADE_MS}ms ease;
        }

        .mc-dots { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px; }
        .mc-dot-wrap { position: relative; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; }
        .mc-dot {
          width: 7px; height: 7px; border-radius: 50%; padding: 0;
          background: #C7D7FB; border: none; cursor: pointer;
          transition: background 0.2s ease, width 0.2s ease, height 0.2s ease;
        }
        .mc-dot.is-active {
          width: 10px; height: 10px;
          background: linear-gradient(135deg, #2563FF, #5B3DF5);
          box-shadow: 0 0 0 3px rgba(37,99,255,0.12);
        }
        @media (hover: hover) and (pointer: fine) {
          .mc-dot:not(.is-active):hover { background: #94A3B8; }
          .mc-dot-wrap:hover .mc-dot-remove { opacity: 1; }
        }
        .mc-dot-remove {
          position: absolute; top: -3px; right: -3px;
          width: 14px; height: 14px; border-radius: 50%;
          background: #FFFFFF; border: 1px solid rgba(239,51,64,0.4);
          color: #EF3340; font-size: 10px; line-height: 1; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.15s ease;
        }
        .mc-dot-remove:focus-visible { opacity: 1; }

        .mc-add-btn {
          background: transparent; border: none; cursor: pointer; padding: 4px 6px;
          font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.12em; color: #64748B;
          display: inline-flex; align-items: center; gap: 5px;
          transition: color 0.15s ease;
        }
        @media (hover: hover) and (pointer: fine) {
          .mc-add-btn:hover { color: #2563FF; }
        }

        .mc-form { display: flex; flex-direction: column; gap: 8px; }
        .mc-input {
          width: 100%; box-sizing: border-box;
          background: #FFFFFF; border: 1px solid #E5EAF3; border-radius: 10px;
          padding: 9px 12px; font-family: 'Inter', sans-serif; font-size: 13px;
          color: #0B1224; outline: none; transition: border-color 0.15s ease;
        }
        .mc-input:focus { border-color: #2563FF; }
        .mc-input::placeholder { color: #94A3B8; }
        .mc-form-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .mc-btn {
          border-radius: 8px; padding: 7px 16px; cursor: pointer;
          font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.12em;
          transition: opacity 0.15s ease, border-color 0.15s ease;
        }
        .mc-btn--primary {
          background: linear-gradient(135deg, #2563FF, #5B3DF5); color: #fff; border: none;
          box-shadow: 0 2px 8px rgba(37,99,255,0.22);
        }
        .mc-btn--primary:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
        .mc-btn--ghost { background: #FFFFFF; border: 1px solid #E5EAF3; color: #475569; }
        .mc-count {
          margin-left: auto; font-family: 'Inter', sans-serif; font-size: 10.5px;
          color: #94A3B8; font-variant-numeric: tabular-nums;
        }
        .mc-count.is-max { color: #EF3340; }
        .mc-error { margin: 0; font-family: 'Inter', sans-serif; font-size: 11.5px; color: #EF3340; }

        .mc-toast {
          display: inline-block; padding: 5px 12px; border-radius: 999px;
          background: rgba(22,163,74,0.1); border: 1px solid rgba(22,163,74,0.25);
          color: #16A34A; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 11px;
        }
      `}</style>
    </section>
  )
}
