/*
 * ADD TO FIRESTORE RULES (Firebase Console → Firestore → Rules) —
 * append this match block, do NOT replace the existing rules:
 *
 *   match /projectLog/{entryId} {
 *     allow read, write: if request.auth != null &&
 *       request.auth.token.email in [
 *         'karthikreddyy2010@gmail.com',
 *         'johnkarthik055@gmail.com'
 *       ];
 *   }
 *
 * Same admin-only pattern the panel already enforces client-side and
 * that other admin-only collections (mapData writes, app_config) use.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import {
  Lightbulb, Bug, CheckCircle2, Plus, Search, X, Loader2, AlertCircle,
} from 'lucide-react'
import { db } from '../../utils/firebase.js'

/* ---- constants ---- */
const TYPES = [
  { id: 'idea',      label: 'Idea',      icon: Lightbulb },
  { id: 'bug',       label: 'Bug',       icon: Bug },
  { id: 'completed', label: 'Completed', icon: CheckCircle2 },
]
const TYPE_MAP = Object.fromEntries(TYPES.map(t => [t.id, t]))

const STATUSES = [
  { id: 'open',        label: 'Open',        badge: 'badge badge-amber' },
  { id: 'in_progress', label: 'In progress', badge: 'badge badge-blue' },
  { id: 'done',        label: 'Done',        badge: 'badge badge-green' },
]
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.id, s]))

const FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'idea',      label: 'Ideas' },
  { id: 'bug',       label: 'Bugs' },
  { id: 'completed', label: 'Completed' },
]

const EMPTY_FORM = {
  type: 'idea',
  title: '',
  description: '',
  relatedArea: '',
  status: 'open',
}

/* ============================================================
   PROJECT LOG TAB
   ------------------------------------------------------------
   Running log of Ideas / Bugs / Completed items. Claude Code
   auto-writes an entry here after every task (see CLAUDE.md);
   Karthik can also add/correct entries manually.
   ============================================================ */
export default function ProjectLogTab({ adminEmail }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)

  /* Live list — same onSnapshot pattern as the Tournaments tab.
     Sorted client-side (newest first) so a brand-new collection with
     not-yet-resolved serverTimestamps still orders correctly and no
     composite index is required. */
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'projectLog'),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => msOf(b.createdAt) - msOf(a.createdAt))
        setEntries(list)
        setLoading(false)
      },
      (err) => {
        console.error('[Admin] projectLog snapshot failed:', err)
        setError(err?.message || 'Failed to load the project log.')
        setLoading(false)
      },
    )
    return unsub
  }, [])

  const counts = useMemo(() => {
    const c = { all: entries.length, idea: 0, bug: 0, completed: 0 }
    for (const e of entries) if (c[e.type] != null) c[e.type]++
    return c
  }, [entries])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter(e => {
      if (filter !== 'all' && e.type !== filter) return false
      if (!q) return true
      return (
        (e.title || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.relatedArea || '').toLowerCase().includes(q)
      )
    })
  }, [entries, filter, search])

  async function addEntry(form) {
    const now = serverTimestamp()
    await addDoc(collection(db, 'projectLog'), {
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim(),
      relatedArea: form.relatedArea.trim(),
      status: form.status,
      createdBy: 'karthik',
      createdAt: now,
      updatedAt: now,
    })
    setAdding(false)
  }

  async function updateStatus(id, status) {
    try {
      await updateDoc(doc(db, 'projectLog', id), {
        status,
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      alert('Could not update status: ' + (err?.message || err))
    }
  }

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Filter sub-tabs — same .seg pattern as the Trials tab */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div className="seg">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`seg-btn ${filter === f.id ? 'active' : ''}`}
            >
              {f.label} · {counts[f.id] ?? 0}
            </button>
          ))}
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setAdding(v => !v)}
        >
          {adding ? <><X size={13} /> Cancel</> : <><Plus size={13} /> Add Entry</>}
        </button>
      </div>

      {adding && <AddEntryForm onSubmit={addEntry} onCancel={() => setAdding(false)} />}

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 480 }}>
        <Search
          size={14}
          style={{
            position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text-subtle)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search title, description or area…"
          className="input-field"
          style={{ paddingLeft: 34 }}
        />
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="card" style={{ padding: 20 }}>
          <EmptyBlock
            title={entries.length === 0 ? 'No log entries yet' : 'Nothing matches'}
            desc={
              entries.length === 0
                ? 'Claude Code will log completed work here automatically, or add an idea/bug manually above.'
                : 'Try a different filter or search term.'
            }
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(e => (
            <EntryCard key={e.id} entry={e} onStatusChange={updateStatus} />
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
        {visible.length} of {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
        {adminEmail ? <> · viewing as {adminEmail}</> : null}
      </div>
    </div>
  )
}

/* ============================================================
   ADD ENTRY FORM
   ============================================================ */
function AddEntryForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const canSave = form.title.trim().length > 0 && !saving

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function submit() {
    if (!canSave) return
    setSaving(true)
    try {
      await onSubmit(form)
      setForm(EMPTY_FORM)
    } catch (err) {
      alert('Could not add entry: ' + (err?.message || err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card-header">
        <div className="card-title">New log entry</div>
      </div>

      <Field label="Type">
        <div className="seg">
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => set('type', t.id)}
              className={`seg-btn ${form.type === t.id ? 'active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Title">
        <input
          className="input-field"
          maxLength={120}
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="Short summary, e.g. Rondo vehicle spawns"
        />
      </Field>

      <Field label="Description">
        <textarea
          className="input-field"
          rows={3}
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Fuller detail of what was requested / found / done"
          style={{ resize: 'vertical' }}
        />
      </Field>

      <Field label="Related area">
        <input
          className="input-field"
          maxLength={80}
          value={form.relatedArea}
          onChange={e => set('relatedArea', e.target.value)}
          placeholder="e.g. Map Knowledge, Strategy Maker, Training Center"
        />
      </Field>

      <Field label="Status">
        <div className="seg">
          {STATUSES.map(s => (
            <button
              key={s.id}
              onClick={() => set('status', s.id)}
              className={`seg-btn ${form.status === s.id ? 'active' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Field>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary btn-sm" disabled={!canSave} onClick={submit}>
          {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : 'Save entry'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

/* ============================================================
   ENTRY CARD
   ============================================================ */
function EntryCard({ entry, onStatusChange }) {
  const [expanded, setExpanded] = useState(false)
  const type = TYPE_MAP[entry.type] || { label: entry.type || 'entry', icon: Lightbulb }
  const TypeIcon = type.icon
  const status = STATUS_MAP[entry.status] || STATUSES[0]
  const desc = entry.description || ''
  const isLong = desc.length > 220
  const shown = expanded || !isLong ? desc : desc.slice(0, 220).trimEnd() + '…'

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className="badge" style={{ gap: 5 }}>
          <TypeIcon size={12} /> {type.label}
        </span>
        <span className={status.badge}>{status.label}</span>
        <div style={{ flex: 1 }} />
        {entry.relatedArea ? (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{entry.relatedArea}</span>
        ) : null}
        <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
          {timeAgo(entry.createdAt)} · {entry.createdBy === 'claude_code' ? 'Claude Code' : 'Karthik'}
        </span>
      </div>

      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
        {entry.title || 'Untitled'}
      </div>

      {desc ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {shown}
          {isLong && (
            <button
              onClick={() => setExpanded(v => !v)}
              style={{
                marginLeft: 6, background: 'none', border: 'none', padding: 0,
                color: 'var(--blue)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
        <span className="label">Set status:</span>
        <div className="seg">
          {STATUSES.map(s => (
            <button
              key={s.id}
              onClick={() => { if (s.id !== entry.status) onStatusChange(entry.id, s.id) }}
              className={`seg-btn ${entry.status === s.id ? 'active' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {entry.updatedAt && msOf(entry.updatedAt) !== msOf(entry.createdAt) ? (
          <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
            updated {timeAgo(entry.updatedAt)}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/* ============================================================
   HELPERS
   ============================================================ */
function msOf(ts) {
  if (!ts) return Date.now() /* unresolved serverTimestamp → treat as newest */
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  const d = new Date(ts)
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

function timeAgo(ts) {
  if (!ts) return 'just now'
  const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts)
  if (isNaN(d.getTime())) return '—'
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min${m === 1 ? '' : 's'} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const day = Math.floor(h / 24)
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`
  const w = Math.floor(day / 7)
  if (w < 5) return `${w} week${w === 1 ? '' : 's'} ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function LoadingBlock() {
  return (
    <div style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
      <Loader2 size={18} className="animate-spin" />
      <span style={{ fontSize: 13 }}>Loading…</span>
    </div>
  )
}

function ErrorBlock({ error }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <AlertCircle size={18} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Something went wrong</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{error}</div>
      </div>
    </div>
  )
}

function EmptyBlock({ title, desc }) {
  return (
    <div className="empty-state">
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-desc">{desc}</div>
    </div>
  )
}
