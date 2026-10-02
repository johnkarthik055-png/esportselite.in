import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
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

const EASE = [0.22, 1, 0.36, 1]

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
  const reduce = useReducedMotion()
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
      <motion.button
        className="rgd-back"
        onClick={() => navigate('/roadmap')}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <ArrowLeft size={14} /> The Road to Esports
      </motion.button>

      <motion.header
        className="rgd-hero"
        initial={{ opacity: 0, y: reduce ? 0 : 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <div className="rgd-hero-dots" aria-hidden />
        <div className="rgd-hero-glow-blue" aria-hidden />
        <div className="rgd-hero-glow-red" aria-hidden />
        <div className="rgd-hero-inner">
          <div className="rgd-hero-kicker"><ClipboardList size={13} /> Debrief</div>
          <h1 className="rgd-title">GAMEPLAY REVIEW</h1>
          <motion.div
            className="rgd-accent"
            initial={{ scaleX: reduce ? 1 : 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
          />
          <p className="rgd-sub">
            A two-minute honest debrief after a session or a match. The habit of writing it down is what
            turns "I played bad" into an actual fix.
          </p>
        </div>
      </motion.header>

      <motion.div
        className="card rgd-card"
        initial={{ opacity: 0, y: reduce ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: EASE }}
      >
        <div className="gpr-form">
          {FIELDS.map(f => (
            <div key={f.key} className="gpr-field">
              <label htmlFor={`gpr-${f.key}`}>{f.label}</label>
              <textarea
                id={`gpr-${f.key}`}
                className="gpr-textarea"
                rows={2}
                placeholder={f.hint}
                value={form[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
              />
            </div>
          ))}

          {error && <div className="gpr-error">{error}</div>}

          <div className="gpr-actions">
            <motion.button
              className="btn btn-primary"
              onClick={save}
              disabled={!canSave}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Save size={14} /> {saving ? 'Saving…' : 'Save Review'}
            </motion.button>
            <button
              className="btn btn-secondary"
              disabled
              title="AI Coach isn't available yet"
            >
              <Bot size={14} /> Ask AI Coach
            </button>
            {savedAt && <span className="gpr-saved-note">Saved.</span>}
            <span className="gpr-count">
              {filledCount}/{FIELDS.length} filled · fill at least one
            </span>
          </div>
        </div>
      </motion.div>

      <AICoachPanel
        context={{ area: 'gameplay-review' }}
        blurb="Once available, the AI Coach will read your review and suggest a drill for the mistake you flagged."
        suggestions={['Why does my choke point keep happening?', 'Turn my "next focus" into a drill']}
      />

      <motion.div
        className="card rgd-card"
        initial={{ opacity: 0, y: reduce ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15, ease: EASE }}
      >
        <div className="rgd-card-title">Past reviews</div>
        {loading ? (
          <div className="card skeleton" style={{ height: 80 }} />
        ) : history.length === 0 ? (
          <p className="rgd-empty">No reviews yet. Your saved reviews show up here, newest first.</p>
        ) : (
          <div className="gpr-history">
            {history.map((h, i) => (
              <motion.div
                key={h.id}
                className="gpr-entry"
                initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.04, ease: EASE }}
              >
                <div className="gpr-entry-date">{formatDate(h.createdAt)}</div>
                {FIELDS.map(f => h[f.key] ? (
                  <div key={f.key} className="gpr-entry-row">
                    <span className="gpr-entry-k">{f.label}</span>
                    <span className="gpr-entry-v">{h[f.key]}</span>
                  </div>
                ) : null)}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <style>{styles}</style>
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

const styles = `
  .rgd-wrap { display: flex; flex-direction: column; gap: 16px; max-width: 920px; margin: 0 auto; width: 100%; }

  .rgd-back {
    align-self: flex-start; display: inline-flex; align-items: center; gap: 6px;
    background: rgba(37,99,255,0.06); border: 1px solid rgba(37,99,255,0.1);
    border-radius: 999px; padding: 7px 16px 7px 12px; cursor: pointer;
    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #2563FF;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .rgd-back:hover { background: rgba(37,99,255,0.1); border-color: rgba(37,99,255,0.18); }

  /* ── Hero ── */
  .rgd-hero {
    position: relative; overflow: hidden;
    background: linear-gradient(135deg, #F7F9FD 0%, #EEF4FF 60%, #FFF0F2 100%);
    border: 1px solid #E5EAF3; border-radius: 18px;
    padding: clamp(24px, 4vw, 36px);
    box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 16px 48px rgba(15,23,42,0.05);
  }
  .rgd-hero-dots {
    position: absolute; inset: 0; pointer-events: none; z-index: 0;
    background-image: radial-gradient(circle, rgba(37,99,255,0.06) 1px, transparent 1px);
    background-size: 24px 24px;
  }
  .rgd-hero-glow-blue {
    position: absolute; top: -70px; left: -70px; width: 280px; height: 280px; border-radius: 50%;
    background: radial-gradient(circle, rgba(37,99,255,0.10) 0%, transparent 65%);
    pointer-events: none; z-index: 0;
  }
  .rgd-hero-glow-red {
    position: absolute; top: -50px; right: -50px; width: 230px; height: 230px; border-radius: 50%;
    background: radial-gradient(circle, rgba(239,51,64,0.07) 0%, transparent 65%);
    pointer-events: none; z-index: 0;
  }
  .rgd-hero-inner { position: relative; z-index: 1; }
  .rgd-hero-kicker {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.15em; color: #2563FF;
  }
  .rgd-title {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900;
    font-size: clamp(28px, 5.5vw, 44px); line-height: 1; text-transform: uppercase;
    letter-spacing: 0.02em; color: #0B1224; margin: 4px 0 0;
  }
  .rgd-accent {
    width: 56px; height: 3px; margin: 10px 0 2px; transform-origin: left;
    background: linear-gradient(90deg, #2563FF 0%, #5B3DF5 50%, #EF3340 100%);
    border-radius: 2px;
  }
  .rgd-sub { font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.65; color: #475569; max-width: 620px; margin: 6px 0 0; }

  .rgd-card { transition: box-shadow 0.2s ease; }
  .rgd-card-title {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 13px;
    text-transform: uppercase; letter-spacing: 0.06em; color: #2563FF; margin-bottom: 12px;
  }
  .rgd-empty { font-family: 'Inter', sans-serif; font-size: 13px; color: #94A3B8; font-style: italic; }

  /* ── Form ── */
  .gpr-form { display: flex; flex-direction: column; gap: 16px; }
  .gpr-field { display: flex; flex-direction: column; gap: 6px; }
  .gpr-field label {
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.08em; color: #64748B;
  }
  .gpr-textarea {
    width: 100%; box-sizing: border-box; resize: vertical;
    background: #F8FAFD; border: 1px solid #E5EAF3; border-radius: 10px;
    padding: 10px 14px; font-family: 'Inter', sans-serif; font-size: 13.5px;
    color: #0B1224; line-height: 1.5; outline: none;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .gpr-textarea:focus { border-color: #2563FF; background: #FFFFFF; }
  .gpr-textarea::placeholder { color: #94A3B8; }
  .gpr-error {
    font-family: 'Inter', sans-serif; font-size: 12.5px; color: #EF3340;
    background: rgba(239,51,64,0.06); border: 1px solid rgba(239,51,64,0.2);
    padding: 8px 12px; border-radius: 8px;
  }
  .gpr-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .gpr-saved-note { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 12.5px; color: #16A34A; }
  .gpr-count { margin-left: auto; font-family: 'Inter', sans-serif; font-size: 11.5px; color: #94A3B8; }

  /* ── History ── */
  .gpr-history { display: flex; flex-direction: column; gap: 10px; }
  .gpr-entry { background: #F8FAFD; border: 1px solid #E5EAF3; border-radius: 12px; padding: 14px 16px; }
  .gpr-entry-date {
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 10.5px;
    text-transform: uppercase; letter-spacing: 0.08em; color: #64748B; margin-bottom: 8px;
  }
  .gpr-entry-row { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
  .gpr-entry-row:last-child { margin-bottom: 0; }
  .gpr-entry-k { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 11.5px; color: #2563FF; }
  .gpr-entry-v { font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.5; color: #475569; }
`
