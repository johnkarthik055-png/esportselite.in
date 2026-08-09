import { useEffect, useMemo, useState, useRef } from 'react'
import {
  Pencil, Save, X, User, Mail, Phone, Crosshair, Hash, Moon, Settings,
  Trophy, Camera, Download, Upload, RotateCcw,
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
import { getTrialStatus, formatTrialDate } from '../utils/trial.js'
import { getLevelName } from '../utils/db.js'
import { auth } from '../utils/firebase.js'
import AvatarUploader from '../components/AvatarUploader.jsx'

const FIELDS = [
  { key: 'username', label: 'Username', icon: User, placeholder: 'Your display name' },
  { key: 'email', label: 'Email', icon: Mail, placeholder: 'you@example.com', type: 'email' },
  { key: 'phone', label: 'Phone number', icon: Phone, placeholder: '+91 98765 43210', type: 'tel' },
  { key: 'ign', label: 'IGN (In-game name)', icon: Crosshair, placeholder: 'Your in-game name' },
  { key: 'igId', label: 'IG ID (BGMI UID)', icon: Hash, placeholder: 'Your unique BGMI ID' },
]

const DEFAULT_PROFILE = { username: 'Player', email: '', phone: '', ign: '', igId: '' }

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

export default function Profile() {
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

  const [trial, setTrial] = useState(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!authUser?.uid) { if (!cancelled) setTrial(null); return }
      const status = await getTrialStatus(authUser.uid)
      if (!cancelled) setTrial(status)
    })()
    return () => { cancelled = true }
  }, [authUser?.uid])

  useEffect(() => { if (!editing) setDraft(profile) }, [editing, profile])

  async function save() {
    const cleaned = {
      username: (draft.username || '').trim() || 'Player',
      email: (draft.email || '').trim(),
      phone: (draft.phone || '').trim(),
      ign: (draft.ign || '').trim(),
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
  function resetLocalData() {
    if (!window.confirm('Reset all local data on this device? This does not affect cloud data.')) return
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

  return (
    <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Edit profile */}
      <div className="card" style={{ maxWidth: 600, width: '100%', alignSelf: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <AvatarUploader username={displayName} onToast={showToast} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="heading" style={{ fontSize: 18 }}>{displayName}</div>
            {profile?.ign && (
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                IGN: {profile.ign}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 2 }}>
              Level {levelNum} — {getLevelName(levelNum)}
            </div>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn btn-secondary btn-sm">
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
                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Icon size={11} /> {f.label}
                </label>
                {editing ? (
                  <input
                    type={f.type || 'text'}
                    value={draft[f.key] || ''}
                    onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="input"
                  />
                ) : (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      color: value ? 'var(--text-primary)' : 'var(--text-subtle)',
                      fontSize: 13,
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

        {editing && (
          <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
            <button onClick={cancel} className="btn btn-secondary">
              <X size={13} /> Cancel
            </button>
            <button onClick={save} className="btn btn-primary">
              <Save size={13} /> Save
            </button>
          </div>
        )}

        {savedToast && (
          <div
            style={{
              marginTop: 14,
              background: 'var(--green-tint)',
              border: '1px solid rgba(0,201,110,0.4)',
              color: 'var(--green)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
            }}
          >
            Profile saved.
          </div>
        )}
      </div>

      {/* Stats summary */}
      <div className="card" style={{ maxWidth: 600, width: '100%', alignSelf: 'center' }}>
        <div className="card-header">
          <div className="card-title">Stats summary</div>
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
          className="section-heading"
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}
        >
          <Trophy size={16} style={{ color: 'var(--text-subtle)' }} /> Rank card
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
          <button onClick={downloadRankCard} disabled={downloading} className="btn btn-primary">
            <Camera size={14} /> {downloading ? 'Saving…' : 'Save as image'}
          </button>
        </div>
      </div>

      {/* Subscription */}
      <div className="card" style={{ maxWidth: 600, width: '100%', alignSelf: 'center' }}>
        <div className="card-header"><div className="card-title">Subscription</div></div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SubRow label="Plan" value="Free Trial" />
          <SubRow label="Started" value={formatTrialDate(trial?.startDate)} />
          <SubRow label="Expires" value={formatTrialDate(trial?.endDate)} />
          <SubRow label="Days left" value={trial?.startDate ? `${trial.daysLeft} day${trial.daysLeft === 1 ? '' : 's'}` : '—'} />
          <SubRow
            label="Status"
            value={
              <span
                className={
                  trial?.active ? 'badge badge-green' :
                  trial?.startDate ? 'badge badge-red' :
                  'badge'
                }
              >
                {trial?.active ? 'Active' : trial?.startDate ? 'Expired' : 'Not started'}
              </span>
            }
          />
        </ul>
      </div>

      {/* Preferences */}
      <div className="card" style={{ maxWidth: 600, width: '100%', alignSelf: 'center' }}>
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={15} style={{ color: 'var(--text-subtle)' }} /> Preferences
          </div>
        </div>
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <Moon size={15} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>AMOLED theme</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
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
              background: amoled ? 'var(--green)' : 'var(--border)',
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
      <div className="card" style={{ maxWidth: 600, width: '100%', alignSelf: 'center' }}>
        <div className="card-header"><div className="card-title">Data management</div></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={exportData} className="btn btn-secondary btn-sm">
            <Download size={13} /> Export
          </button>
          <button onClick={importData} className="btn btn-secondary btn-sm">
            <Upload size={13} /> Import
          </button>
          <ResetButton onClick={resetLocalData} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 12 }}>
          Reset clears local cache on this device only. Your cloud data stays intact.
        </div>
      </div>

      {toast && (
        <div className="toast-container">
          <div className="toast-item">{toast}</div>
        </div>
      )}
    </div>
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
        borderRadius: 'var(--radius-sm)',
        background: 'transparent',
        border: `1px solid ${hover ? 'var(--red)' : 'var(--border)'}`,
        color: hover ? 'var(--red)' : 'var(--text-subtle)',
        fontFamily: 'DM Sans, sans-serif',
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
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '12px',
      }}
    >
      <div className="stat-number" style={{ fontSize: 18 }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
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
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
      }}
    >
      <span className="label">{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{value}</span>
    </li>
  )
}
