/*
 * IMPORTANT: Firestore security rules must
 * allow admin emails to read all user
 * documents. Update your Firestore rules
 * to allow reads on users collection for
 * these admin UIDs, or temporarily use
 * test mode while developing.
 * Do not deploy with open rules to production.
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, collectionGroup, getDocs, doc, updateDoc,
  deleteDoc, addDoc, setDoc, getDoc, query, orderBy,
  getCountFromServer, where, limit, Timestamp,
} from 'firebase/firestore'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Users as UsersIcon, Clock, Bell, ListChecks,
  Wrench, Search, Loader2, AlertCircle, Copy, Download,
  Trash2, Info, CheckCircle2, AlertTriangle, ChevronLeft,
  ChevronRight, BarChart2, Send, Mail, Zap, X, Trophy,
} from 'lucide-react'
import { db } from '../utils/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import TournamentsAdminTab from '../components/admin/TournamentsAdminTab.jsx'

const ADMIN_EMAILS = [
  'karthikreddyy2010@gmail.com',
  'johnkarthik055@gmail.com',
]

const TABS = [
  { id: 'overview',      label: 'Overview',      icon: BarChart2 },
  { id: 'users',         label: 'Users',         icon: UsersIcon },
  { id: 'trials',        label: 'Trials',        icon: Clock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'waitlist',      label: 'Waitlist',      icon: ListChecks },
  { id: 'maintenance',   label: 'Maintenance',   icon: Wrench },
  { id: 'tournaments',   label: 'Tournaments',   icon: Trophy },
]

/* ============================================================
   ROOT
   ============================================================ */
export default function AdminPanel() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    if (loading) return
    if (!user) { navigate('/login', { replace: true }); return }
    if (!ADMIN_EMAILS.includes(user.email)) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, loading, navigate])

  if (loading || !user || !ADMIN_EMAILS.includes(user.email)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 size={22} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-transition">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1
            className="heading"
            style={{
              fontSize: 28,
              letterSpacing: '0.06em',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              margin: 0,
            }}
          >
            <Shield size={22} style={{ color: 'var(--text-muted)' }} />
            Admin Panel
          </h1>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-subtle)', marginTop: 4 }}>
            Signed in as {user.email}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: 3,
          display: 'inline-flex',
          gap: 2,
          flexWrap: 'wrap',
          alignSelf: 'flex-start',
        }}
      >
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: active ? 'var(--bg-elevated)' : 'transparent',
                border: active ? '1px solid var(--border)' : '1px solid transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-subtle)',
                padding: '8px 14px',
                borderRadius: 4,
                fontSize: 13,
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {tab === 'overview'      && <OverviewTab />}
          {tab === 'users'         && <UsersTab />}
          {tab === 'trials'        && <TrialsTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'waitlist'      && <WaitlistTab />}
          {tab === 'maintenance'   && <MaintenanceTab adminEmail={user.email} />}
          {tab === 'tournaments'   && <TournamentsAdminTab />}
        </motion.div>
      </AnimatePresence>

      <style>{`
        .animate-spin { animation: ee-admin-spin 0.9s linear infinite; }
        @keyframes ee-admin-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

/* ============================================================
   OVERVIEW TAB
   ============================================================ */
function OverviewTab() {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      try {
        const usersRef = collection(db, 'users')
        const waitlistRef = collection(db, 'waitlist')
        const [usersSnap, sessionsCount, matchesCount, waitlistCount, allUsers] = await Promise.all([
          getCountFromServer(usersRef),
          getCountFromServer(collectionGroup(db, 'sessions')).catch(() => ({ data: () => ({ count: 0 }) })),
          getCountFromServer(collectionGroup(db, 'matches')).catch(() => ({ data: () => ({ count: 0 }) })),
          getCountFromServer(waitlistRef).catch(() => ({ data: () => ({ count: 0 }) })),
          getDocs(usersRef),
        ])

        /* Compute trial counts + build recent list from full users snapshot */
        const now = new Date()
        let activeTrials = 0
        let expiredTrials = 0
        const users = []
        allUsers.forEach(u => {
          const data = u.data() || {}
          const trial = data.trial || null
          let daysLeft = 0, expired = true, active = false
          if (trial?.endDate) {
            const end = new Date(trial.endDate)
            daysLeft = Math.ceil((end - now) / 86400000)
            active = daysLeft > 0
            expired = daysLeft <= 0
          }
          if (active) activeTrials++
          else expiredTrials++

          users.push({
            uid: u.id,
            email: data.email || '',
            username: data.username || 'Player',
            createdAt: data.createdAt || null,
            level: data.level ?? 1,
            xp: data.xp ?? 0,
            trial: { ...trial, daysLeft, active, expired },
          })
        })

        const recentUsers = [...users]
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .slice(0, 10)

        if (!cancelled) {
          setStats({
            users: usersSnap.data().count,
            activeTrials,
            expiredTrials,
            sessions: sessionsCount.data().count,
            matches: matchesCount.data().count,
            waitlist: waitlistCount.data().count,
          })
          setRecent(recentUsers)
        }
      } catch (err) {
        console.error('[Admin] Overview load failed:', err)
        if (!cancelled) setError(err?.message || 'Failed to load overview.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <StatTile icon={<UsersIcon size={18} />} value={stats.users} label="Total Users" />
        <StatTile icon={<CheckCircle2 size={18} />} value={stats.activeTrials} label="Active Trials" />
        <StatTile icon={<AlertTriangle size={18} />} value={stats.expiredTrials} label="Expired Trials" />
        <StatTile icon={<Zap size={18} />} value={stats.sessions} label="Total Sessions" />
        <StatTile icon={<BarChart2 size={18} />} value={stats.matches} label="Total Matches" />
        <StatTile icon={<ListChecks size={18} />} value={stats.waitlist} label="Waitlist Signups" />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent activity</div>
          <div className="label">Last 10 signups</div>
        </div>
        {recent.length === 0 ? (
          <EmptyBlock title="No users yet" desc="New signups will appear here." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Signed up</th>
                  <th style={{ textAlign: 'right' }}>Trial days left</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(u => (
                  <tr key={u.uid}>
                    <td style={{ width: 40 }}><Avatar name={u.username} /></td>
                    <td>{u.username}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(u.createdAt)}</td>
                    <td className="mono" style={{ textAlign: 'right', color: 'var(--text-primary)' }}>
                      {Math.max(0, u.trial.daysLeft)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   USERS TAB
   ============================================================ */
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [page, setPage] = useState(0)
  const [extendFor, setExtendFor] = useState(null)  /* uid or null */
  const PER_PAGE = 20

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError('')
    try {
      const q1 = query(collection(db, 'users'), orderBy('createdAt', 'desc'))
      const snap = await getDocs(q1).catch(async () => {
        /* Some users may lack createdAt — fall back to unordered fetch */
        return getDocs(collection(db, 'users'))
      })
      const now = new Date()
      const list = []
      snap.forEach(u => {
        const data = u.data() || {}
        const trial = data.trial || null
        let daysLeft = 0, expired = true, active = false
        if (trial?.endDate) {
          const end = new Date(trial.endDate)
          daysLeft = Math.ceil((end - now) / 86400000)
          active = daysLeft > 0
          expired = daysLeft <= 0
        }
        list.push({
          uid: u.id,
          email: data.email || '',
          username: data.username || 'Player',
          createdAt: data.createdAt || null,
          level: data.level ?? 1,
          xp: data.xp ?? 0,
          trial: { ...trial, daysLeft, active, expired },
        })
      })
      setUsers(list)
    } catch (err) {
      console.error('[Admin] Users load failed:', err)
      setError(err?.message || 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = searchQ.trim().toLowerCase()
    if (!q) return users
    return users.filter(u =>
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    )
  }, [users, searchQ])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageUsers = filtered.slice(currentPage * PER_PAGE, (currentPage + 1) * PER_PAGE)

  async function extendTrial(uid, days) {
    const target = users.find(u => u.uid === uid)
    if (!target) return
    const currentEnd = target.trial?.endDate ? new Date(target.trial.endDate) : new Date()
    if (currentEnd < new Date()) currentEnd.setTime(Date.now())
    const newEnd = new Date(currentEnd.getTime() + days * 86400000)
    try {
      await updateDoc(doc(db, 'users', uid), {
        'trial.endDate': newEnd.toISOString(),
        'trial.active': true,
        'trial.expired': false,
      })
      setExtendFor(null)
      await load()
    } catch (err) {
      console.error('[Admin] extendTrial failed:', err)
      alert('Could not extend trial: ' + (err?.message || err))
    }
  }

  async function revokeTrial(uid) {
    if (!window.confirm('Revoke this user\'s trial? They will lose access immediately.')) return
    try {
      await updateDoc(doc(db, 'users', uid), {
        'trial.active': false,
        'trial.expired': true,
        'trial.daysLeft': 0,
        'trial.endDate': new Date().toISOString(),
      })
      await load()
    } catch (err) {
      alert('Could not revoke trial: ' + (err?.message || err))
    }
  }

  async function deleteUser(uid, email) {
    const confirmMsg =
      `Delete Firestore data for ${email || uid}?\n\n` +
      `This removes their user document but does NOT delete their\n` +
      `Firebase Authentication account (that requires the Admin SDK\n` +
      `server-side). They will be able to sign in again but with an\n` +
      `empty profile.\n\nContinue?`
    if (!window.confirm(confirmMsg)) return
    try {
      await deleteDoc(doc(db, 'users', uid))
      await load()
    } catch (err) {
      alert('Could not delete user: ' + (err?.message || err))
    }
  }

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 480 }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-subtle)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          value={searchQ}
          onChange={e => { setSearchQ(e.target.value); setPage(0) }}
          placeholder="Search by name or email..."
          className="input-field"
          style={{ paddingLeft: 34 }}
        />
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {pageUsers.length === 0 ? (
          <div style={{ padding: 20 }}>
            <EmptyBlock title="No users found" desc="Try a different search." />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Level</th>
                  <th>XP</th>
                  <th>Trial</th>
                  <th>Days left</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageUsers.map(u => (
                  <UserRow
                    key={u.uid}
                    u={u}
                    extendOpen={extendFor === u.uid}
                    onExtendToggle={() => setExtendFor(extendFor === u.uid ? null : u.uid)}
                    onExtendConfirm={(days) => extendTrial(u.uid, days)}
                    onRevoke={() => revokeTrial(u.uid)}
                    onDelete={() => deleteUser(u.uid, u.email)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
          {filtered.length} user{filtered.length === 1 ? '' : 's'} · page {currentPage + 1} of {pageCount}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={currentPage === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >
            <ChevronLeft size={13} /> Prev
          </button>
          <button
            className="btn btn-secondary btn-sm"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
          >
            Next <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

function UserRow({ u, extendOpen, onExtendToggle, onExtendConfirm, onRevoke, onDelete }) {
  const [customDays, setCustomDays] = useState(30)

  const badge =
    u.trial.active && u.trial.daysLeft > 7
      ? <span className="badge badge-green">Active</span>
      : u.trial.active && u.trial.daysLeft <= 7
      ? <span className="badge badge-amber">Expiring</span>
      : <span className="badge badge-red">Expired</span>

  return (
    <>
      <tr>
        <td style={{ width: 40 }}><Avatar name={u.username} /></td>
        <td style={{ fontWeight: 500 }}>{u.username}</td>
        <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
        <td><span className="badge">L{u.level}</span></td>
        <td className="mono" style={{ color: 'var(--text-muted)' }}>{Number(u.xp).toLocaleString()}</td>
        <td>{badge}</td>
        <td className="mono" style={{ color: 'var(--text-muted)' }}>
          {Math.max(0, u.trial.daysLeft)}
        </td>
        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button onClick={onExtendToggle} className="btn btn-secondary btn-sm">
              Extend
            </button>
            <DangerBtn onClick={onRevoke} label="Revoke" />
            <DangerBtn onClick={onDelete} label="Delete" />
          </div>
        </td>
      </tr>
      {extendOpen && (
        <tr>
          <td colSpan={8} style={{ background: 'var(--bg-elevated)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 0' }}>
              <span className="label">Extend by:</span>
              <button className="btn btn-secondary btn-sm" onClick={() => onExtendConfirm(7)}>+7 days</button>
              <button className="btn btn-secondary btn-sm" onClick={() => onExtendConfirm(30)}>+30 days</button>
              <button className="btn btn-secondary btn-sm" onClick={() => onExtendConfirm(90)}>+90 days</button>
              <span style={{ color: 'var(--text-subtle)', fontSize: 12 }}>or custom:</span>
              <input
                type="number"
                min="1"
                max="3650"
                value={customDays}
                onChange={e => setCustomDays(e.target.value)}
                className="input-field"
                style={{ width: 90 }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onExtendConfirm(Math.max(1, Number(customDays) || 1))}
              >
                Apply
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={onExtendToggle}
                style={{ marginLeft: 'auto' }}
              >
                <X size={13} />
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/* ============================================================
   TRIALS TAB
   ============================================================ */
function TrialsTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sub, setSub] = useState('active')  /* active | expiring | expired */
  const [bulkRunning, setBulkRunning] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError('')
    try {
      const snap = await getDocs(collection(db, 'users'))
      const now = new Date()
      const list = []
      snap.forEach(u => {
        const data = u.data() || {}
        const trial = data.trial || {}
        let daysLeft = 0, expired = true, active = false
        if (trial?.endDate) {
          const end = new Date(trial.endDate)
          daysLeft = Math.ceil((end - now) / 86400000)
          active = daysLeft > 0
          expired = daysLeft <= 0
        }
        list.push({
          uid: u.id,
          email: data.email || '',
          username: data.username || 'Player',
          trial: { ...trial, daysLeft, active, expired },
        })
      })
      setUsers(list)
    } catch (err) {
      setError(err?.message || 'Failed to load trials.')
    } finally {
      setLoading(false)
    }
  }

  const bySub = useMemo(() => {
    const active   = users.filter(u => u.trial.active  && u.trial.daysLeft > 7)
    const expiring = users.filter(u => u.trial.active  && u.trial.daysLeft <= 7 && u.trial.daysLeft > 0)
    const expired  = users.filter(u => u.trial.expired || u.trial.daysLeft <= 0)
    return { active, expiring, expired }
  }, [users])

  async function extendOne(uid, days) {
    const target = users.find(u => u.uid === uid)
    if (!target) return
    const currentEnd = target.trial?.endDate ? new Date(target.trial.endDate) : new Date()
    if (currentEnd < new Date()) currentEnd.setTime(Date.now())
    const newEnd = new Date(currentEnd.getTime() + days * 86400000)
    try {
      await updateDoc(doc(db, 'users', uid), {
        'trial.endDate': newEnd.toISOString(),
        'trial.active': true,
        'trial.expired': false,
      })
    } catch (err) {
      console.warn('[Admin] extendOne failed', uid, err)
    }
  }

  async function bulkExtend(list, days = 30) {
    if (list.length === 0) return
    if (!window.confirm(`Extend trials for ${list.length} user${list.length === 1 ? '' : 's'} by ${days} days?`)) return
    setBulkRunning(true)
    for (const u of list) {
      await extendOne(u.uid, days)
    }
    setBulkRunning(false)
    await load()
  }

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} />

  const SUB_TABS = [
    { id: 'active',   label: 'Active',        count: bySub.active.length },
    { id: 'expiring', label: 'Expiring Soon', count: bySub.expiring.length },
    { id: 'expired',  label: 'Expired',       count: bySub.expired.length },
  ]

  const list =
    sub === 'active'   ? bySub.active :
    sub === 'expiring' ? bySub.expiring :
    bySub.expired

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="seg">
        {SUB_TABS.map(s => (
          <button
            key={s.id}
            onClick={() => setSub(s.id)}
            className={`seg-btn ${sub === s.id ? 'active' : ''}`}
          >
            {s.label} · {s.count}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div className="label">
            {list.length} {sub === 'expiring' ? 'expiring soon' : sub}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            disabled={list.length === 0 || bulkRunning}
            onClick={() => bulkExtend(list, 30)}
          >
            {bulkRunning ? <><Loader2 size={13} className="animate-spin" /> Extending…</> : 'Extend all by 30 days'}
          </button>
        </div>

        {list.length === 0 ? (
          <div style={{ padding: 20 }}>
            <EmptyBlock title="Nothing here" desc="No users in this bucket." />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Days left</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map(u => (
                  <tr
                    key={u.uid}
                    style={sub === 'expiring' ? { background: 'rgba(245,158,11,0.05)' } : undefined}
                  >
                    <td style={{ fontWeight: 500 }}>{u.username}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(u.trial.startDate)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(u.trial.endDate)}</td>
                    <td className="mono" style={{ color: 'var(--text-primary)' }}>
                      {Math.max(0, u.trial.daysLeft)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={async () => { await extendOne(u.uid, 30); await load() }}
                      >
                        +30 days
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   NOTIFICATIONS TAB
   ============================================================ */
const NOTIF_TYPES = [
  { id: 'info',    label: 'Info',    icon: Info },
  { id: 'success', label: 'Success', icon: CheckCircle2 },
  { id: 'warning', label: 'Warning', icon: AlertTriangle },
  { id: 'alert',   label: 'Alert',   icon: AlertCircle },
]

function NotificationsTab() {
  const { user: admin } = useAuth()
  const [mode, setMode] = useState('broadcast')  /* broadcast | targeted */
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState('')

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    setLoadingHistory(true); setHistoryError('')
    try {
      const snap = await getDocs(query(
        collection(db, 'admin_notifications'),
        orderBy('createdAt', 'desc'),
        limit(20),
      )).catch(async () => {
        return getDocs(collection(db, 'admin_notifications'))
      })
      const list = []
      snap.forEach(d => list.push({ id: d.id, ...d.data() }))
      /* Fallback sort if orderBy failed */
      list.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || 0
        const tb = b.createdAt?.toMillis?.() || 0
        return tb - ta
      })
      setHistory(list.slice(0, 20))
    } catch (err) {
      setHistoryError(err?.message || 'Failed to load history.')
    } finally {
      setLoadingHistory(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Mode toggle */}
      <div className="seg" style={{ alignSelf: 'flex-start' }}>
        <button
          onClick={() => setMode('broadcast')}
          className={`seg-btn ${mode === 'broadcast' ? 'active' : ''}`}
        >
          Broadcast
        </button>
        <button
          onClick={() => setMode('targeted')}
          className={`seg-btn ${mode === 'targeted' ? 'active' : ''}`}
        >
          Targeted
        </button>
      </div>

      {mode === 'broadcast'
        ? <BroadcastForm adminEmail={admin?.email} onSent={loadHistory} />
        : <TargetedForm adminEmail={admin?.email} onSent={loadHistory} />}

      {/* History */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div className="card-title">Notification history</div>
        </div>
        {loadingHistory ? (
          <div style={{ padding: 20 }}><LoadingBlock /></div>
        ) : historyError ? (
          <div style={{ padding: 20 }}><ErrorBlock error={historyError} /></div>
        ) : history.length === 0 ? (
          <div style={{ padding: 20 }}>
            <EmptyBlock title="Nothing sent yet" desc="Sent notifications will appear here." />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Message</th>
                  <th>Sent to</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td><TypeBadge type={h.type} /></td>
                    <td style={{ fontWeight: 500 }}>{h.title}</td>
                    <td style={{ color: 'var(--text-muted)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.message}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {h.target === 'all' ? `All (${h.recipientCount || '?'})` : h.target}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(h.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function BroadcastForm({ adminEmail, onSent }) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState('info')
  const [link, setLink] = useState('')
  const [progress, setProgress] = useState(null)  /* {sent, total} */
  const [toast, setToast] = useState('')

  const canSend = title.trim() && message.trim() && !progress

  async function send() {
    if (!canSend) return
    try {
      const snap = await getDocs(collection(db, 'users'))
      const uids = []
      snap.forEach(u => uids.push(u.id))
      const total = uids.length
      setProgress({ sent: 0, total })
      const payload = {
        title: title.trim(),
        message: message.trim(),
        type,
        link: link.trim() || null,
        read: false,
      }
      let sent = 0
      for (const uid of uids) {
        try {
          await addDoc(collection(db, 'users', uid, 'notifications'), {
            ...payload,
            createdAt: Timestamp.now(),
          })
        } catch (e) {
          console.warn('[Admin] broadcast fail for', uid, e)
        }
        sent++
        if (sent % 5 === 0 || sent === total) setProgress({ sent, total })
      }
      await addDoc(collection(db, 'admin_notifications'), {
        ...payload,
        target: 'all',
        recipientCount: total,
        sentBy: adminEmail || null,
        createdAt: Timestamp.now(),
      })
      setToast(`Sent to ${total} user${total === 1 ? '' : 's'}.`)
      setTitle(''); setMessage(''); setLink('')
      setProgress(null)
      onSent?.()
      setTimeout(() => setToast(''), 4000)
    } catch (err) {
      console.error('[Admin] broadcast failed:', err)
      setToast('Broadcast failed: ' + (err?.message || err))
      setProgress(null)
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card-header">
        <div className="card-title">Broadcast to all users</div>
      </div>

      <Field label="Title">
        <input
          className="input-field"
          maxLength={60}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Short headline"
        />
      </Field>
      <Field label="Message">
        <textarea
          className="input-field"
          rows={3}
          maxLength={200}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Body text (max 200 chars)"
          style={{ resize: 'vertical' }}
        />
      </Field>
      <Field label="Type">
        <div className="seg">
          {NOTIF_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`seg-btn ${type === t.id ? 'active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Link (optional)">
        <input
          className="input-field"
          value={link}
          onChange={e => setLink(e.target.value)}
          placeholder="/training"
        />
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary"
          disabled={!canSend}
          onClick={send}
        >
          {progress
            ? <><Loader2 size={14} className="animate-spin" /> Sending to {progress.sent}/{progress.total}...</>
            : <><Send size={14} /> Send to all users</>}
        </button>
        {toast && (
          <span style={{
            fontSize: 12,
            color: toast.startsWith('Sent') ? 'var(--green)' : 'var(--red)',
          }}>
            {toast}
          </span>
        )}
      </div>
    </div>
  )
}

function TargetedForm({ adminEmail, onSent }) {
  const [target, setTarget] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState('info')
  const [link, setLink] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')

  const canSend = target.trim() && title.trim() && message.trim() && !sending

  async function send() {
    if (!canSend) return
    setSending(true); setToast('')
    try {
      const t = target.trim()
      let uid = null
      /* Try as an email first */
      if (t.includes('@')) {
        const snap = await getDocs(query(collection(db, 'users'), where('email', '==', t)))
        if (!snap.empty) uid = snap.docs[0].id
      } else {
        /* Treat as UID */
        const snap = await getDoc(doc(db, 'users', t))
        if (snap.exists()) uid = snap.id
      }
      if (!uid) {
        setToast('No user found for that email/UID.')
        return
      }
      const payload = {
        title: title.trim(),
        message: message.trim(),
        type,
        link: link.trim() || null,
        read: false,
      }
      await addDoc(collection(db, 'users', uid, 'notifications'), {
        ...payload,
        createdAt: Timestamp.now(),
      })
      await addDoc(collection(db, 'admin_notifications'), {
        ...payload,
        target: t,
        recipientCount: 1,
        sentBy: adminEmail || null,
        createdAt: Timestamp.now(),
      })
      setToast('Sent.')
      setTarget(''); setTitle(''); setMessage(''); setLink('')
      onSent?.()
    } catch (err) {
      console.error('[Admin] targeted send failed', err)
      setToast('Send failed: ' + (err?.message || err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card-header">
        <div className="card-title">Send to a specific user</div>
      </div>
      <Field label="Send to (email or UID)">
        <input
          className="input-field"
          value={target}
          onChange={e => setTarget(e.target.value)}
          placeholder="user@example.com"
        />
      </Field>
      <Field label="Title">
        <input
          className="input-field"
          maxLength={60}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Short headline"
        />
      </Field>
      <Field label="Message">
        <textarea
          className="input-field"
          rows={3}
          maxLength={200}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Body text (max 200 chars)"
          style={{ resize: 'vertical' }}
        />
      </Field>
      <Field label="Type">
        <div className="seg">
          {NOTIF_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`seg-btn ${type === t.id ? 'active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Link (optional)">
        <input
          className="input-field"
          value={link}
          onChange={e => setLink(e.target.value)}
          placeholder="/training"
        />
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary"
          disabled={!canSend}
          onClick={send}
        >
          {sending
            ? <><Loader2 size={14} className="animate-spin" /> Sending...</>
            : <><Send size={14} /> Send</>}
        </button>
        {toast && (
          <span style={{
            fontSize: 12,
            color: toast === 'Sent.' ? 'var(--green)' : 'var(--red)',
          }}>
            {toast}
          </span>
        )}
      </div>
    </div>
  )
}

function TypeBadge({ type }) {
  const cls =
    type === 'success' ? 'badge badge-green' :
    type === 'warning' ? 'badge badge-amber' :
    type === 'alert'   ? 'badge badge-red'   :
    'badge badge-blue'
  return <span className={cls}>{type || 'info'}</span>
}

/* ============================================================
   WAITLIST TAB
   ============================================================ */
function WaitlistTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError('')
    try {
      let snap
      try {
        snap = await getDocs(query(collection(db, 'waitlist'), orderBy('timestamp', 'desc')))
      } catch {
        snap = await getDocs(collection(db, 'waitlist'))
      }
      const list = []
      snap.forEach(d => {
        const data = d.data() || {}
        list.push({
          id: d.id,
          email: data.email || '',
          signedUpAt: data.timestamp || data.createdAt || null,
        })
      })
      list.sort((a, b) => {
        const ta = a.signedUpAt?.toMillis?.() || new Date(a.signedUpAt || 0).getTime() || 0
        const tb = b.signedUpAt?.toMillis?.() || new Date(b.signedUpAt || 0).getTime() || 0
        return tb - ta
      })
      setItems(list)
    } catch (err) {
      setError(err?.message || 'Failed to load waitlist.')
    } finally {
      setLoading(false)
    }
  }

  async function copyEmail(email, id) {
    try {
      await navigator.clipboard.writeText(email)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch { /* ignore */ }
  }

  async function deleteEntry(id, email) {
    if (!window.confirm(`Delete waitlist entry for ${email}?`)) return
    try {
      await deleteDoc(doc(db, 'waitlist', id))
      await load()
    } catch (err) {
      alert('Could not delete: ' + (err?.message || err))
    }
  }

  function exportCsv() {
    if (items.length === 0) return
    const rows = [['email', 'signedUpAt']]
    items.forEach(i => {
      const d = i.signedUpAt?.toDate?.() || (i.signedUpAt ? new Date(i.signedUpAt) : null)
      rows.push([i.email, d ? d.toISOString() : ''])
    })
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `waitlist-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span className="badge">
          {items.length} total signup{items.length === 1 ? '' : 's'}
        </span>
        <button
          onClick={exportCsv}
          disabled={items.length === 0}
          className="btn btn-secondary btn-sm"
        >
          <Download size={13} /> Export CSV
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {items.length === 0 ? (
          <div style={{ padding: 20 }}>
            <EmptyBlock title="No signups yet" desc="Waitlist submissions from the landing page will appear here." />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Email</th>
                  <th>Signed up</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i, idx) => (
                  <tr key={i.id}>
                    <td style={{ color: 'var(--text-subtle)' }}>{idx + 1}</td>
                    <td>{i.email}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(i.signedUpAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          onClick={() => copyEmail(i.email, i.id)}
                          className="btn btn-secondary btn-sm"
                        >
                          <Copy size={12} /> {copiedId === i.id ? 'Copied' : 'Copy'}
                        </button>
                        <DangerBtn onClick={() => deleteEntry(i.id, i.email)} label={<><Trash2 size={12} /> Delete</>} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   MAINTENANCE TAB
   ============================================================ */
function MaintenanceTab({ adminEmail }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingMsg, setSavingMsg] = useState(false)
  const [message, setMessage] = useState('')
  const [toggling, setToggling] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError('')
    try {
      const snap = await getDoc(doc(db, 'app_config', 'maintenance'))
      if (snap.exists()) {
        const d = snap.data() || {}
        setData(d)
        setMessage(d.message || '')
      } else {
        setData({ isActive: false, message: '' })
        setMessage('')
      }
    } catch (err) {
      setError(err?.message || 'Failed to load maintenance config.')
    } finally {
      setLoading(false)
    }
  }

  async function toggle() {
    const nowActive = !data?.isActive
    if (nowActive && !window.confirm('This will lock out ALL users. Are you sure?')) return
    setToggling(true)
    try {
      const payload = {
        isActive: nowActive,
        message: data?.message || '',
        lastChangedBy: adminEmail || null,
        lastChangedAt: Timestamp.now(),
      }
      await setDoc(doc(db, 'app_config', 'maintenance'), payload, { merge: true })
      await load()
    } catch (err) {
      alert('Toggle failed: ' + (err?.message || err))
    } finally {
      setToggling(false)
    }
  }

  async function saveMessage() {
    setSavingMsg(true)
    try {
      await setDoc(doc(db, 'app_config', 'maintenance'), {
        message: message.trim(),
        lastChangedBy: adminEmail || null,
        lastChangedAt: Timestamp.now(),
      }, { merge: true })
      await load()
    } catch (err) {
      alert('Save failed: ' + (err?.message || err))
    } finally {
      setSavingMsg(false)
    }
  }

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} />

  const isActive = !!data?.isActive

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h3
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontWeight: 400,
              fontSize: 22,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Maintenance Mode
          </h3>
          <span className={isActive ? 'badge badge-red' : 'badge badge-green'}>
            {isActive ? 'LIVE' : 'ONLINE'}
          </span>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
          When enabled, all non-admin users will see the maintenance screen and cannot access the app.
          You and other admins can still log in normally.
        </p>

        <motion.button
          onClick={toggle}
          disabled={toggling}
          animate={{
            backgroundColor: isActive ? 'var(--red)' : 'var(--amber)',
            color: isActive ? '#fff' : '#000',
            borderColor: isActive ? 'var(--red)' : 'var(--amber)',
          }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{
            marginTop: 20,
            width: '100%',
            height: 46,
            border: '1px solid',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 600,
            fontSize: 14,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: toggling ? 'not-allowed' : 'pointer',
            opacity: toggling ? 0.6 : 1,
          }}
        >
          {toggling
            ? <><Loader2 size={14} className="animate-spin" /> Updating...</>
            : isActive ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}
        </motion.button>

        {data?.lastChangedBy && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-subtle)' }}>
            Last changed by <span style={{ color: 'var(--text-muted)' }}>{data.lastChangedBy}</span>
            {data.lastChangedAt && <> · {formatDate(data.lastChangedAt)}</>}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Custom maintenance message</div>
        </div>
        <textarea
          className="input-field"
          rows={3}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Shown to users on the maintenance screen (optional)."
          style={{ resize: 'vertical' }}
        />
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={saveMessage}
            disabled={savingMsg}
          >
            {savingMsg
              ? <><Loader2 size={13} className="animate-spin" /> Saving...</>
              : 'Save message'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   SHARED HELPERS
   ============================================================ */
function StatTile({ icon, value, label }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          width: 34, height: 34,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontWeight: 400,
          fontSize: 38,
          letterSpacing: '0.04em',
          color: 'var(--text-primary)',
          lineHeight: 1,
        }}
      >
        {Number(value ?? 0).toLocaleString()}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function Avatar({ name }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <div
      style={{
        width: 32, height: 32,
        borderRadius: '50%',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 700,
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  )
}

function DangerBtn({ onClick, label }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-elevated)',
        border: `1px solid ${hover ? 'var(--red)' : 'var(--border)'}`,
        color: hover ? 'var(--red)' : 'var(--text-primary)',
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        minHeight: 30,
        transition: 'border-color 0.15s, color 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function LoadingBlock() {
  return (
    <div
      style={{
        padding: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        color: 'var(--text-muted)',
      }}
    >
      <Loader2 size={18} className="animate-spin" />
      <span style={{ fontSize: 13 }}>Loading…</span>
    </div>
  )
}

function ErrorBlock({ error }) {
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <AlertCircle size={18} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Something went wrong</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{error}</div>
      </div>
    </div>
  )
}

function EmptyBlock({ title, desc }) {
  return (
    <div className="empty-state">
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-desc">{desc}</div>
    </div>
  )
}

function formatDate(v) {
  if (!v) return '—'
  let d
  if (v?.toDate) d = v.toDate()
  else d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
