import { useEffect, useRef, useState } from 'react'
import {
  Settings, Save, AlertTriangle, Crown, Trash2, Loader2,
  AlertCircle, LogOut, Upload, ImageIcon,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  updateTeam, transferOwnership, deleteTeam, leaveTeam,
} from '../../utils/team.js'
import {
  notifyTeamMembers, sendTeamNotification, TEAM_NOTIFICATIONS,
} from '../../utils/notifications.js'

const REGIONS = [
  'India - North',
  'India - South',
  'India - East',
  'India - West',
  'India - Central',
  'Other',
]

const MAX_IMAGE_BYTES = 500 * 1024   /* 500 KB */

export default function TeamSettings({ team, members, myRole, teamId, onTeamDeleted }) {
  const { user } = useAuth()
  const uid = user?.uid
  const isOwner = myRole === 'owner'
  const isIGL = myRole === 'igl'
  const canEdit = isOwner || isIGL

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <IdentityCard team={team} canEdit={canEdit} teamId={teamId} />

      {isOwner && (
        <DangerZone
          team={team}
          members={members}
          teamId={teamId}
          uid={uid}
          onTeamDeleted={onTeamDeleted}
        />
      )}

      <LeaveCard
        team={team}
        myRole={myRole}
        teamId={teamId}
        uid={uid}
        onDone={onTeamDeleted}
      />

      <style>{`.animate-spin{animation:ee-set-spin .9s linear infinite}@keyframes ee-set-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

/* ============================================================
   IDENTITY / EDIT
   ============================================================ */
function IdentityCard({ team, canEdit, teamId }) {
  const [name, setName] = useState(team?.name || '')
  const [tag, setTag] = useState(team?.tag || '')
  const [description, setDescription] = useState(team?.description || '')
  const [region, setRegion] = useState(team?.region || REGIONS[0])
  const [isPublic, setIsPublic] = useState(!!team?.isPublic)
  const [logo, setLogo] = useState(team?.logo || '')
  const [banner, setBanner] = useState(team?.banner || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    setName(team?.name || '')
    setTag(team?.tag || '')
    setDescription(team?.description || '')
    setRegion(team?.region || REGIONS[0])
    setIsPublic(!!team?.isPublic)
    setLogo(team?.logo || '')
    setBanner(team?.banner || '')
  }, [team])

  async function handleLogo(file) {
    setErr('')
    if (!file) return
    if (file.size > MAX_IMAGE_BYTES) {
      setErr('Logo must be under 500 KB.')
      return
    }
    const b64 = await readAsDataURL(file)
    setLogo(b64)
  }

  async function handleBanner(file) {
    setErr('')
    if (!file) return
    if (file.size > MAX_IMAGE_BYTES) {
      setErr('Banner must be under 500 KB.')
      return
    }
    const b64 = await readAsDataURL(file)
    setBanner(b64)
  }

  async function save() {
    if (!name.trim() || !tag.trim()) {
      setErr('Name and tag are required.')
      return
    }
    setBusy(true); setErr(''); setMsg('')
    try {
      await updateTeam(teamId, {
        name: name.trim(),
        tag: tag.trim().toUpperCase().slice(0, 5),
        description: description.trim(),
        region,
        isPublic,
        logo,
        banner,
      })
      setMsg('Team saved.')
      setTimeout(() => setMsg(''), 3000)
    } catch (e) {
      setErr(e?.message || 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card-header">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={15} style={{ color: 'var(--text-subtle)' }} />
          Team identity
        </div>
      </div>

      {/* Logo + banner uploads */}
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 14, alignItems: 'flex-start' }}>
        <LogoUploader value={logo} tag={tag || team?.tag} onChange={handleLogo} disabled={!canEdit} />
        <BannerUploader value={banner} onChange={handleBanner} disabled={!canEdit} />
      </div>

      <Field label="Team name*">
        <input
          className="input-field"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={30}
          disabled={!canEdit}
        />
      </Field>

      <Field label="Team tag*">
        <input
          className="input-field"
          value={tag}
          onChange={e => setTag(e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 5))}
          maxLength={5}
          disabled={!canEdit}
          style={{ letterSpacing: '0.08em' }}
        />
      </Field>

      <Field label="Description">
        <textarea
          className="input-field"
          rows={3}
          maxLength={200}
          value={description}
          onChange={e => setDescription(e.target.value)}
          disabled={!canEdit}
          style={{ resize: 'vertical' }}
        />
      </Field>

      <Field label="Region">
        <select
          className="input-field"
          value={region}
          onChange={e => setRegion(e.target.value)}
          disabled={!canEdit}
        >
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>

      <PublicToggle value={isPublic} onChange={setIsPublic} disabled={!canEdit} />

      {err && (
        <div style={{ background: 'var(--red-ghost)', border: '1px solid rgba(232,0,28,0.25)', color: 'var(--red)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={13} /> {err}
        </div>
      )}
      {msg && (
        <div style={{ background: 'var(--green-tint)', border: '1px solid rgba(0,201,110,0.4)', color: 'var(--green)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
          {msg}
        </div>
      )}

      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={save} disabled={busy} className="btn btn-primary">
            {busy ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Save size={13} /> Save changes</>}
          </button>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   DANGER ZONE — owner only
   ============================================================ */
function DangerZone({ team, members, teamId, uid, onTeamDeleted }) {
  const [xferTarget, setXferTarget] = useState('')
  const [xferBusy, setXferBusy] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [err, setErr] = useState('')

  const candidates = members.filter(m => m.uid !== team.ownerId)

  async function transfer() {
    if (!xferTarget) return
    const target = members.find(m => m.uid === xferTarget)
    if (!target) return
    if (!window.confirm(`Transfer ownership to ${target.ign || 'this member'}? You will become a regular player.`)) return
    setXferBusy(true); setErr('')
    try {
      await transferOwnership(teamId, uid, xferTarget)
      sendTeamNotification(xferTarget, TEAM_NOTIFICATIONS.roleChanged('Owner'))
    } catch (e) {
      setErr(e?.message || 'Could not transfer.')
    } finally {
      setXferBusy(false)
    }
  }

  async function del() {
    setErr('')
    setDeleteBusy(true)
    try {
      await deleteTeam(teamId, uid, members)
      onTeamDeleted?.()
    } catch (e) {
      setErr(e?.message || 'Could not delete team.')
    } finally {
      setDeleteBusy(false)
    }
  }

  const canDelete = deleteConfirm.trim() === (team?.name || '').trim() && !!(team?.name || '').trim()

  return (
    <div
      className="card"
      style={{
        borderLeft: '3px solid var(--red)',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}
    >
      <div className="card-header">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--red)' }}>
          <AlertTriangle size={15} />
          Danger zone
        </div>
      </div>

      {/* Transfer ownership */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
          <Crown size={13} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--text-muted)' }} />
          Transfer ownership
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
          Hand the team over to another active member. You'll become a regular player.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            className="input-field"
            value={xferTarget}
            onChange={e => setXferTarget(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          >
            <option value="">Select a member…</option>
            {candidates.map(m => (
              <option key={m.uid} value={m.uid}>{m.ign || 'Player'}</option>
            ))}
          </select>
          <button
            onClick={transfer}
            disabled={!xferTarget || xferBusy}
            className="btn btn-secondary"
          >
            {xferBusy ? <><Loader2 size={13} className="animate-spin" /> Transferring…</> : 'Transfer'}
          </button>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Delete team */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
          <Trash2 size={13} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--text-muted)' }} />
          Delete team
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
          Permanently deletes the team, its members, practices, scrims, and announcements. This can't be undone.
        </div>
        <Field label={<>Type the team name <span style={{ color: 'var(--text-primary)' }}>{team?.name || ''}</span> to confirm</>}>
          <input
            className="input-field"
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            placeholder={team?.name || ''}
          />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <DangerBtn
            onClick={del}
            disabled={!canDelete || deleteBusy}
            label={deleteBusy
              ? <><Loader2 size={13} className="animate-spin" /> Deleting…</>
              : <><Trash2 size={13} /> Delete team</>}
          />
        </div>
      </div>

      {err && (
        <div style={{ background: 'var(--red-ghost)', border: '1px solid rgba(232,0,28,0.25)', color: 'var(--red)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={13} /> {err}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   LEAVE / OWNER NOTICE
   ============================================================ */
function LeaveCard({ team, myRole, teamId, uid, onDone }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function leave() {
    if (!window.confirm(`Are you sure you want to leave ${team?.name || 'the team'}?`)) return
    setBusy(true); setErr('')
    try {
      await leaveTeam(teamId, uid, myRole)
      onDone?.()
    } catch (e) {
      setErr(e?.message || 'Could not leave.')
    } finally {
      setBusy(false)
    }
  }

  if (myRole === 'owner') {
    return (
      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <AlertTriangle size={18} style={{ color: 'var(--amber)', flexShrink: 0 }} />
        <div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
            Owners can't leave directly
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6 }}>
            Transfer ownership above first, then you can leave the team as a regular player.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="card-header">
        <div className="card-title">Leave team</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        You can rejoin later with a new invite code.
      </div>
      {err && (
        <div style={{ background: 'var(--red-ghost)', border: '1px solid rgba(232,0,28,0.25)', color: 'var(--red)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={13} /> {err}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={leave} disabled={busy} className="btn btn-secondary">
          {busy ? <><Loader2 size={13} className="animate-spin" /> Leaving…</> : <><LogOut size={13} /> Leave team</>}
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   UPLOADERS
   ============================================================ */
function LogoUploader({ value, tag, onChange, disabled }) {
  const inputRef = useRef(null)
  return (
    <div>
      <label className="label" style={{ display: 'block', marginBottom: 6 }}>Logo</label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        style={{
          width: 100, height: 100,
          borderRadius: '50%',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          cursor: disabled ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0,
          position: 'relative',
        }}
      >
        {value ? (
          <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 28,
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
            }}
          >
            {(tag || 'TM').slice(0, 3)}
          </span>
        )}
        {!disabled && (
          <span
            style={{
              position: 'absolute',
              bottom: 4, right: 4,
              width: 24, height: 24,
              borderRadius: '50%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <Upload size={11} />
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        disabled={disabled}
      />
    </div>
  )
}

function BannerUploader({ value, onChange, disabled }) {
  const inputRef = useRef(null)
  return (
    <div>
      <label className="label" style={{ display: 'block', marginBottom: 6 }}>Banner</label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-elevated)',
          border: '1px dashed var(--border)',
          overflow: 'hidden',
          cursor: disabled ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0,
          color: 'var(--text-subtle)',
          fontSize: 12,
          position: 'relative',
        }}
      >
        {value ? (
          <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ImageIcon size={14} /> Click to upload
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        disabled={disabled}
      />
    </div>
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

function PublicToggle({ value, onChange, disabled }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12,
        padding: '12px 14px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>Public team</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {value ? 'Anyone with the invite code can join.' : 'Private — share the code only with invited players.'}
        </div>
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        aria-pressed={value}
        style={{
          width: 40, height: 22, borderRadius: 999,
          background: value ? 'var(--green)' : 'var(--border)',
          border: 'none', cursor: disabled ? 'default' : 'pointer',
          position: 'relative', transition: 'background 0.2s',
          flexShrink: 0, opacity: disabled ? 0.6 : 1,
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

function DangerBtn({ onClick, disabled, label }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 14px',
        borderRadius: 'var(--radius-sm)',
        background: 'transparent',
        border: `1px solid ${hover && !disabled ? 'var(--red)' : 'var(--border)'}`,
        color: hover && !disabled ? 'var(--red)' : 'var(--text-primary)',
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        minHeight: 36,
        transition: 'border-color 0.15s, color 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = reject
    r.readAsDataURL(file)
  })
}
