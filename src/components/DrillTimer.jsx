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
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
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

  /* Ring progress is only meaningful once a manual target is entered —
     otherwise the button shows a plain running state instead of a
     progress arc that would imply a target the user never set. */
  const targetSec = Math.max(0, Math.round((Number(targetMinutes) || 0) * 60))
  const ringPct = targetSec > 0 ? Math.min(100, (seconds / targetSec) * 100) : 0

  const stateClass = isLocked
    ? 'is-locked'
    : isEditing
      ? 'is-editing'
      : running
        ? 'is-running'
        : ''

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      className={`dt-row ${stateClass} ${isDragging ? 'is-dragging' : ''}`}
    >
      {/* SINGLE CONTROL ROW — grip | name/desc | controls */}
      <div className="dt-main">
        <button
          {...attributes} {...listeners}
          className="dt-grip"
          title="Drag to reorder drill" aria-label="Drag to reorder drill"
        >
          <GripVertical size={14} />
        </button>

        <div className="dt-head-text">
          <div className="dt-name-row">
            {isLocked  && <Lock   size={13} style={{ color: '#16A34A', flexShrink: 0 }} />}
            {isEditing && <Unlock size={13} style={{ color: '#2563FF', flexShrink: 0 }} />}
            <span className="dt-name">{drill.name}</span>
            {isLocked  && <span className="dt-pill dt-pill--green">Completed</span>}
            {isEditing && <span className="dt-pill dt-pill--blue">Editing</span>}
            {running && !isLocked && !isEditing && (
              <span className="dt-live" aria-label="Timer running">
                <span className="dt-live-dot" />
                Live
              </span>
            )}
          </div>

          {isLocked ? (
            <div className="dt-meta">
              {lockedSession.gunsSelected?.length > 0 && (
                <>
                  <span className="dt-meta-strong">{lockedSession.gunsSelected.join(' + ')}</span>
                  <span className="dt-meta-sep">•</span>
                </>
              )}
              <span className="dt-meta-num">{formatMS(lockedSession.durationSeconds)}</span>
              <span className="dt-meta-sep">•</span>
              <span className="dt-meta-num">{formatHHMM(lockedSession.timestamp)}</span>
            </div>
          ) : isEditing ? (
            <div className="dt-loadout">
              <span className="dt-loadout-label">Loadout</span>
              {editGuns.length === 0 ? (
                <span className="dt-loadout-none">none</span>
              ) : (
                editGuns.map(g => (
                  <button
                    key={g}
                    onClick={() => setEditGuns(prev => prev.filter(x => x !== g))}
                    className="dt-gun-chip"
                    aria-label={`Remove ${g}`}
                  >
                    {g} <X size={10} />
                  </button>
                ))
              )}
            </div>
          ) : (
            drill.description && <div className="dt-desc">{drill.description}</div>
          )}

          {!isLocked && !isEditing && gunsSelected.length > 0 && (
            <div className="dt-loadout">
              <span className="dt-loadout-label">Loadout</span>
              {gunsSelected.map(g => <span key={g} className="dt-gun-tag">{g}</span>)}
            </div>
          )}
        </div>

        {/* ── Control group — one cohesive cluster, no dead space ── */}
        {isLocked ? (
          <div className="dt-controls">
            <span className="dt-check is-checked" aria-hidden>
              <CheckCircle2 size={15} strokeWidth={2.6} />
            </span>
            <motion.button
              onClick={requestEdit}
              className="dt-btn dt-btn--ghost"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15, ease: DT_EASE }}
            >
              <Unlock size={12} /> Edit
            </motion.button>
          </div>
        ) : isEditing ? (
          <div className="dt-controls">
            {/* ONE unit label — the input carries no placeholder */}
            <input
              type="number" min="1" value={targetMinutes}
              onChange={e => setTargetMinutes(e.target.value)}
              className="dt-input"
              aria-label="Duration in minutes"
            />
            <span className="dt-unit">min</span>
            <motion.button
              onClick={saveEdit}
              disabled={!targetMinutes || Number(targetMinutes) <= 0}
              className="dt-btn dt-btn--primary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15, ease: DT_EASE }}
            >
              <Save size={13} /> Save
            </motion.button>
            <motion.button
              onClick={cancelEdit}
              className="dt-btn dt-btn--ghost"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15, ease: DT_EASE }}
            >
              <X size={13} /> Cancel
            </motion.button>
          </div>
        ) : (
          <div className="dt-controls">
            {/* Circular start / pause with progress ring */}
            <TimerButton
              running={running}
              pct={ringPct}
              hasTarget={targetSec > 0}
              onClick={running ? pause : start}
            />

            {/* Live readout */}
            <div className={`dt-time ${running ? 'is-running' : ''}`}>
              {formatTime(seconds)}
            </div>

            {/* Manual minutes override — ONE unit label, no placeholder */}
            <input
              type="number" min="0" value={targetMinutes}
              onChange={e => { setTargetMinutes(e.target.value); setDurationError('') }}
              className={`dt-input ${durationError ? 'has-error' : ''}`}
              title="Manual duration in minutes (overrides timer)"
              aria-label="Duration in minutes"
            />
            <span className="dt-unit">min</span>

            {seconds > 0 && (
              <button onClick={reset} className="dt-reset" title="Reset timer" aria-label="Reset timer">
                <RotateCcw size={14} />
              </button>
            )}

            {/* Completion toggle */}
            <span className="dt-complete-wrap">
              <CompleteButton onClick={complete} />
              {confetti.map(p => (
                <span key={p.id} className="confetti-particle" style={{
                  top: '50%', left: '50%', background: p.color,
                  '--tx': `${p.tx}px`, '--ty': `${p.ty}px`,
                }} />
              ))}
            </span>
          </div>
        )}

        <DrillKebab
          onEdit={() => onEditDrill?.(drill)}
          onDelete={() => onDeleteDrill?.(drill)}
          onDuplicate={() => onDuplicateDrill?.(drill)}
        />
      </div>

      <AnimatePresence>
        {durationError && (
          <motion.div
            className="dt-error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: DT_EASE }}
          >
            <AlertCircle size={13} />
            <span>{durationError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lastLogged && (
          <motion.div
            className="dt-logged"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: DT_EASE }}
          >
            <CheckCircle2 size={14} />
            <span className="dt-logged-num">Logged {lastLogged}</span>
            <span className="dt-logged-sub">— locking drill.</span>
          </motion.div>
        )}
      </AnimatePresence>

      <DrillEditWarningModal
        open={warningOpen}
        drillName={`${moduleName} — ${drill.name}`}
        completedAt={lockedSession?.timestamp}
        onClose={() => setWarningOpen(false)}
        onConfirm={confirmUnlock}
      />

      <style>{drillStyles}</style>
    </div>
  )
}

/* ─── 36px circular start/pause with a progress ring ─────────── */
function TimerButton({ running, pct, hasTarget, onClick }) {
  const size = 40
  const stroke = 3
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (Math.max(0, Math.min(100, pct)) / 100) * circumference

  return (
    <motion.button
      onClick={onClick}
      className={`dt-circle ${running ? 'is-running' : ''}`}
      title={running ? 'Pause timer' : 'Start timer'}
      aria-label={running ? 'Pause timer' : 'Start timer'}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.15, ease: DT_EASE }}
    >
      {/* Progress ring — only drawn when a target exists */}
      {running && hasTarget && (
        <svg className="dt-circle-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={stroke}
          />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="#FFFFFF" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.95s linear' }}
          />
        </svg>
      )}
      <span className="dt-circle-icon">
        {running ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
      </span>
    </motion.button>
  )
}

/* ─── Completion toggle — scale pop + colour flash on press ──── */
function CompleteButton({ onClick }) {
  const reduce = useReducedMotion()
  const [popped, setPopped] = useState(false)

  function handle() {
    if (!reduce) {
      setPopped(true)
      setTimeout(() => setPopped(false), 420)
    }
    onClick?.()
  }

  return (
    <motion.button
      onClick={handle}
      className="dt-check"
      title="Complete drill (use timer or enter minutes above)"
      aria-label="Complete drill"
      animate={popped && !reduce
        ? { transform: ['scale(1)', 'scale(1.22)', 'scale(0.93)', 'scale(1)'] }
        : { transform: 'scale(1)' }}
      transition={{ duration: 0.42, ease: DT_EASE }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.94 }}
    >
      <CheckCircle2 size={16} strokeWidth={2.4} />
    </motion.button>
  )
}

const DT_EASE = [0.22, 1, 0.36, 1]

const drillStyles = `
  .dt-row {
    position: relative;
    background: #FFFFFF; border: 1px solid #E5EAF3;
    border-left: 3px solid #E5EAF3; border-radius: 12px; padding: 14px 18px;
    transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .dt-row:not(.is-locked):hover { border-left-color: #2563FF; background: #F2F7FF; }
  }
  .dt-row.is-locked {
    background: rgba(22,163,74,0.04); border-color: rgba(22,163,74,0.2);
    border-left-color: #16A34A;
  }
  .dt-row.is-editing {
    background: #FFFFFF; border-color: rgba(37,99,255,0.35);
    border-left-color: #2563FF; box-shadow: 0 0 0 3px rgba(37,99,255,0.07);
  }
  .dt-row.is-running {
    background: #FFFFFF; border-color: rgba(37,99,255,0.3);
    border-left-color: #2563FF; box-shadow: 0 4px 18px rgba(37,99,255,0.1);
  }
  .dt-row.is-dragging { box-shadow: 0 14px 40px rgba(15,23,42,0.14); z-index: 10; }

  /* ── Single control row ──
     The name block is the only flex-grow element; every control sits in
     one tight cluster so there is no dead space mid-row. */
  .dt-main { display: flex; align-items: center; gap: 12px; }
  .dt-grip {
    padding: 4px; border-radius: 7px; flex-shrink: 0;
    background: transparent; border: none; color: #94A3B8;
    cursor: grab; touch-action: none; display: flex;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .dt-grip:active { cursor: grabbing; }
  @media (hover: hover) and (pointer: fine) {
    .dt-grip:hover { color: #475569; background: #EEF4FF; }
  }
  .dt-head-text { flex: 1; min-width: 0; }
  .dt-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .dt-name {
    font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; color: #0B1224;
  }
  .dt-pill {
    border-radius: 999px; padding: 2px 9px; flex-shrink: 0;
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 9.5px;
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .dt-pill--green { background: rgba(22,163,74,0.1); border: 1px solid rgba(22,163,74,0.3); color: #16A34A; }
  .dt-pill--blue  { background: #EAF2FF; border: 1px solid rgba(37,99,255,0.25); color: #2563FF; }

  .dt-live {
    display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 9.5px;
    text-transform: uppercase; letter-spacing: 0.12em; color: #2563FF;
  }
  .dt-live-dot {
    width: 6px; height: 6px; border-radius: 50%; background: #2563FF; display: inline-block;
    animation: dtLivePulse 1.4s cubic-bezier(0.22,1,0.36,1) infinite;
  }
  @keyframes dtLivePulse {
    0%, 100% { opacity: 0.35; transform: scale(0.8); }
    50%      { opacity: 1;    transform: scale(1.15); }
  }

  .dt-meta {
    margin-top: 5px; display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-family: 'Inter', sans-serif; font-size: 12px; color: #64748B;
  }
  .dt-meta-strong { font-weight: 600; color: #2563FF; }
  .dt-meta-num { font-variant-numeric: tabular-nums; }
  .dt-meta-sep { color: #CBD5E1; }
  .dt-desc {
    margin-top: 3px; font-family: 'Inter', sans-serif; font-size: 12.5px;
    color: #64748B; line-height: 1.45;
  }

  .dt-loadout { margin-top: 7px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .dt-loadout-label {
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 9.5px;
    text-transform: uppercase; letter-spacing: 0.12em; color: #94A3B8;
  }
  .dt-loadout-none { font-family: 'Inter', sans-serif; font-size: 11.5px; color: #94A3B8; font-style: italic; }
  .dt-gun-chip {
    background: #EAF2FF; border: 1px solid rgba(37,99,255,0.25); color: #2563FF;
    border-radius: 999px; padding: 2px 8px; cursor: pointer;
    font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600;
    display: inline-flex; align-items: center; gap: 4px;
    transition: background 0.15s ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .dt-gun-chip:hover { background: #FFF0F2; border-color: rgba(239,51,64,0.3); color: #EF3340; }
  }
  .dt-gun-tag {
    background: #FFFFFF; border: 1px solid #E5EAF3; color: #475569;
    border-radius: 999px; padding: 2px 9px;
    font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 500;
  }

  /* ── Controls cluster ── */
  .dt-controls {
    display: flex; align-items: center; gap: 12px; flex-shrink: 0;
  }

  .dt-circle {
    position: relative; width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
    border: none; cursor: pointer; padding: 0;
    background: #2563FF; color: #FFFFFF;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 3px 12px rgba(37,99,255,0.3);
    transition: background 0.18s ease, box-shadow 0.18s ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .dt-circle:not(.is-running):hover { background: #1677FF; box-shadow: 0 5px 16px rgba(37,99,255,0.38); }
  }
  .dt-circle.is-running {
    background: linear-gradient(135deg, #F59E0B, #EF3340);
    box-shadow: 0 3px 12px rgba(239,51,64,0.28);
    animation: dtRingPulse 2s cubic-bezier(0.22,1,0.36,1) infinite;
  }
  @keyframes dtRingPulse {
    0%, 100% { box-shadow: 0 3px 12px rgba(239,51,64,0.28), 0 0 0 0 rgba(239,51,64,0.25); }
    50%      { box-shadow: 0 3px 12px rgba(239,51,64,0.28), 0 0 0 8px rgba(239,51,64,0); }
  }
  .dt-circle-ring { position: absolute; inset: 0; pointer-events: none; }
  .dt-circle-icon { position: relative; display: flex; }

  .dt-time {
    min-width: 76px; text-align: center; flex-shrink: 0;
    background: #F8FAFD; border: 1px solid #E5EAF3; border-radius: 9px;
    padding: 7px 10px;
    font-family: 'Inter', sans-serif; font-weight: 800; font-size: 16px;
    font-variant-numeric: tabular-nums; color: #0B1224;
    transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
  }
  .dt-time.is-running { border-color: rgba(239,51,64,0.3); color: #EF3340; background: #FFF7ED; }

  /* Compact duration field. Spinners are hidden so 56px is fully usable. */
  .dt-input {
    width: 56px; box-sizing: border-box; text-align: center; flex-shrink: 0;
    background: #F8FAFF; border: 1px solid #DCE4F0; border-radius: 9px;
    padding: 8px 6px;
    font-family: 'Inter', sans-serif; font-size: 13px; font-variant-numeric: tabular-nums;
    color: #0B1224; outline: none;
    transition: border-color 0.15s ease, background 0.15s ease;
    -moz-appearance: textfield;
  }
  .dt-input::-webkit-outer-spin-button,
  .dt-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .dt-input:focus { border-color: #2563FF; background: #FFFFFF; }
  .dt-input.has-error { border-color: #EF3340; }
  @media (hover: hover) and (pointer: fine) {
    .dt-input:hover:not(:focus) { border-color: #C7D7FB; }
  }
  /* The single unit label — sits immediately after the field, no duplicate
     placeholder inside the input. */
  .dt-unit {
    font-family: 'Inter', sans-serif; font-weight: 400; font-size: 12px;
    color: #94A3B8; flex-shrink: 0; margin-left: -6px;
  }

  .dt-complete-wrap { position: relative; display: inline-flex; flex-shrink: 0; }
  .dt-check {
    width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; padding: 0;
    background: #FFFFFF; border: 1.5px solid #E5EAF3;
    color: #94A3B8; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
  }
  .dt-check.is-checked {
    background: #16A34A; border-color: #16A34A; color: #FFFFFF; cursor: default;
  }
  @media (hover: hover) and (pointer: fine) {
    .dt-check:not(.is-checked):hover { background: #16A34A; border-color: #16A34A; color: #FFFFFF; }
  }

  .dt-reset {
    width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
    background: transparent; border: 1px solid #E5EAF3; color: #64748B; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .dt-reset:hover { color: #0B1224; border-color: #C7D7FB; background: #F8FAFF; }
  }

  .dt-btn {
    border-radius: 10px; padding: 8px 14px; cursor: pointer;
    font-family: 'Inter', sans-serif; font-weight: 600; font-size: 12px;
    display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
  }
  .dt-btn--primary {
    background: linear-gradient(135deg, #2563FF, #5B3DF5); border: none; color: #FFFFFF;
    box-shadow: 0 3px 10px rgba(37,99,255,0.25);
  }
  .dt-btn--primary:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
  .dt-btn--ghost { background: #FFFFFF; border: 1px solid #E5EAF3; color: #475569; }
  @media (hover: hover) and (pointer: fine) {
    .dt-btn--ghost:hover { border-color: #2563FF; color: #2563FF; }
  }

  /* ── Feedback ── */
  .dt-error {
    margin-top: 9px; display: flex; align-items: center; gap: 7px;
    font-family: 'Inter', sans-serif; font-size: 12px; color: #EF3340;
  }
  .dt-logged {
    margin-top: 11px; padding: 8px 12px; border-radius: 10px;
    background: rgba(22,163,74,0.08); border: 1px solid rgba(22,163,74,0.25);
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-family: 'Inter', sans-serif; font-size: 12px; color: #16A34A;
  }
  .dt-logged-num { font-weight: 600; font-variant-numeric: tabular-nums; }
  .dt-logged-sub { color: #64748B; }

  @media (prefers-reduced-motion: reduce) {
    .dt-live-dot, .dt-circle.is-running { animation: none; }
  }

  /* Below this width the single row can't hold name + controls, so the
     control cluster drops to its own line and spans the full width while
     staying one tight group. */
  @media (max-width: 720px) {
    .dt-main { flex-wrap: wrap; row-gap: 12px; }
    .dt-head-text { flex-basis: 100%; order: 1; }
    .dt-grip { order: 0; }
    .dt-controls { order: 2; flex: 1; gap: 10px; }
  }
  @media (max-width: 420px) {
    .dt-time { min-width: 68px; font-size: 15px; }
    .dt-controls { gap: 8px; flex-wrap: wrap; }
  }
`

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
    <div className="dt-kebab-wrap" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className={`dt-kebab ${open ? 'is-open' : ''}`}
        title="Drill options"
        aria-label="Drill options"
        aria-expanded={open}
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className="dt-kebab-menu">
          <KebabItem icon={Pencil} label="Edit drill name"  onClick={wrap(onEdit)} />
          <KebabItem icon={Copy}   label="Duplicate drill"  onClick={wrap(onDuplicate)} />
          <div className="dt-kebab-sep" />
          <KebabItem icon={Trash2} label="Delete drill"     onClick={wrap(onDelete)} destructive />
        </div>
      )}

      <style>{`
        .dt-kebab-wrap { position: relative; flex-shrink: 0; }
        .dt-kebab {
          padding: 6px; border-radius: 8px; background: transparent; border: none;
          color: #94A3B8; cursor: pointer; display: flex;
          transition: color 0.15s ease, background 0.15s ease;
        }
        .dt-kebab.is-open { background: #EAF2FF; color: #2563FF; }
        @media (hover: hover) and (pointer: fine) {
          .dt-kebab:hover { color: #475569; background: #F1F5F9; }
        }
        .dt-kebab-menu {
          position: absolute; right: 0; top: 100%; margin-top: 6px; width: 192px;
          background: #FFFFFF; border: 1px solid #E5EAF3; border-radius: 12px;
          overflow: hidden; z-index: 30;
          box-shadow: 0 12px 32px rgba(15,23,42,0.12);
        }
        .dt-kebab-sep { height: 1px; background: #E5EAF3; }
        .dt-kebab-item {
          width: 100%; display: flex; align-items: center; gap: 11px;
          padding: 10px 14px; background: transparent; border: none; cursor: pointer;
          font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500;
          color: #0B1224; text-align: left;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .dt-kebab-item--danger { color: #EF3340; }
        @media (hover: hover) and (pointer: fine) {
          .dt-kebab-item:hover { background: #F8FAFF; }
          .dt-kebab-item--danger:hover { background: #FFF0F2; }
        }
      `}</style>
    </div>
  )
}

function KebabItem({ icon: Icon, label, onClick, destructive }) {
  return (
    <button
      onClick={onClick}
      className={`dt-kebab-item ${destructive ? 'dt-kebab-item--danger' : ''}`}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  )
}
