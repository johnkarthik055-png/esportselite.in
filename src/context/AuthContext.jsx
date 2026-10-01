import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  onAuthStateChanged,
  signOut,
  getRedirectResult,
} from 'firebase/auth'
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
  /*
   * `undefined`  = auth state not yet resolved (initial load).
   * `null`       = resolved, signed out.
   * User object  = resolved, signed in.
   *
   * `isResolvingRedirect` stays true until getRedirectResult() settles so we
   * never render a single child component before the UID is available.
   */
  const [user, setUser] = useState(undefined)
  const [isResolvingRedirect, setIsResolvingRedirect] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let authUnsubscribe = null
    let userFallback = null
    let mounted = true

    function subscribeAuthState() {
      /* Safety: if onAuthStateChanged never calls back (network blocked, SDK
         issue) force user out of `undefined` after 5 seconds so `loading`
         resolves and the app doesn't stay on Splash forever. */
      userFallback = setTimeout(() => {
        if (mounted) setUser(prev => prev === undefined ? null : prev)
      }, 5000)

      authUnsubscribe = onAuthStateChanged(auth, firebaseUser => {
        clearTimeout(userFallback)
        const uid = firebaseUser?.uid || null
        setActiveUID(uid)
        if (uid) migrateOldData(uid)
        setUser(firebaseUser ?? null)
      })
    }

    /* 1. Resolve any pending Google-redirect sign-in result FIRST.
          Race against a 5-second timeout so a hung getRedirectResult
          (e.g. App Check / network issue) never freezes the Splash screen. */
    const redirectPromise = getRedirectResult(auth)
      .then(result => result)
      .catch(err => {
        console.error('Redirect error:', err)
        return null
      })
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 5000))

    Promise.race([redirectPromise, timeoutPromise])
      .then(result => {
        if (!mounted) return
        if (result?.user) {
          const u = result.user
          setActiveUID(u.uid)
          migrateOldData(u.uid)
          navigate('/dashboard', { replace: true })
        }
      })
      .finally(() => {
        if (!mounted) return
        setIsResolvingRedirect(false)

        /* 2. Subscribe to ongoing auth state AFTER redirect is resolved. */
        subscribeAuthState()
      })

    return () => {
      mounted = false
      if (authUnsubscribe) authUnsubscribe()
      if (userFallback) clearTimeout(userFallback)
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])

  async function logout() {
    try {
      await signOut(auth)
    } catch {
      /* swallow */
    }
    /* Force the context user to null right away so any component
       that reads `user` in the same tick sees the logged-out state.
       Without this, the onAuthStateChanged listener fires a beat
       later and a subsequent login navigation can race a stale
       user object still cached in child components. */
    setUser(null)
    setActiveUID(null)
    /* Hard redirect to landing. This tears down the whole React
       tree so the next login mounts against a fresh AuthContext,
       killing every "login didn't take after logout" race for
       good. */
    window.location.href = '/'
  }

  /**
   * Force-refresh the in-context user object after a profile update so
   * every component reading user.displayName sees the new value immediately.
   */
  async function refreshUser() {
    if (!auth.currentUser) return
    try {
      await auth.currentUser.reload()
      setUser({ ...auth.currentUser })
    } catch {
      /* non-fatal */
    }
  }

  const loading = isResolvingRedirect || user === undefined

  return (
    <AuthContext.Provider value={{ user: user ?? null, loading, logout, refreshUser }}>
      {/* Block ALL child rendering until auth is fully resolved so no
          component can read localStorage before setActiveUID() fires. */}
      {loading ? <SplashScreen /> : children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
