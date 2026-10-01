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
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, ImageIcon, Send, Loader2, AlertTriangle, Crosshair, Target, Percent, RefreshCw,
  Brain, Check, Crown, Map, BookOpen, BarChart2, Zap,
} from 'lucide-react'
import {
  collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../utils/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { aiCoachChat, fileToBase64 } from '../utils/aiFunctions.js'
import { useSubscription } from '../hooks/useSubscription.js'
import UpgradeOverlay from '../components/UpgradeOverlay.jsx'

/* Single ongoing thread per user — simplest for v1; no session switcher.
   (A multi-session picker can be layered on later without changing the
   message schema.) */
const SESSION_ID = 'default'

const SUGGESTION_CHIPS = [
  { icon: Target,    text: 'How do I improve my aim?' },
  { icon: Map,       text: 'Best rotation for Erangel?' },
  { icon: BookOpen,  text: 'Create a training plan for me' },
  { icon: BarChart2, text: 'Analyze my weaknesses' },
]

const CAPABILITIES = [
  'Strategy & Rotations',
  'Aim & Mechanics',
  'Team Communication',
  'Training Plans',
  'Match Analysis',
  'Mental Game',
]

export default function AICoach() {
  const { user } = useAuth()
  const uid = user?.uid
  const { isActive, loading: subLoading } = useSubscription()

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
      msg = `The AI Coach isn’t live yet — the Cloud Function still needs to be deployed.`
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

  /* ── helpers ── */
  function handleSuggestionChip(text) {
    if (!currentStats) {
      setError('Upload a Classic stats screenshot first so the coach has something to work with.')
      return
    }
    setInput(text)
  }

  return (
    <div style={{ position: 'relative' }}>
      {!isActive && !subLoading && (
        <UpgradeOverlay
          title="AI Coach"
          description="Get personalized coaching based on your actual match stats. Upload a screenshot and receive a breakdown of your strengths, weaknesses, and a custom practice plan."
          feature="ai-coach"
        />
      )}

      {/* ── Page header ── */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: 'linear-gradient(135deg, #F7F9FD 0%, #EEF4FF 60%, #FFF0F2 100%)',
          borderRadius: 16, padding: 32,
          position: 'relative', overflow: 'hidden',
          marginBottom: 24,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(37,99,255,0.06) 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: -60, left: -60, width: 300, height: 300, background: 'radial-gradient(circle, rgba(37,99,255,0.1) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, right: -40, width: 250, height: 250, background: 'radial-gradient(circle, rgba(239,51,64,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 0 }}>
            <h1 style={{
              fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 48,
              color: '#0B1224', margin: 0, letterSpacing: '0.02em', textTransform: 'uppercase',
              lineHeight: 1,
            }}>
              AI Coach
            </h1>
            <span style={{
              background: '#EAF2FF', color: '#2563FF',
              fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 600,
              borderRadius: 999, padding: '2px 10px',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              alignSelf: 'flex-start', marginTop: 4,
            }}>BETA</span>
          </div>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{ width: 64, height: 3, background: 'linear-gradient(90deg,#2563FF,#EF3340)', borderRadius: 2, marginTop: 12, marginBottom: 12, transformOrigin: 'left' }}
          />
          <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 15, color: '#64748B', margin: 0 }}>
            Your personal BGMI performance coach. Powered by AI.
          </p>
        </div>
      </motion.div>

      {/* ── 2-column layout ── */}
      <div className="aic-layout">
        {/* ── Main chat area ── */}
        <div className="aic-main">
          <div style={{
            background: '#FFFFFF', border: '1px solid #E5EAF3',
            borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
            height: 'calc(100vh - 300px)', minHeight: 500,
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Chat header */}
            <div style={{
              background: '#FFFFFF', borderBottom: '1px solid #E5EAF3',
              padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: '#EAF2FF', border: '1px solid rgba(37,99,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Brain size={24} style={{ color: '#2563FF' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: '#0B1224' }}>
                  AI Coach
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#64748B', marginTop: 1 }}>
                  Ask me anything about BGMI strategy, training, or improvement
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A' }} />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500, color: '#16A34A' }}>Online</span>
              </div>
            </div>

            {/* Messages area */}
            <div ref={scrollRef} style={{
              flex: 1, overflowY: 'auto',
              padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
              background: '#F8FAFD',
            }}>
              {loadingThread ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#64748B', fontSize: 13, padding: 24 }}>
                  <Loader2 size={18} className="aic-spin" /> Loading…
                </div>
              ) : messages.length === 0 ? (
                /* Welcome / empty state */
                <div style={{ margin: 'auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: 20, marginBottom: 16,
                    background: 'linear-gradient(135deg,#EAF2FF,#F0EEFF)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Brain size={40} style={{ color: '#2563FF' }} />
                  </div>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 32, color: '#0B1224', marginBottom: 8 }}>
                    Welcome to AI Coach
                  </div>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#64748B', maxWidth: 400, lineHeight: 1.6, margin: '0 0 24px' }}>
                    Upload a screenshot of your Classic career stats and the coach will analyse your performance and give personalised coaching.
                  </p>
                  {/* Suggestion chips */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 480, width: '100%', marginBottom: 20 }}>
                    {SUGGESTION_CHIPS.map(({ icon: Icon, text }, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.08, duration: 0.3 }}
                        onClick={() => handleSuggestionChip(text)}
                        style={{
                          background: '#FFFFFF', border: '1px solid #E5EAF3',
                          borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563FF'; e.currentTarget.style.background = '#EAF2FF' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5EAF3'; e.currentTarget.style.background = '#FFFFFF' }}
                      >
                        <Icon size={16} style={{ color: '#2563FF', flexShrink: 0 }} />
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: '#0B1224' }}>{text}</span>
                      </motion.button>
                    ))}
                  </div>
                  <button
                    style={{
                      background: 'linear-gradient(135deg,#2563FF,#5B3DF5)', color: '#FFFFFF',
                      border: 'none', borderRadius: 10, padding: '12px 28px',
                      fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      boxShadow: '0 4px 14px rgba(37,99,255,0.25)',
                    }}
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                  >
                    <ImageIcon size={16} /> Upload Stats Screenshot
                  </button>
                </div>
              ) : (
                messages.map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                      flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                    }}
                  >
                    {m.role === 'coach' && (
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: '#EAF2FF', border: '1px solid rgba(37,99,255,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Brain size={18} style={{ color: '#2563FF' }} />
                      </div>
                    )}
                    <div style={{ maxWidth: '70%' }}>
                      <div style={{
                        padding: '14px 18px',
                        background: m.role === 'coach' ? '#FFFFFF' : 'linear-gradient(135deg,#2563FF,#5B3DF5)',
                        border: m.role === 'coach' ? '1px solid #E5EAF3' : 'none',
                        borderRadius: m.role === 'coach' ? '0 14px 14px 14px' : '14px 0 14px 14px',
                        color: m.role === 'coach' ? '#0B1224' : '#FFFFFF',
                        fontFamily: 'Inter, sans-serif', fontSize: 14, lineHeight: 1.65,
                        boxShadow: m.role === 'coach' ? '0 2px 8px rgba(15,23,42,0.04)' : 'none',
                      }}>
                        {m.role === 'coach' && m.stats && <StatsCard stats={m.stats} />}
                        {Array.isArray(m.warnings) && m.warnings.map((w, wi) => (
                          <div key={wi} style={{
                            display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                            color: '#F59E0B', background: 'rgba(245,158,11,0.08)',
                            border: '1px solid rgba(245,158,11,0.2)', padding: '5px 8px',
                            borderRadius: 8, marginBottom: 8,
                          }}>
                            <AlertTriangle size={12} /> {w}
                          </div>
                        ))}
                        <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}

              {/* Typing indicator */}
              {busy && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: '#EAF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Brain size={18} style={{ color: '#2563FF' }} />
                  </div>
                  <div style={{
                    padding: '14px 18px', background: '#FFFFFF', border: '1px solid #E5EAF3',
                    borderRadius: '0 14px 14px 14px',
                    display: 'inline-flex', gap: 4, alignItems: 'center',
                  }}>
                    <i className="aic-dot" /><i className="aic-dot" /><i className="aic-dot aic-dot-3" />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Error bar */}
            {error && (
              <div style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12.5, color: '#EF3340',
                background: 'rgba(239,51,64,0.06)', border: '1px solid rgba(239,51,64,0.2)',
                borderTop: 'none', padding: '9px 16px',
              }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {error}
                {lastAction && (
                  <button
                    onClick={retry}
                    style={{
                      marginLeft: 'auto', background: 'transparent',
                      border: '1px solid rgba(239,51,64,0.3)', color: '#EF3340',
                      borderRadius: 6, padding: '4px 10px', fontSize: 12,
                      fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <RefreshCw size={12} /> Retry
                  </button>
                )}
              </div>
            )}

            {/* Composer */}
            <div style={{
              flexShrink: 0, background: '#FFFFFF', borderTop: '1px solid #E5EAF3',
              padding: '16px 20px', display: 'flex', gap: 10, alignItems: 'flex-end',
            }}>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} hidden />
              {!currentStats && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  title="Upload Classic stats screenshot"
                  aria-label="Upload Classic stats screenshot"
                  style={{
                    width: 44, height: 44, flexShrink: 0,
                    background: '#F8FAFD', border: '1.5px solid #DCE4F0',
                    borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#64748B',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563FF'; e.currentTarget.style.color = '#2563FF' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#DCE4F0'; e.currentTarget.style.color = '#64748B' }}
                >
                  <ImageIcon size={17} />
                </button>
              )}
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFollowUp() } }}
                placeholder={currentStats ? 'Ask a follow-up… e.g. why is my accuracy weak?' : 'Upload a stats screenshot to start, or ask a question…'}
                disabled={busy}
                rows={1}
                style={{
                  flex: 1, background: '#F8FAFD',
                  border: '1.5px solid #DCE4F0', borderRadius: 12,
                  padding: '12px 16px', fontFamily: 'Inter, sans-serif',
                  fontSize: 14, color: '#0B1224', resize: 'none',
                  minHeight: 44, maxHeight: 120, outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  lineHeight: 1.5,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#2563FF'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,255,0.1)'; e.currentTarget.style.background = '#FFFFFF' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#DCE4F0'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#F8FAFD' }}
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={sendFollowUp}
                disabled={busy || !input.trim()}
                aria-label="Send"
                style={{
                  width: 44, height: 44, flexShrink: 0,
                  background: (busy || !input.trim()) ? '#E5EAF3' : '#2563FF',
                  border: 'none', borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: (busy || !input.trim()) ? 'not-allowed' : 'pointer',
                  color: '#FFFFFF',
                  transition: 'background 0.15s',
                }}
              >
                {busy ? <Loader2 size={16} className="aic-spin" /> : <Send size={16} />}
              </motion.button>
            </div>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="aic-sidebar">
          {/* Coach profile */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E5EAF3', borderRadius: 14, padding: 20, textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
              background: 'linear-gradient(135deg,#EAF2FF,#F0EEFF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Brain size={28} style={{ color: '#2563FF' }} />
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: '#0B1224' }}>AI Coach</div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#64748B', marginTop: 4 }}>Powered by Claude AI</div>
            <span style={{
              display: 'inline-block', marginTop: 10,
              background: '#EAF2FF', color: '#2563FF',
              fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 600,
              borderRadius: 999, padding: '3px 12px',
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>BETA</span>
          </div>

          {/* Capabilities */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E5EAF3', borderRadius: 14, padding: 20, marginTop: 16 }}>
            <div style={{
              fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.12em', color: '#64748B',
              marginBottom: 16,
            }}>What I Can Help With</div>
            {CAPABILITIES.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0',
                borderBottom: i < CAPABILITIES.length - 1 ? '1px solid #F8FAFF' : 'none',
              }}>
                <Check size={16} style={{ color: '#16A34A', flexShrink: 0 }} />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#475569' }}>{item}</span>
              </div>
            ))}
          </div>

          {/* Upgrade card */}
          <div style={{
            background: 'linear-gradient(135deg,#EEF4FF,#FFF0F3)', border: '1px solid #DCE5FA',
            borderRadius: 14, padding: 20, marginTop: 16,
          }}>
            <Crown size={24} style={{ color: '#2563FF', marginBottom: 12 }} />
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: '#0B1224' }}>Unlock Full AI Coach</div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#64748B', marginTop: 8, marginBottom: 16, lineHeight: 1.6 }}>
              Get personalized coaching, screenshot analysis, and advanced training plans.
            </p>
            <button style={{
              background: 'linear-gradient(90deg,#2563FF,#EF3340)', color: '#FFFFFF',
              border: 'none', borderRadius: 10, padding: '12px 20px',
              fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14,
              cursor: 'pointer', width: '100%',
              boxShadow: '0 4px 14px rgba(37,99,255,0.2)',
            }}>
              Upgrade to Elite →
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .aic-layout { display: flex; gap: 20px; align-items: flex-start; }
        .aic-main { flex: 1; min-width: 0; }
        .aic-sidebar { width: 280px; flex-shrink: 0; }
        @media (max-width: 960px) {
          .aic-layout { flex-direction: column; align-items: stretch; }
          .aic-sidebar { width: 100%; }
        }
        .aic-spin { animation: aic-spin 0.9s linear infinite; }
        @keyframes aic-spin { to { transform: rotate(360deg); } }
        .aic-dot {
          display: inline-block; width: 8px; height: 8px; border-radius: 50%;
          background: #CBD5E1;
          animation: aic-bounce 1s infinite ease-in-out;
        }
        .aic-dot:nth-child(2) { animation-delay: 0.15s; }
        .aic-dot-3 { animation-delay: 0.3s; }
        @keyframes aic-bounce { 0%,80%,100%{ transform:translateY(0); opacity:0.4; } 40%{ transform:translateY(-4px); opacity:1; } }
      `}</style>
    </div>
  )
}

function StatsCard({ stats }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #E5EAF3' }}>
      {[
        { icon: <Crosshair size={12} />, label: 'Headshots', val: stats.headshots, suffix: '' },
        { icon: <Target size={12} />,    label: 'HS Rate',   val: stats.headshotRate, suffix: '%' },
        { icon: <Percent size={12} />,   label: 'Accuracy',  val: stats.accuracy, suffix: '%' },
      ].map(({ icon, label, val, suffix }, i) => (
        <div key={i} style={{
          flex: 1, minWidth: 78, background: '#F8FAFD', border: '1px solid #E5EAF3',
          borderRadius: 8, padding: '7px 10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B' }}>
            {icon} {label}
          </div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 22, color: '#0B1224', lineHeight: 1.1, marginTop: 2 }}>
            {val == null ? '—' : `${val}${suffix}`}
          </div>
        </div>
      ))}
    </div>
  )
}
