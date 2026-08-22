import { useState } from 'react'
import {
  Copy, RefreshCw, Share2, ShieldCheck, ShieldOff, UserMinus,
  Crown, Loader2, AlertCircle, Check,
} from 'lucide-react'
import {
  assignIGL, removeIGL, removeMember, regenerateInviteCode,
  transferOwnership, updateMember,
} from '../../utils/team.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useConfirm } from '../../hooks/useConfirm.js'
import ConfirmModal from '../ConfirmModal.jsx'

/* ============================================================
   IN-GAME SQUAD ROLES
   Assigned by Owner/IGL; players cannot self-assign.
   ============================================================ */
const IN_GAME_ROLES = [
  'Assaulter',
  'Support',
  'Sniper',
  'IGL',
  'Fragger',
  'Entry Fragger',
  'Scout',
  'All-rounder',
]

/* Per-role badge for read-only display (player view). Returns a
   className + inline style tuple so we can render `.badge-gold` even
   though the shared CSS only ships red/green/amber/blue variants. */
function roleBadgeProps(role) {
  switch (role) {
    case 'Assaulter':
    case 'Fragger':
    case 'Entry Fragger':
      return { className: 'badge badge-red' }
    case 'Support':      return { className: 'badge badge-blue' }
    case 'Sniper':       return { className: 'badge badge-amber' }
    case 'IGL':          return {
      className: 'badge',
      style: {
        background: 'var(--gold-tint)',
        color: 'var(--gold)',
        borderColor: 'rgba(255,215,0,0.4)',
      },
    }
    case 'Scout':        return { className: 'badge badge-green' }
    default:             return { className: 'badge' }
  }
}

export default function TeamRoster({ team, members, myRole, teamId }) {
  const { confirm, confirmModalProps } = useConfirm()
  const { user } = useAuth()
  const uid = user?.uid
  const isOwner = myRole === 'owner'
  const isIGL = myRole === 'igl'
  const canManage = isOwner || isIGL
  const [busyUid, setBusyUid] = useState(null)
  const [err, setErr] = useState('')

  async function doAssignIGL(target) {
    if (!isOwner) return
    setBusyUid(target); setErr('')
    try { await assignIGL(teamId, uid, target) } catch (e) { setErr(e.message) }
    finally { setBusyUid(null) }
  }
  async function doRemoveIGL(target) {
    if (!isOwner) return
    setBusyUid(target); setErr('')
    try { await removeIGL(teamId, uid, target) } catch (e) { setErr(e.message) }
    finally { setBusyUid(null) }
  }
  async function doRemove(target) {
    if (!canManage) return
    if (!await confirm('Remove this member from the team?')) return
    setBusyUid(target); setErr('')
    try { await removeMember(teamId, target, myRole) }
    catch (e) { setErr(e.message) }
    finally { setBusyUid(null) }
  }
  async function doTransfer(target, ign) {
    if (!isOwner) return
    if (!await confirm(`Transfer ownership to ${ign || 'this member'}? You will become a regular player.`)) return
    setBusyUid(target); setErr('')
    try { await transferOwnership(teamId, uid, target) }
    catch (e) { setErr(e.message) }
    finally { setBusyUid(null) }
  }

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

      {/* Role assignment summary (owner/IGL only) */}
      {canManage && <RoleSummary members={members} />}

      {/* Member grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {members.map(m => (
          <MemberCard
            key={m.uid}
            m={m}
            teamId={teamId}
            isSelf={m.uid === uid}
            isOwner={isOwner}
            canManage={canManage}
            busy={busyUid === m.uid}
            onAssignIGL={() => doAssignIGL(m.uid)}
            onRemoveIGL={() => doRemoveIGL(m.uid)}
            onRemove={() => doRemove(m.uid)}
            onTransfer={() => doTransfer(m.uid, m.ign)}
          />
        ))}
      </div>

      {/* Invite section */}
      <InviteCard
        team={team}
        teamId={teamId}
        isOwner={isOwner}
      />
    </div>
    <ConfirmModal {...confirmModalProps} />
    </>
  )
}

/* ============================================================
   ROLE SUMMARY — squad composition at a glance (owner/IGL view)
   ============================================================ */
function RoleSummary({ members }) {
  const counts = {}
  let unassigned = 0
  members.forEach((m) => {
    const r = (m.inGameRole || '').trim()
    if (!r) { unassigned++; return }
    counts[r] = (counts[r] || 0) + 1
  })
  const parts = Object.entries(counts).map(([role, n]) => `${role} ×${n}`)
  if (unassigned > 0) parts.push(`Unassigned ×${unassigned}`)
  if (parts.length === 0) return null
  return (
    <div
      style={{
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 12,
        color: 'var(--text-subtle)',
        padding: '4px 2px',
      }}
    >
      {parts.join(' · ')}
    </div>
  )
}

/* ============================================================
   MEMBER CARD
   ============================================================ */
function MemberCard({
  m, teamId, isSelf, isOwner, canManage, busy,
  onAssignIGL, onRemoveIGL, onRemove, onTransfer,
}) {
  const initial = (m.ign || '?').trim().charAt(0).toUpperCase()
  const roleBadge =
    m.role === 'owner' ? { className: 'badge badge-red', label: 'Owner' } :
    m.role === 'igl'   ? { className: 'badge badge-amber', label: 'IGL' } :
    { className: 'badge', label: 'Player' }
  const status = m.status || 'active'
  const dotColor = status === 'active' ? 'var(--green)' : 'var(--text-subtle)'

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {m.avatar ? (
          <img
            src={m.avatar}
            alt=""
            style={{
              width: 48, height: 48, borderRadius: '50%',
              objectFit: 'cover', border: '1px solid var(--border)',
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 18,
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 18,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {m.ign || 'Player'}
            {isSelf && (
              <span
                className="badge"
                style={{ fontSize: 9, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                You
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {m.bgmiUid ? `UID ${m.bgmiUid}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span className={roleBadge.className}>{roleBadge.label}</span>
          <span
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: dotColor, display: 'inline-block',
            }}
            title={status}
          />
        </div>
      </div>

      {/* In-game role row — dropdown for owner/IGL, coloured badge for
          players. Sits above the other stats so squad composition is
          the first thing the eye lands on. */}
      <RoleSlot m={m} teamId={teamId} canManage={canManage} />

      {/* Other stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: 8,
        }}
      >
        <MiniStat label="Device" value={m.device || '—'} />
        <MiniStat label="FPS" value={m.fps || '—'} />
        <MiniStat label="Gyro" value={m.gyro ? 'On' : 'Off'} />
      </div>

      {/* Actions */}
      {canManage && !isSelf && m.role !== 'owner' && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
          }}
        >
          {isOwner && m.role !== 'igl' && (
            <button className="btn btn-secondary btn-sm" onClick={onAssignIGL} disabled={busy}>
              <ShieldCheck size={12} /> Make IGL
            </button>
          )}
          {isOwner && m.role === 'igl' && (
            <button className="btn btn-secondary btn-sm" onClick={onRemoveIGL} disabled={busy}>
              <ShieldOff size={12} /> Remove IGL
            </button>
          )}
          <DangerBtn
            onClick={onRemove}
            disabled={busy}
            label={<><UserMinus size={12} /> Remove</>}
          />
          {isOwner && (
            <DangerBtn
              onClick={onTransfer}
              disabled={busy}
              label={<><Crown size={12} /> Transfer</>}
            />
          )}
          {busy && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
              <Loader2 size={12} className="animate-spin" /> Updating…
            </span>
          )}
        </div>
      )}

      <style>{`
        .animate-spin { animation: ee-roster-spin 0.9s linear infinite; }
        @keyframes ee-roster-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

/* ============================================================
   ROLE SLOT — dropdown (owner/IGL) or coloured badge (player view)
   ============================================================ */
function RoleSlot({ m, teamId, canManage }) {
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(0)
  const [err, setErr] = useState('')

  async function change(next) {
    if (!teamId || !m?.uid) return
    if (next === (m.inGameRole || '')) return
    setSaving(true); setErr('')
    try {
      await updateMember(teamId, m.uid, { inGameRole: next })
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt((prev) => (Date.now() - prev >= 1500 ? 0 : prev)), 1600)
    } catch (e) {
      setErr(e?.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  if (canManage) {
    return (
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span className="label" style={{ fontSize: 10 }}>In-game role</span>
          {savedAt > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 10,
                color: 'var(--green)',
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: 600,
              }}
            >
              <Check size={10} /> Saved
            </span>
          )}
          {saving && (
            <Loader2 size={11} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
        <select
          value={m.inGameRole || ''}
          onChange={(e) => change(e.target.value)}
          disabled={saving}
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 12,
            padding: '4px 8px',
            cursor: 'pointer',
            appearance: 'auto',
          }}
        >
          <option value="">Unassigned</option>
          {IN_GAME_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {err && (
          <span style={{ fontSize: 10, color: 'var(--red)' }}>{err}</span>
        )}
      </div>
    )
  }

  /* Player view — read-only coloured badge */
  const badge = roleBadgeProps(m.inGameRole || '')
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <span className="label" style={{ fontSize: 10 }}>In-game role</span>
      <span className={badge.className} style={badge.style}>
        {m.inGameRole || 'Unassigned'}
      </span>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 10px',
      }}
    >
      <div className="label" style={{ fontSize: 10 }}>{label}</div>
      <div
        style={{
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: 500,
          fontSize: 13,
          color: 'var(--text-primary)',
          marginTop: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  )
}

/* ============================================================
   INVITE CARD
   ============================================================ */
function InviteCard({ team, teamId, isOwner }) {
  const { confirm, confirmModalProps } = useConfirm()
  const [copied, setCopied] = useState(null)   /* 'code' | 'link' | null */
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const { user } = useAuth()

  const code = team?.inviteCode || '------'
  const shareUrl = `https://esportselite.in/join/${code}`

  async function copy(text, kind) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } catch { /* ignore */ }
  }

  async function regen() {
    if (!isOwner) return
    if (!await confirm('Regenerate the invite code? The old code will stop working immediately.')) return
    setBusy(true); setErr('')
    try {
      await regenerateInviteCode(teamId, user?.uid)
    } catch (e) {
      setErr(e.message || 'Could not regenerate')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    <div className="card">
      <div className="card-header">
        <div className="card-title">Invite code</div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 18px',
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 32,
            letterSpacing: '0.3em',
            color: 'var(--text-primary)',
          }}
        >
          {code}
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => copy(code, 'code')}
        >
          <Copy size={13} /> {copied === 'code' ? 'Copied' : 'Copy code'}
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => copy(shareUrl, 'link')}
        >
          <Share2 size={13} /> {copied === 'link' ? 'Copied' : 'Share link'}
        </button>

        {isOwner && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={regen}
            disabled={busy}
            style={{ marginLeft: 'auto' }}
          >
            {busy ? <><Loader2 size={13} className="animate-spin" /> Regenerating…</> : <><RefreshCw size={13} /> Regenerate</>}
          </button>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 12 }}>
        Anyone with this code can request to join. Regenerate to invalidate the old code.
      </div>

      {err && (
        <div
          style={{
            background: 'var(--red-ghost)',
            border: '1px solid rgba(232,0,28,0.25)',
            color: 'var(--red)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            marginTop: 10,
          }}
        >
          {err}
        </div>
      )}
    </div>
    <ConfirmModal {...confirmModalProps} />
    </>
  )
}

/* ============================================================
   DANGER BUTTON — default neutral, red on hover
   ============================================================ */
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
        padding: '6px 12px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-elevated)',
        border: `1px solid ${hover ? 'var(--red)' : 'var(--border)'}`,
        color: hover ? 'var(--red)' : 'var(--text-primary)',
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        minHeight: 30,
        transition: 'border-color 0.15s, color 0.15s',
      }}
    >
      {label}
    </button>
  )
}
