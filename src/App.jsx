import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { AnimatePresence } from 'framer-motion'
import { Wrench, Shield } from 'lucide-react'
import { db } from './utils/firebase.js'

import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Training from './pages/Training.jsx'
import TrainingPlan from './pages/TrainingPlan.jsx'
import Profile from './pages/Profile.jsx'
import Weapons from './pages/Weapons.jsx'
import MapKnowledge from './pages/MapKnowledge.jsx'
import Analytics from './pages/Analytics.jsx'
import Progress from './pages/Progress.jsx'
import MaintenancePage from './pages/MaintenancePage.jsx'
import Privacy from './pages/Privacy.jsx'
import Terms from './pages/Terms.jsx'
import Contact from './pages/Contact.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import Team from './pages/Team.jsx'
import TeamCreate from './pages/TeamCreate.jsx'
import Tournaments from './pages/Tournaments.jsx'
import TournamentDetail from './pages/TournamentDetail.jsx'
import Scheduler from './pages/Scheduler.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Layout from './components/Layout.jsx'
import AuthGuard from './components/AuthGuard.jsx'
import { useAuth } from './context/AuthContext.jsx'

/* ============================================================
   SPLASH
   ============================================================ */
function Splash() {
  const [logoFailed, setLogoFailed] = useState(false)
  return (
    <div className="splash">
      {!logoFailed ? (
        <img
          src="/assets/logo.png"
          alt="Esports Elite"
          className="splash-logo"
          onError={(e) => { e.currentTarget.style.display = 'none'; setLogoFailed(true) }}
        />
      ) : (
        <Shield size={64} className="splash-logo" style={{ color: 'var(--red)' }} strokeWidth={2.5} />
      )}
      <div className="splash-bar-track">
        <div className="splash-bar-fill" />
      </div>
      <div className="splash-label">Loading…</div>
    </div>
  )
}

/* ============================================================
   ROUTE GUARDS
   ============================================================ */
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

        {/* Legal / contact pages — accessible whether signed in or out */}
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/contact" element={<Contact />} />

        {/* Password reset — public. Firebase's default action URL is
            `/__/auth/action`, but we ship a custom URL too so branded
            templates land here directly. */}
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/__/auth/action" element={<ResetPassword />} />

        <Route
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/training" element={<Training />} />
          <Route path="/training-plan" element={<TrainingPlan />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/weapons" element={<Weapons />} />
          <Route path="/map-knowledge" element={<MapKnowledge />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/team" element={<Team />} />
          <Route path="/team/create" element={<TeamCreate />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route path="/tournaments/:tournamentId" element={<TournamentDetail />} />
          <Route path="/scheduler" element={<Scheduler />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

/* ============================================================
   APP ROOT — Firestore maintenance listener
   ============================================================ */
export default function App() {
  const [maintenance, setMaintenance] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'app_config', 'maintenance'),
      (snap) => {
        if (snap.exists()) setMaintenance(snap.data())
        else setMaintenance({ isActive: false })
        setChecking(false)
      },
      (error) => {
        console.error('Maintenance check:', error)
        setMaintenance({ isActive: false })
        setChecking(false)
      }
    )
    return () => unsub()
  }, [])

  if (checking) return <Splash />

  if (maintenance?.isActive) {
    return <MaintenancePage message={maintenance.message || ''} />
  }

  return <AppRoutes />
}

/* ============================================================
   COMING SOON
   ============================================================ */
export function ComingSoon({ title = 'Coming Soon', description = 'This feature is on the roadmap. Check back shortly.' }) {
  return (
    <div className="coming-soon-page">
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Wrench size={26} style={{ color: 'var(--text-muted)' }} />
      </div>
      <h2 className="heading" style={{ fontSize: 22 }}>{title}</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 400 }}>
        {description}
      </p>
      <span className="badge badge-amber">Back soon</span>
    </div>
  )
}
