import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, getRedirectResult } from 'firebase/auth'
import { auth } from '../utils/firebase.js'
import { setActiveUID, migrateOldData } from '../utils/storage.js'
import SplashScreen from '../components/SplashScreen.jsx'

const AuthContext = createContext({
  user: null,
  loading: true,
  logout: async () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRedirectResult(auth).catch(() => {})

    const timeout = setTimeout(() => {
      setUser(null)
      setLoading(false)
    }, 5000)

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(timeout)
      const uid = firebaseUser?.uid || null
      setActiveUID(uid)
      if (uid) migrateOldData(uid)
      setUser(firebaseUser ?? null)
      setLoading(false)
    })

    return () => {
      clearTimeout(timeout)
      unsubscribe()
    }
  }, [])

  async function logout() {
    try { await signOut(auth) } catch { /* swallow */ }
    setUser(null)
    setActiveUID(null)
    window.location.href = '/'
  }

  async function refreshUser() {
    if (!auth.currentUser) return
    try {
      await auth.currentUser.reload()
      setUser({ ...auth.currentUser })
    } catch { /* non-fatal */ }
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      {loading ? <SplashScreen /> : children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
