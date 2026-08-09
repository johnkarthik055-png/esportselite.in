import { useEffect, useState } from 'react'
import { X, CheckCircle2, Star } from 'lucide-react'
import { SESSION_MOODS } from '../utils/constants.js'
import { formatDuration } from '../utils/helpers.js'

export default function EndSessionModal({
  open,
  drillCount = 0,
  matchCount = 0,
  totalDuration = 0,
  modulesWorked = [],
  onClose,
  onConfirm,
}) {
  const [mood, setMood] = useState(null)
  const [notes, setNotes] = useState('')
  const [rating, setRating] = useState(0)

  useEffect(() => {
    if (open) { setMood(null); setNotes(''); setRating(0) }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function submit() { onConfirm?.({ mood, notes, rating }) }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={18} style={{ color: 'var(--green)' }} />
            <h3
              style={{
                fontFamily: 'Bebas Neue, sans-serif',
                fontWeight: 700,
                fontSize: 17,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              End Today's Session
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32,
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary box */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: 14,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
            }}
          >
            <Summary label="Drills" value={drillCount} />
            <Summary label="Matches" value={matchCount} />
            <Summary label="Total time" value={formatDuration(totalDuration)} />
          </div>

          {/* Rating */}
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Rate this session</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => {
                const active = rating >= n
                return (
                  <button
                    key={n}
                    onClick={() => setRating(n === rating ? 0 : n)}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 'var(--radius-sm)',
                      background: active ? 'var(--gold-tint)' : 'var(--bg-elevated)',
                      border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                      color: active ? 'var(--gold)' : 'var(--text-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    <Star size={16} fill={active ? 'var(--gold)' : 'none'} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Mood */}
          <div>
            <div className="label" style={{ marginBottom: 8 }}>How did it feel?</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SESSION_MOODS.map((m) => {
                const active = mood === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setMood(m.id)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      background: active ? 'var(--bg-elevated)' : 'transparent',
                      border: `1px solid ${active ? 'var(--text-subtle)' : 'var(--border)'}`,
                      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>{m.emoji}</span>
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Notes (optional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={400}
              placeholder="What clicked? What needs work?"
              className="input"
              style={{ resize: 'vertical' }}
            />
          </div>

          {Array.isArray(modulesWorked) && modulesWorked.length > 0 && (
            <div>
              <div className="label" style={{ marginBottom: 8 }}>Modules worked on</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {modulesWorked.map((m) => (
                  <span key={m} className="badge">{m}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '14px 24px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button onClick={onClose} className="btn btn-secondary">Keep Going</button>
          <button onClick={submit} className="btn btn-primary">
            <CheckCircle2 size={14} /> Save &amp; End
          </button>
        </div>
      </div>
    </div>
  )
}

function Summary({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontWeight: 700,
          fontSize: 20,
          color: 'var(--text-primary)',
        }}
      >
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
