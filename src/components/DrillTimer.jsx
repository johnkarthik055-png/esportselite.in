/**
 * DrillTimer.jsx
 *
 * Complete drill-row component with:
 *  • Fixed manual-minutes logic   — manual input ALWAYS overrides the timer
 *  • Validation                   — blocks save if durationSeconds === 0
 *  • Firestore dual-write         — addSession() persists to the cloud
 *  • Streak tracking              — updates Firestore streak on every drill complete
 *  • Same-tab sync fix            — dispatches 'esports-elite:auth-uid-changed'
 *    so every useLocalStorage(SESSIONS) instance re-reads immediately.
 *
 * Props are identical to the old DrillRow so ModuleCard needs no changes.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Play,
  Pause,
  CheckCircle2,
  RotateCcw,
  Lock,
  Unlock,
  Save,
  X,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  GripVertical,
  AlertCircle,
} from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { STORAGE_KEYS } from '../utils/constants.js'
import {
  formatTime,
  formatHHMM,
  formatMS,
  uid,
  dateKey,
  todayKey,
  normalizeSessions,
} from '../utils/helpers.js'
import { isTrialExpired } from '../utils/trial.js'
import { useAuth } from '../context/AuthContext.jsx'
import { addSession, getProfile, saveStreak } from '../utils/db.js'
import { useUserData } from '../hooks/useUserData.js'
import DrillEditWarningModal from './DrillEditWarningModal.jsx'

/* Same event string as AUTH_EVENT in useLocalStorage.js — triggers
   all useLocalStorage instances to re-read from the current UID key.
   This is the cross-component same-tab sync fix for SessionBanner. */
const AUTH_EVENT = 'esports-elite:auth-uid-changed'

const CONFETTI_COLORS = ['#E8001C', '#FF2D44', '#FFD700', '#F0F0F0']

export default function DrillTimer({
  drill,
  moduleId,
  moduleName,
  gunsSelected = [],
  isCustom = false,
  onEditDrill,
  onDeleteDrill,
  onDuplicateDrill,
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: drill.id })

  const sortableStyle = { transform: CSS.Transform.toString(transform), transition }

  const [sessionsRaw, setSessions] = useLocalStorage(STORAGE_KEYS.SESSIONS, [])
  const { user: authUser } = useAuth()
  const trialExpired = isTrialExpired(authUser?.uid)
  const { updateXP } = useUserData()

  /* Today's most-recent session for this exact drill. */
  const lockedSession = useMemo(() => {
    const today = todayKey()
    const normalized = normalizeSessions(sessionsRaw)
    return (
      normalized
        .filter(s => s.drillId === drill.id && dateKey(s.timestamp) === today)
        .sort((a, b) => b.timestamp - a.timestamp)[0] || null
    )
  }, [sessionsRaw, drill.id])

  const [seconds, setSeconds]             = useState(0)
  const [running, setRunning]             = useState(false)
  const [targetMinutes, setTargetMinutes] = useState('')
  const [lastLogged, setLastLogged]       = useState(null)
  const [durationError, setDurationError] = useState('')
  const intervalRef = useRef(null)

  const [editing, setEditing]       = useState(false)
  const [warningOpen, setWarningOpen] = useState(false)
  const [editGuns, setEditGuns]     = useState([])
  const [confetti, setConfetti]     = useState([])

  /* Timer interval lifecycle */
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  /* Prefill edit mode from saved session */
  useEffect(() => {
    if (editing && lockedSession) {
      setTargetMinutes(String(Math.round(lockedSession.durationSeconds / 60)))
      setEditGuns(lockedSession.gunsSelected || [])
      setSeconds(0)
      setRunning(false)
    }
  }, [editing, lockedSession])

  /* ───────────────────────────────────────────────────────────
     STREAK UPDATE — fire-and-forget after every drill complete.
     Reads current streak from Firestore, calculates new value,
     then merges the updated streak back.
     ─────────────────────────────────────────────────────────── */
  async function updateStreak() {
    const uid = authUser?.uid
    if (!uid) return
    try {
      const today       = new Date().toISOString().split('T')[0]
      const profile     = await getProfile(uid)
      const currentStreak = profile?.streak || { count: 0, lastActiveDate: null }
      const last        = currentStreak.lastActiveDate

      const yesterday   = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      let newCount = currentStreak.count
      if (last === today) {
        /* Already logged today — no change */
        newCount = currentStreak.count
      } else if (last === yesterdayStr) {
        /* Consecutive day — increment */
        newCount = currentStreak.count + 1
      } else {
        /* Missed a day or first ever drill — reset to 1 */
        newCount = 1
      }

      const newStreak = { count: newCount, lastActiveDate: today }
      await saveStreak(uid, newStreak)
      console.log('[DrillTimer] Streak updated:', newStreak)
    } catch (err) {
      console.warn('[DrillTimer] Streak update error (non-fatal):', err)
    }
  }

  function start() { setLastLogged(null); setDurationError(''); setRunning(true) }
  function pause() { setRunning(false) }
  function reset() { setRunning(false); setSeconds(0); setLastLogged(null); setDurationError('') }

  /* ===== COMPLETE ===== */
  function complete() {
    setRunning(false)
    if (trialExpired) return

    /*
     * Duration resolution — manual ALWAYS wins over the live timer.
     *   manualMinutes entered  → use manualMinutes × 60
     *   only timer ran         → use elapsed seconds
     *   neither                → validation error
     */
    const manualSec =
      targetMinutes && Number(targetMinutes) > 0
        ? Math.floor(Number(targetMinutes) * 60)
        : 0

    const durationSeconds = manualSec > 0 ? manualSec : seconds

    if (!durationSeconds || isNaN(durationSeconds) || durationSeconds <= 0) {
      setDurationError('Enter a duration (timer or minutes) before completing.')
      return
    }
    setDurationError('')

    const session = {
      id: uid(),
      drillId: drill.id,
      drillName: drill.name,
      moduleId,
      module: moduleName,
      gunsSelected: Array.isArray(gunsSelected) ? [...gunsSelected] : [],
      durationSeconds,
      timestamp: Date.now(),
      isCustom: !!isCustom,
    }

    /* 1. Write to localStorage → immediate UI update */
    setSessions(prev => [...prev, session])

    /* 2. Write to Firestore → cloud persistence (async, non-blocking) */
    addSession(session).catch(() => { /* localStorage is the fallback */ })

    /* 3. Dispatch AUTH_EVENT → every useLocalStorage(SESSIONS) re-reads,
          fixing SessionBanner not appearing without a page reload. */
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTH_EVENT))
    }

    /* 4. UI feedback */
    setLastLogged(formatTime(durationSeconds))
    setSeconds(0)
    setTargetMinutes('')
    setTimeout(() => setLastLogged(null), 3500)

    /* 5. Confetti */
    const stamp = Date.now()
    const particles = Array.from({ length: 12 }, (_, i) => ({
      id: `${stamp}-${i}`,
      tx: (Math.random() * 2 - 1) * 60,
      ty: -Math.random() * 80 - 10,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    }))
    setConfetti(particles)
    setTimeout(() => setConfetti([]), 700)

    /* 6. XP — saved to both localStorage (toast) AND Firestore */
    updateXP(25)

    /* 7. Streak — async, fire-and-forget */
    updateStreak()
  }

  function requestEdit()  { setWarningOpen(true) }
  function confirmUnlock() { setWarningOpen(false); setEditing(true) }
  function cancelEdit() {
    setEditing(false); setSeconds(0); setTargetMinutes(''); setRunning(false)
  }
  function saveEdit() {
    if (!lockedSession) return
    const overrideSec =
      targetMinutes && Number(targetMinutes) > 0
        ? Math.floor(Number(targetMinutes) * 60)
        : lockedSession.durationSeconds
    if (overrideSec <= 0) return
    setSessions(prev =>
      prev.map(s =>
        s.id === lockedSession.id
          ? { ...s, durationSeconds: overrideSec, gunsSelected: editGuns }
          : s
      )
    )
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_EVENT))
    setEditing(false); setSeconds(0); setTargetMinutes('')
  }

  /* ───── RENDER ──────────────────────────────────────────────── */
  const isLocked  = !!lockedSession && !editing
  const isEditing = !!lockedSession && editing

  const containerClass = isLocked
    ? 'rounded-md p-3 transition-all bg-[rgba(0,230,118,0.04)] border border-[rgba(0,230,118,0.25)] border-l-[3px] border-l-[#00E676] hover:bg-[rgba(0,230,118,0.07)]'
    : isEditing
    ? 'rounded-md p-3 bg-bg-elevated/40 border border-[rgba(232,0,28,0.4)] shadow-red-glow'
    : running
    ? 'rounded-md p-3 bg-bg-elevated/40 border drill-active-pulse'
    : 'rounded-md p-3 bg-bg-elevated/40 border border-border hover:border-[rgba(232,0,28,0.4)] transition-all'

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      className={`relative ${containerClass} ${isDragging ? 'scale-[1.02] shadow-red-glow-lg z-10' : ''}`}
    >
      {/* HEADER ROW */}
      <div className="flex items-start justify-between gap-3">
        <button
          {...attributes} {...listeners}
          className="mt-0.5 p-1 rounded text-text-muted hover:text-accent-secondary hover:bg-white/5 transition-all cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          title="Drag to reorder drill" aria-label="Drag to reorder drill"
        >
          <GripVertical size={14} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="heading text-white text-sm tracking-wide flex items-center gap-2 flex-wrap">
            {isLocked  && <Lock   size={14} className="text-success flex-shrink-0" />}
            {isEditing && <Unlock size={14} className="text-accent-secondary flex-shrink-0" />}
            <span>{drill.name}</span>
            {isLocked  && <span className="pill text-[10px] tracking-widest bg-success/15 border-success/40 text-success">COMPLETED</span>}
            {isEditing && <span className="pill pill-red text-[10px] tracking-widest">EDITING</span>}
            {running && !isLocked && !isEditing && (
              <span aria-label="Timer running" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                color: '#22D3EE', textTransform: 'uppercase', flexShrink: 0,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#22D3EE',
                  animation: 'drillLivePulse 1.2s ease-in-out infinite',
                  display: 'inline-block',
                }} />
                LIVE
                <style>{`@keyframes drillLivePulse { 0%,100%{opacity:0.4;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }`}</style>
              </span>
            )}
          </div>

          {isLocked ? (
            <div className="mt-1 text-xs text-text-secondary flex items-center gap-2 flex-wrap">
              {lockedSession.gunsSelected?.length > 0 && (
                <>
                  <span className="mono text-accent-secondary">{lockedSession.gunsSelected.join(' + ')}</span>
                  <span className="text-text-muted">•</span>
                </>
              )}
              <span className="mono">{formatMS(lockedSession.durationSeconds)}</span>
              <span className="text-text-muted">•</span>
              <span className="mono">{formatHHMM(lockedSession.timestamp)}</span>
            </div>
          ) : isEditing ? (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-text-muted heading">Loadout:</span>
              {editGuns.length === 0 ? (
                <span className="text-[11px] text-text-muted italic">none</span>
              ) : (
                editGuns.map(g => (
                  <button key={g} onClick={() => setEditGuns(prev => prev.filter(x => x !== g))}
                    className="pill pill-red mono text-[11px] flex items-center gap-1 hover:bg-[rgba(232,0,28,0.2)] transition-all">
                    {g} <X size={10} />
                  </button>
                ))
              )}
            </div>
          ) : (
            drill.description && <div className="text-xs text-text-secondary mt-0.5">{drill.description}</div>
          )}

          {!isLocked && !isEditing && gunsSelected.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-text-muted heading">Loadout:</span>
              {gunsSelected.map(g => <span key={g} className="text-[11px] mono text-accent-secondary">{g}</span>)}
            </div>
          )}
        </div>

        <DrillKebab
          onEdit={() => onEditDrill?.(drill)}
          onDelete={() => onDeleteDrill?.(drill)}
          onDuplicate={() => onDuplicateDrill?.(drill)}
        />
      </div>

      {/* DIVIDER */}
      <div className="h-px bg-border my-3" />

      {/* TIMER / ACTION ROW */}
      {isLocked ? (
        <div className="flex items-center justify-end">
          <button onClick={requestEdit}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-border bg-bg-elevated/60 text-text-secondary hover:text-white hover:border-accent-primary heading text-xs uppercase tracking-widest transition-all">
            <Unlock size={12} /> Edit
          </button>
        </div>
      ) : isEditing ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-text-muted heading">Duration</span>
          <input type="number" min="1" value={targetMinutes}
            onChange={e => setTargetMinutes(e.target.value)}
            className="input-field w-24 text-sm py-2 text-center" placeholder="min" />
          <span className="text-xs text-text-secondary">min</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={saveEdit} disabled={!targetMinutes || Number(targetMinutes) <= 0}
              className="btn-red px-3.5 py-2 rounded-md text-xs uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
              <Save size={13} /> Save Changes
            </button>
            <button onClick={cancelEdit}
              className="px-3.5 py-2 rounded-md text-xs uppercase tracking-widest text-text-secondary hover:text-white border border-border hover:border-text-secondary transition-all heading font-semibold flex items-center gap-1.5">
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Live timer display */}
          <div
            className={`mono text-xl px-3.5 py-1.5 rounded-md border ${
              running
                ? 'border-accent-primary text-accent-secondary bg-[rgba(232,0,28,0.08)] animate-pulse-red'
                : 'border-border text-text-primary bg-bg-primary/60'
            }`}
            style={{ minWidth: 100, textAlign: 'center' }}
          >
            {formatTime(seconds)}
          </div>

          {!running ? (
            <button onClick={start} className="btn-red px-3.5 py-2 rounded-md text-xs uppercase tracking-widest flex items-center gap-1.5">
              <Play size={14} fill="currentColor" /> Start
            </button>
          ) : (
            <button onClick={pause} className="px-3.5 py-2 rounded-md text-xs uppercase tracking-widest flex items-center gap-1.5 bg-warning/20 border border-warning/50 text-warning heading font-semibold hover:bg-warning/30 transition-all">
              <Pause size={14} fill="currentColor" /> Pause
            </button>
          )}

          {/* Manual minutes override */}
          <div className="flex items-center gap-1">
            <input
              type="number" min="0" placeholder="min" value={targetMinutes}
              onChange={e => { setTargetMinutes(e.target.value); setDurationError('') }}
              className={`input-field w-20 text-sm py-2 text-center ${durationError ? 'border-accent-secondary' : ''}`}
              title="Manual duration in minutes (overrides timer)"
            />
            <span className="text-[10px] text-text-muted">min</span>
          </div>

          {/* Complete */}
          <span className="ml-auto relative inline-flex">
            <button
              onClick={complete}
              disabled={trialExpired}
              title={trialExpired ? 'Free trial ended — premium plan coming soon' : 'Complete drill (use timer or enter minutes above)'}
              className="px-3.5 py-2 rounded-md text-xs uppercase tracking-widest flex items-center gap-1.5 bg-success/15 border border-success/40 text-success heading font-semibold hover:bg-success/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={14} /> Complete
            </button>
            {confetti.map(p => (
              <span key={p.id} className="confetti-particle" style={{
                top: '50%', left: '50%', background: p.color,
                '--tx': `${p.tx}px`, '--ty': `${p.ty}px`,
              }} />
            ))}
          </span>

          {seconds > 0 && (
            <button onClick={reset} className="px-2.5 py-2 rounded-md text-text-secondary hover:text-white hover:bg-white/5 transition-all" title="Reset timer">
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      )}

      {durationError && (
        <div className="mt-2 flex items-center gap-2 text-xs text-accent-secondary animate-fade-in">
          <AlertCircle size={13} />
          <span>{durationError}</span>
        </div>
      )}

      {lastLogged && (
        <div className="mt-3 toast-success rounded-md px-3 py-2 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={14} />
          <span className="mono">Logged {lastLogged}</span>
          <span className="text-text-secondary">— locking drill.</span>
        </div>
      )}

      <DrillEditWarningModal
        open={warningOpen}
        drillName={`${moduleName} — ${drill.name}`}
        completedAt={lockedSession?.timestamp}
        onClose={() => setWarningOpen(false)}
        onConfirm={confirmUnlock}
      />
    </div>
  )
}

/* ─── Kebab menu ─────────────────────────────────────────────── */
function DrillKebab({ onEdit, onDelete, onDuplicate }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    function onKey(e)   { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])

  function wrap(fn) { return (e) => { e.stopPropagation(); setOpen(false); fn?.() } }

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className={`p-1.5 rounded-md transition-all ${open ? 'bg-[rgba(232,0,28,0.12)] text-accent-secondary' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
        title="Drill options"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 glass-strong rounded-md overflow-hidden shadow-2xl z-30 dropdown-in">
          <KebabItem icon={Pencil} label="Edit drill name"  onClick={wrap(onEdit)} />
          <KebabItem icon={Copy}   label="Duplicate drill"  onClick={wrap(onDuplicate)} />
          <div className="h-px bg-border" />
          <KebabItem icon={Trash2} label="Delete drill"     onClick={wrap(onDelete)} destructive />
        </div>
      )}
    </div>
  )
}

function KebabItem({ icon: Icon, label, onClick, destructive }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm transition-all ${
        destructive ? 'text-accent-secondary hover:bg-[rgba(232,0,28,0.08)]' : 'text-text-primary hover:bg-white/5'
      }`}
    >
      <Icon size={14} />
      <span className="heading text-xs tracking-wider uppercase">{label}</span>
    </button>
  )
}
