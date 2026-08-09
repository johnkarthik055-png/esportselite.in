/*
 * ADD TO FIRESTORE RULES:
 *
 * match /tournaments/{tournamentId} {
 *   allow read: if request.auth != null;
 *   allow write: if request.auth != null &&
 *     request.auth.token.email in [
 *       'karthikreddyy2010@gmail.com',
 *       'johnkarthik055@gmail.com'
 *     ];
 *   match /matches/{matchId} {
 *     allow read: if request.auth != null;
 *     allow write: if request.auth != null &&
 *       request.auth.token.email in [
 *         'karthikreddyy2010@gmail.com',
 *         'johnkarthik055@gmail.com'
 *       ];
 *   }
 * }
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, onSnapshot, orderBy, query,
} from 'firebase/firestore'
import {
  Trophy, Calendar, Map as MapIcon, ArrowRight,
  Loader2, AlertTriangle,
} from 'lucide-react'
import { db } from '../utils/firebase.js'

const TYPE_FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'community', label: 'Community' },
  { key: 'official',  label: 'Official' },
]

const STATUS_FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'upcoming',  label: 'Upcoming' },
  { key: 'ongoing',   label: 'Ongoing' },
  { key: 'completed', label: 'Completed' },
]

export default function Tournaments() {
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setList(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        /* Fall back to an un-ordered fetch if some legacy docs
           lack createdAt (which would kick them out of an
           orderBy query in some rule setups). */
        // eslint-disable-next-line no-console
        console.warn('[Tournaments] ordered snapshot failed, retrying unordered:', err)
        const alt = onSnapshot(
          collection(db, 'tournaments'),
          (snap) => {
            setList(snap.docs.map(d => ({ id: d.id, ...d.data() })))
            setLoading(false)
          },
          (e2) => { setError(e2?.message || 'Failed to load tournaments.'); setLoading(false) },
        )
        return alt
      },
    )
    return unsub
  }, [])

  const featured = useMemo(() => {
    const f = list.filter(t => t.featured)
    if (!f.length) return null
    /* Most-recently-updated wins so admins can pin a new spotlight
       just by touching updatedAt on the intended tournament. */
    return f.slice().sort((a, b) => tsMs(b.updatedAt) - tsMs(a.updatedAt))[0]
  }, [list])

  const visible = useMemo(() => {
    return list.filter(t => {
      if (typeFilter !== 'all'   && t.type   !== typeFilter)   return false
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      return true
    })
  }, [list, typeFilter, statusFilter])

  if (loading) return <LoadingState />
  if (error)   return <ErrorState message={error} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-transition">
      <Header
        typeFilter={typeFilter} onTypeFilter={setTypeFilter}
        statusFilter={statusFilter} onStatusFilter={setStatusFilter}
      />

      {featured && (
        <FeaturedCard
          tournament={featured}
          onOpen={() => navigate(`/tournaments/${featured.id}`)}
        />
      )}

      {visible.length === 0 ? (
        <EmptyState hasFilters={typeFilter !== 'all' || statusFilter !== 'all'} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {visible.map(t => (
            <TournamentCard
              key={t.id}
              tournament={t}
              onOpen={() => navigate(`/tournaments/${t.id}`)}
            />
          ))}
        </div>
      )}

      <PulseKeyframes />
    </div>
  )
}

/* ============================================================
   HEADER
   ============================================================ */
function Header({ typeFilter, onTypeFilter, statusFilter, onStatusFilter }) {
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <div>
          <h1
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontWeight: 400,
              fontSize: 28,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Tournaments
          </h1>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Live standings and results
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        <SegGroup filters={TYPE_FILTERS}   active={typeFilter}   onChange={onTypeFilter} />
        <SegGroup filters={STATUS_FILTERS} active={statusFilter} onChange={onStatusFilter} />
      </div>
    </div>
  )
}

function SegGroup({ filters, active, onChange }) {
  return (
    <div className="seg" style={segRowStyle}>
      {filters.map(f => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`seg-btn ${active === f.key ? 'active' : ''}`}
          style={segBtnStyle(active === f.key)}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

/* ============================================================
   FEATURED CARD
   ============================================================ */
function FeaturedCard({ tournament, onOpen }) {
  return (
    <div
      className="card"
      style={{
        borderTop: '2px solid var(--red)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="badge badge-red" style={{ letterSpacing: '0.10em' }}>Featured</span>
        <TypeBadge type={tournament.type} />
        <StatusBadge status={tournament.status} />
      </div>

      <h2
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontWeight: 400,
          fontSize: 26,
          letterSpacing: '0.04em',
          color: 'var(--text-primary)',
          margin: 0,
        }}
      >
        {tournament.name}
      </h2>
      <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-muted)' }}>
        {tournament.organizer || '—'}
      </div>

      <div
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: 22,
          letterSpacing: '0.04em',
          color: 'var(--gold)',
        }}
      >
        {tournament.prizePool || 'No prize pool set'}
      </div>

      <InfoRow tournament={tournament} />

      <div>
        <button onClick={onOpen} className="btn btn-primary btn-sm">
          View Standings <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   TOURNAMENT CARD
   ============================================================ */
function TournamentCard({ tournament, onOpen }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      className="card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onOpen}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'pointer',
        borderColor: hover ? 'var(--text-subtle)' : undefined,
        transition: 'border-color 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <TypeBadge type={tournament.type} />
        <StatusBadge status={tournament.status} />
        {tournament.featured && (
          <span className="badge badge-red" style={{ letterSpacing: '0.10em' }}>Featured</span>
        )}
      </div>

      <div>
        <div
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontWeight: 400,
            fontSize: 20,
            letterSpacing: '0.04em',
            color: 'var(--text-primary)',
            lineHeight: 1.2,
          }}
        >
          {tournament.name}
        </div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {tournament.organizer || '—'}
        </div>
      </div>

      <InfoRow tournament={tournament} compact />

      <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
        {Number(tournament.totalMatches) || 0} matches played
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onOpen() }}
        className="btn btn-secondary btn-sm"
        style={{ width: '100%', marginTop: 4 }}
      >
        View Standings <ArrowRight size={13} />
      </button>
    </div>
  )
}

/* ============================================================
   REUSABLE BADGES + INFO ROW
   ============================================================ */
export function TypeBadge({ type }) {
  if (type === 'community') return <span className="badge badge-blue">Community</span>
  if (type === 'official')  return <span className="badge badge-amber">Official</span>
  return <span className="badge">{String(type || 'Type').toUpperCase()}</span>
}

export function StatusBadge({ status }) {
  if (status === 'ongoing') {
    return (
      <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span className="mk-live-dot" />
        Live
      </span>
    )
  }
  if (status === 'upcoming')  return <span className="badge">Upcoming</span>
  if (status === 'completed') return <span className="badge">Ended</span>
  return <span className="badge">{String(status || 'Status').toUpperCase()}</span>
}

function InfoRow({ tournament, compact }) {
  const maps = Array.isArray(tournament.maps) ? tournament.maps.filter(Boolean) : []
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: compact ? 6 : 10,
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 13,
        color: 'var(--text-muted)',
      }}
    >
      <InfoItem icon={<Calendar size={13} />}>
        {fmtDateRange(tournament.startDate, tournament.endDate)}
      </InfoItem>
      {!compact && (
        <InfoItem icon={<Trophy size={13} />}>
          <span style={{ color: 'var(--gold)', fontWeight: 600 }}>
            {tournament.prizePool || '—'}
          </span>
        </InfoItem>
      )}
      <InfoItem icon={<MapIcon size={13} />}>
        {maps.length ? maps.join(', ') : '—'}
      </InfoItem>
    </div>
  )
}

function InfoItem({ icon, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <span style={{ color: 'var(--text-subtle)', flexShrink: 0 }}>{icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {children}
      </span>
    </span>
  )
}

/* ============================================================
   STATES
   ============================================================ */
function LoadingState() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '40vh', gap: 10, color: 'var(--text-muted)',
    }}>
      <Loader2 size={18} className="animate-spin" />
      <span style={{ fontSize: 13 }}>Loading tournaments…</span>
      <PulseKeyframes />
    </div>
  )
}

function ErrorState({ message }) {
  return (
    <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <AlertTriangle size={18} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, color: 'var(--text-primary)' }}>
          Couldn't load tournaments
        </div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {message}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ hasFilters }) {
  return (
    <div className="card empty-state">
      <Trophy size={48} className="empty-state-icon" />
      <div className="empty-state-title">
        {hasFilters ? 'No tournaments match your filters' : 'No tournaments yet'}
      </div>
      <div className="empty-state-desc">
        {hasFilters
          ? 'Try switching the type or status filter back to All.'
          : 'Check back soon for upcoming tournaments and live standings.'}
      </div>
    </div>
  )
}

/* ============================================================
   HELPERS + STYLE HOOKS
   ============================================================ */
export function tsMs(v) {
  if (v && typeof v.toMillis === 'function') return v.toMillis()
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const t = new Date(v).getTime()
    return isNaN(t) ? 0 : t
  }
  if (v instanceof Date) return v.getTime()
  return 0
}

export function fmtDateRange(start, end) {
  const s = fmtDate(start)
  const e = fmtDate(end)
  if (s && e && s !== e) return `${s} → ${e}`
  return s || e || 'Date TBD'
}

export function fmtDate(d) {
  if (!d) return ''
  const dt = typeof d === 'string' ? new Date(d) : d
  if (!(dt instanceof Date) || isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const segRowStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: 3,
  display: 'inline-flex',
  gap: 2,
  flexWrap: 'wrap',
}

function segBtnStyle(active) {
  return {
    background: active ? 'var(--bg-elevated)' : 'transparent',
    border: active ? '1px solid var(--border)' : '1px solid transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-subtle)',
    padding: '8px 14px',
    borderRadius: 4,
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
  }
}

/* One-time keyframes for the "live" pulsing dot + spinner. Rendered
   as a `<style>` node from any component that needs the animation
   so pages that mount without the loader still get the pulse. */
function PulseKeyframes() {
  return (
    <style>{`
      .mk-live-dot {
        display: inline-block;
        width: 6px; height: 6px;
        border-radius: 50%;
        background: var(--green);
        box-shadow: 0 0 0 0 rgba(0, 201, 110, 0.6);
        animation: ee-live-pulse 1.4s ease-out infinite;
      }
      @keyframes ee-live-pulse {
        0%   { box-shadow: 0 0 0 0    rgba(0, 201, 110, 0.6); }
        70%  { box-shadow: 0 0 0 10px rgba(0, 201, 110, 0); }
        100% { box-shadow: 0 0 0 0    rgba(0, 201, 110, 0); }
      }
      .animate-spin { animation: ee-tourn-spin 0.9s linear infinite; }
      @keyframes ee-tourn-spin { to { transform: rotate(360deg); } }
    `}</style>
  )
}
