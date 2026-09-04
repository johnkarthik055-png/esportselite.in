import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  doc, collection, getDocs, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../utils/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { readLS, writeLS } from './useLocalStorage.js'
import {
  ROADMAP_STAGES, getStageConfig, countReadyQuestions, readySections,
} from '../data/roadmapStages.js'
import { scoreStage } from '../utils/roadmapScoring.js'

/*
 * useRoadmap — per-user progress for "THE ROAD TO ESPORTS".
 *
 * Storage
 * -------
 *   users/{uid}/roadmapProgress/{stageId}   one doc per stage
 *   users/{uid}/roadmapProgress/_meta       { startedAt }  (cosmetic day counter)
 *
 * Mirrored to a UID-scoped localStorage blob (esportselite_roadmap_v2) for
 * instant paint, same dual-write idea as the rest of the app. The existing
 * rule  match /users/{userId}/{document=**} { allow read, write: if isOwner }
 * already covers this path — no firestore.rules change needed.
 *
 * Per-stage doc shape:
 *   {
 *     status:         'in_progress' | 'completed'
 *     phase:          'content' | 'assessment' | 'result' | 'improve' | 'next'
 *     activeSectionId: string
 *     sectionsViewed: { [sectionId]: true }
 *     answers:        { [sectionId]: { [questionId]: optionIndex } }
 *     notes:          { [sectionId]: string }
 *     result:         <scoreStage() output>            (latest)
 *     attempts:       [{ at, overall, level, sections:[{id,score,level}] }]
 *     startedAt, completedAt, xpAwarded
 *   }
 *
 * Unlocking is PROGRESS-BASED only: stage N unlocks when stage N-1's status
 * is 'completed' (which happens when its Next Step phase is reached). There
 * is no calendar/day gate anywhere — `dayCount` below is display-only.
 *
 * XP: this hook never awards XP. completeStage() returns { newlyCompleted,
 * xpReward } and the caller feeds xpReward into the ONE existing XP system
 * via useUserData().updateXP.
 */

const LS_KEY = 'esportselite_roadmap_v2'
const META_ID = '_meta'
export const ROADMAP_PHASES = ['content', 'assessment', 'result', 'improve', 'next']
const DAY_MS = 24 * 60 * 60 * 1000

function emptyState() {
  return { meta: {}, stages: {} }
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object') return emptyState()
  return {
    meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : {},
    stages: raw.stages && typeof raw.stages === 'object' ? raw.stages : {},
  }
}

export function useRoadmap() {
  const { user } = useAuth()
  const uid = user?.uid

  const [state, setState] = useState(() => normalize(readLS(LS_KEY, null)))
  const [loading, setLoading] = useState(true)

  /* Ref mirror so action callbacks read fresh state without being
     re-created on every change. */
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  /* ── Load from Firestore (localStorage already painted) ── */
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!uid) { setLoading(false); return }
      const local = readLS(LS_KEY, null)
      if (local) setState(normalize(local))
      try {
        const snap = await getDocs(collection(db, 'users', uid, 'roadmapProgress'))
        if (cancelled) return
        const next = emptyState()
        snap.forEach(d => {
          if (d.id === META_ID) next.meta = d.data() || {}
          else next.stages[d.id] = d.data() || {}
        })
        setState(next)
        writeLS(LS_KEY, next)
      } catch {
        /* offline / permission — keep whatever localStorage had */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [uid])

  /* ── Commit helper: mutate a draft, write LS + the touched docs ──
     `producer(draft)` returns { meta?: true, stages?: string[] }. */
  const commit = useCallback((producer) => {
    setState(prev => {
      const draft = {
        meta: { ...prev.meta },
        stages: { ...prev.stages },
      }
      const touched = producer(draft) || {}
      const next = normalize(draft)
      writeLS(LS_KEY, next)
      if (uid) {
        if (touched.meta) {
          setDoc(
            doc(db, 'users', uid, 'roadmapProgress', META_ID),
            { ...next.meta, updatedAt: serverTimestamp() },
            { merge: true },
          ).catch(() => {})
        }
        ;(touched.stages || []).forEach(id => {
          setDoc(
            doc(db, 'users', uid, 'roadmapProgress', id),
            { ...next.stages[id], stageId: id, updatedAt: serverTimestamp() },
            { merge: true },
          ).catch(() => {})
        })
      }
      return next
    })
  }, [uid])

  /* small helper for producers */
  function patchStage(draft, id, changes) {
    draft.stages[id] = { ...(draft.stages[id] || {}), ...changes }
    return draft.stages[id]
  }

  /* ── Derived stage list ── */
  const stages = useMemo(() => ROADMAP_STAGES.map((cfg, i) => {
    const rec = state.stages[cfg.id] || {}
    const prev = i === 0 ? null : ROADMAP_STAGES[i - 1]
    const prevDone = !prev || state.stages[prev.id]?.status === 'completed'

    let uiState
    if (rec.status === 'completed') uiState = 'completed'
    else if (!prevDone) uiState = 'locked'
    else if (rec.status === 'in_progress') uiState = 'in_progress'
    else uiState = 'available'

    const firstSectionId = cfg.sections[0]?.id ?? null

    return {
      ...cfg,
      index: i,
      state: uiState,
      status: rec.status || null,
      phase: rec.phase || 'content',
      activeSectionId: rec.activeSectionId || firstSectionId,
      sectionsViewed: rec.sectionsViewed || {},
      answers: rec.answers || {},
      notes: rec.notes || {},
      result: rec.result || null,
      attempts: rec.attempts || [],
      startedAt: rec.startedAt || null,
      completedAt: rec.completedAt || null,
      readyQuestionCount: countReadyQuestions(cfg),
    }
  }), [state])

  const getStage = useCallback(
    (id) => stages.find(s => s.id === id) || null,
    [stages],
  )

  const completedCount = stages.filter(s => s.state === 'completed').length
  const totalStages = ROADMAP_STAGES.length
  const overallPct = totalStages ? Math.round((completedCount / totalStages) * 100) : 0
  const xpEarned = stages
    .filter(s => s.state === 'completed')
    .reduce((sum, s) => sum + (s.xpReward || 0), 0)
  const currentStage =
    stages.find(s => s.state === 'in_progress') ||
    stages.find(s => s.state === 'available') ||
    null

  /* Cosmetic day counter — NEVER gates anything. */
  const hasStarted = !!state.meta.startedAt
  const dayCount = hasStarted
    ? Math.max(1, Math.floor((Date.now() - state.meta.startedAt) / DAY_MS) + 1)
    : 1

  /* ── Actions ── */

  /** Enter a stage: stamp the roadmap start date (once) and mark the stage
   *  in_progress if it was merely available. No-op for completed stages. */
  const enterStage = useCallback((stageId) => {
    const cur = stateRef.current
    const rec = cur.stages[stageId] || {}
    const needsStart = !cur.meta.startedAt
    const needsProgress = rec.status !== 'completed' && rec.status !== 'in_progress'
    if (!needsStart && !needsProgress) return
    commit(draft => {
      const touched = {}
      if (!draft.meta.startedAt) {
        draft.meta.startedAt = Date.now()
        touched.meta = true
      }
      if (needsProgress) {
        patchStage(draft, stageId, {
          status: 'in_progress',
          phase: draft.stages[stageId]?.phase || 'content',
          startedAt: draft.stages[stageId]?.startedAt || Date.now(),
        })
        touched.stages = [stageId]
      }
      return touched
    })
  }, [commit])

  const setPhase = useCallback((stageId, phase) => {
    commit(draft => {
      const rec = draft.stages[stageId] || {}
      patchStage(draft, stageId, {
        status: rec.status === 'completed' ? 'completed' : 'in_progress',
        phase,
      })
      return { stages: [stageId] }
    })
  }, [commit])

  const setActiveSection = useCallback((stageId, sectionId) => {
    commit(draft => {
      const rec = draft.stages[stageId] || {}
      patchStage(draft, stageId, {
        activeSectionId: sectionId,
        sectionsViewed: { ...(rec.sectionsViewed || {}), [sectionId]: true },
      })
      return { stages: [stageId] }
    })
  }, [commit])

  const markSectionViewed = useCallback((stageId, sectionId) => {
    commit(draft => {
      const rec = draft.stages[stageId] || {}
      if (rec.sectionsViewed?.[sectionId]) return {}
      patchStage(draft, stageId, {
        sectionsViewed: { ...(rec.sectionsViewed || {}), [sectionId]: true },
      })
      return { stages: [stageId] }
    })
  }, [commit])

  const saveNote = useCallback((stageId, sectionId, text) => {
    commit(draft => {
      const rec = draft.stages[stageId] || {}
      patchStage(draft, stageId, {
        notes: { ...(rec.notes || {}), [sectionId]: text },
      })
      return { stages: [stageId] }
    })
  }, [commit])

  const saveAnswer = useCallback((stageId, sectionId, questionId, optionIndex) => {
    commit(draft => {
      const rec = draft.stages[stageId] || {}
      const answers = { ...(rec.answers || {}) }
      answers[sectionId] = { ...(answers[sectionId] || {}), [questionId]: optionIndex }
      patchStage(draft, stageId, {
        status: rec.status === 'completed' ? 'completed' : 'in_progress',
        answers,
      })
      return { stages: [stageId] }
    })
  }, [commit])

  /** Compute + persist a rule-based result, advance to the result phase.
   *  Returns the result object (or null if nothing answered). */
  const submitAssessment = useCallback((stageId) => {
    const cfg = getStageConfig(stageId)
    const rec = stateRef.current.stages[stageId] || {}
    const result = scoreStage(cfg, rec.answers || {})

    commit(draft => {
      const d = draft.stages[stageId] || {}
      const attempts = [...(d.attempts || [])]
      if (result) {
        attempts.push({
          at: Date.now(),
          overall: result.overall,
          level: result.overallLevel,
          sections: result.sectionResults.map(s => ({
            id: s.sectionId, score: s.score, level: s.level,
          })),
        })
      }
      patchStage(draft, stageId, {
        status: d.status === 'completed' ? 'completed' : 'in_progress',
        phase: 'result',
        result: result || null,
        attempts,
      })
      return { stages: [stageId] }
    })

    return result
  }, [commit])

  /** Finalise the stage. Returns { newlyCompleted, xpReward } so the caller
   *  awards XP exactly once through the existing system. */
  const completeStage = useCallback((stageId) => {
    const cfg = getStageConfig(stageId)
    const xpReward = cfg?.xpReward || 0
    const already = stateRef.current.stages[stageId]?.status === 'completed'

    commit(draft => {
      const rec = draft.stages[stageId] || {}
      if (rec.status === 'completed') {
        patchStage(draft, stageId, { phase: 'next' })
        return { stages: [stageId] }
      }
      patchStage(draft, stageId, {
        status: 'completed',
        phase: 'next',
        completedAt: Date.now(),
        xpAwarded: true,
      })
      return { stages: [stageId] }
    })

    return { newlyCompleted: !already, xpReward }
  }, [commit])

  return {
    loading,
    stages,
    getStage,
    totalStages,
    completedCount,
    overallPct,
    xpEarned,
    currentStage,
    dayCount,
    hasStarted,
    meta: state.meta,
    /* actions */
    enterStage,
    setPhase,
    setActiveSection,
    markSectionViewed,
    saveNote,
    saveAnswer,
    submitAssessment,
    completeStage,
    /* re-exports for convenience */
    readySections,
  }
}
