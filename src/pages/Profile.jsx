import { useEffect, useMemo, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Pencil, Save, X, User, Mail, Phone, Crosshair, Hash, Moon, Settings,
  Trophy, Camera, Download, Upload, RotateCcw, Plus,
} from 'lucide-react'
import { updateProfile } from 'firebase/auth'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { STORAGE_KEYS } from '../utils/constants.js'
import { useStats } from '../hooks/useStats.js'
import { useStreak } from '../hooks/useStreak.js'
import { useTheme } from '../hooks/useTheme.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getXP, getLevelFor } from '../utils/xp.js'
import { formatPracticeTime } from '../utils/helpers.js'
import { getDisplayName } from '../utils/storage.js'
import { useSubscription } from '../hooks/useSubscription.js'
import { getLevelName } from '../utils/db.js'
import { auth } from '../utils/firebase.js'
import AvatarUploader from '../components/AvatarUploader.jsx'
import { seedTestData } from '../utils/seedTestData.js'
import { useConfirm } from '../hooks/useConfirm.js'
import ConfirmModal from '../components/ConfirmModal.jsx'

const FIELDS = [
  { key: 'username', label: 'Username', icon: User, placeholder: 'Your display name' },
  { key: 'email', label: 'Email', icon: Mail, placeholder: 'you@example.com', type: 'email' },
  { key: 'phone', label: 'Phone number', icon: Phone, placeholder: '+91 98765 43210', type: 'tel' },
  { key: 'igId', label: 'IG ID (BGMI UID)', icon: Hash, placeholder: 'Your unique BGMI ID' },
]

const DEFAULT_PROFILE = { username: 'Player', email: '', phone: '', ign: '', igId: '', igns: [] }
const MAX_IGNS = 3

/* Players use several in-game names across matches. `igns` is the
   source of truth (1–3 entries); legacy single `ign` is kept in sync
   as igns[0] so older screens keep working. */
function normalizeIgns(p) {
  const arr = Array.isArray(p?.igns) ? p.igns : []
  const cleaned = arr.map(s => String(s || '').trim()).filter(Boolean)
  if (cleaned.length) return cleaned.slice(0, MAX_IGNS)
  return p?.ign ? [String(p.ign).trim()] : []
}

function longestStreakFrom(daily) {
  if (!daily || typeof daily !== 'object') return 0
  const days = Object.entries(daily)
    .filter(([, v]) => v && v.status === 'completed')
    .map(([k]) => k).sort()
  if (!days.length) return 0
  let best = 1, run = 1
  for (let i = 1; i < days.length; i++) {
    const a = new Date(days[i - 1]); a.setHours(0,0,0,0)
    const b = new Date(days[i]);     b.setHours(0,0,0,0)
    const diff = Math.round((b - a) / 86400000)
    if (diff === 1) { run += 1; if (run > best) best = run } else run = 1
  }
  return best
}

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E5EAF3',
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
}

export default function Profile() {
  const { confirm, confirmModalProps } = useConfirm()
  const [profile, setProfile] = useLocalStorage(STORAGE_KEYS.USER, DEFAULT_PROFILE)
  const [matches] = useLocalStorage(STORAGE_KEYS.MATCHES, [])
  const [sessions] = useLocalStorage(STORAGE_KEYS.SESSIONS, [])
  const [dailySess] = useLocalStorage(STORAGE_KEYS.DAILY_SESSIONS, {})
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile)
  const [savedToast, setSavedToast] = useState(false)
  const stats = useStats()
  const streak = useStreak()
  const [theme, setTheme] = useTheme()
  const [toast, setToast] = useState('')
  const { user: authUser, refreshUser } = useAuth()
  const displayName = getDisplayName()
  const { plan, isActive, expiresAt } = useSubscription()

  useEffect(() => {
    if (!editing) {
      const seeded = normalizeIgns(profile)
      setDraft({ ...profile, igns: seeded.length ? seeded : [''] })
    }
  }, [editing, profile])

  /* draft.igns is a RAW array while editing (may hold blank rows);
     it's only trimmed/filtered on save. */
  const draftIgns = Array.isArray(draft.igns) ? draft.igns : ['']
  const ignList = editing
    ? draftIgns.map(s => String(s || '').trim()).filter(Boolean)
    : normalizeIgns(profile)

  function setIgnAt(i, val) {
    setDraft(d => {
      const igns = [...(Array.isArray(d.igns) ? d.igns : [''])]
      igns[i] = val
      return { ...d, igns }
    })
  }
  function addIgn() {
    setDraft(d => {
      const igns = Array.isArray(d.igns) ? d.igns : ['']
      if (igns.length >= MAX_IGNS) return d
      return { ...d, igns: [...igns, ''] }
    })
  }
  function removeIgnAt(i) {
    setDraft(d => {
      const igns = (Array.isArray(d.igns) ? d.igns : ['']).filter((_, idx) => idx !== i)
      return { ...d, igns: igns.length ? igns : [''] }
    })
  }

  async function save() {
    const igns = (Array.isArray(draft.igns) ? draft.igns : [])
      .map(s => String(s || '').trim())
      .filter(Boolean)
      .slice(0, MAX_IGNS)
    const cleaned = {
      username: (draft.username || '').trim() || 'Player',
      email: (draft.email || '').trim(),
      phone: (draft.phone || '').trim(),
      igns,
      ign: igns[0] || '',
      igId: (draft.igId || '').trim(),
    }
    setProfile(cleaned)
    if (auth.currentUser) {
      try {
        await updateProfile(auth.currentUser, { displayName: cleaned.username })
        await auth.currentUser.reload()
        if (refreshUser) await refreshUser()
      } catch { /* non-fatal */ }
    }
    setEditing(false)
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2500)
  }

  function cancel() { setDraft(profile); setEditing(false) }
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 4000) }

  const xp = getXP()
  const level = getLevelFor(xp)
  const levelNum = level.level
  const nextLevelXP = level.ceil || xp
  const xpProgressPct = Math.min((xp / Math.max(1, nextLevelXP)) * 100, 100)
  const longestStreak = useMemo(() => longestStreakFrom(dailySess), [dailySess])
  const scrimAvg = useMemo(() => {
    const scrims = (Array.isArray(matches) ? matches : []).filter(m => m.type === 'Scrims' || m.type === 'Tournament')
    if (!scrims.length) return '0.0'
    const total = scrims.reduce((s, m) => s + (Number(m.individualKills) || 0), 0)
    return (total / scrims.length).toFixed(1)
  }, [matches])

  const rankCardRef = useRef(null)
  const [downloading, setDownloading] = useState(false)

  const downloadRankCard = async () => {
    const card = document.getElementById('rank-card')
    if (!card) return
    setDownloading(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(card, {
        scale: 2, useCORS: true, allowTaint: true,
        backgroundColor: '#0A0A0F',
        width: 400, height: 220,
        scrollX: 0, scrollY: 0,
        windowWidth: 400, windowHeight: 220,
        logging: false, imageTimeout: 0,
        onclone: (doc) => {
          const el = doc.getElementById('rank-card')
          if (el) el.style.fontFamily = 'Bebas Neue, sans-serif'
        },
      })
      const link = document.createElement('a')
      const username = (authUser?.displayName || displayName || 'player')
        .replace(/\s+/g, '_').replace(/[^\w-]/g, '').toLowerCase()
      link.download = `esports-elite-${username}-rank.png`
      link.href = canvas.toDataURL('image/png', 1.0)
      link.click()
    } catch (error) {
      console.error('Download error:', error)
    } finally { setDownloading(false) }
  }

  const streakCount = streak?.current || 0
  const sessionsCount = sessions?.length || stats.totalSessions || 0
  const matchesCount = matches?.length || 0
  const amoled = theme === 'amoled'

  function exportData() {
    try {
      const dump = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('esportselite_')) dump[k] = localStorage.getItem(k)
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `esports-elite-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Data exported.')
    } catch { showToast('Export failed.') }
  }
  function importData() {
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = 'application/json'
    inp.onchange = async () => {
      const file = inp.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        Object.entries(data).forEach(([k, v]) => {
          if (typeof k === 'string' && k.startsWith('esportselite_')) localStorage.setItem(k, v)
        })
        showToast('Data imported. Reloading…')
        setTimeout(() => window.location.reload(), 800)
      } catch { showToast('Invalid backup file.') }
    }
    inp.click()
  }
  async function resetLocalData() {
    if (!await confirm('Reset all local data on this device? This does not affect cloud data.')) return
    try {
      const toRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('esportselite_')) toRemove.push(k)
      }
      toRemove.forEach(k => localStorage.removeItem(k))
      showToast('Local data cleared. Reloading…')
      setTimeout(() => window.location.reload(), 800)
    } catch { showToast('Reset failed.') }
  }

  const btnPrimary = { background: '#2563FF', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }
  const btnSecondary = { background: '#FFFFFF', color: '#0B1224', border: '1px solid #E5EAF3', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }
  const btnSm = { padding: '6px 12px', fontSize: 12 }
  const inputStyle = { background: '#FFFFFF', border: '1px solid #E5EAF3', borderRadius: 8, padding: '10px 12px', fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#0B1224', width: '100%', outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }

  return (
    <>
    <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Standard Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: 'linear-gradient(135deg, #F7F9FD 0%, #EEF4FF 60%, #FFF0F2 100%)',
          borderRadius: 16, padding: 32, position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(37,99,255,0.06) 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: -60, left: -60, width: 300, height: 300, background: 'radial-gradient(circle, rgba(37,99,255,0.1) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: -40, right: -40, width: 250, height: 250, background: 'radial-gradient(circle, rgba(239,51,64,0.07) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11, color: '#2563FF', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Account</div>
          <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 48, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1, margin: 0 }}>Profile</h1>
          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: 64, height: 3, background: 'linear-gradient(90deg,#2563FF,#EF3340)', transformOrigin: 'left', borderRadius: 2, marginTop: 12, marginBottom: 12 }}
          />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#64748B', margin: 0 }}>Manage your player identity and preferences.</p>
        </div>
      </motion.div>

      {/* Edit profile */}
      <div style={{ ...cardStyle, maxWidth: 600, width: '100%', alignSelf: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <AvatarUploader username={displayName} onToast={showToast} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 18, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{displayName}</div>
            {ignList.length > 0 && (
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#475569', marginTop: 2 }}>
                IGN: {ignList.join(' · ')}
              </div>
            )}
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#64748B', marginTop: 2 }}>
              Level {levelNum} — {getLevelName(levelNum)}
            </div>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} style={{ ...btnSecondary, ...btnSm }}>
              <Pencil size={13} /> Edit
            </button>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          {FIELDS.map(f => {
            const Icon = f.icon
            const value = editing ? draft[f.key] : profile?.[f.key]
            return (
              <div key={f.key}>
                <label style={labelStyle}>
                  <Icon size={11} /> {f.label}
                </label>
                {editing ? (
                  <input
                    type={f.type || 'text'}
                    value={draft[f.key] || ''}
                    onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={inputStyle}
                  />
                ) : (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: '#F8FAFD',
                      border: '1px solid #E5EAF3',
                      color: value ? '#0B1224' : '#94A3B8',
                      fontSize: 13,
                      fontFamily: 'Inter, sans-serif',
                      minHeight: 40,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {value || <span style={{ fontStyle: 'italic' }}>Not set</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* In-game names (IGNs) — up to 3. Used by AI features to identify
            which player in a screenshot is you. */}
        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>
            <Crosshair size={11} /> In-game names (IGNs) — up to {MAX_IGNS}
          </label>

          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {draftIgns.map((val, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={val}
                    onChange={e => setIgnAt(i, e.target.value)}
                    placeholder={i === 0 ? 'Primary in-game name' : `Alternate name ${i + 1}`}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  {draftIgns.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeIgnAt(i)}
                      style={{ ...btnSecondary, ...btnSm }}
                      aria-label={`Remove IGN ${i + 1}`}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addIgn}
                disabled={draftIgns.length >= MAX_IGNS}
                style={{ ...btnSecondary, ...btnSm, alignSelf: 'flex-start' }}
              >
                <Plus size={13} /> Add IGN
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ignList.length ? (
                ignList.map((name, i) => (
                  <span
                    key={i}
                    style={{ background: '#F8FAFD', border: '1px solid #E5EAF3', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontFamily: 'Inter, sans-serif', color: '#0B1224' }}
                  >
                    {name}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: 13, color: '#94A3B8', fontStyle: 'italic', fontFamily: 'Inter, sans-serif' }}>Not set</span>
              )}
            </div>
          )}
        </div>

        {editing && (
          <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
            <button onClick={cancel} style={btnSecondary}>
              <X size={13} /> Cancel
            </button>
            <button onClick={save} style={btnPrimary}>
              <Save size={13} /> Save
            </button>
          </div>
        )}

        {savedToast && (
          <div
            style={{
              marginTop: 14,
              background: '#F0FDF4',
              border: '1px solid rgba(22,163,74,0.3)',
              color: '#16A34A',
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Profile saved.
          </div>
        )}
      </div>

      {/* Stats summary */}
      <div style={{ ...cardStyle, maxWidth: 600, width: '100%', alignSelf: 'center' }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 16, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stats summary</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <Summary label="Practice" value={formatPracticeTime(stats.totalSeconds)} />
          <Summary label="Drills" value={stats.totalSessions} />
          <Summary label="Matches" value={stats.matchCount} />
          <Summary label="Best streak" value={`${longestStreak}d`} />
          <Summary label={level.name} value={`Level ${level.level}`} />
          <Summary label="Avg K / scrim" value={scrimAvg} />
        </div>
      </div>

      {/* Rank card */}
      <div style={{ maxWidth: 600, width: '100%', alignSelf: 'center' }}>
        <h3
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B' }}
        >
          <Trophy size={16} style={{ color: '#64748B' }} /> Rank card
        </h3>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            id="rank-card"
            ref={rankCardRef}
            style={{
              position: 'relative',
              width: '400px',
              height: '220px',
              background: '#0A0A0F',
              borderRadius: '12px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
              boxSizing: 'border-box',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src="/assets/logo.png"
                style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                alt=""
                crossOrigin="anonymous"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              <div>
                <div
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    fontWeight: 400,
                    fontSize: '22px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#F0F0F8',
                  }}
                >
                  {displayName}
                </div>
                <div
                  style={{
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: '11px',
                    color: '#8888A8',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Level {levelNum} — {getLevelName(levelNum)}
                </div>
              </div>
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  color: '#8888A8',
                  marginBottom: '6px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                <span>XP Progress</span><span>{xp} XP</span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '4px',
                  background: '#1C1C26',
                  borderRadius: '999px',
                }}
              >
                <div
                  style={{
                    width: `${xpProgressPct}%`,
                    height: '100%',
                    background: '#E8001C',
                    borderRadius: '999px',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
              {[
                ['STREAK', `${streakCount} days`],
                ['SESSIONS', sessionsCount],
                ['MATCHES', matchesCount],
              ].map(([label, value]) => (
                <div key={label}>
                  <div
                    style={{
                      fontFamily: 'Bebas Neue, sans-serif',
                      fontWeight: 400,
                      fontSize: '22px',
                      letterSpacing: '0.04em',
                      color: '#F0F0F8',
                    }}
                  >
                    {value}
                  </div>
                  <div
                    style={{
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: '9px',
                      color: '#44445A',
                      letterSpacing: '0.10em',
                      textTransform: 'uppercase',
                      marginTop: 2,
                    }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                fontFamily: 'DM Sans, sans-serif',
                position: 'absolute',
                bottom: '12px',
                right: '16px',
                fontSize: '9px',
                color: '#2A2A40',
                letterSpacing: '0.10em',
              }}
            >
              esportselite.in
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <button onClick={downloadRankCard} disabled={downloading} style={btnPrimary}>
            <Camera size={14} /> {downloading ? 'Saving…' : 'Save as image'}
          </button>
        </div>
      </div>

      {/* Subscription */}
      <div style={{ ...cardStyle, maxWidth: 600, width: '100%', alignSelf: 'center' }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 16, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subscription</div>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SubRow label="Plan" value={plan === 'pro' ? 'Pro' : 'Free'} />
          {isActive && <SubRow label="Renews" value={formatSubDate(expiresAt)} />}
          <SubRow
            label="Status"
            value={
              <span style={{ background: isActive ? '#DCFCE7' : '#F1F5F9', color: isActive ? '#16A34A' : '#64748B', border: `1px solid ${isActive ? 'rgba(22,163,74,0.2)' : '#E5EAF3'}`, borderRadius: 20, padding: '2px 12px', fontSize: 11, fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {isActive ? 'Active' : 'Free'}
              </span>
            }
          />
        </ul>
      </div>

      {/* Preferences */}
      <div style={{ ...cardStyle, maxWidth: 600, width: '100%', alignSelf: 'center' }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 16, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={15} style={{ color: '#64748B' }} /> Preferences
          </div>
        </div>
        <div
          style={{
            background: '#F8FAFD',
            border: '1px solid #E5EAF3',
            borderRadius: 8,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <Moon size={15} style={{ color: '#64748B', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#0B1224' }}>AMOLED theme</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#475569', marginTop: 2 }}>
                Pure black backgrounds — better battery on OLED screens.
              </div>
            </div>
          </div>
          <button
            onClick={() => setTheme(amoled ? 'dark' : 'amoled')}
            aria-pressed={amoled}
            style={{
              width: 40, height: 22,
              borderRadius: 999,
              background: amoled ? '#16A34A' : '#E5EAF3',
              border: 'none', cursor: 'pointer',
              position: 'relative', transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: 'absolute', top: 3, left: amoled ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }}
            />
          </button>
        </div>
      </div>

      {/* Data management */}
      <div style={{ ...cardStyle, maxWidth: 600, width: '100%', alignSelf: 'center' }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 16, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Data management</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={exportData} style={{ ...btnSecondary, ...btnSm }}>
            <Download size={13} /> Export
          </button>
          <button onClick={importData} style={{ ...btnSecondary, ...btnSm }}>
            <Upload size={13} /> Import
          </button>
          <ResetButton onClick={resetLocalData} />
          {import.meta.env.DEV && ['karthikreddyy2010@gmail.com', 'johnkarthik055@gmail.com'].includes(authUser?.email) && (
            <button
              onClick={async () => {
                if (!authUser?.uid) { showToast('Not signed in.'); return }
                try {
                  const result = await seedTestData(authUser.uid)
                  alert(`Added ${result.sessionsAdded} sessions and ${result.matchesAdded} matches!`)
                  window.location.reload()
                } catch (e) {
                  console.error('Seed failed:', e)
                  showToast('Seed failed: ' + e.message)
                }
              }}
              style={{
                marginTop: 20, padding: '10px 20px',
                background: '#7C3AED', color: 'white',
                borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 13, fontWeight: 600,
              }}
            >
              🧪 Seed Test Data (Dev Only)
            </button>
          )}
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#64748B', marginTop: 12 }}>
          Reset clears local cache on this device only. Your cloud data stays intact.
        </div>
      </div>

      {toast && (
        <div className="toast-container">
          <div className="toast-item">{toast}</div>
        </div>
      )}
    </div>
    <ConfirmModal {...confirmModalProps} />
    </>
  )
}

function ResetButton({ onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 12px',
        borderRadius: 8,
        background: 'transparent',
        border: `1px solid ${hover ? '#EF3340' : '#E5EAF3'}`,
        color: hover ? '#EF3340' : '#64748B',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        fontSize: 12,
        cursor: 'pointer',
        minHeight: 30,
        transition: 'border-color 0.15s, color 0.15s',
      }}
    >
      <RotateCcw size={13} /> Reset local data
    </button>
  )
}

function Summary({ label, value }) {
  return (
    <div
      style={{
        background: '#F8FAFD',
        border: '1px solid #E5EAF3',
        borderRadius: 8,
        padding: '12px',
      }}
    >
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 18, color: '#0B1224', letterSpacing: '0.02em' }}>{value}</div>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function formatSubDate(d) {
  if (!d) return '—'
  try {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return '—'
  }
}

function SubRow({ label, value }) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 8,
        background: '#F8FAFD',
        border: '1px solid #E5EAF3',
      }}
    >
      <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B' }}>{label}</span>
      <span style={{ fontSize: 13, fontFamily: 'Inter, sans-serif', color: '#0B1224' }}>{value}</span>
    </li>
  )
}
