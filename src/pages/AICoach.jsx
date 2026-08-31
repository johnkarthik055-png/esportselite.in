/*
 * ADD TO FIRESTORE RULES (Firebase Console → Firestore → Rules) —
 * append these match blocks, do NOT replace the existing rules.
 * Owner-only, same pattern as the other users/{userId} subcollections.
 *
 *   match /users/{userId}/classicStats/{docId} {
 *     allow read, write: if request.auth != null && request.auth.uid == userId;
 *   }
 *   match /users/{userId}/coachSessions/{sessionId} {
 *     allow read, write: if request.auth != null && request.auth.uid == userId;
 *     match /messages/{msgId} {
 *       allow read, write: if request.auth != null && request.auth.uid == userId;
 *     }
 *   }
 *
 * NOTE: the AI Coach needs the `aiCoachChat` Cloud Function deployed
 * (Blaze plan + `firebase functions:secrets:set OPENAI_KEY` +
 * `firebase deploy --only functions`). Until then, uploads/messages
 * fail with a friendly "AI Coach isn't set up yet" message and nothing
 * is written.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot, ImageIcon, Send, Loader2, AlertTriangle, Crosshair, Target, Percent, RefreshCw,
} from 'lucide-react'
import {
  collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../utils/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { aiCoachChat, fileToBase64 } from '../utils/aiFunctions.js'

/* Single ongoing thread per user — simplest for v1; no session switcher.
   (A multi-session picker can be layered on later without changing the
   message schema.) */
const SESSION_ID = 'default'

export default function AICoach() {
  const { user } = useAuth()
  const uid = user?.uid

  const [messages, setMessages] = useState([])
  const [statsHistory, setStatsHistory] = useState([]) /* newest first, up to 3 */
  const [loadingThread, setLoadingThread] = useState(true)
  const [busy, setBusy] = useState(false)      /* awaiting a coach response */
  const [error, setError] = useState('')
  const [lastAction, setLastAction] = useState(null) /* for retry: { kind, ... } */
  const [input, setInput] = useState('')

  const fileRef = useRef(null)
  const scrollRef = useRef(null)

  const msgsCol = useMemo(
    () => (uid ? collection(db, 'users', uid, 'coachSessions', SESSION_ID, 'messages') : null),
    [uid],
  )

  /* live thread */
  useEffect(() => {
    if (!msgsCol) return
    const unsub = onSnapshot(
      query(msgsCol, orderBy('createdAt', 'asc')),
      snap => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoadingThread(false)
      },
      () => setLoadingThread(false),
    )
    return unsub
  }, [msgsCol])

  /* recent stats history — feeds the "improvement vs last time" prompt */
  useEffect(() => {
    if (!uid) return
    const unsub = onSnapshot(
      query(collection(db, 'users', uid, 'classicStats'), orderBy('createdAt', 'desc'), limit(3)),
      snap => setStatsHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {},
    )
    return unsub
  }, [uid])

  /* keep scrolled to newest */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const currentStats = statsHistory[0]
    ? {
        headshots: statsHistory[0].headshots ?? null,
        headshotRate: statsHistory[0].headshotRate ?? null,
        accuracy: statsHistory[0].accuracy ?? null,
      }
    : null

  const priorStatsPayload = statsHistory.map(s => ({
    headshots: s.headshots ?? null,
    headshotRate: s.headshotRate ?? null,
    accuracy: s.accuracy ?? null,
  }))

  const historyPayload = messages.slice(-20).map(m => ({ role: m.role, text: m.text }))

  async function writeMsg(data) {
    if (!msgsCol) return
    await addDoc(msgsCol, { ...data, createdAt: serverTimestamp() })
  }

  /* ---- new analysis: screenshot upload ---- */
  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Image is too large — use one under 5 MB.'); return }

    setError(''); setBusy(true)
    try {
      const { base64, mimeType } = await fileToBase64(file)
      const res = await aiCoachChat({ imageBase64: base64, mimeType, priorStats: priorStatsPayload })

      /* persist: stats history + the two chat messages */
      await addDoc(collection(db, 'users', uid, 'classicStats'), {
        headshots: res.stats?.headshots ?? null,
        headshotRate: res.stats?.headshotRate ?? null,
        accuracy: res.stats?.accuracy ?? null,
        createdAt: serverTimestamp(),
      })
      await writeMsg({ role: 'user', text: 'Uploaded a new Classic stats screenshot.' })
      await writeMsg({
        role: 'coach',
        text: res.coachMessage,
        stats: res.stats || null,
        warnings: res.warnings || [],
      })
      setLastAction(null)
    } catch (err) {
      handleErr(err, { kind: 'upload', file })
    } finally {
      setBusy(false)
    }
  }

  /* ---- follow-up: text question ---- */
  async function sendFollowUp() {
    const text = input.trim()
    if (!text || busy) return
    if (!currentStats) {
      setError('Upload a Classic stats screenshot first so the coach has something to work with.')
      return
    }
    setInput(''); setError(''); setBusy(true)
    try {
      await writeMsg({ role: 'user', text })
      const res = await aiCoachChat({
        message: text,
        stats: currentStats,
        priorStats: priorStatsPayload,
        history: historyPayload,
      })
      await writeMsg({ role: 'coach', text: res.coachMessage, warnings: res.warnings || [] })
      setLastAction(null)
    } catch (err) {
      handleErr(err, { kind: 'followup', text })
    } finally {
      setBusy(false)
    }
  }

  function handleErr(err, action) {
    const code = err?.code || ''
    let msg = err?.message || 'Something went wrong.'
    if (code === 'functions/unauthenticated') msg = 'Sign in first.'
    else if (code === 'functions/not-found' || code === 'functions/internal' && /not.*(deployed|configured|available)/i.test(msg)) {
      msg = 'The AI Coach isn’t live yet — the Cloud Function still needs to be deployed.'
    }
    setError(msg)
    setLastAction(action)
  }

  async function retry() {
    if (!lastAction) return
    setError('')
    if (lastAction.kind === 'followup') { setInput(lastAction.text); setLastAction(null) }
    else if (lastAction.kind === 'upload' && lastAction.file) {
      setBusy(true)
      try {
        const { base64, mimeType } = await fileToBase64(lastAction.file)
        const res = await aiCoachChat({ imageBase64: base64, mimeType, priorStats: priorStatsPayload })
        await addDoc(collection(db, 'users', uid, 'classicStats'), {
          headshots: res.stats?.headshots ?? null,
          headshotRate: res.stats?.headshotRate ?? null,
          accuracy: res.stats?.accuracy ?? null,
          createdAt: serverTimestamp(),
        })
        await writeMsg({ role: 'user', text: 'Uploaded a new Classic stats screenshot.' })
        await writeMsg({ role: 'coach', text: res.coachMessage, stats: res.stats || null, warnings: res.warnings || [] })
        setLastAction(null)
      } catch (err) { handleErr(err, lastAction) }
      finally { setBusy(false) }
    }
  }

  return (
    <div className="aic-page page-transition">
      <div className="aic-head">
        <div className="aic-title">
          <Bot size={20} /> AI Coach
        </div>
        <div className="aic-sub">
          Upload a Classic stats screen and talk through your aim with an AI coach.
        </div>
      </div>

      <div className="aic-thread" ref={scrollRef}>
        {loadingThread ? (
          <div className="aic-center"><Loader2 size={18} className="aic-spin" /> Loading…</div>
        ) : messages.length === 0 ? (
          <div className="aic-empty">
            <Bot size={34} />
            <p>No sessions yet.</p>
            <p className="aic-empty-sub">
              Upload a screenshot of your Classic career stats (headshots, headshot rate,
              accuracy) and the coach will tell you what to work on.
            </p>
            <button className="btn btn-red btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              <ImageIcon size={14} /> Upload Stats Screenshot
            </button>
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`aic-row ${m.role === 'coach' ? 'aic-row-coach' : 'aic-row-user'}`}>
              {m.role === 'coach' && (
                <div className="aic-avatar"><Bot size={15} /></div>
              )}
              <div className={`aic-bubble ${m.role === 'coach' ? 'aic-bubble-coach' : 'aic-bubble-user'}`}>
                {m.role === 'coach' && m.stats && <StatsCard stats={m.stats} />}
                {Array.isArray(m.warnings) && m.warnings.map((w, i) => (
                  <div key={i} className="aic-warn"><AlertTriangle size={12} /> {w}</div>
                ))}
                <div className="aic-text">{m.text}</div>
              </div>
            </div>
          ))
        )}

        {busy && (
          <div className="aic-row aic-row-coach">
            <div className="aic-avatar"><Bot size={15} /></div>
            <div className="aic-bubble aic-bubble-coach">
              <span className="aic-typing"><i /><i /><i /></span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="aic-error">
          <AlertTriangle size={14} /> {error}
          {lastAction && (
            <button className="btn btn-secondary btn-sm" onClick={retry} style={{ marginLeft: 'auto' }}>
              <RefreshCw size={12} /> Retry
            </button>
          )}
        </div>
      )}

      <div className="aic-composer">
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} hidden />
        <button
          className="aic-attach"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          title="Upload Classic stats screenshot"
          aria-label="Upload Classic stats screenshot"
        >
          <ImageIcon size={17} />
        </button>
        <input
          className="aic-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFollowUp() } }}
          placeholder={currentStats ? 'Ask a follow-up… e.g. why is my accuracy weak?' : 'Upload a stats screenshot to start'}
          disabled={busy}
        />
        <button className="aic-send" onClick={sendFollowUp} disabled={busy || !input.trim()} aria-label="Send">
          {busy ? <Loader2 size={16} className="aic-spin" /> : <Send size={16} />}
        </button>
      </div>

      <style>{`
        .aic-page { display:flex; flex-direction:column; gap:14px; height:calc(100vh - 150px); min-height:520px; max-width:820px; margin:0 auto; width:100%; }
        .aic-head { flex-shrink:0; }
        .aic-title { display:flex; align-items:center; gap:9px; font-family:'Bebas Neue',sans-serif; font-size:26px; letter-spacing:0.05em; text-transform:uppercase; color:var(--text-primary); }
        .aic-sub { font-size:12.5px; color:var(--text-subtle); margin-top:2px; }
        .aic-thread { flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:14px; padding:16px; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius-lg); }
        .aic-center { display:flex; align-items:center; justify-content:center; gap:8px; color:var(--text-muted); font-size:13px; padding:24px; }
        .aic-empty { margin:auto; text-align:center; color:var(--text-muted); display:flex; flex-direction:column; align-items:center; gap:8px; max-width:380px; }
        .aic-empty p { margin:0; font-size:13px; }
        .aic-empty-sub { color:var(--text-subtle); font-size:12px; line-height:1.6; }
        .aic-empty .btn { margin-top:8px; }
        .aic-row { display:flex; gap:10px; align-items:flex-start; }
        .aic-row-user { flex-direction:row-reverse; }
        .aic-avatar { width:28px; height:28px; flex-shrink:0; border-radius:50%; background:var(--blue); color:#fff; display:flex; align-items:center; justify-content:center; }
        .aic-bubble { max-width:76%; padding:11px 14px; border-radius:14px; font-size:13.5px; line-height:1.6; }
        .aic-bubble-coach { background:var(--bg-elevated); border:1px solid var(--border); color:var(--text-primary); border-top-left-radius:4px; }
        .aic-bubble-user { background:var(--blue); color:#fff; border-top-right-radius:4px; }
        .aic-text { white-space:pre-wrap; }
        .aic-warn { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--amber); background:var(--amber-tint); border:1px solid rgba(245,158,11,0.3); padding:5px 8px; border-radius:8px; margin-bottom:8px; }
        .aic-statscard { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid var(--border); }
        .aic-stat { flex:1; min-width:78px; background:var(--bg-surface); border:1px solid var(--border); border-radius:8px; padding:7px 9px; }
        .aic-stat-label { display:flex; align-items:center; gap:4px; font-size:9px; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-subtle); }
        .aic-stat-val { font-family:'Bebas Neue',sans-serif; font-size:20px; color:var(--text-primary); line-height:1.1; margin-top:2px; }
        .aic-typing { display:inline-flex; gap:4px; padding:2px 0; }
        .aic-typing i { width:6px; height:6px; border-radius:50%; background:var(--text-subtle); animation:aic-bounce 1s infinite ease-in-out; }
        .aic-typing i:nth-child(2) { animation-delay:0.15s; }
        .aic-typing i:nth-child(3) { animation-delay:0.3s; }
        @keyframes aic-bounce { 0%,80%,100%{ transform:translateY(0); opacity:0.4; } 40%{ transform:translateY(-4px); opacity:1; } }
        .aic-spin { animation:aic-spin 0.9s linear infinite; }
        @keyframes aic-spin { to { transform:rotate(360deg); } }
        .aic-error { flex-shrink:0; display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--red); background:var(--red-ghost); border:1px solid rgba(232,0,28,0.25); padding:9px 12px; border-radius:var(--radius-sm); }
        .aic-composer { flex-shrink:0; display:flex; align-items:center; gap:8px; }
        .aic-attach, .aic-send { width:38px; height:38px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--bg-elevated); color:var(--text-primary); cursor:pointer; }
        .aic-send { background:var(--blue); border-color:var(--blue); color:#fff; }
        .aic-attach:disabled, .aic-send:disabled { opacity:0.5; cursor:not-allowed; }
        .aic-input { flex:1; min-width:0; height:38px; padding:0 12px; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--bg-elevated); color:var(--text-primary); font-family:var(--font-body); font-size:13px; }
        .aic-input:focus { outline:none; border-color:var(--blue); }
      `}</style>
    </div>
  )
}

function StatsCard({ stats }) {
  const cell = (icon, label, val, suffix = '') => (
    <div className="aic-stat">
      <div className="aic-stat-label">{icon} {label}</div>
      <div className="aic-stat-val">{val == null ? '—' : `${val}${suffix}`}</div>
    </div>
  )
  return (
    <div className="aic-statscard">
      {cell(<Crosshair size={10} />, 'Headshots', stats.headshots)}
      {cell(<Target size={10} />, 'HS Rate', stats.headshotRate, '%')}
      {cell(<Percent size={10} />, 'Accuracy', stats.accuracy, '%')}
    </div>
  )
}
