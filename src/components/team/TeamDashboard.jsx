import { useEffect, useState } from 'react'
import {
  BarChart3, Trophy, Crosshair, Percent, Megaphone, Calendar,
  Swords, UserPlus, ChevronRight, Users,
} from 'lucide-react'
import StatCard from '../StatCard.jsx'
import {
  getAnnouncements, getPractices, getScrims, getRecentActivity,
} from '../../utils/team.js'

/**
 * Team overview tab. Reads the async collections once on mount —
 * live updates on team + members come from useTeam in the parent.
 */
export default function TeamDashboard({ team, members, teamId }) {
  const [pinned, setPinned] = useState([])
  const [nextPractice, setNextPractice] = useState(null)
  const [nextScrim, setNextScrim] = useState(null)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!teamId) { setLoading(false); return }
      setLoading(true)
      try {
        const [ann, prac, scr, act] = await Promise.all([
          getAnnouncements(teamId),
          getPractices(teamId),
          getScrims(teamId),
          getRecentActivity(teamId, 5),
        ])
        if (cancelled) return
        setPinned(ann.filter(a => a.pinned).slice(0, 2))
        setNextPractice(pickUpcoming(prac))
        setNextScrim(pickUpcoming(scr))
        setActivity(act)
      } catch { /* fail-soft */ }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [teamId])

  const stats = team?.stats || {}
  const totalMatches = Number(stats.totalMatches) || 0
  const wins = Number(stats.wins) || 0
  const totalKills = Number(stats.totalKills) || 0
  const kd = totalMatches > 0 ? (totalKills / (5 * totalMatches)).toFixed(2) : '0.00'
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stat row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
        }}
      >
        <StatCard icon={<BarChart3 size={18} />} value={totalMatches} label="Total Matches" />
        <StatCard icon={<Trophy size={18} />}    value={wins}         label="Wins" accent="green" />
        <StatCard icon={<Crosshair size={18} />} value={kd}           label="Team K/D" />
        <StatCard icon={<Percent size={18} />}   value={`${winRate}%`} label="Win Rate" />
      </div>

      {/* Two-column layout */}
      <div
        className="team-overview-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 20,
        }}
      >
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* Pinned announcements */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Megaphone size={15} style={{ color: 'var(--text-subtle)' }} />
                Pinned announcements
              </div>
            </div>
            {loading ? <SkeletonRow /> : pinned.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No pinned announcements</div>
                <div className="empty-state-desc">Pin important notices so the roster sees them first.</div>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pinned.map(a => (
                  <li
                    key={a.id}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                      {a.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                      {truncate(a.body, 160)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 6 }}>
                      {a.createdByName || 'Unknown'} · {formatRelative(a.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Next practice + next scrim */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
            }}
          >
            <div className="card">
              <div className="card-header">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={15} style={{ color: 'var(--text-subtle)' }} />
                  Next practice
                </div>
              </div>
              {loading ? <SkeletonRow /> : nextPractice ? (
                <UpcomingRow
                  title={nextPractice.title || 'Practice'}
                  when={`${nextPractice.date || ''} ${nextPractice.time || ''}`.trim()}
                  sub={nextPractice.notes ? truncate(nextPractice.notes, 80) : ''}
                />
              ) : (
                <div className="empty-state">
                  <div className="empty-state-title">No practice scheduled</div>
                  <div className="empty-state-desc">Coming up in the Practice tab.</div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Swords size={15} style={{ color: 'var(--text-subtle)' }} />
                  Next scrim
                </div>
              </div>
              {loading ? <SkeletonRow /> : nextScrim ? (
                <UpcomingRow
                  title={`vs ${nextScrim.opponent || 'TBD'}`}
                  when={`${nextScrim.date || ''} ${nextScrim.time || ''}`.trim()}
                  sub={nextScrim.notes ? truncate(nextScrim.notes, 80) : ''}
                />
              ) : (
                <div className="empty-state">
                  <div className="empty-state-title">No scrims scheduled</div>
                  <div className="empty-state-desc">Schedule one from the Scrims tab.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* Team info card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Team info</div>
              <span className={team?.isPublic ? 'badge badge-green' : 'badge'}>
                {team?.isPublic ? 'Public' : 'Private'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <TeamAvatar team={team} />
              <div style={{ minWidth: 0 }}>
                <div
                  className="heading"
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    fontSize: 22,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {team?.name || '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  [{team?.tag || '—'}] · {team?.region || '—'}
                </div>
              </div>
            </div>

            <InfoRow label="Members" value={`${team?.memberCount ?? members.length} / 6`} />
            <InfoRow label="Owner" value={ownerName(team, members)} />
            <InfoRow label="Created" value={formatDate(team?.createdAt)} />
          </div>

          {/* Activity feed */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Recent activity</div>
            </div>
            {loading ? <SkeletonRow /> : activity.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">Nothing yet</div>
                <div className="empty-state-desc">Team events will show up here.</div>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activity.map((ev, i) => (
                  <li
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <ActivityIcon kind={ev.kind} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>
                        {formatRelativeMs(ev.at)}
                      </div>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-subtle)' }} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .team-overview-grid {
            grid-template-columns: minmax(0, 1fr) 340px !important;
          }
        }
      `}</style>
    </div>
  )
}

/* ============================================================
   INTERNAL
   ============================================================ */
function TeamAvatar({ team }) {
  if (team?.logo) {
    return (
      <img
        src={team.logo}
        alt=""
        style={{
          width: 56, height: 56,
          borderRadius: 12,
          objectFit: 'cover',
          border: '1px solid var(--border)',
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: 56, height: 56,
        borderRadius: 12,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Bebas Neue, sans-serif',
        fontSize: 20,
        letterSpacing: '0.06em',
        color: 'var(--text-primary)',
        flexShrink: 0,
      }}
    >
      {(team?.tag || 'TM').slice(0, 3)}
    </div>
  )
}

function UpcomingRow({ title, when, sub }) {
  return (
    <div>
      <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{when || '—'}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 6, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10,
        padding: '8px 0',
        borderTop: '1px solid var(--border)',
      }}
    >
      <span className="label">{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function ActivityIcon({ kind }) {
  const style = { color: 'var(--text-muted)', flexShrink: 0 }
  if (kind === 'scrim') return <Swords size={14} style={style} />
  if (kind === 'practice') return <Calendar size={14} style={style} />
  if (kind === 'announcement') return <Megaphone size={14} style={style} />
  if (kind === 'member') return <UserPlus size={14} style={style} />
  return <Users size={14} style={style} />
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="skeleton" style={{ height: 14, width: '70%' }} />
      <span className="skeleton" style={{ height: 12, width: '40%' }} />
    </div>
  )
}

/* ------------------------------------------------------------ */
function ownerName(team, members) {
  if (!team) return '—'
  const owner = (members || []).find(m => m.uid === team.ownerId)
  return owner?.ign || '—'
}

function pickUpcoming(list) {
  if (!list || list.length === 0) return null
  const today = new Date().toISOString().split('T')[0]
  const upcoming = list
    .filter(x => (x.date || '') >= today)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  return upcoming[0] || list[0] || null
}

function truncate(s, n) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function formatDate(v) {
  if (!v) return '—'
  const d = v?.toDate ? v.toDate() : new Date(v)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatRelative(v) {
  if (!v) return ''
  const ms = v?.toMillis?.() ?? (v ? new Date(v).getTime() : 0)
  return formatRelativeMs(ms)
}

function formatRelativeMs(ms) {
  if (!ms) return ''
  const diff = Date.now() - ms
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
