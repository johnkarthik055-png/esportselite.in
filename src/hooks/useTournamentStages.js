import { useCallback } from 'react'
import { useLocalStorage, readLS, writeLS } from './useLocalStorage.js'
import { STORAGE_KEYS, DEFAULT_TOURNAMENT_STAGES } from '../utils/constants.js'
import { uid } from '../utils/helpers.js'

/* ----------------------------------------------------------
   Seed on first load (idempotent).
   Each default stage is marked isDefault: true.
---------------------------------------------------------- */
export function initializeTournamentStagesIfNeeded() {
  if (typeof window === 'undefined') return
  /* IMPORTANT: must read through readLS (UID-scoped) — a raw
     localStorage.getItem here misses the user's already-seeded data
     and re-seeds on every mount, wiping any customisations. */
  const existing = readLS(STORAGE_KEYS.TOURNAMENT_STAGES_LIST, null)
  if (existing !== null) return
  const seeded = DEFAULT_TOURNAMENT_STAGES.map(s => ({
    id: s.id,
    name: s.name,
    isDefault: true,
  }))
  writeLS(STORAGE_KEYS.TOURNAMENT_STAGES_LIST, seeded)
}

/* ----------------------------------------------------------
   Hook
---------------------------------------------------------- */
export function useTournamentStages() {
  initializeTournamentStagesIfNeeded()

  const [stages, setStages] = useLocalStorage(STORAGE_KEYS.TOURNAMENT_STAGES_LIST, [])

  const addStage = useCallback((name) => {
    const trimmed = (name || '').trim()
    if (!trimmed) return null
    const stage = {
      id: 'stage-' + uid(),
      name: trimmed,
      isDefault: false,
    }
    setStages(prev => [...prev, stage])
    return stage
  }, [setStages])

  const renameStage = useCallback((id, name) => {
    const trimmed = (name || '').trim()
    if (!trimmed) return
    setStages(prev => prev.map(s => (s.id === id ? { ...s, name: trimmed } : s)))
  }, [setStages])

  const deleteStage = useCallback((id) => {
    setStages(prev => prev.filter(s => s.id !== id))
  }, [setStages])

  const restoreDefaults = useCallback(() => {
    setStages(prev => {
      const existingIds = new Set(prev.map(s => s.id))
      const missing = DEFAULT_TOURNAMENT_STAGES
        .filter(s => !existingIds.has(s.id))
        .map(s => ({ id: s.id, name: s.name, isDefault: true }))
      return [...prev, ...missing]
    })
  }, [setStages])

  return {
    stages,
    addStage,
    renameStage,
    deleteStage,
    restoreDefaults,
  }
}
