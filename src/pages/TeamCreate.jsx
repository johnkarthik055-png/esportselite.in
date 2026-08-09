import { useState } from 'react'
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
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/team')}
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: 10 }}
        >
          <ArrowLeft size={13} /> Back
        </button>
        <h1
          className="heading"
          style={{ fontSize: 32, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <Users size={22} style={{ color: 'var(--text-muted)' }} />
          Team
        </h1>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Create a new team or join an existing one with an invite code.
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
          alignSelf: 'flex-start',
        }}
      >
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
                background: active ? 'var(--bg-elevated)' : 'transparent',
                border: active ? '1px solid var(--border)' : '1px solid transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-subtle)',
                padding: '8px 14px',
                borderRadius: 4,
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 13,
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
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card-header">
          <div className="card-title">Team details</div>
        </div>

        <Field label="Team name*">
          <input
            className="input-field"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            maxLength={30}
            placeholder="e.g. Ashen Reapers"
          />
        </Field>

        <Field label="Team tag* (max 5 chars, uppercase)">
          <input
            className="input-field"
            value={teamTag}
            onChange={e => setTeamTag(e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 5))}
            maxLength={5}
            placeholder="ASHN"
            style={{ letterSpacing: '0.08em' }}
          />
        </Field>

        <Field label="Region*">
          <select
            className="input-field"
            value={region}
            onChange={e => setRegion(e.target.value)}
          >
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>

        <Field label="Description">
          <textarea
            className="input-field"
            rows={3}
            maxLength={200}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Short bio, playstyle, tournaments…"
            style={{ resize: 'vertical' }}
          />
        </Field>

        <Toggle
          label="Public team"
          desc={isPublic
            ? 'Anyone with the invite code can join.'
            : 'Private — only people you share the code with.'}
          value={isPublic}
          onChange={setIsPublic}
        />
      </div>

      {/* Profile card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card-header">
          <div className="card-title">Your profile in the team</div>
        </div>

        <Field label="IGN*">
          <input
            className="input-field"
            value={ign}
            onChange={e => setIgn(e.target.value)}
            placeholder="Your in-game name"
          />
        </Field>

        <Field label="BGMI UID*">
          <input
            className="input-field"
            value={bgmiUid}
            onChange={e => setBgmiUid(e.target.value)}
            placeholder="Your BGMI unique ID"
          />
        </Field>

        <Field label="In-game role*">
          <select
            className="input-field"
            value={inGameRole}
            onChange={e => setInGameRole(e.target.value)}
          >
            {IN_GAME_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>

        <Field label="Device">
          <input
            className="input-field"
            value={device}
            onChange={e => setDevice(e.target.value)}
            placeholder="e.g. iPhone 13"
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="FPS">
            <select
              className="input-field"
              value={fps}
              onChange={e => setFps(e.target.value)}
            >
              {FPS_OPTIONS.map(f => <option key={f} value={f}>{f} FPS</option>)}
            </select>
          </Field>
          <Field label="Gyroscope">
            <Toggle
              inline
              value={gyro}
              onChange={setGyro}
              label={gyro ? 'On' : 'Off'}
            />
          </Field>
        </div>
      </div>

      {err && (
        <div
          style={{
            background: 'var(--red-ghost)',
            border: '1px solid rgba(232,0,28,0.25)',
            color: 'var(--red)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            gridColumn: '1 / -1',
          }}
        >
          <AlertCircle size={14} /> {err}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, gridColumn: '1 / -1' }}>
        <button type="submit" disabled={!canSubmit} className="btn btn-primary">
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
    <form
      onSubmit={submit}
      style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560 }}
    >
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card-header">
          <div className="card-title">Invite code</div>
        </div>

        <Field label="Enter invite code (6 chars)">
          <input
            className="input-field"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 6))}
            maxLength={6}
            placeholder="XXXXXX"
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 22,
              letterSpacing: '0.3em',
              textAlign: 'center',
            }}
          />
        </Field>

        <div
          style={{
            display: 'flex',
            gap: 8,
            fontSize: 12,
            color: 'var(--text-subtle)',
            alignItems: 'flex-start',
          }}
        >
          <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Ask your team owner for the 6-character invite code shown on their team page.</span>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card-header">
          <div className="card-title">Your profile in the team</div>
        </div>

        <Field label="IGN*">
          <input
            className="input-field"
            value={ign}
            onChange={e => setIgn(e.target.value)}
            placeholder="Your in-game name"
          />
        </Field>

        <Field label="BGMI UID*">
          <input
            className="input-field"
            value={bgmiUid}
            onChange={e => setBgmiUid(e.target.value)}
            placeholder="Your BGMI unique ID"
          />
        </Field>

        <Field label="In-game role">
          <select
            className="input-field"
            value={inGameRole}
            onChange={e => setInGameRole(e.target.value)}
          >
            {IN_GAME_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>

        <Field label="Device">
          <input
            className="input-field"
            value={device}
            onChange={e => setDevice(e.target.value)}
            placeholder="e.g. iPhone 13"
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="FPS">
            <select
              className="input-field"
              value={fps}
              onChange={e => setFps(e.target.value)}
            >
              {FPS_OPTIONS.map(f => <option key={f} value={f}>{f} FPS</option>)}
            </select>
          </Field>
          <Field label="Gyroscope">
            <Toggle
              inline
              value={gyro}
              onChange={setGyro}
              label={gyro ? 'On' : 'Off'}
            />
          </Field>
        </div>
      </div>

      {err && (
        <div
          style={{
            background: 'var(--red-ghost)',
            border: '1px solid rgba(232,0,28,0.25)',
            color: 'var(--red)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={14} /> {err}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={!canSubmit} className="btn btn-primary">
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
      <label className="label" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
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
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
          {label}
        </div>
        {desc && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
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
          background: value ? 'var(--green)' : 'var(--border)',
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
