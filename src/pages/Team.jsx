import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Users, LayoutGrid, Calendar, Swords, Megaphone, BarChart3,
  Settings, Loader2, Shield, LogIn, Plus, Copy, Info, LogOut, Eye,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useUserTeamId, useTeam } from '../hooks/useTeam.js'
import { useSubscription } from '../hooks/useSubscription.js'
import UpgradeOverlay from '../components/UpgradeOverlay.jsx'
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
  const { isActive, loading: subLoading } = useSubscription()
  const [tab, setTab] = useState('overview')
  const [leaving, setLeaving] = useState(false)

  const loading = idLoading || (teamId && teamLoading)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 10, color: 'var(--text-muted)' }}>
        <Loader2 size={18} className="animate-spin" />
        <span style={{ fontSize: 13 }}>Loading teamâ€¦</span>
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
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11, color: '#2563FF', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Squad</div>
          <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 48, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1, margin: 0 }}>My Team</h1>
          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: 64, height: 3, background: 'linear-gradient(90deg,#2563FF,#EF3340)', transformOrigin: 'left', borderRadius: 2, marginTop: 12, marginBottom: 12 }}
          />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#64748B', margin: 0 }}>Manage your squad and track performance together.</p>
        </div>
      </motion.div>

      <TeamHeader
        team={team}
        members={members}
        myRole={myRole}
        onLeave={handleLeave}
        leaving={leaving}
      />

      {/* Premium Tab Switcher */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5EAF3',
          borderRadius: 12,
          padding: 4,
          display: 'inline-flex',
          gap: 4,
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
                background: active ? 'linear-gradient(135deg,#2563FF,#5B3DF5)' : 'transparent',
                color: active ? '#FFFFFF' : '#64748B',
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                borderRadius: 4,
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: active ? '0 4px 12px rgba(37,99,255,0.25)' : 'none',
                transition: 'all 0.2s ease',
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
      {tab === 'stats' && (
        <div style={{ position: 'relative', minHeight: 400, borderRadius: 12, overflow: 'hidden' }}>
          <TeamStats team={team} members={members} myRole={myRole} teamId={teamId} />
          {!isActive && !subLoading && (
            <UpgradeOverlay
              title="Squad Performance Analysis"
              description="See exactly where each player underperformed â€” positioning errors, kill contributions, damage breakdown, and what went wrong in each match."
              feature="squad-analysis"
            />
          )}
        </div>
      )}
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
    myRole === 'owner' ? 'badge' :
    myRole === 'igl'   ? 'badge' :
    'badge'
  const roleBadgeStyle =
    myRole === 'owner' ? { background: '#FEE2E2', color: '#EF3340', borderColor: 'rgba(239,51,64,0.25)' } :
    myRole === 'igl'   ? { background: '#FEF3C7', color: '#D97706', borderColor: 'rgba(217,119,6,0.25)' } :
    { background: '#EEF4FF', color: '#2563FF', borderColor: 'rgba(37,99,255,0.2)' }

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #E5EAF3',
        background: '#FFFFFF',
        boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
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
            opacity: 0.12,
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
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontSize: 13,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  color: 'var(--text-primary)',
                }}
              >
                [{team.tag || 'â€”'}]
              </span>
              <h1
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontWeight: 400,
                  fontSize: 32,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: '#0B1224',
                  margin: 0,
                }}
              >
                {team.name || 'Team'}
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <span className="badge">{team.memberCount ?? members.length} / 6 members</span>
              <span className="badge">{team.region || 'Other'}</span>
              <span className={roleBadgeClass} style={roleBadgeStyle}>{roleLabel}</span>
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
              {leaving ? <><Loader2 size={13} className="animate-spin" /> Leavingâ€¦</> : <><LogOut size={13} /> Leave</>}
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
        background: '#EEF4FF',
        border: '1px solid #E5EAF3',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Barlow Condensed, sans-serif',
        fontSize: 22,
        letterSpacing: '0.04em',
        color: '#2563FF',
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
      <div style={{ background: '#FFFFFF', border: '1px solid #E5EAF3', borderRadius: 16, padding: 32, boxShadow: '0 4px 20px rgba(15,23,42,0.04)', maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: 12,
            background: '#EEF4FF',
            border: '1px solid #E5EAF3',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#2563FF',
            margin: '0 auto 14px',
          }}
        >
          <Users size={26} />
        </div>
        <div
          style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: 24,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#0B1224',
            marginBottom: 6,
          }}
        >
          You're not in a team yet
        </div>
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 18 }}>
          Create your own team or join one with an invite code from your captain.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onCreate} style={{ background: '#2563FF', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={13} /> Create Team
          </button>
          <button onClick={onCreate} style={{ background: '#FFFFFF', color: '#0B1224', border: '1px solid #E5EAF3', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
