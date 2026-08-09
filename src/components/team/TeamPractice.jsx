// FIRESTORE RULES NEEDED:
// match /teams/{teamId} {
//   allow read: if request.auth != null;
//   allow create: if request.auth != null;
//   allow update, delete: if request.auth.uid == resource.data.ownerId || isAdmin();
//   match /{subcollection=**} {
//     allow read, write: if request.auth != null;
//   }
// }

import { useEffect, useMemo, useState } from 'react'
import {
  onSnapshot, collection,
} from 'firebase/firestore'
import {
  Calendar, Plus, Pencil, Trash2, X, Loader2, AlertCircle, Check,
  Users, CheckCheck,
} from 'lucide-react'
import { db } from '../../utils/firebase.js'
import {
  createPractice, updatePractice, deletePractice, markAttendance,
} from '../../utils/team.js'
import {
  notifyTeamMembers, TEAM_NOTIFICATIONS,
} from '../../utils/notifications.js'
import { useAuth } from '../../context/AuthContext.jsx'
import AttendanceModal from './AttendanceModal.jsx'

export default function TeamPractice({ team, members, myRole, teamId }) {
  const { user } = useAuth()
  const uid = user?.uid
  const canManage = myRole === 'owner' || myRole === 'igl'

  const [practices, setPractices] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [attendanceFor, setAttendanceFor] = useState(null)

  useEffect(() => {
    if (!teamId) return
    setLoading(true)
    const unsub = onSnapshot(
      collection(db, 'teams', teamId, 'practices'),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        setPractices(list)
        setLoading(false)
      },
      () => setLoading(false)
    )
    return () => unsub()
  }, [teamId])

  const { upcoming, past } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const up = practices.filter(p => (p.date || '') >= today)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    const pa = practices.filter(p => (p.date || '') < today)
    return { upcoming: up, past: pa }
  }, [practices])

  async function handleCreate(data) {
    await createPractice(teamId, uid, data)
    setCreateOpen(false)
    notifyTeamMembers(
      members.filter(m => m.uid !== uid).map(m => m.uid),
      TEAM_NOTIFICATIONS.practiceReminder(data.title, `${data.date} ${data.time}`),
    )
  }
  async function handleEdit(id, data) {
    await updatePractice(teamId, id, data)
    setEditing(null)
  }
  async function handleDelete(id) {
    if (!window.confirm('Delete this practice session?')) return
    await deletePractice(teamId, id)
  }
  async function handleAttendance(pId, targetUid, status) {
    await markAttendance(teamId, pId, targetUid, status)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
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
          Practice Schedule
        </h2>
        {canManage && (
          <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm">
            <Plus size={13} /> Schedule Practice
          </button>
        )}
      </div>

      {loading ? (
        <LoadingRow />
      ) : practices.length === 0 ? (
        <EmptyPractice canManage={canManage} onCreate={() => setCreateOpen(true)} />
      ) : (
        <>
          <PracticeGroup
            title="Upcoming"
            practices={upcoming}
            members={members}
            uid={uid}
            canManage={canManage}
            onEdit={p => setEditing(p)}
            onDelete={handleDelete}
            onMarkAttendance={p => setAttendanceFor(p)}
            onSelfMark={handleAttendance}
          />
          <PracticeGroup
            title="Past"
            practices={past}
            members={members}
            uid={uid}
            canManage={canManage}
            onEdit={p => setEditing(p)}
            onDelete={handleDelete}
            onMarkAttendance={p => setAttendanceFor(p)}
            onSelfMark={handleAttendance}
            faded
          />
        </>
      )}

      <PracticeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
      <PracticeModal
        open={!!editing}
        initial={editing}
        onClose={() => setEditing(null)}
        onSubmit={(data) => handleEdit(editing.id, data)}
      />
      <AttendanceModal
        open={!!attendanceFor}
        onClose={() => setAttendanceFor(null)}
        practice={attendanceFor}
        members={members}
        teamId={teamId}
      />

      <style>{`.animate-spin{animation:ee-p-spin .9s linear infinite}@keyframes ee-p-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

/* ============================================================ */
function PracticeGroup({
  title, practices, members, uid, canManage, faded,
  onEdit, onDelete, onMarkAttendance, onSelfMark,
}) {
  if (practices.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="label">{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: faded ? 0.75 : 1 }}>
        {practices.map(p => (
          <PracticeCard
            key={p.id}
            p={p}
            members={members}
            uid={uid}
            canManage={canManage}
            onEdit={() => onEdit(p)}
            onDelete={() => onDelete(p.id)}
            onMarkAttendance={() => onMarkAttendance(p)}
            onSelfMark={(status) => onSelfMark(p.id, uid, status)}
          />
        ))}
      </div>
    </div>
  )
}

function PracticeCard({
  p, members, uid, canManage, onEdit, onDelete, onMarkAttendance, onSelfMark,
}) {
  const dateParts = parseDate(p.date)
  const attendance = p.attendance || {}
  const myStatus = attendance[uid] || 'pending'

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {/* Date box */}
        <div
          style={{
            width: 72, flexShrink: 0,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 8px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              color: 'var(--text-muted)',
            }}
          >
            {dateParts.month}
          </div>
          <div
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 32,
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
              lineHeight: 1,
              marginTop: 2,
            }}
          >
            {dateParts.day}
          </div>
        </div>

        {/* Middle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
            {p.title || 'Practice'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{p.time || 'Time TBD'}</div>
          {p.notes && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-subtle)',
                marginTop: 6,
                lineHeight: 1.6,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {p.notes}
            </div>
          )}
        </div>

        {/* Right actions */}
        {canManage && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <IconBtn onClick={onEdit} title="Edit"><Pencil size={14} /></IconBtn>
            <IconBtn danger onClick={onDelete} title="Delete"><Trash2 size={14} /></IconBtn>
          </div>
        )}
      </div>

      {/* Attendance */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Users size={11} /> Attendance
          </div>
          {canManage && (
            <button className="btn btn-secondary btn-sm" onClick={onMarkAttendance}>
              <CheckCheck size={12} /> Mark attendance
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {members.map(m => {
            const status = attendance[m.uid] || 'pending'
            return (
              <div
                key={m.uid}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                }}
              >
                <Avatar name={m.ign} size={24} />
                <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.ign || 'Player'}
                </span>
                <StatusBadge status={status} />
              </div>
            )
          })}
        </div>

        {/* Player self-mark */}
        {!canManage && (
          <div style={{ marginTop: 12 }}>
            <div className="label" style={{ marginBottom: 6 }}>
              Your attendance {myStatus !== 'pending' && `— currently ${myStatus}`}
            </div>
            <div className="seg">
              <button
                onClick={() => onSelfMark('present')}
                className={`seg-btn ${myStatus === 'present' ? 'active' : ''}`}
              >
                Present
              </button>
              <button
                onClick={() => onSelfMark('late')}
                className={`seg-btn ${myStatus === 'late' ? 'active' : ''}`}
              >
                Late
              </button>
              <button
                onClick={() => onSelfMark('absent')}
                className={`seg-btn ${myStatus === 'absent' ? 'active' : ''}`}
              >
                Can't make it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   PRACTICE MODAL (create + edit)
   ============================================================ */
function PracticeModal({ open, onClose, onSubmit, initial }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || '')
      setDate(initial?.date || '')
      setTime(initial?.time || '')
      setNotes(initial?.notes || '')
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
    if (!title.trim() || !date || !time) { setErr('Title, date, and time are required.'); return }
    setBusy(true); setErr('')
    try {
      await onSubmit({ title: title.trim(), date, time, notes: notes.trim() })
    } catch (e2) {
      setErr(e2?.message || 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit} style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calendar size={18} style={{ color: 'var(--text-muted)' }} />
            <h3 style={{ fontFamily: 'Bebas Neue, sans-serif', fontWeight: 400, fontSize: 22, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)', margin: 0 }}>
              {initial ? 'Edit Practice' : 'Schedule Practice'}
            </h3>
          </div>
          <IconBtn onClick={onClose} title="Close"><X size={16} /></IconBtn>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Title*">
            <input className="input-field" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. TDM warm-up" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Date*">
              <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
            <Field label="Time*">
              <input type="time" className="input-field" value={time} onChange={e => setTime(e.target.value)} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="input-field" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" style={{ resize: 'vertical' }} />
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
   SHARED HELPERS
   ============================================================ */
function EmptyPractice({ canManage, onCreate }) {
  return (
    <div className="card empty-state">
      <Calendar size={40} className="empty-state-icon" />
      <div className="empty-state-title">No practices scheduled</div>
      <div className="empty-state-desc">Schedule your first practice session.</div>
      {canManage && (
        <button onClick={onCreate} className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>
          <Plus size={13} /> Schedule Practice
        </button>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'present') return <span className="badge badge-green">Present</span>
  if (status === 'late') return <span className="badge badge-amber">Late</span>
  if (status === 'absent') return <span className="badge badge-red">Absent</span>
  return <span className="badge">Pending</span>
}

function Avatar({ name, size = 32 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        fontFamily: 'Bebas Neue, sans-serif',
        fontSize: Math.round(size * 0.45),
        letterSpacing: '0.04em',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  )
}

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

function parseDate(iso) {
  if (!iso) return { month: '—', day: '—' }
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return { month: '—', day: '—' }
  return {
    month: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()).padStart(2, '0'),
  }
}
