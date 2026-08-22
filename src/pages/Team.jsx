import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, LayoutGrid, Calendar, Swords, Megaphone, BarChart3,
  Settings, Loader2, Shield, LogIn, Plus, Copy, Info, LogOut, Eye,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useUserTeamId, useTeam } from '../hooks/useTeam.js'
import { leaveTeam } from '../utils/team.js'
import { useConfirm } from '../hooks/useConfirm.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import TeamDashboard from '../components/team/TeamDashboard.jsx'
import TeamRoster from '../components/team/TeamRoster.jsx'
import TeamPractice from '../components/team/TeamPractice.jsx'
import TeamScrims from '../components/team/TeamScrims.jsx'
import TeamAnnouncements from '../components/team/TeamAnnouncements.jsx'
import TeamStats from '../components/team/TeamStats.jsx'
import TeamSettings from '../components/team/TeamSettings.jsx'
import IGLDashboard from '../components/team/IGLDashboard.jsx'

const TABS = [
  { id: 'overview',      label: 'Overview',      icon: LayoutGrid },
  { id: 'roster',        label: 'Roster',        icon: Users },
  { id: 'practice',      label: 'Practice',      icon: Calendar },
  { id: 'scrims',        label: 'Scrims',        icon: Swords },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'stats',         label: 'Stats',         icon: BarChart3 },
  { id: 'igl',           label: 'IGL View',      icon: Eye,      restricted: true },
  { id: 'settings',      label: 'Settings',      icon: Settings, restricted: true },
]

export default function Team() {
  const navigate = useNavigate()
  const { confirm, confirmModalProps } = useConfirm()
  const { user } = useAuth()
  const { teamId, loading: idLoading } = useUserTeamId()
  const { team, members, myRole, loading: teamLoading } = useTeam(teamId)
  const [tab, setTab] = useState('overview')
  const [leaving, setLeaving] = useState(false)

  const loading = idLoading || (teamId && teamLoading)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 10, color: 'var(--text-muted)' }}>
        <Loader2 size={18} className="animate-spin" />
        <span style={{ fontSize: 13 }}>Loading team…</span>
        <style>{`.animate-spin { animation: ee-team-spin 0.9s linear infinite; } @keyframes ee-team-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!teamId || !team) {
    return <NoTeamState onCreate={() => navigate('/team/create')} />
  }

  const canSeeSettings = myRole === 'owner' || myRole === 'igl'
  const visibleTabs = TABS.filter(t => !t.restricted || canSeeSettings)

  async function handleLeave() {
    if (myRole === 'owner') {
      alert('Transfer ownership before leaving the team.')
      return
    }
    if (!await confirm('Leave this team? You can rejoin later with a new invite code.')) return
    setLeaving(true)
    try {
      await leaveTeam(teamId, user.uid, myRole)
    } catch (e) {
      alert('Could not leave: ' + (e?.message || e))
    } finally {
      setLeaving(false)
    }
  }

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-transition">
      <TeamHeader
        team={team}
        members={members}
        myRole={myRole}
        onLeave={handleLeave}
        leaving={leaving}
      />

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
        {visibleTabs.map(t => {
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

      {/* Content */}
      {tab === 'overview'      && <TeamDashboard     team={team} members={members} teamId={teamId} />}
      {tab === 'roster'        && <TeamRoster        team={team} members={members} myRole={myRole} teamId={teamId} />}
      {tab === 'practice'      && <TeamPractice      team={team} members={members} myRole={myRole} teamId={teamId} />}
      {tab === 'scrims'        && <TeamScrims        team={team} members={members} myRole={myRole} teamId={teamId} />}
      {tab === 'announcements' && <TeamAnnouncements team={team} members={members} myRole={myRole} teamId={teamId} />}
      {tab === 'stats'         && <TeamStats         team={team} members={members} myRole={myRole} teamId={teamId} />}
      {tab === 'igl'           && (myRole === 'owner' || myRole === 'igl'
        ? <IGLDashboard         team={team} members={members} myRole={myRole} teamId={teamId} />
        : null)}
      {tab === 'settings'      && (myRole !== 'player'
        ? <TeamSettings         team={team} members={members} myRole={myRole} teamId={teamId} onTeamDeleted={() => navigate('/team')} />
        : null)}
    </div>
    <ConfirmModal {...confirmModalProps} />
    </>
  )
}

/* ============================================================
   TEAM HEADER (banner + name + badges + settings/leave)
   ============================================================ */
function TeamHeader({ team, members, myRole, onLeave, leaving }) {
  const roleLabel =
    myRole === 'owner' ? 'Your role: Owner' :
    myRole === 'igl'   ? 'Your role: IGL' :
    'Your role: Player'
  const roleBadgeClass =
    myRole === 'owner' ? 'badge badge-red' :
    myRole === 'igl'   ? 'badge badge-amber' :
    'badge'

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: 'var(--bg-surface)',
      }}
    >
      {team.banner && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${team.banner})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.2,
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          position: 'relative',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <TeamAvatar team={team} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span
                className="badge"
                style={{
                  fontFamily: 'Bebas Neue, sans-serif',
                  fontSize: 13,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  color: 'var(--text-primary)',
                }}
              >
                [{team.tag || '—'}]
              </span>
              <h1
                style={{
                  fontFamily: 'Bebas Neue, sans-serif',
                  fontWeight: 400,
                  fontSize: 32,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                {team.name || 'Team'}
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <span className="badge">{team.memberCount ?? members.length} / 6 members</span>
              <span className="badge">{team.region || 'Other'}</span>
              <span className={roleBadgeClass}>{roleLabel}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {myRole !== 'owner' && (
            <button
              onClick={onLeave}
              disabled={leaving}
              className="btn btn-secondary btn-sm"
            >
              {leaving ? <><Loader2 size={13} className="animate-spin" /> Leaving…</> : <><LogOut size={13} /> Leave</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function TeamAvatar({ team }) {
  if (team?.logo) {
    return (
      <img
        src={team.logo}
        alt=""
        style={{
          width: 60, height: 60,
          borderRadius: 12,
          objectFit: 'cover',
          border: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: 60, height: 60,
        borderRadius: 12,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Bebas Neue, sans-serif',
        fontSize: 22,
        letterSpacing: '0.04em',
        color: 'var(--text-primary)',
        flexShrink: 0,
      }}
    >
      {(team?.tag || 'TM').slice(0, 3)}
    </div>
  )
}

/* ============================================================
   NO TEAM EMPTY STATE
   ============================================================ */
function NoTeamState({ onCreate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '40px 20px' }} className="page-transition">
      <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: 12,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-subtle)',
            margin: '0 auto 14px',
          }}
        >
          <Users size={26} />
        </div>
        <div
          className="heading"
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 24,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            marginBottom: 6,
          }}
        >
          You're not in a team yet
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 18 }}>
          Create your own team or join one with an invite code from your captain.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onCreate} className="btn btn-primary btn-sm">
            <Plus size={13} /> Create Team
          </button>
          <button onClick={onCreate} className="btn btn-secondary btn-sm">
            <LogIn size={13} /> Join Team
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   COMING SOON (Part 2)
   ============================================================ */
function ComingSoonPanel({ title, hint }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{title}</div>
        <span className="badge badge-amber">Part 2</span>
      </div>
      <div className="empty-state">
        <Shield size={26} className="empty-state-icon" />
        <div className="empty-state-title">{title} arriving soon</div>
        <div className="empty-state-desc">{hint}</div>
      </div>
    </div>
  )
}
