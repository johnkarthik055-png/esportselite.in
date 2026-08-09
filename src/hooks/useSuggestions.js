import { useCallback, useMemo } from 'react'
import { useLocalStorage, readLS, writeLS } from './useLocalStorage.js'
import {
  STORAGE_KEYS,
  DEFAULT_SUGGESTIONS,
  SUGGESTION_CATEGORIES,
} from '../utils/constants.js'
import { uid } from '../utils/helpers.js'

/* ----------------------------------------------------------
   Seed defaults on first run (idempotent).
---------------------------------------------------------- */
export function initializeSuggestionsIfNeeded() {
  if (typeof window === 'undefined') return
  /* IMPORTANT: must read through readLS (UID-scoped) — a raw
     localStorage.getItem here misses the user's already-seeded data
     and re-seeds on every mount, wiping any customisations. */
  const existing = readLS(STORAGE_KEYS.SUGGESTIONS, null)
  if (existing !== null) return
  const seeded = DEFAULT_SUGGESTIONS.map(s => ({
    ...s,
    isDefault: true,
    hidden: false,
    createdAt: Date.now(),
  }))
  writeLS(STORAGE_KEYS.SUGGESTIONS, seeded)
}

/* ----------------------------------------------------------
   Migration v2 — convert free-text weakestPoint/strongestPoint
   match-log fields into suggestion-id arrays.
   Idempotent: runs once, guarded by MIGRATION_V2_DONE flag.
---------------------------------------------------------- */
export function migrateMatchesToSuggestionIds() {
  if (typeof window === 'undefined') return
  if (readLS(STORAGE_KEYS.MIGRATION_V2_DONE, false)) return

  const matches = readLS(STORAGE_KEYS.MATCHES, [])
  if (!Array.isArray(matches) || matches.length === 0) {
    writeLS(STORAGE_KEYS.MIGRATION_V2_DONE, true)
    return
  }

  /* Suggestions must be seeded already (call order in main.jsx). */
  let suggestions = readLS(STORAGE_KEYS.SUGGESTIONS, [])
  let createdAny = false

  function ensureSuggestion(name) {
    const trimmed = (name || '').trim()
    if (!trimmed) return null
    const existing = suggestions.find(
      s => s.name.toLowerCase() === trimmed.toLowerCase()
    )
    if (existing) return existing
    const created = {
      id: 'sug-custom-' + uid(),
      name: trimmed,
      category: 'Custom',
      icon: '🛠',
      linkedModuleId: null,
      isDefault: false,
      hidden: false,
      createdAt: Date.now(),
    }
    suggestions = [...suggestions, created]
    createdAny = true
    return created
  }

  let touchedMatches = false
  const upgraded = matches.map(m => {
    const next = { ...m }
    if (m.weakestPoint && !Array.isArray(m.weakestPoints)) {
      const sug = ensureSuggestion(m.weakestPoint)
      next.weakestPoints = sug ? [sug.id] : []
      touchedMatches = true
    } else if (!Array.isArray(m.weakestPoints)) {
      next.weakestPoints = []
    }
    if (m.strongestPoint && !Array.isArray(m.strongestPoints)) {
      const sug = ensureSuggestion(m.strongestPoint)
      next.strongestPoints = sug ? [sug.id] : []
      touchedMatches = true
    } else if (!Array.isArray(m.strongestPoints)) {
      next.strongestPoints = []
    }
    return next
  })

  if (createdAny) writeLS(STORAGE_KEYS.SUGGESTIONS, suggestions)
  if (touchedMatches) writeLS(STORAGE_KEYS.MATCHES, upgraded)

  if (createdAny || touchedMatches) {
    writeLS(
      STORAGE_KEYS.PENDING_TOAST,
      'We upgraded weakness tracking. Your existing entries are preserved as custom suggestions.'
    )
  }

  writeLS(STORAGE_KEYS.MIGRATION_V2_DONE, true)
}

/* ----------------------------------------------------------
   Hook
---------------------------------------------------------- */
export function useSuggestions() {
  initializeSuggestionsIfNeeded()
  const [suggestions, setSuggestions] = useLocalStorage(STORAGE_KEYS.SUGGESTIONS, [])

  const visibleSuggestions = useMemo(
    () => suggestions.filter(s => !s.hidden),
    [suggestions]
  )

  const getById = useCallback(
    id => suggestions.find(s => s.id === id) || null,
    [suggestions]
  )

  const groupedByCategory = useMemo(() => {
    const groups = {}
    SUGGESTION_CATEGORIES.forEach(c => {
      groups[c.name] = []
    })
    visibleSuggestions.forEach(s => {
      if (!groups[s.category]) groups[s.category] = []
      groups[s.category].push(s)
    })
    return SUGGESTION_CATEGORIES
      .map(c => ({
        name: c.name,
        icon: c.icon,
        items: (groups[c.name] || []).sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter(g => g.items.length > 0)
  }, [visibleSuggestions])

  const addCustom = useCallback(({ name, category, linkedModuleId }) => {
    const trimmed = (name || '').trim()
    if (!trimmed) return null
    const existing = suggestions.find(
      s => s.name.toLowerCase() === trimmed.toLowerCase()
    )
    if (existing) return existing
    const created = {
      id: 'sug-custom-' + uid(),
      name: trimmed,
      category: category || 'Custom',
      icon: SUGGESTION_CATEGORIES.find(c => c.name === (category || 'Custom'))?.icon || '🛠',
      linkedModuleId: linkedModuleId || null,
      isDefault: false,
      hidden: false,
      createdAt: Date.now(),
    }
    setSuggestions(prev => [...prev, created])
    return created
  }, [suggestions, setSuggestions])

  const updateSuggestion = useCallback((id, patch) => {
    setSuggestions(prev =>
      prev.map(s => (s.id === id ? { ...s, ...patch } : s))
    )
  }, [setSuggestions])

  const deleteSuggestion = useCallback((id) => {
    setSuggestions(prev => prev.filter(s => s.id !== id))
  }, [setSuggestions])

  const toggleHidden = useCallback((id) => {
    setSuggestions(prev =>
      prev.map(s => (s.id === id ? { ...s, hidden: !s.hidden } : s))
    )
  }, [setSuggestions])

  return {
    suggestions,
    visibleSuggestions,
    groupedByCategory,
    getById,
    addCustom,
    updateSuggestion,
    deleteSuggestion,
    toggleHidden,
  }
}
