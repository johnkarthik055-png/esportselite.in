import { useState, useEffect, useCallback } from 'react'

const PREFIX = 'esportselite_'
const AUTH_EVENT = 'esports-elite:auth-uid-changed'

/* ============================================================
   GLOBAL UID
   AuthContext calls setCurrentUid(uid) on auth-state-changed so
   useLocalStorage / readLS / writeLS can transparently scope keys.
   ============================================================ */
let currentUid = null

export function setCurrentUid(uid) {
  const next = uid || null
  if (currentUid === next) return
  currentUid = next
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_EVENT))
  }
}

export function getCurrentUid() {
  return currentUid
}

/**
 * Translate a base key like `esportselite_sessions` into the
 * UID-scoped form `esportselite_${uid}_sessions`. If no UID is set
 * (logged out / pre-auth), the key passes through unchanged so the
 * Login page and other public surfaces keep working.
 */
export function nsKey(key) {
  if (!key || !currentUid) return key
  if (!key.startsWith(PREFIX)) return key
  return `${PREFIX}${currentUid}_${key.slice(PREFIX.length)}`
}

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(nsKey(key))
      if (raw === null) return initialValue
      return JSON.parse(raw)
    } catch {
      return initialValue
    }
  })

  /* Write through to the (currently-scoped) key whenever value changes. */
  useEffect(() => {
    try {
      window.localStorage.setItem(nsKey(key), JSON.stringify(value))
    } catch {
      /* ignore */
    }
  }, [key, value])

  /* Cross-tab + cross-component sync. */
  useEffect(() => {
    function onStorage(e) {
      if (e.key === nsKey(key)) {
        try {
          setValue(e.newValue ? JSON.parse(e.newValue) : initialValue)
        } catch {
          /* ignore */
        }
      }
    }
    /* Auth-uid changed → re-read from the new namespaced key. */
    function onAuth() {
      try {
        const raw = window.localStorage.getItem(nsKey(key))
        setValue(raw === null ? initialValue : JSON.parse(raw))
      } catch {
        setValue(initialValue)
      }
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(AUTH_EVENT, onAuth)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(AUTH_EVENT, onAuth)
    }
  }, [key, initialValue])

  const reset = useCallback(() => setValue(initialValue), [initialValue])

  return [value, setValue, reset]
}

export function readLS(key, fallback) {
  try {
    const raw = window.localStorage.getItem(nsKey(key))
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeLS(key, value) {
  try {
    window.localStorage.setItem(nsKey(key), JSON.stringify(value))
  } catch {
    /* ignore */
  }
}
