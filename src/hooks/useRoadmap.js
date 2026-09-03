import { useCallback, useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../utils/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { readLS, writeLS } from './useLocalStorage.js'
import { ROADMAP_STAGES, countQuestions } from '../data/roadmapStages.js'

/*
 * useRoadmap — progress state for the Career Roadmap.
 *
 * Storage: users/{uid}/data/roadmap  (mirrored to a UID-scoped
 * localStorage key for instant paint, same dual-write pattern as
 * utils/db.js). The existing security rule
 *   match /users/{userId}/{document=**} { allow read, write: if isOwner }
 * already covers this path — no rules change needed.
 *
 * Shape of the stored doc:
 *   {
 *     stages: {
 *       [stageId]: {
 *         status: 'in_progress' | 'completed',
 *         phase:  'content' | 'assessment' | 'result' | 'next',
 *         notes:  string,
 *         assessment: { score, correct, total, answers, at },
 *         startedAt, completedAt
 *       }
 *     },
 *     updatedAt
 *   }
 *
 * Derived per-stage `state` for the UI:
 *   'locked'      previous stage not completed
 *   'available'   unlocked, not started
 *   'in_progress' started, not finished
 *   'completed'   done (XP already awarded)
 *
 * XP: this hook does NOT award XP itself. The stage flow calls
 * completeStage(); if it returns true (newly completed) the page
 * awards stage.xpReward through useUserData().updateXP so the roadmap
 * feeds the ONE existing XP/level system (Firestore users/{uid}.xp).
 */

const LS_KEY = 'esportselite_roadmap'
export const ROADMAP_PHASES = ['content', 'assessment', 'result', 'next']

function emptyProgress() {
  return { stages: {} }
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object') return emptyProgress()
  return { stages: raw.stages && typeof raw.stages === 'object' ? raw.stages : {} }
}

export function useRoadmap() {
  const { user } = useAuth()
  const uid = user?.uid

  const [progress, setProgress] = useState(() => normalize(readLS(LS_KEY, null)))
  const [loading, setLoading] = useState(true)

  /* ── Load from Firestore (localStorage already painted) ── */
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!uid) { setLoading(false); return }
      const local = readLS(LS_KEY, null)
      if (local) setProgress(normalize(local))
      try {
        const snap = await getDoc(doc(db, 'users', uid, 'data', 'roadmap'))
        if (cancelled) return
        if (snap.exists()) {
          const next = normalize(snap.data())
          setProgress(next)
          writeLS(LS_KEY, next)
        }
      } catch {
        /* offline / permission — keep whatever localStorage had */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [uid])

  /* ── Dual-write helper ── */
  const persist = useCallback((updater) => {
    setProgress(prev => {
      const next = normalize(typeof updater === 'function' ? updater(prev) : updater)
      writeLS(LS_KEY, next)
      if (uid) {
        setDoc(
          doc(db, 'users', uid, 'data', 'roadmap'),
          { stages: next.stages, updatedAt: serverTimestamp() },
          { merge: true },
        ).catch(() => { /* localStorage already has it */ })
      }
      return next
    })
  }, [uid])

  const patchStage = useCallback((id, patch) => {
    persist(prev => ({
      stages: {
        ...prev.stages,
        [id]: { ...(prev.stages[id] || {}), ...patch },
      },
    }))
  }, [persist])

  /* ── Derived stage list ── */
  const stages = ROADMAP_STAGES.map((s, i) => {
    const rec = progress.stages[s.id] || {}
    const prev = i === 0 ? null : ROADMAP_STAGES[i - 1]
    const prevDone = !prev || progress.stages[prev.id]?.status === 'completed'

    let state
    if (rec.status === 'completed') state = 'completed'
    else if (!prevDone) state = 'locked'
    else if (rec.status === 'in_progress') state = 'in_progress'
    else state = 'available'

    return {
      ...s,
      index: i,
      questionCount: countQuestions(s),
      state,
      phase: rec.phase || 'content',
      notes: rec.notes || '',
      result: rec.assessment || null,
      startedAt: rec.startedAt || null,
      completedAt: rec.completedAt || null,
    }
  })

  const getStage = useCallback(
    (id) => stages.find(s => s.id === id) || null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress],
  )

  const completedCount = stages.filter(s => s.state === 'completed').length
  const xpEarned = stages
    .filter(s => s.state === 'completed')
    .reduce((sum, s) => sum + s.xpReward, 0)
  const nextStage =
    stages.find(s => s.state === 'available' || s.state === 'in_progress') || null

  /* ── Actions ── */

  /** Mark a stage started (no-op if already started/completed). */
  const startStage = useCallback((id) => {
    setProgress(prev => {
      const rec = prev.stages[id] || {}
      if (rec.status === 'completed' || rec.status === 'in_progress') return prev
      const next = normalize({
        stages: {
          ...prev.stages,
          [id]: { ...rec, status: 'in_progress', phase: rec.phase || 'content', startedAt: Date.now() },
        },
      })
      writeLS(LS_KEY, next)
      if (uid) {
        setDoc(
          doc(db, 'users', uid, 'data', 'roadmap'),
          { stages: next.stages, updatedAt: serverTimestamp() },
          { merge: true },
        ).catch(() => {})
      }
      return next
    })
  }, [uid])

  /** Move a stage to a given phase. Completed stages stay 'completed'. */
  const goToPhase = useCallback((id, phase) => {
    persist(prev => {
      const rec = prev.stages[id] || {}
      return {
        stages: {
          ...prev.stages,
          [id]: {
            ...rec,
            status: rec.status === 'completed' ? 'completed' : 'in_progress',
            phase,
          },
        },
      }
    })
  }, [persist])

  const saveNotes = useCallback((id, notes) => {
    patchStage(id, { notes })
  }, [patchStage])

  /** Record an assessment attempt and advance to the result phase. */
  const saveAssessment = useCallback((id, { correct, total, answers }) => {
    const score = total > 0 ? correct / total : 0
    persist(prev => {
      const rec = prev.stages[id] || {}
      return {
        stages: {
          ...prev.stages,
          [id]: {
            ...rec,
            status: rec.status === 'completed' ? 'completed' : 'in_progress',
            phase: 'result',
            assessment: { score, correct, total, answers, at: Date.now() },
          },
        },
      }
    })
    return score
  }, [persist])

  /**
   * Finalise a stage. Returns true only the FIRST time it completes,
   * so the caller can award XP exactly once.
   */
  const completeStage = useCallback((id) => {
    const already = progress.stages[id]?.status === 'completed'
    persist(prev => {
      const rec = prev.stages[id] || {}
      if (rec.status === 'completed') return prev
      return {
        stages: {
          ...prev.stages,
          [id]: { ...rec, status: 'completed', phase: 'next', completedAt: Date.now() },
        },
      }
    })
    return !already
  }, [progress, persist])

  return {
    loading,
    stages,
    getStage,
    totalStages: ROADMAP_STAGES.length,
    completedCount,
    xpEarned,
    nextStage,
    /* actions */
    startStage,
    goToPhase,
    saveNotes,
    saveAssessment,
    completeStage,
  }
}
