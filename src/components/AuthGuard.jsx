import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import SplashScreen from './SplashScreen.jsx'

/**
 * Guards protected routes — must be rendered INSIDE <AuthProvider>.
 *  - while the first session check is in flight → SplashScreen
 *  - no user           → redirect to /login
 *  - authenticated     → render children
 */
export default function AuthGuard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <SplashScreen />
  if (!user) return <Navigate to="/login" replace />
  return children
}
