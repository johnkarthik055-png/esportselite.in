import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Users, Plus, LogIn, Loader2, AlertCircle, ArrowLeft, Info,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { createTeam, joinTeamByCode } from '../utils/team.js'
import { useUserTeamId } from '../hooks/useTeam.js'

const REGIONS = [
  'India - North',
  'India - South',
  'India - East',
  'India - West',
  'India - Central',
  'Other',
]

const IN_GAME_ROLES = [
  'Fragger', 'IGL', 'Support', 'Sniper', 'Rusher', 'All-rounder',
]

const FPS_OPTIONS = ['60', '90']

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E5EAF3',
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
}

const inputStyle = {
  background: '#FFFFFF',
  border: '1px solid #E5EAF3',
  borderRadius: 8,
  padding: '10px 12px',
  fontFamily: 'Inter, sans-serif',
  fontSize: 13,
  color: '#0B1224',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

const btnPrimary = {
  background: '#2563FF', color: '#fff', border: 'none', borderRadius: 8,
  padding: '10px 20px', fontSize: 13, fontFamily: 'Inter, sans-serif',
  fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
}

const btnSecondary = {
  background: '#FFFFFF', color: '#0B1224', border: '1px solid #E5EAF3', borderRadius: 8,
  padding: '8px 14px', fontSize: 13, fontFamily: 'Inter, sans-serif',
  fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
}

const labelStyle = {
  fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11,
  textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B',
  display: 'block', marginBottom: 6,
}

export default function TeamCreate() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { teamId: existingTeamId, loading: teamLoading } = useUserTeamId()
  const [tab, setTab] = useState('create')

  /* Redirect if the user is already in a team. */
  if (!teamLoading && existingTeamId) {
    navigate('/team', { replace: true })
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-transition">
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
          <button
            onClick={() => navigate('/team')}
            style={{ background: 'transparent', border: 'none', color: '#2563FF', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, marginBottom: 12 }}
          >
            <ArrowLeft size={13} /> Back to Team
          </button>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11, color: '#2563FF', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Squad</div>
          <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 48, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Users size={36} style={{ color: '#2563FF' }} /> Team
          </h1>
          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: 64, height: 3, background: 'linear-gradient(90deg,#2563FF,#EF3340)', transformOrigin: 'left', borderRadius: 2, marginTop: 12, marginBottom: 12 }}
          />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#64748B', margin: 0 }}>Create a new team or join an existing one with an invite code.</p>
        </div>
      </motion.div>

      {/* Premium Tab Switcher */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E5EAF3', borderRadius: 12, padding: 4, display: 'inline-flex', gap: 4, alignSelf: 'flex-start' }}>
        {[
          { id: 'create', label: 'Create Team', icon: Plus },
          { id: 'join',   label: 'Join Team',   icon: LogIn },
        ].map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: active ? 'linear-gradient(135deg,#2563FF,#5B3DF5)' : 'transparent',
                border: 'none',
                color: active ? '#fff' : '#475569',
                padding: '8px 16px',
                borderRadius: 8,
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: active ? '0 4px 12px rgba(37,99,255,0.25)' : 'none',
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'create'
        ? <CreateTab uid={user?.uid} onDone={() => navigate('/team')} />
        : <JoinTab uid={user?.uid} onDone={() => navigate('/team')} />}
    </div>
  )
}

/* ============================================================
   CREATE TAB
   ============================================================ */
function CreateTab({ uid, onDone }) {
  const [teamName, setTeamName] = useState('')
  const [teamTag, setTeamTag] = useState('')
  const [region, setRegion] = useState(REGIONS[0])
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)

  const [ign, setIgn] = useState('')
  const [bgmiUid, setBgmiUid] = useState('')
  const [inGameRole, setInGameRole] = useState('All-rounder')
  const [device, setDevice] = useState('')
  const [fps, setFps] = useState('60')
  const [gyro, setGyro] = useState(false)

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const canSubmit =
    teamName.trim().length > 0 &&
    teamTag.trim().length > 0 &&
    ign.trim().length > 0 &&
    bgmiUid.trim().length > 0 &&
    !busy

  async function submit(e) {
    e.preventDefault()
    if (!uid) { setErr('Not signed in'); return }
    if (!canSubmit) return
    setErr(''); setBusy(true)
    try {
      await createTeam(uid,
        { ign, bgmiUid, inGameRole, device, fps, gyro },
        { name: teamName, tag: teamTag, region, description, isPublic },
      )
      onDone()
    } catch (e2) {
      setErr(e2?.message || 'Could not create team.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{ display: 'grid', gap: 20, gridTemplateColumns: '1fr' }}
      className="team-create-grid"
    >
      {/* Team card */}
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 16, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Team details</div>
        </div>

        <Field label="Team name*">
          <input style={inputStyle} value={teamName} onChange={e => setTeamName(e.target.value)} maxLength={30} placeholder="e.g. Ashen Reapers" />
        </Field>

        <Field label="Team tag* (max 5 chars, uppercase)">
          <input style={{ ...inputStyle, letterSpacing: '0.08em' }} value={teamTag} onChange={e => setTeamTag(e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 5))} maxLength={5} placeholder="ASHN" />
        </Field>

        <Field label="Region*">
          <select style={inputStyle} value={region} onChange={e => setRegion(e.target.value)}>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>

        <Field label="Description">
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} maxLength={200} value={description} onChange={e => setDescription(e.target.value)} placeholder="Short bio, playstyle, tournaments…" />
        </Field>

        <Toggle
          label="Public team"
          desc={isPublic ? 'Anyone with the invite code can join.' : 'Private — only people you share the code with.'}
          value={isPublic}
          onChange={setIsPublic}
        />
      </div>

      {/* Profile card */}
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 16, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your profile in the team</div>
        </div>

        <Field label="IGN*">
          <input style={inputStyle} value={ign} onChange={e => setIgn(e.target.value)} placeholder="Your in-game name" />
        </Field>

        <Field label="BGMI UID*">
          <input style={inputStyle} value={bgmiUid} onChange={e => setBgmiUid(e.target.value)} placeholder="Your BGMI unique ID" />
        </Field>

        <Field label="In-game role*">
          <select style={inputStyle} value={inGameRole} onChange={e => setInGameRole(e.target.value)}>
            {IN_GAME_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>

        <Field label="Device">
          <input style={inputStyle} value={device} onChange={e => setDevice(e.target.value)} placeholder="e.g. iPhone 13" />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="FPS">
            <select style={inputStyle} value={fps} onChange={e => setFps(e.target.value)}>
              {FPS_OPTIONS.map(f => <option key={f} value={f}>{f} FPS</option>)}
            </select>
          </Field>
          <Field label="Gyroscope">
            <Toggle inline value={gyro} onChange={setGyro} label={gyro ? 'On' : 'Off'} />
          </Field>
        </div>
      </div>

      {err && (
        <div style={{ background: '#FFF0F2', border: '1px solid rgba(239,51,64,0.25)', color: '#EF3340', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, gridColumn: '1 / -1' }}>
          <AlertCircle size={14} /> {err}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, gridColumn: '1 / -1' }}>
        <button type="submit" disabled={!canSubmit} style={{ ...btnPrimary, opacity: canSubmit ? 1 : 0.5 }}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><Plus size={14} /> Create Team</>}
        </button>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .team-create-grid {
            grid-template-columns: 1fr 1fr !important;
            align-items: start;
          }
        }
        .animate-spin { animation: ee-tc-spin 0.9s linear infinite; }
        @keyframes ee-tc-spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  )
}

/* ============================================================
   JOIN TAB
   ============================================================ */
function JoinTab({ uid, onDone }) {
  const [code, setCode] = useState('')
  const [ign, setIgn] = useState('')
  const [bgmiUid, setBgmiUid] = useState('')
  const [inGameRole, setInGameRole] = useState('All-rounder')
  const [device, setDevice] = useState('')
  const [fps, setFps] = useState('60')
  const [gyro, setGyro] = useState(false)

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const canSubmit =
    code.trim().length === 6 &&
    ign.trim().length > 0 &&
    bgmiUid.trim().length > 0 &&
    !busy

  async function submit(e) {
    e.preventDefault()
    if (!uid) { setErr('Not signed in'); return }
    if (!canSubmit) return
    setErr(''); setBusy(true)
    try {
      await joinTeamByCode(uid,
        { ign, bgmiUid, inGameRole, device, fps, gyro },
        code,
      )
      onDone()
    } catch (e2) {
      setErr(e2?.message || 'Could not join team.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560 }}>
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 16, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Invite code</div>
        </div>

        <Field label="Enter invite code (6 chars)">
          <input
            style={{ ...inputStyle, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 22, letterSpacing: '0.3em', textAlign: 'center' }}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 6))}
            maxLength={6}
            placeholder="XXXXXX"
          />
        </Field>

        <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#64748B', alignItems: 'flex-start' }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontFamily: 'Inter, sans-serif' }}>Ask your team owner for the 6-character invite code shown on their team page.</span>
        </div>
      </div>

      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 16, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your profile in the team</div>
        </div>

        <Field label="IGN*">
          <input style={inputStyle} value={ign} onChange={e => setIgn(e.target.value)} placeholder="Your in-game name" />
        </Field>

        <Field label="BGMI UID*">
          <input style={inputStyle} value={bgmiUid} onChange={e => setBgmiUid(e.target.value)} placeholder="Your BGMI unique ID" />
        </Field>

        <Field label="In-game role">
          <select style={inputStyle} value={inGameRole} onChange={e => setInGameRole(e.target.value)}>
            {IN_GAME_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>

        <Field label="Device">
          <input style={inputStyle} value={device} onChange={e => setDevice(e.target.value)} placeholder="e.g. iPhone 13" />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="FPS">
            <select style={inputStyle} value={fps} onChange={e => setFps(e.target.value)}>
              {FPS_OPTIONS.map(f => <option key={f} value={f}>{f} FPS</option>)}
            </select>
          </Field>
          <Field label="Gyroscope">
            <Toggle inline value={gyro} onChange={setGyro} label={gyro ? 'On' : 'Off'} />
          </Field>
        </div>
      </div>

      {err && (
        <div style={{ background: '#FFF0F2', border: '1px solid rgba(239,51,64,0.25)', color: '#EF3340', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={14} /> {err}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={!canSubmit} style={{ ...btnPrimary, opacity: canSubmit ? 1 : 0.5 }}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Joining…</> : <><LogIn size={14} /> Join Team</>}
        </button>
      </div>

      <style>{`
        .animate-spin { animation: ee-tc-spin 0.9s linear infinite; }
        @keyframes ee-tc-spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  )
}

/* ============================================================
   SHARED
   ============================================================ */
function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, desc, value, onChange, inline }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: inline ? '10px 12px' : '12px 14px',
        background: '#F8FAFD',
        border: '1px solid #E5EAF3',
        borderRadius: 8,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#0B1224', fontWeight: 500 }}>
          {label}
        </div>
        {desc && (
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#475569', marginTop: 2 }}>
            {desc}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        aria-pressed={value}
        style={{
          width: 40, height: 22, borderRadius: 999,
          background: value ? '#16A34A' : '#E5EAF3',
          border: 'none', cursor: 'pointer',
          position: 'relative', transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute', top: 3, left: value ? 21 : 3,
            width: 16, height: 16, borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s',
          }}
        />
      </button>
    </div>
  )
}
