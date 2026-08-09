import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, collection } from 'firebase/firestore'
import {
  Swords, Plus, Pencil, Trash2, X, Loader2, AlertCircle,
  Eye, EyeOff, Trophy, Copy, Save,
} from 'lucide-react'
import { db } from '../../utils/firebase.js'
import {
  createScrim, updateScrim, deleteScrim,
} from '../../utils/team.js'
import {
  notifyTeamMembers, TEAM_NOTIFICATIONS,
} from '../../utils/notifications.js'
import { useAuth } from '../../context/AuthContext.jsx'
import ScrimResultModal from './ScrimResultModal.jsx'

export default function TeamScrims({ team, members, myRole, teamId }) {
  const { user } = useAuth()
  const uid = user?.uid
  const canManage = myRole === 'owner' || myRole === 'igl'

  const [scrims, setScrims] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [resultFor, setResultFor] = useState(null)

  useEffect(() => {
    if (!teamId) return
    setLoading(true)
    const unsub = onSnapshot(
      collection(db, 'teams', teamId, 'scrims'),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        setScrims(list)
        setLoading(false)
      },
      () => setLoading(false)
    )
    return () => unsub()
  }, [teamId])

  const { upcoming, completed } = useMemo(() => {
    const up = scrims.filter(s => !s.result)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    const done = scrims.filter(s => s.result)
    return { upcoming: up, completed: done }
  }, [scrims])

  async function handleCreate(data) {
    await createScrim(teamId, uid, data)
    setCreateOpen(false)
    notifyTeamMembers(
      members.filter(m => m.uid !== uid).map(m => m.uid),
      TEAM_NOTIFICATIONS.scrimReminder(data.opponent, `${data.date} ${data.time}`),
    )
  }
  async function handleEdit(id, data) {
    await updateScrim(teamId, id, data)
    setEditing(null)
  }
  async function handleDelete(id) {
    if (!window.confirm('Delete this scrim?')) return
    await deleteScrim(teamId, id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h2
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontWeight: 400,
            fontSize: 24,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Scrim Schedule
        </h2>
        {canManage && (
          <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm">
            <Plus size={13} /> Schedule Scrim
          </button>
        )}
      </div>

      {loading ? (
        <LoadingRow />
      ) : scrims.length === 0 ? (
        <div className="card empty-state">
          <Swords size={40} className="empty-state-icon" />
          <div className="empty-state-title">No scrims scheduled</div>
          <div className="empty-state-desc">Plan your next scrim session.</div>
          {canManage && (
            <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>
              <Plus size={13} /> Schedule Scrim
            </button>
          )}
        </div>
      ) : (
        <>
          <ScrimGroup
            title="Upcoming"
            list={upcoming}
            canManage={canManage}
            onEdit={s => setEditing(s)}
            onDelete={handleDelete}
            onSaveResult={s => setResultFor(s)}
          />
          <ScrimGroup
            title="Completed"
            list={completed}
            canManage={canManage}
            onEdit={s => setEditing(s)}
            onDelete={handleDelete}
            onSaveResult={s => setResultFor(s)}
            faded
          />
        </>
      )}

      <ScrimModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
      <ScrimModal
        open={!!editing}
        initial={editing}
        onClose={() => setEditing(null)}
        onSubmit={(d) => handleEdit(editing.id, d)}
      />
      <ScrimResultModal
        open={!!resultFor}
        scrim={resultFor}
        teamId={teamId}
        onClose={() => setResultFor(null)}
      />

      <style>{`.animate-spin{animation:ee-s-spin .9s linear infinite}@keyframes ee-s-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

/* ============================================================ */
function ScrimGroup({ title, list, canManage, faded, onEdit, onDelete, onSaveResult }) {
  if (list.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="label">{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: faded ? 0.75 : 1 }}>
        {list.map(s => (
          <ScrimCard
            key={s.id}
            s={s}
            canManage={canManage}
            onEdit={() => onEdit(s)}
            onDelete={() => onDelete(s.id)}
            onSaveResult={() => onSaveResult(s)}
          />
        ))}
      </div>
    </div>
  )
}

function ScrimCard({ s, canManage, onEdit, onDelete, onSaveResult }) {
  const [showPass, setShowPass] = useState(false)
  const [copied, setCopied] = useState(false)
  const roomMasked = s.roomId ? `••• ${String(s.roomId).slice(-4)}` : '—'

  const statusBadge = s.result
    ? (s.result.won
        ? <span className="badge badge-green">WON</span>
        : <span className="badge badge-red">LOST</span>)
    : <span className="badge badge-blue">Upcoming</span>

  async function copyRoom() {
    if (!s.roomId) return
    try {
      await navigator.clipboard.writeText(s.roomId)
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 40, height: 40,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            <Swords size={16} />
          </div>
          <div
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontWeight: 400,
              fontSize: 20,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            vs {s.opponent || 'TBD'}
          </div>
        </div>
        {statusBadge}
      </div>

      {/* Info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <InfoBox label="Date & Time" value={`${s.date || '—'} ${s.time || ''}`.trim()} />
        <InfoBox
          label="Room ID"
          value={roomMasked}
          onClick={s.roomId ? copyRoom : undefined}
          trailing={s.roomId && <Copy size={11} style={{ color: 'var(--text-subtle)' }} />}
          note={copied ? 'Copied' : ''}
        />
        <InfoBox
          label="Password"
          value={s.password ? (showPass ? s.password : '••••••') : '—'}
          onClick={s.password ? () => setShowPass(v => !v) : undefined}
          trailing={s.password && (showPass ? <EyeOff size={11} style={{ color: 'var(--text-subtle)' }} /> : <Eye size={11} style={{ color: 'var(--text-subtle)' }} />)}
        />
      </div>

      {/* Result */}
      {s.result && (
        <div
          style={{
            padding: '12px 14px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderLeft: `3px solid ${s.result.won ? 'var(--green)' : 'var(--red)'}`,
            borderRadius: 'var(--radius-sm)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}
        >
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
            <div>
              <span className="label" style={{ marginRight: 6 }}>Kills</span>
              <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 18, letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
                {s.result.ourKills}
              </span>
              <span style={{ color: 'var(--text-subtle)', margin: '0 6px' }}>vs</span>
              <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 18, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                {s.result.opponentKills}
              </span>
            </div>
            <div>
              <span className="label" style={{ marginRight: 6 }}>Placement</span>
              <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 18, letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
                #{s.result.placement || '—'}
              </span>
            </div>
          </div>
          {s.notes && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>{s.notes}</div>
          )}
        </div>
      )}

      {/* Actions */}
      {canManage && (
        <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 12, flexWrap: 'wrap' }}>
          {!s.result && (
            <button className="btn btn-primary btn-sm" onClick={onSaveResult}>
              <Trophy size={12} /> Save result
            </button>
          )}
          <IconBtn onClick={onEdit} title="Edit"><Pencil size={13} /></IconBtn>
          <IconBtn danger onClick={onDelete} title="Delete"><Trash2 size={13} /></IconBtn>
        </div>
      )}
    </div>
  )
}

function InfoBox({ label, value, onClick, trailing, note }) {
  const clickable = !!onClick
  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      style={{
        textAlign: 'left',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 10px',
        cursor: clickable ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="label" style={{ fontSize: 10 }}>{label}</div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-primary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </div>
        {note && <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 2 }}>{note}</div>}
      </div>
      {trailing}
    </button>
  )
}

/* ============================================================
   CREATE / EDIT MODAL
   ============================================================ */
function ScrimModal({ open, onClose, onSubmit, initial }) {
  const [opponent, setOpponent] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [roomId, setRoomId] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setOpponent(initial?.opponent || '')
      setDate(initial?.date || '')
      setTime(initial?.time || '')
      setRoomId(initial?.roomId || '')
      setPassword(initial?.password || '')
      setNotes(initial?.notes || '')
      setShowPass(false)
      setErr('')
    }
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function submit(e) {
    e.preventDefault()
    if (!opponent.trim() || !date || !time) { setErr('Opponent, date, and time are required.'); return }
    setBusy(true); setErr('')
    try {
      await onSubmit({
        opponent: opponent.trim(),
        date, time,
        roomId: roomId.trim(),
        password: password.trim(),
        notes: notes.trim(),
      })
    } catch (e2) { setErr(e2?.message || 'Could not save.') }
    finally { setBusy(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit} style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Swords size={18} style={{ color: 'var(--text-muted)' }} />
            <h3 style={{ fontFamily: 'Bebas Neue, sans-serif', fontWeight: 400, fontSize: 22, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)', margin: 0 }}>
              {initial ? 'Edit Scrim' : 'Schedule Scrim'}
            </h3>
          </div>
          <IconBtn onClick={onClose} title="Close"><X size={16} /></IconBtn>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Opponent name*">
            <input className="input-field" value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="e.g. Squad Titans" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Date*">
              <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
            <Field label="Time*">
              <input type="time" className="input-field" value={time} onChange={e => setTime(e.target.value)} />
            </Field>
          </div>
          <Field label="Room ID">
            <input className="input-field" value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Password">
            <div style={{ position: 'relative' }}>
              <input
                className="input-field"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Optional"
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, display: 'flex' }}
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>
          <Field label="Notes">
            <textarea className="input-field" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" style={{ resize: 'vertical' }} />
          </Field>
          {err && <ErrorBar msg={err} />}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : (initial ? 'Save changes' : 'Schedule')}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ============================================================
   SHARED
   ============================================================ */
function IconBtn({ children, onClick, title, danger }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 30, height: 30,
        border: `1px solid ${danger && hover ? 'var(--red)' : 'transparent'}`,
        background: hover ? 'var(--bg-elevated)' : 'transparent',
        color: danger && hover ? 'var(--red)' : 'var(--text-muted)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
      }}
    >
      {children}
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

function ErrorBar({ msg }) {
  return (
    <div style={{ background: 'var(--red-ghost)', border: '1px solid rgba(232,0,28,0.25)', color: 'var(--red)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
      <AlertCircle size={13} /> {msg}
    </div>
  )
}

function LoadingRow() {
  return (
    <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)' }}>
      <Loader2 size={16} className="animate-spin" /> <span style={{ fontSize: 13 }}>Loading…</span>
    </div>
  )
}
