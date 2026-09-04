import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../utils/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { readLS, writeLS } from './useLocalStorage.js'
import {
  DISCOVERY_GROUPS, ROLES, roleAssessmentSection,
} from '../data/roadmapRoles.js'
import { scoreDiscovery, scoreRoleAssessment } from '../utils/roleScoring.js'

/*
 * useRoles — per-user progress for the Role System (Phase 2).
 *
 * Mirrors the useRoadmap dual-write pattern exactly. Everything lives in one
 * Firestore doc under the same prefix the existing rule already covers:
 *
 *   users/{uid}/roadmapProgress/roles
 *   {
 *     discovery: {
 *       answers:  { [questionId]: optionIndex },
 *       result:   <scoreDiscovery() output>,
 *       attempts: [{ at, primaryRoleId, primaryRoleName, roleFit, roleFitScore }],
 *     },
 *     roles: {
 *       [roleId]: {
 *         answers:  { [questionId]: optionIndex },
 *         result:   <scoreRoleAssessment() output>,
 *         attempts: [{ at, score, readiness }],
 *       }
 *     },
 *     updatedAt
 *   }
 *
 * Mirrored to a UID-scoped localStorage blob for instant paint.
 * No gating — the Role System never locks anything.
 */

const LS_KEY = 'esportselite_roles_v1'

function emptyState() {
  return { discovery: {}, roles: {} }
}
function normalize(raw) {
  if (!raw || typeof raw !== 'object') return emptyState()
  return {
    discovery: raw.discovery && typeof raw.discovery === 'object' ? raw.discovery : {},
    roles: raw.roles && typeof raw.roles === 'object' ? raw.roles : {},
  }
}

export function useRoles() {
  const { user } = useAuth()
  const uid = user?.uid

  const [state, setState] = useState(() => normalize(readLS(LS_KEY, null)))
  const [loading, setLoading] = useState(true)
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!uid) { setLoading(false); return }
      const local = readLS(LS_KEY, null)
      if (local) setState(normalize(local))
      try {
        const snap = await getDoc(doc(db, 'users', uid, 'roadmapProgress', 'roles'))
        if (cancelled) return
        if (snap.exists()) {
          const next = normalize(snap.data())
          setState(next)
          writeLS(LS_KEY, next)
        }
      } catch {
        /* offline / permission — keep localStorage */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [uid])

  /* Read from the ref, mutate a draft, write LS synchronously, then setState.
     Doing the LS write outside the setState updater means a component that
     navigates immediately after a submit (Role Detail → Role Readiness) reads
     the fresh value straight from localStorage — no updater-timing race. */
  const persist = useCallback((producer) => {
    const prev = stateRef.current
    const draft = {
      discovery: { ...prev.discovery },
      roles: { ...prev.roles },
    }
    producer(draft)
    const next = normalize(draft)
    stateRef.current = next
    writeLS(LS_KEY, next)
    setState(next)
    if (uid) {
      setDoc(
        doc(db, 'users', uid, 'roadmapProgress', 'roles'),
        { ...next, updatedAt: serverTimestamp() },
        { merge: true },
      ).catch(() => {})
    }
  }, [uid])

  /* ── Discovery ── */
  const discovery = useMemo(() => ({
    answers: state.discovery.answers || {},
    result: state.discovery.result || null,
    attempts: state.discovery.attempts || [],
  }), [state.discovery])

  const saveDiscoveryAnswer = useCallback((questionId, optionIndex) => {
    persist(draft => {
      const d = { ...(draft.discovery || {}) }
      d.answers = { ...(d.answers || {}), [questionId]: optionIndex }
      draft.discovery = d
    })
  }, [persist])

  const submitDiscovery = useCallback(() => {
    const answers = stateRef.current.discovery?.answers || {}
    const result = scoreDiscovery(DISCOVERY_GROUPS, ROLES, answers)
    persist(draft => {
      const d = { ...(draft.discovery || {}) }
      d.result = result || null
      if (result) {
        d.attempts = [
          ...(d.attempts || []),
          {
            at: Date.now(),
            primaryRoleId: result.primaryRoleId,
            primaryRoleName: result.primaryRoleName,
            roleFit: result.roleFit,
            roleFitScore: result.roleFitScore,
          },
        ]
      }
      draft.discovery = d
    })
    return result
  }, [persist])

  /* ── Per-role assessment ── */
  const roleData = useCallback((roleId) => {
    const r = state.roles[roleId] || {}
    return {
      answers: r.answers || {},
      result: r.result || null,
      attempts: r.attempts || [],
    }
  }, [state.roles])

  const saveRoleAnswer = useCallback((roleId, questionId, optionIndex) => {
    persist(draft => {
      const r = { ...(draft.roles[roleId] || {}) }
      r.answers = { ...(r.answers || {}), [questionId]: optionIndex }
      draft.roles[roleId] = r
    })
  }, [persist])

  const submitRoleAssessment = useCallback((roleId) => {
    const section = roleAssessmentSection(roleId)
    const answers = stateRef.current.roles?.[roleId]?.answers || {}
    const result = section ? scoreRoleAssessment(section, answers) : null
    persist(draft => {
      const r = { ...(draft.roles[roleId] || {}) }
      r.result = result || null
      if (result) {
        r.attempts = [
          ...(r.attempts || []),
          { at: Date.now(), score: result.score, readiness: result.readinessLabel },
        ]
      }
      draft.roles[roleId] = r
    })
    return result
  }, [persist])

  return {
    loading,
    discovery,
    saveDiscoveryAnswer,
    submitDiscovery,
    roleData,
    saveRoleAnswer,
    submitRoleAssessment,
  }
}
