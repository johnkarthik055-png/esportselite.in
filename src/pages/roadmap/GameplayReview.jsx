import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp,
} from 'firebase/firestore'
import { ArrowLeft, Save, Bot, ClipboardList } from 'lucide-react'
import { db } from '../../utils/firebase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import AICoachPanel from '../../components/roadmap/AICoachPanel.jsx'

/*
 * Section D — Gameplay Review.
 *
 * A lightweight standalone reflection form. It does NOT overlap with the
 * Match Logger — the Match Logger records match STATS (placement, kills,
 * damage); this records qualitative REVIEW notes for a session or match.
 *
 * Saves to  users/{uid}/roadmapReviews/{autoId}
 * (covered by the existing  users/{userId}/{document=**}  owner rule).
 *
 * "Ask AI Coach" is an honest placeholder — the coach backend is not
 * deployed (blocked on Blaze).
 *
 * FIRESTORE RULES: no change needed — the wildcard subcollection rule
 * under users/{userId} already permits owner read/write here.
 */

/* Verbatim from the content doc, Stage 8 "How to Improve" (lines 371-375):
   after important games, answer these five. */
const FIELDS = [
  { key: 'chokePoint',   label: 'Choke Point',                   hint: 'What went wrong?' },
  { key: 'strongPoint',  label: 'Strong Point',                  hint: 'What worked?' },
  { key: 'wouldImprove', label: 'What would I improve?',         hint: 'One concrete change.' },
  { key: 'whyMistake',   label: 'Why did the mistake happen?',   hint: 'The reason, not just the result.' },
  { key: 'nextTime',     label: 'What will I do differently next time?', hint: 'The specific fix.' },
]

const EMPTY = FIELDS.reduce((o, f) => ({ ...o, [f.key]: '' }), {})

export default function GameplayReview() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const uid = user?.uid

  const [form, setForm] = useState(EMPTY)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState('')
  const savedTimer = useRef(null)

  const load = useCallback(async () => {
    if (!uid) { setLoading(false); return }
    try {
      const snap = await getDocs(query(
        collection(db, 'users', uid, 'roadmapReviews'),
        orderBy('createdAt', 'desc'),
        limit(20),
      ))
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      /* orderBy on a missing field / empty collection is fine; only log real errors */
      console.warn('[GameplayReview] load:', e?.message || e)
    } finally {
      setLoading(false)
    }
  }, [uid])

  useEffect(() => { load() }, [load])
  useEffect(() => () => clearTimeout(savedTimer.current), [])

  const filledCount = FIELDS.filter(f => form[f.key].trim()).length
  const canSave = filledCount > 0 && !saving

  function update(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function save() {
    if (!uid || !canSave) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...FIELDS.reduce((o, f) => ({ ...o, [f.key]: form[f.key].trim() }), {}),
        createdAt: serverTimestamp(),
        source: 'roadmap-gameplay-review',
      }
      const ref = await addDoc(collection(db, 'users', uid, 'roadmapReviews'), payload)
      setHistory(prev => [{ id: ref.id, ...payload, createdAt: { toDate: () => new Date() } }, ...prev])
      setForm(EMPTY)
      setSavedAt(Date.now())
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSavedAt(null), 4000)
    } catch (e) {
      setError('Could not save — check your connection and try again.')
      console.error('[GameplayReview] save:', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rgd-wrap page-transition">
      <button className="roles-back" onClick={() => navigate('/roadmap')}>
        <ArrowLeft size={14} /> The Road to Esports
      </button>

      <div className="rgd-hero">
        <h1><ClipboardList size={20} style={{ verticalAlign: '-3px', marginRight: 8 }} />Gameplay Review</h1>
        <p>
          A two-minute honest debrief after a session or a match. The habit of writing it down is what
          turns "I played bad" into an actual fix.
        </p>
      </div>

      <div className="card">
        <div className="gpr-form">
          {FIELDS.map(f => (
            <div key={f.key} className="gpr-field">
              <label htmlFor={`gpr-${f.key}`}>{f.label}</label>
              <textarea
                id={`gpr-${f.key}`}
                className="input"
                rows={2}
                placeholder={f.hint}
                value={form[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
              />
            </div>
          ))}

          {error && <div style={{ color: 'var(--danger)', fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>{error}</div>}

          <div className="gpr-actions">
            <button className="btn btn-primary" onClick={save} disabled={!canSave}>
              <Save size={14} /> {saving ? 'Saving…' : 'Save Review'}
            </button>
            <button
              className="btn btn-secondary"
              disabled
              title="AI Coach isn't available yet"
            >
              <Bot size={14} /> Ask AI Coach
            </button>
            {savedAt && <span className="gpr-saved-note">Saved.</span>}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-subtle)', fontFamily: "'DM Sans', sans-serif" }}>
              {filledCount}/{FIELDS.length} filled · fill at least one
            </span>
          </div>
        </div>
      </div>

      <AICoachPanel
        context={{ area: 'gameplay-review' }}
        blurb="Once available, the AI Coach will read your review and suggest a drill for the mistake you flagged."
        suggestions={['Why does my choke point keep happening?', 'Turn my "next focus" into a drill']}
      />

      <div className="card">
        <div className="rma-side-title">Past reviews</div>
        {loading ? (
          <div className="card skeleton" style={{ height: 80 }} />
        ) : history.length === 0 ? (
          <p className="prg-empty">No reviews yet. Your saved reviews show up here, newest first.</p>
        ) : (
          <div className="gpr-history">
            {history.map(h => (
              <div key={h.id} className="gpr-entry">
                <div className="gpr-entry-date">{formatDate(h.createdAt)}</div>
                {FIELDS.map(f => h[f.key] ? (
                  <div key={f.key} className="gpr-entry-row">
                    <span className="gpr-entry-k">{f.label}</span>
                    <span className="gpr-entry-v">{h[f.key]}</span>
                  </div>
                ) : null)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatDate(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : new Date())
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return 'Recently'
  }
}
