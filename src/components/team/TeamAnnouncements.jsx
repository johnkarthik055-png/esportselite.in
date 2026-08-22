import { useEffect, useState } from 'react'
import { onSnapshot, collection } from 'firebase/firestore'
import {
  Megaphone, Plus, Pin, PinOff, Pencil, Trash2, X, Loader2,
  AlertCircle, Save,
} from 'lucide-react'
import { db } from '../../utils/firebase.js'
import {
  createAnnouncement, updateAnnouncement, deleteAnnouncement, togglePin,
} from '../../utils/team.js'
import {
  notifyTeamMembers, TEAM_NOTIFICATIONS,
} from '../../utils/notifications.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { getDisplayName } from '../../utils/storage.js'
import { useConfirm } from '../../hooks/useConfirm.js'
import ConfirmModal from '../ConfirmModal.jsx'

export default function TeamAnnouncements({ team, members, myRole, teamId }) {
  const { confirm, confirmModalProps } = useConfirm()
  const { user } = useAuth()
  const uid = user?.uid
  const canManage = myRole === 'owner' || myRole === 'igl'

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    if (!teamId) return
    setLoading(true)
    const unsub = onSnapshot(
      collection(db, 'teams', teamId, 'announcements'),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
          const at = a.createdAt?.toMillis?.() || 0
          const bt = b.createdAt?.toMillis?.() || 0
          return bt - at
        })
        setItems(list)
        setLoading(false)
      },
      () => setLoading(false)
    )
    return () => unsub()
  }, [teamId])

  async function handleCreate({ title, body }) {
    await createAnnouncement(teamId, uid, getDisplayName() || 'Unknown', { title, body })
    setShowCreate(false)
    notifyTeamMembers(
      members.filter(m => m.uid !== uid).map(m => m.uid),
      TEAM_NOTIFICATIONS.newAnnouncement(title),
    )
  }
  async function handleUpdate(id, data) {
    await updateAnnouncement(teamId, id, data)
    setEditingId(null)
  }
  async function handleDelete(id) {
    if (!await confirm('Delete this announcement?')) return
    await deleteAnnouncement(teamId, id)
  }
  async function handleTogglePin(id, currentPinned) {
    await togglePin(teamId, id, currentPinned)
  }

  return (
    <>
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
          Announcements
        </h2>
        {canManage && !showCreate && (
          <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm">
            <Plus size={13} /> Post Announcement
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && canManage && (
        <CreateAnnouncementForm
          onCancel={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}

      {loading ? (
        <LoadingRow />
      ) : items.length === 0 ? (
        <div className="card empty-state">
          <Megaphone size={40} className="empty-state-icon" />
          <div className="empty-state-title">No announcements yet</div>
          <div className="empty-state-desc">
            {canManage
              ? 'Post the first announcement so the roster is in the loop.'
              : 'Team-wide notices will appear here.'}
          </div>
          {canManage && !showCreate && (
            <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>
              <Plus size={13} /> Post the first announcement
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(a => (
            editingId === a.id ? (
              <EditAnnouncementForm
                key={a.id}
                item={a}
                onCancel={() => setEditingId(null)}
                onSubmit={(data) => handleUpdate(a.id, data)}
              />
            ) : (
              <AnnouncementCard
                key={a.id}
                a={a}
                canManage={canManage}
                onEdit={() => setEditingId(a.id)}
                onDelete={() => handleDelete(a.id)}
                onTogglePin={() => handleTogglePin(a.id, !!a.pinned)}
              />
            )
          ))}
        </div>
      )}

      <style>{`.animate-spin{animation:ee-a-spin .9s linear infinite}@keyframes ee-a-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
    <ConfirmModal {...confirmModalProps} />
    </>
  )
}

/* ============================================================ */
function AnnouncementCard({ a, canManage, onEdit, onDelete, onTogglePin }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {a.pinned && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--amber)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <Pin size={12} /> Pinned
              </span>
            )}
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
              {a.title}
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 4 }}>
            {a.createdByName || 'Unknown'} · {formatRelative(a.createdAt)}
            {a.editedAt && <> · edited {formatRelative(a.editedAt)}</>}
          </div>
        </div>

        {canManage && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <IconBtn onClick={onTogglePin} title={a.pinned ? 'Unpin' : 'Pin'}>
              {a.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </IconBtn>
            <IconBtn onClick={onEdit} title="Edit"><Pencil size={14} /></IconBtn>
            <IconBtn danger onClick={onDelete} title="Delete"><Trash2 size={14} /></IconBtn>
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: 14,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        }}
      >
        {a.body}
      </div>
    </div>
  )
}

function CreateAnnouncementForm({ onCancel, onSubmit }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !busy

  async function submit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setErr('')
    try {
      await onSubmit({ title: title.trim(), body: body.trim() })
    } catch (e2) { setErr(e2?.message || 'Could not post.') }
    finally { setBusy(false) }
  }

  return (
    <form className="card" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card-header">
        <div className="card-title">New announcement</div>
      </div>
      <Field label="Title*">
        <input className="input-field" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Short headline" />
      </Field>
      <Field label="Body*">
        <textarea className="input-field" rows={4} value={body} onChange={e => setBody(e.target.value)} placeholder="Full announcement text" style={{ resize: 'vertical' }} />
      </Field>
      {err && <ErrorBar msg={err} />}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button>
        <button type="submit" disabled={!canSubmit} className="btn btn-primary">
          {busy ? <><Loader2 size={13} className="animate-spin" /> Posting…</> : <><Plus size={13} /> Post</>}
        </button>
      </div>
    </form>
  )
}

function EditAnnouncementForm({ item, onCancel, onSubmit }) {
  const [title, setTitle] = useState(item.title || '')
  const [body, setBody] = useState(item.body || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !busy

  async function submit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setErr('')
    try { await onSubmit({ title: title.trim(), body: body.trim() }) }
    catch (e2) { setErr(e2?.message || 'Could not save.') }
    finally { setBusy(false) }
  }

  return (
    <form className="card" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card-header">
        <div className="card-title">Edit announcement</div>
      </div>
      <Field label="Title*">
        <input className="input-field" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} />
      </Field>
      <Field label="Body*">
        <textarea className="input-field" rows={4} value={body} onChange={e => setBody(e.target.value)} style={{ resize: 'vertical' }} />
      </Field>
      {err && <ErrorBar msg={err} />}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button>
        <button type="submit" disabled={!canSubmit} className="btn btn-primary">
          {busy ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Save size={13} /> Save</>}
        </button>
      </div>
    </form>
  )
}

/* ============================================================ */
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

function formatRelative(v) {
  if (!v) return ''
  const ms = v?.toMillis?.() ?? new Date(v).getTime()
  if (!ms) return ''
  const diff = Date.now() - ms
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
