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
import { motion } from 'framer-motion'
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

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E5EAF3',
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
}

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
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11, color: '#2563FF', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Compete</div>
          <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 48, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1, margin: 0 }}>Tournaments</h1>
          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: 64, height: 3, background: 'linear-gradient(90deg,#2563FF,#EF3340)', transformOrigin: 'left', borderRadius: 2, marginTop: 12, marginBottom: 12 }}
          />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#64748B', margin: '0 0 20px' }}>Live standings and results</p>
          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <SegGroup filters={TYPE_FILTERS}   active={typeFilter}   onChange={setTypeFilter} />
            <SegGroup filters={STATUS_FILTERS} active={statusFilter} onChange={setStatusFilter} />
          </div>
        </div>
      </motion.div>

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
   SEG GROUP
   ============================================================ */
function SegGroup({ filters, active, onChange }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5EAF3',
      borderRadius: 8,
      padding: 3,
      display: 'inline-flex',
      gap: 2,
      flexWrap: 'wrap',
    }}>
      {filters.map(f => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          style={{
            background: active === f.key ? 'linear-gradient(135deg,#2563FF,#5B3DF5)' : 'transparent',
            border: 'none',
            color: active === f.key ? '#fff' : '#64748B',
            padding: '6px 14px',
            borderRadius: 6,
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: active === f.key ? '0 2px 8px rgba(37,99,255,0.25)' : 'none',
          }}
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
      style={{
        ...cardStyle,
        borderTop: '2px solid #EF3340',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={badgeStyle('red', true)}>Featured</span>
        <TypeBadge type={tournament.type} />
        <StatusBadge status={tournament.status} />
      </div>

      <h2
        style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          fontWeight: 900,
          fontSize: 26,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#0B1224',
          margin: 0,
        }}
      >
        {tournament.name}
      </h2>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#475569' }}>
        {tournament.organizer || '—'}
      </div>

      <div
        style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          fontWeight: 900,
          fontSize: 22,
          letterSpacing: '0.04em',
          color: '#D97706',
        }}
      >
        {tournament.prizePool || 'No prize pool set'}
      </div>

      <InfoRow tournament={tournament} />

      <div>
        <button onClick={onOpen} style={{ background: '#2563FF', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onOpen}
      style={{
        ...cardStyle,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'pointer',
        borderColor: hover ? '#2563FF' : '#E5EAF3',
        boxShadow: hover ? '0 8px 24px rgba(37,99,255,0.1)' : cardStyle.boxShadow,
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <TypeBadge type={tournament.type} />
        <StatusBadge status={tournament.status} />
        {tournament.featured && (
          <span style={badgeStyle('red', true)}>Featured</span>
        )}
      </div>

      <div>
        <div
          style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: 900,
            fontSize: 20,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#0B1224',
            lineHeight: 1.2,
          }}
        >
          {tournament.name}
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#475569', marginTop: 2 }}>
          {tournament.organizer || '—'}
        </div>
      </div>

      <InfoRow tournament={tournament} compact />

      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#64748B' }}>
        {Number(tournament.totalMatches) || 0} matches played
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onOpen() }}
        style={{ background: '#FFFFFF', color: '#0B1224', border: '1px solid #E5EAF3', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 4 }}
      >
        View Standings <ArrowRight size={13} />
      </button>
    </div>
  )
}

/* ============================================================
   REUSABLE BADGES + INFO ROW
   ============================================================ */
function badgeStyle(color, strong) {
  const map = {
    red:    { bg: strong ? '#FEE2E2' : '#FEF3F2', text: '#EF3340', border: 'rgba(239,51,64,0.2)' },
    blue:   { bg: '#EEF4FF', text: '#2563FF', border: 'rgba(37,99,255,0.2)' },
    amber:  { bg: '#FEF3C7', text: '#D97706', border: 'rgba(217,119,6,0.2)' },
    green:  { bg: '#DCFCE7', text: '#16A34A', border: 'rgba(22,163,74,0.2)' },
    default:{ bg: '#F1F5F9', text: '#475569', border: '#E5EAF3' },
  }
  const c = map[color] || map.default
  return {
    background: c.bg,
    color: c.text,
    border: `1px solid ${c.border}`,
    borderRadius: 20,
    padding: '3px 10px',
    fontSize: 10,
    fontFamily: 'Rajdhani, sans-serif',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  }
}

export function TypeBadge({ type }) {
  if (type === 'community') return <span style={badgeStyle('blue')}>Community</span>
  if (type === 'official')  return <span style={badgeStyle('amber')}>Official</span>
  return <span style={badgeStyle('default')}>{String(type || 'Type').toUpperCase()}</span>
}

export function StatusBadge({ status }) {
  if (status === 'ongoing') {
    return (
      <span style={{ ...badgeStyle('green'), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span className="mk-live-dot" />
        Live
      </span>
    )
  }
  if (status === 'upcoming')  return <span style={badgeStyle('default')}>Upcoming</span>
  if (status === 'completed') return <span style={badgeStyle('default')}>Ended</span>
  return <span style={badgeStyle('default')}>{String(status || 'Status').toUpperCase()}</span>
}

function InfoRow({ tournament, compact }) {
  const maps = Array.isArray(tournament.maps) ? tournament.maps.filter(Boolean) : []
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: compact ? 6 : 10,
        fontFamily: 'Inter, sans-serif',
        fontSize: 13,
        color: '#475569',
      }}
    >
      <InfoItem icon={<Calendar size={13} />}>
        {fmtDateRange(tournament.startDate, tournament.endDate)}
      </InfoItem>
      {!compact && (
        <InfoItem icon={<Trophy size={13} />}>
          <span style={{ color: '#D97706', fontWeight: 600 }}>
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
      <span style={{ color: '#64748B', flexShrink: 0 }}>{icon}</span>
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
      minHeight: '40vh', gap: 10, color: '#475569',
    }}>
      <Loader2 size={18} className="animate-spin" />
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13 }}>Loading tournaments…</span>
      <PulseKeyframes />
    </div>
  )
}

function ErrorState({ message }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5EAF3', borderRadius: 16, padding: 20, boxShadow: '0 4px 20px rgba(15,23,42,0.04)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <AlertTriangle size={18} style={{ color: '#EF3340', flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#0B1224' }}>
          Couldn't load tournaments
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#475569', marginTop: 4 }}>
          {message}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ hasFilters }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px dashed #E5EAF3', borderRadius: 16, padding: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <Trophy size={48} style={{ color: '#E5EAF3' }} />
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 18, color: '#0B1224', textTransform: 'uppercase' }}>
        {hasFilters ? 'No tournaments match your filters' : 'No tournaments yet'}
      </div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#475569', maxWidth: 360 }}>
        {hasFilters
          ? 'Try switching the type or status filter back to All.'
          : 'Check back soon for upcoming tournaments and live standings.'}
      </div>
    </div>
  )
}

/* ============================================================
   HELPERS
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
        background: #16A34A;
        box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.6);
        animation: ee-live-pulse 1.4s ease-out infinite;
      }
      @keyframes ee-live-pulse {
        0%   { box-shadow: 0 0 0 0    rgba(22, 163, 74, 0.6); }
        70%  { box-shadow: 0 0 0 10px rgba(22, 163, 74, 0); }
        100% { box-shadow: 0 0 0 0    rgba(22, 163, 74, 0); }
      }
      .animate-spin { animation: ee-tourn-spin 0.9s linear infinite; }
      @keyframes ee-tourn-spin { to { transform: rotate(360deg); } }
    `}</style>
  )
}
