import { useEffect } from 'react'
import { X, CheckCheck } from 'lucide-react'
import { markAttendance } from '../../utils/team.js'

export default function AttendanceModal({ open, onClose, practice, members, teamId }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !practice) return null

  const attendance = practice.attendance || {}

  async function setStatus(uid, status) {
    /* Optimistic — we mutate the practice attendance in place so the
       row updates without waiting for the round-trip. The parent's
       Firestore listener will overwrite with the authoritative value. */
    attendance[uid] = status
    try { await markAttendance(teamId, practice.id, uid, status) }
    catch { /* swallow */ }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 22px', borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCheck size={18} style={{ color: 'var(--text-muted)' }} />
            <div>
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
                Mark Attendance
              </h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {practice.title || 'Practice'} · {practice.date || ''} {practice.time || ''}
              </div>
            </div>
          </div>
          <IconClose onClick={onClose} />
        </div>

        {/* Members */}
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
          {members.map(m => {
            const status = attendance[m.uid] || 'pending'
            return (
              <div
                key={m.uid}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <Avatar name={m.ign} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.ign || 'Player'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <StatusBtn label="Present" tint="green" active={status === 'present'} onClick={() => setStatus(m.uid, 'present')} />
                  <StatusBtn label="Late"    tint="amber" active={status === 'late'}    onClick={() => setStatus(m.uid, 'late')} />
                  <StatusBtn label="Absent"  tint="red"   active={status === 'absent'}  onClick={() => setStatus(m.uid, 'absent')} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex', justifyContent: 'flex-end', gap: 10,
            padding: '14px 22px', borderTop: '1px solid var(--border)',
          }}
        >
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={onClose} className="btn btn-primary">Done</button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ */

function StatusBtn({ label, tint, active, onClick }) {
  const colorMap = {
    green: { color: 'var(--green)', bg: 'var(--green-tint)', border: 'rgba(0,201,110,0.4)' },
    amber: { color: 'var(--amber)', bg: 'var(--amber-tint)', border: 'rgba(245,158,11,0.4)' },
    red:   { color: 'var(--red)',   bg: 'var(--red-ghost)',  border: 'rgba(232,0,28,0.4)'  },
  }[tint] || { color: 'var(--text-muted)', bg: 'var(--bg-elevated)', border: 'var(--border)' }

  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        background: active ? colorMap.bg : 'var(--bg-surface)',
        border: `1px solid ${active ? colorMap.border : 'var(--border)'}`,
        color: active ? colorMap.color : 'var(--text-muted)',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function Avatar({ name }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <div
      style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        fontFamily: 'Bebas Neue, sans-serif',
        fontSize: 14,
        letterSpacing: '0.04em',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  )
}

function IconClose({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32, height: 32,
        borderRadius: 'var(--radius-sm)',
        background: 'transparent',
        border: 'none',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      title="Close"
    >
      <X size={16} />
    </button>
  )
}
