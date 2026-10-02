import { useState } from 'react'
import {
  Copy, RefreshCw, Share2, ShieldCheck, ShieldOff, UserMinus,
  Crown, Loader2, AlertCircle, Check, Plus, X,
} from 'lucide-react'
import {
  assignIGL, removeIGL, removeMember, regenerateInviteCode,
  transferOwnership, updateMember, updateMemberIgns,
} from '../../utils/team.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useConfirm } from '../../hooks/useConfirm.js'
import ConfirmModal from '../ConfirmModal.jsx'

/* ============================================================
   IN-GAME SQUAD ROLES
   ============================================================ */
const IN_GAME_ROLES = [
  'Assaulter', 'Support', 'Sniper', 'IGL', 'Fragger',
  'Entry Fragger', 'Scout', 'All-rounder',
]

function roleBadgeStyle(role) {
  switch (role) {
    case 'Assaulter':
    case 'Fragger':
    case 'Entry Fragger':
      return { background: '#FEE2E2', color: '#EF3340', border: '1px solid rgba(239,51,64,0.2)' }
    case 'Support':
      return { background: '#EEF4FF', color: '#2563FF', border: '1px solid rgba(37,99,255,0.2)' }
    case 'Sniper':
      return { background: '#FEF3C7', color: '#D97706', border: '1px solid rgba(217,119,6,0.2)' }
    case 'IGL':
      return { background: 'rgba(217,119,6,0.08)', color: '#D97706', border: '1px solid rgba(217,119,6,0.3)' }
    case 'Scout':
      return { background: '#DCFCE7', color: '#16A34A', border: '1px solid rgba(22,163,74,0.2)' }
    default:
      return { background: '#F1F5F9', color: '#475569', border: '1px solid #E5EAF3' }
  }
}

const badgeBase = {
  borderRadius: 20, padding: '3px 10px', fontSize: 10,
  fontFamily: 'Rajdhani, sans-serif', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  display: 'inline-flex', alignItems: 'center',
}

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E5EAF3',
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
}

const labelStyle = {
  fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 10,
  textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B',
}

const inputStyle = {
  background: '#FFFFFF',
  border: '1px solid #E5EAF3',
  borderRadius: 6,
  color: '#0B1224',
  fontFamily: 'Inter, sans-serif',
  fontSize: 12,
  padding: '5px 8px',
  outline: 'none',
}

const btnSecondary = {
  background: '#FFFFFF', color: '#0B1224', border: '1px solid #E5EAF3',
  borderRadius: 8, padding: '6px 12px', fontSize: 12,
  fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
}

const btnPrimary = {
  background: '#2563FF', color: '#fff', border: 'none',
  borderRadius: 8, padding: '6px 12px', fontSize: 12,
  fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
}

const btnGhost = {
  background: 'transparent', color: '#475569', border: '1px solid transparent',
  borderRadius: 6, padding: '4px 8px', fontSize: 11,
  fontFamily: 'Inter, sans-serif', fontWeight: 500, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 4,
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
        <div style={{ background: '#FFF0F2', border: '1px solid rgba(239,51,64,0.25)', color: '#EF3340', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={14} /> {err}
        </div>
      )}

      {/* Role assignment summary (owner/IGL only) */}
      {canManage && <RoleSummary members={members} />}

      {/* Member grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
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
      <InviteCard team={team} teamId={teamId} isOwner={isOwner} />
    </div>
    <ConfirmModal {...confirmModalProps} />
    </>
  )
}

/* ============================================================
   ROLE SUMMARY
   ============================================================ */
function RoleSummary({ members }) {
  const counts = {}
  let unassigned = 0
  members.forEach((m) => {
    const r = (m.inGameRole || '').trim()
    if (!r) { unassigned++; return }
    counts[r] = (counts[r] || 0) + 1
  })
  const parts = Object.entries(counts).map(([role, n]) => `${role} Ã—${n}`)
  if (unassigned > 0) parts.push(`Unassigned Ã—${unassigned}`)
  if (parts.length === 0) return null
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#64748B', padding: '4px 2px' }}>
      {parts.join(' Â· ')}
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
    m.role === 'owner' ? { style: { background: '#FEE2E2', color: '#EF3340', border: '1px solid rgba(239,51,64,0.2)' }, label: 'Owner' } :
    m.role === 'igl'   ? { style: { background: '#FEF3C7', color: '#D97706', border: '1px solid rgba(217,119,6,0.2)' }, label: 'IGL' } :
    { style: { background: '#F1F5F9', color: '#475569', border: '1px solid #E5EAF3' }, label: 'Player' }
  const status = m.status || 'active'
  const dotColor = status === 'active' ? '#16A34A' : '#94A3B8'

  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {m.avatar ? (
          <img
            src={m.avatar}
            alt=""
            style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '1px solid #E5EAF3', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 48, height: 48, borderRadius: '50%',
              background: '#EEF4FF',
              border: '1px solid #E5EAF3',
              color: '#2563FF',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 900,
              fontSize: 18,
              letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 900,
              fontSize: 18,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#0B1224',
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
              <span style={{ ...badgeBase, background: '#F1F5F9', color: '#475569', border: '1px solid #E5EAF3', fontSize: 9, padding: '1px 6px' }}>
                You
              </span>
            )}
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#475569', marginTop: 2 }}>
            {m.bgmiUid ? `UID ${m.bgmiUid}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ ...badgeBase, ...roleBadge.style }}>{roleBadge.label}</span>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, display: 'inline-block' }} title={status} />
        </div>
      </div>

      <IgnSlot m={m} teamId={teamId} isSelf={isSelf} />
      <RoleSlot m={m} teamId={teamId} canManage={canManage} />

      {/* Other stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
        <MiniStat label="Device" value={m.device || 'â€”'} />
        <MiniStat label="FPS" value={m.fps || 'â€”'} />
        <MiniStat label="Gyro" value={m.gyro ? 'On' : 'Off'} />
      </div>

      {/* Actions */}
      {canManage && !isSelf && m.role !== 'owner' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 12, borderTop: '1px solid #E5EAF3' }}>
          {isOwner && m.role !== 'igl' && (
            <button style={btnSecondary} onClick={onAssignIGL} disabled={busy}>
              <ShieldCheck size={12} /> Make IGL
            </button>
          )}
          {isOwner && m.role === 'igl' && (
            <button style={btnSecondary} onClick={onRemoveIGL} disabled={busy}>
              <ShieldOff size={12} /> Remove IGL
            </button>
          )}
          <DangerBtn onClick={onRemove} disabled={busy} label={<><UserMinus size={12} /> Remove</>} />
          {isOwner && (
            <DangerBtn onClick={onTransfer} disabled={busy} label={<><Crown size={12} /> Transfer</>} />
          )}
          {busy && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto', fontSize: 12, color: '#475569' }}>
              <Loader2 size={12} className="animate-spin" /> Updatingâ€¦
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
   IGN SLOT
   ============================================================ */
const MAX_MEMBER_IGNS = 3
function memberIgns(m) {
  const arr = Array.isArray(m?.igns) ? m.igns : []
  const cleaned = arr.map(s => String(s || '').trim()).filter(Boolean)
  if (cleaned.length) return cleaned.slice(0, MAX_MEMBER_IGNS)
  return m?.ign ? [String(m.ign).trim()] : []
}

function IgnSlot({ m, teamId, isSelf }) {
  const stored = memberIgns(m)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(stored.length ? stored : [''])
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(0)
  const [err, setErr] = useState('')

  function open() {
    setDraft(stored.length ? stored : [''])
    setErr('')
    setEditing(true)
  }
  async function save() {
    setSaving(true); setErr('')
    try {
      await updateMemberIgns(teamId, m.uid, draft)
      setSavedAt(Date.now())
      setEditing(false)
      setTimeout(() => setSavedAt(prev => (Date.now() - prev >= 1500 ? 0 : prev)), 1600)
    } catch (e) {
      setErr(e?.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const wrapStyle = {
    background: '#F8FAFD',
    border: '1px solid #E5EAF3',
    borderRadius: 8,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  }

  if (!isSelf || !editing) {
    return (
      <div style={wrapStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={labelStyle}>In-game names</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {savedAt > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#16A34A', fontWeight: 600 }}>
                <Check size={10} /> Saved
              </span>
            )}
            {isSelf && (
              <button type="button" onClick={open} style={btnGhost}>
                Edit
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {stored.length ? stored.map((name, i) => (
            <span key={i} style={{ ...badgeBase, background: '#F1F5F9', color: '#475569', border: '1px solid #E5EAF3', fontSize: 11 }}>{name}</span>
          )) : (
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
              {isSelf ? 'Add your in-game names' : 'Not set'}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={wrapStyle}>
      <span style={labelStyle}>In-game names â€” up to {MAX_MEMBER_IGNS}</span>
      {(draft.length ? draft : ['']).map((val, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="text"
            value={val}
            onChange={e => setDraft(d => { const n = [...d]; n[i] = e.target.value; return n })}
            placeholder={i === 0 ? 'Primary IGN' : `Alternate ${i + 1}`}
            style={{ ...inputStyle, flex: 1 }}
          />
          {draft.length > 1 && (
            <button
              type="button"
              onClick={() => setDraft(d => d.filter((_, idx) => idx !== i))}
              style={{ ...btnGhost, padding: '4px 6px' }}
              aria-label={`Remove IGN ${i + 1}`}
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setDraft(d => (d.length >= MAX_MEMBER_IGNS ? d : [...d, '']))}
          disabled={draft.length >= MAX_MEMBER_IGNS}
          style={{ ...btnSecondary, padding: '4px 8px', fontSize: 11 }}
        >
          <Plus size={11} /> Add
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => setEditing(false)} style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} style={{ ...btnPrimary, padding: '4px 10px', fontSize: 11 }}>
            {saving ? <><Loader2 size={11} className="animate-spin" /> Savingâ€¦</> : 'Save'}
          </button>
        </div>
      </div>
      {err && <span style={{ fontSize: 10, color: '#EF3340' }}>{err}</span>}
    </div>
  )
}

/* ============================================================
   ROLE SLOT
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

  const wrapStyle = {
    background: '#F8FAFD',
    border: '1px solid #E5EAF3',
    borderRadius: 8,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  }

  if (canManage) {
    return (
      <div style={wrapStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={labelStyle}>In-game role</span>
          {savedAt > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#16A34A', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
              <Check size={10} /> Saved
            </span>
          )}
          {saving && <Loader2 size={11} className="animate-spin" style={{ color: '#475569' }} />}
        </div>
        <select
          value={m.inGameRole || ''}
          onChange={(e) => change(e.target.value)}
          disabled={saving}
          style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
        >
          <option value="">Unassigned</option>
          {IN_GAME_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {err && <span style={{ fontSize: 10, color: '#EF3340' }}>{err}</span>}
      </div>
    )
  }

  const rStyle = roleBadgeStyle(m.inGameRole || '')
  return (
    <div style={{ ...wrapStyle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={labelStyle}>In-game role</span>
      <span style={{ ...badgeBase, ...rStyle }}>
        {m.inGameRole || 'Unassigned'}
      </span>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div style={{ background: '#F8FAFD', border: '1px solid #E5EAF3', borderRadius: 8, padding: '8px 10px' }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 13, color: '#0B1224', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
  const [copied, setCopied] = useState(null)
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
    <div style={cardStyle}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 16, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Invite code</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{
          background: '#F8FAFD',
          border: '1px solid #E5EAF3',
          borderRadius: 8,
          padding: '10px 18px',
          fontFamily: 'Barlow Condensed, sans-serif',
          fontWeight: 900,
          fontSize: 32,
          letterSpacing: '0.3em',
          color: '#0B1224',
        }}>
          {code}
        </div>

        <button style={btnSecondary} onClick={() => copy(code, 'code')}>
          <Copy size={13} /> {copied === 'code' ? 'Copied' : 'Copy code'}
        </button>

        <button style={btnSecondary} onClick={() => copy(shareUrl, 'link')}>
          <Share2 size={13} /> {copied === 'link' ? 'Copied' : 'Share link'}
        </button>

        {isOwner && (
          <button
            style={{ ...btnSecondary, marginLeft: 'auto', color: '#64748B' }}
            onClick={regen}
            disabled={busy}
          >
            {busy ? <><Loader2 size={13} className="animate-spin" /> Regeneratingâ€¦</> : <><RefreshCw size={13} /> Regenerate</>}
          </button>
        )}
      </div>

      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#64748B', marginTop: 12 }}>
        Anyone with this code can request to join. Regenerate to invalidate the old code.
      </div>

      {err && (
        <div style={{ background: '#FFF0F2', border: '1px solid rgba(239,51,64,0.25)', color: '#EF3340', padding: '8px 12px', borderRadius: 8, fontSize: 12, marginTop: 10 }}>
          {err}
        </div>
      )}
    </div>
    <ConfirmModal {...confirmModalProps} />
    </>
  )
}

/* ============================================================
   DANGER BUTTON
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
        borderRadius: 8,
        background: '#FFFFFF',
        border: `1px solid ${hover ? '#EF3340' : '#E5EAF3'}`,
        color: hover ? '#EF3340' : '#0B1224',
        fontFamily: 'Inter, sans-serif',
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
