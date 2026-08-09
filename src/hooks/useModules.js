import { useCallback } from 'react'
import { useLocalStorage, readLS, writeLS } from './useLocalStorage.js'
import { STORAGE_KEYS, DEFAULT_MODULE_SEED } from '../utils/constants.js'
import { uid } from '../utils/helpers.js'

/* ----------------------------------------------------------
   Seed defaults into localStorage on first run.
   Idempotent: if key already exists, do nothing.
   Also migrates the LEGACY esportselite_custom_modules array (if any).
---------------------------------------------------------- */
export function seedDefaultModules() {
  const now = Date.now()
  return DEFAULT_MODULE_SEED.map((m, i) => ({
    id: m.id,
    name: m.name,
    short: m.short,
    description: m.description,
    icon: m.icon,
    isDefault: true,
    drills: m.drills.map(d => ({ ...d })),
    createdAt: now + i,
  }))
}

export function initializeModulesIfNeeded() {
  /* IMPORTANT: must read through readLS (UID-scoped) — a raw
     localStorage.getItem here misses the user's already-seeded modules
     and re-seeds on every mount, wiping their customisations. */
  const existing = readLS(STORAGE_KEYS.MODULES, null)
  if (existing !== null) return

  /* Pull any legacy custom modules and merge them in. */
  let legacyCustom = readLS(STORAGE_KEYS.CUSTOM_MODULES, [])
  if (!Array.isArray(legacyCustom)) legacyCustom = []

  const seeded = [
    ...seedDefaultModules(),
    ...legacyCustom.map(m => ({
      id: m.id || 'mod-' + uid(),
      name: m.name,
      short: m.short || m.name,
      description: m.description || '',
      icon: m.icon || '🎯',
      isDefault: false,
      drills: Array.isArray(m.drills) ? m.drills : [],
      createdAt: m.createdAt || Date.now(),
    })),
  ]

  writeLS(STORAGE_KEYS.MODULES, seeded)
}

/* ----------------------------------------------------------
   Hook
---------------------------------------------------------- */
export function useModules() {
  /* Defensive: if no seed has run yet (e.g. component used in isolation), seed now. */
  if (typeof window !== 'undefined') {
    initializeModulesIfNeeded()
  }

  const [modules, setModules] = useLocalStorage(STORAGE_KEYS.MODULES, [])

  const addModule = useCallback(({ name, description, icon }) => {
    const trimmed = (name || '').trim() || 'Untitled Module'
    const m = {
      id: 'mod-' + uid(),
      name: trimmed,
      short: trimmed,
      description: (description || '').trim(),
      icon: icon || '🎯',
      isDefault: false,
      drills: [],
      createdAt: Date.now(),
    }
    setModules(prev => [...prev, m])
    return m
  }, [setModules])

  const updateModule = useCallback((updated) => {
    setModules(prev => prev.map(m => (m.id === updated.id ? updated : m)))
  }, [setModules])

  const deleteModule = useCallback((id) => {
    setModules(prev => prev.filter(m => m.id !== id))
  }, [setModules])

  const duplicateModule = useCallback((id) => {
    setModules(prev => {
      const orig = prev.find(m => m.id === id)
      if (!orig) return prev
      const copyName = orig.name.endsWith(' (Copy)') ? orig.name : orig.name + ' (Copy)'
      const copy = {
        ...orig,
        id: 'mod-' + uid(),
        name: copyName,
        short: copyName,
        isDefault: false,
        drills: orig.drills.map(d => ({ ...d, id: 'drill-' + uid() })),
        createdAt: Date.now(),
      }
      return [...prev, copy]
    })
  }, [setModules])

  const renameModule = useCallback((id, patch) => {
    setModules(prev =>
      prev.map(m =>
        m.id === id
          ? {
              ...m,
              name: patch.name?.trim() || m.name,
              short: patch.name?.trim() || m.short,
              description: patch.description?.trim() ?? m.description,
              icon: patch.icon || m.icon,
            }
          : m
      )
    )
  }, [setModules])

  const addDrill = useCallback((moduleId, { name, description }) => {
    setModules(prev =>
      prev.map(m =>
        m.id === moduleId
          ? {
              ...m,
              drills: [
                ...m.drills,
                {
                  id: 'drill-' + uid(),
                  name: name.trim(),
                  description: (description || '').trim(),
                },
              ],
            }
          : m
      )
    )
  }, [setModules])

  const updateDrill = useCallback((moduleId, drillId, patch) => {
    setModules(prev =>
      prev.map(m =>
        m.id === moduleId
          ? {
              ...m,
              drills: m.drills.map(d =>
                d.id === drillId
                  ? { ...d, name: patch.name?.trim() || d.name, description: patch.description?.trim() ?? d.description }
                  : d
              ),
            }
          : m
      )
    )
  }, [setModules])

  const deleteDrill = useCallback((moduleId, drillId) => {
    setModules(prev =>
      prev.map(m =>
        m.id === moduleId
          ? { ...m, drills: m.drills.filter(d => d.id !== drillId) }
          : m
      )
    )
  }, [setModules])

  const restoreDefaults = useCallback(() => {
    setModules(prev => {
      const existingIds = new Set(prev.map(m => m.id))
      const now = Date.now()
      const missing = DEFAULT_MODULE_SEED
        .filter(m => !existingIds.has(m.id))
        .map((m, i) => ({
          id: m.id,
          name: m.name,
          short: m.short,
          description: m.description,
          icon: m.icon,
          isDefault: true,
          drills: m.drills.map(d => ({ ...d })),
          createdAt: now + i,
        }))
      return [...prev, ...missing]
    })
  }, [setModules])

  const getModuleById = useCallback(
    (id) => modules.find(m => m.id === id) || null,
    [modules]
  )

  /** Replace the entire ordered list (used by drag-to-reorder). */
  const reorderModules = useCallback((nextOrdered) => {
    if (!Array.isArray(nextOrdered)) return
    setModules(nextOrdered)
  }, [setModules])

  /** Replace the ordered drills of a single module. */
  const reorderDrills = useCallback((moduleId, nextDrills) => {
    if (!Array.isArray(nextDrills)) return
    setModules(prev =>
      prev.map(m => (m.id === moduleId ? { ...m, drills: nextDrills } : m))
    )
  }, [setModules])

  return {
    modules,
    addModule,
    updateModule,
    deleteModule,
    duplicateModule,
    renameModule,
    addDrill,
    updateDrill,
    deleteDrill,
    restoreDefaults,
    getModuleById,
    reorderModules,
    reorderDrills,
  }
}
