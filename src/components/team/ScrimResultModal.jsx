import { useEffect, useState } from 'react'
import { X, Trophy, Loader2, AlertCircle } from 'lucide-react'
import { saveScrimResult, updateScrim } from '../../utils/team.js'

export default function ScrimResultModal({ open, onClose, scrim, teamId }) {
  const [won, setWon] = useState(true)
  const [ourKills, setOurKills] = useState('')
  const [oppKills, setOppKills] = useState('')
  const [placement, setPlacement] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open && scrim) {
      const r = scrim.result || {}
      setWon(r.won ?? true)
      setOurKills(r.ourKills != null ? String(r.ourKills) : '')
      setOppKills(r.opponentKills != null ? String(r.opponentKills) : '')
      setPlacement(r.placement != null ? String(r.placement) : '')
      setNotes(scrim.notes || '')
      setErr('')
    }
  }, [open, scrim])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !scrim) return null

  async function save() {
    const place = Number(placement)
    if (Number.isNaN(place) || place < 1 || place > 25) {
      setErr('Placement must be between 1 and 25.')
      return
    }
    setBusy(true); setErr('')
    try {
      /* Persist the notes onto the scrim doc first (so notes stick
         even if placement is edited later). */
      if (notes.trim() !== (scrim.notes || '')) {
        await updateScrim(teamId, scrim.id, { notes: notes.trim() })
      }
      await saveScrimResult(teamId, scrim.id, {
        won,
        ourKills: Number(ourKills) || 0,
        opponentKills: Number(oppKills) || 0,
        placement: place,
      })
      onClose?.()
    } catch (e) {
      setErr(e?.message || 'Could not save result.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trophy size={18} style={{ color: 'var(--text-muted)' }} />
            <div>
              <h3
                style={{
                  fontFamily: 'Bebas Neue, sans-serif',
                  fontWeight: 400,
                  fontSize: 22,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                Save Scrim Result
              </h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                vs {scrim.opponent || 'TBD'}
              </div>
            </div>
          </div>
          <IconClose onClick={onClose} />
        </div>

        {/* Body */}
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Result</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <ResultButton label="Won" tint="green" active={won} onClick={() => setWon(true)} />
              <ResultButton label="Lost" tint="red" active={!won} onClick={() => setWon(false)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Our kills">
              <input type="number" min="0" className="input-field" value={ourKills} onChange={e => setOurKills(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Opponent kills">
              <input type="number" min="0" className="input-field" value={oppKills} onChange={e => setOppKills(e.target.value)} placeholder="0" />
            </Field>
          </div>

          <Field label="Placement (1–25)">
            <input
              type="number"
              min="1"
              max="25"
              className="input-field"
              value={placement}
              onChange={e => setPlacement(e.target.value)}
              placeholder="e.g. 3"
            />
          </Field>

          <Field label="Match notes">
            <textarea
              className="input-field"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What went well? What to improve?"
              style={{ resize: 'vertical' }}
            />
          </Field>

          {err && (
            <div style={{ background: 'var(--red-ghost)', border: '1px solid rgba(232,0,28,0.25)', color: 'var(--red)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={13} /> {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={save} disabled={busy} className="btn btn-primary">
            {busy ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : 'Save result'}
          </button>
        </div>

        <style>{`.animate-spin{animation:ee-sr-spin .9s linear infinite}@keyframes ee-sr-spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}

function ResultButton({ label, tint, active, onClick }) {
  const map = {
    green: { bg: 'var(--green-tint)', border: 'var(--green)', color: 'var(--green)' },
    red:   { bg: 'var(--red-ghost)',  border: 'var(--red)',   color: 'var(--red)'   },
  }[tint] || { bg: 'var(--bg-elevated)', border: 'var(--border)', color: 'var(--text-primary)' }

  return (
    <button
      onClick={onClick}
      style={{
        padding: '14px 12px',
        background: active ? map.bg : 'var(--bg-elevated)',
        border: `1px solid ${active ? map.border : 'var(--border)'}`,
        color: active ? map.color : 'var(--text-muted)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        fontFamily: 'Bebas Neue, sans-serif',
        fontSize: 22,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function IconClose({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32, height: 32, borderRadius: 'var(--radius-sm)',
        background: 'transparent', border: 'none',
        color: 'var(--text-muted)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      title="Close"
    >
      <X size={16} />
    </button>
  )
}
