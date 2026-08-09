import { useEffect, useState } from 'react'

const THEME_KEY = 'esportselite_theme'

function readPref() {
  try {
    return localStorage.getItem(THEME_KEY) || 'dark'
  } catch {
    return 'dark'
  }
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return
  document.body.classList.remove('theme-dark', 'theme-amoled')
  document.body.classList.add(theme === 'amoled' ? 'theme-amoled' : 'theme-dark')
}

/** Apply the persisted theme. Safe to call once early in app boot. */
export function bootTheme() {
  applyTheme(readPref())
}

/** Theme state hook + setter. Persists to localStorage + updates body class. */
export function useTheme() {
  const [theme, setThemeState] = useState(readPref)

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  return [theme, setThemeState]
}
