import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  collection, doc, onSnapshot, orderBy, query,
} from 'firebase/firestore'
import {
  ArrowLeft, Trophy, Calendar, Map as MapIcon, Layers,
  Loader2, AlertTriangle, Crosshair,
} from 'lucide-react'
import { db } from '../utils/firebase.js'
import {
  TypeBadge, StatusBadge, fmtDate, fmtDateRange, tsMs,
} from './Tournaments.jsx'

const MEDAL_COLORS = {
  1: '#D97706',
  2: '#C0C0C0',
  3: '#CD7F32',
}
const MEDAL_ROW_BG = {
  1: 'rgba(217, 119, 6, 0.04)',
  2: 'rgba(192, 192, 192, 0.04)',
  3: 'rgba(205, 127, 50, 0.04)',
}

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E5EAF3',
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
}

export default function TournamentDetail() {
  const { tournamentId } = useParams()
  const navigate = useNavigate()
  const [tournament, setTournament] = useState(null)
  const [matches, setMatches] = useState([])
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overall')

  useEffect(() => {
    if (!tournamentId) return
    const unsub = onSnapshot(
      doc(db, 'tournaments', tournamentId),
      (snap) => {
        if (!snap.exists()) { setNotFound(true); return }
        setTournament({ id: snap.id, ...snap.data() })
      },
      (err) => setError(err?.message || 'Failed to load tournament.'),
    )
    return unsub
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId) return
    const q = query(
      collection(db, 'tournaments', tournamentId, 'matches'),
      orderBy('matchNumber', 'asc'),
    )
    const unsub = onSnapshot(
      q,
      (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => {
        /* Some matches might lack matchNumber â€” fall back to an
           unordered fetch and sort client-side by createdAt. */
        // eslint-disable-next-line no-console
        console.warn('[TournamentDetail] ordered matches snapshot failed, retrying:', err)
        const alt = onSnapshot(
          collection(db, 'tournaments', tournamentId, 'matches'),
          (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            list.sort((a, b) => {
              const an = Number(a.matchNumber)
              const bn = Number(b.matchNumber)
              if (!isNaN(an) && !isNaN(bn) && an !== bn) return an - bn
              return tsMs(a.createdAt) - tsMs(b.createdAt)
            })
            setMatches(list)
          },
        )
        return alt
      },
    )
    return unsub
  }, [tournamentId])

  const overall = useMemo(() => aggregateStandings(matches), [matches])
  const killBoard = useMemo(() => aggregateKills(matches), [matches])

  if (error) return <ErrorState message={error} onBack={() => navigate('/tournaments')} />
  if (notFound) return <NotFoundState onBack={() => navigate('/tournaments')} />
  if (!tournament) return <LoadingState />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-transition">
      <BackLink onClick={() => navigate('/tournaments')} />
      <TournamentHeader tournament={tournament} />

      <OverallLeaderboard overall={overall} />

      <MatchTabs
        matches={matches}
        active={activeTab}
        onActive={setActiveTab}
      />

      {activeTab === 'kills' ? (
        <KillBoard rows={killBoard} />
      ) : (
        <MatchDetail match={matches.find(m => m.id === activeTab)} />
      )}

      <TableStyles />
    </div>
  )
}

/* ============================================================
   HEADER + BACK
   ============================================================ */
function BackLink({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        alignSelf: 'flex-start',
        background: 'transparent',
        border: 'none',
        color: '#475569',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: 4,
        fontFamily: 'Inter, sans-serif',
        fontSize: 13,
      }}
    >
      <ArrowLeft size={14} /> Tournaments
    </button>
  )
}

function TournamentHeader({ tournament }) {
  const maps = Array.isArray(tournament.maps) ? tournament.maps.filter(Boolean) : []
  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <TypeBadge type={tournament.type} />
        <StatusBadge status={tournament.status} />
        {tournament.featured && (
          <span style={{ background: '#FEE2E2', color: '#EF3340', border: '1px solid rgba(239,51,64,0.2)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Featured</span>
        )}
      </div>

      <div>
        <h1
          style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: 400,
            fontSize: 32,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#0B1224',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {tournament.name || 'Tournament'}
        </h1>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
          {tournament.organizer || '—'}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <StatBlock
          icon={<Trophy size={14} />}
          label="Prize Pool"
          value={tournament.prizePool || 'â€”'}
          accent="#D97706"
        />
        <StatBlock
          icon={<Calendar size={14} />}
          label="Dates"
          value={fmtDateRange(tournament.startDate, tournament.endDate)}
        />
        <StatBlock
          icon={<Layers size={14} />}
          label="Format"
          value={tournament.format || 'â€”'}
        />
        <StatBlock
          icon={<MapIcon size={14} />}
          label="Maps"
          value={maps.length ? maps.join(', ') : 'â€”'}
        />
      </div>

      {tournament.description && (
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
            color: '#475569',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {tournament.description}
        </p>
      )}
    </div>
  )
}

function StatBlock({ icon, label, value, accent }) {
  return (
    <div
      style={{
        background: '#F8FAFD',
        border: '1px solid #E5EAF3',
        borderRadius: 8,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span style={{
        fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: '#64748B',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ color: '#64748B' }}>{icon}</span>
        {label}
      </span>
      <span
        style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          fontWeight: 400,
          fontSize: 20,
          letterSpacing: '0.04em',
          color: accent || '#0B1224',
          lineHeight: 1.1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  )
}

/* ============================================================
   OVERALL LEADERBOARD
   ============================================================ */
function OverallLeaderboard({ overall }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={15} style={{ color: '#64748B' }} />
          <span style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: 400,
            fontSize: 20,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#0B1224',
          }}>
            Overall Standings
          </span>
        </div>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B' }}>{overall.length} team{overall.length === 1 ? '' : 's'}</div>
      </div>
      {overall.length === 0 ? (
        <EmptyBlock title="No standings yet" desc="Match results will roll up here as they're added." />
      ) : (
        <div className="mk-table-scroll">
          <table className="mk-light-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Matches</th>
                <th>Kills</th>
                <th>Placement Pts</th>
                <th>Total Pts</th>
                <th>WWC Pts</th>
                <th>Chicken Dinners</th>
              </tr>
            </thead>
            <tbody>
              {overall.map(row => (
                <tr key={row.teamName} style={{ background: MEDAL_ROW_BG[row.rank] || undefined }}>
                  <td>
                    <RankCell rank={row.rank} />
                  </td>
                  <td style={{ fontWeight: 600, color: '#0B1224' }}>{row.teamName}</td>
                  <td style={{ fontFamily: 'Inter, sans-serif' }}>{row.matchesPlayed}</td>
                  <td style={{ fontFamily: 'Inter, sans-serif', color: '#F59E0B' }}>{row.totalKills}</td>
                  <td style={{ fontFamily: 'Inter, sans-serif' }}>{row.totalPlacementPoints}</td>
                  <td style={{ fontFamily: 'Inter, sans-serif', color: '#0B1224', fontWeight: 700 }}>{row.totalPoints}</td>
                  <td style={{ fontFamily: 'Inter, sans-serif' }}>{row.totalWWC || 'â€”'}</td>
                  <td style={{ fontFamily: 'Inter, sans-serif' }}>{row.chickenDinners || 'â€”'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RankCell({ rank }) {
  const color = MEDAL_COLORS[rank] || '#475569'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color, fontWeight: 700 }}>
      {rank === 1 && <Trophy size={13} />}
      #{rank}
    </span>
  )
}

/* ============================================================
   MATCH TABS + PER-MATCH DETAIL
   ============================================================ */
function MatchTabs({ matches, active, onActive }) {
  const tabs = [
    ...matches.map(m => ({
      id: m.id,
      label: m.round || (m.matchNumber ? `Match ${m.matchNumber}` : m.id.slice(0, 6)),
    })),
    { id: 'kills', label: 'Kill Board', accent: true },
  ]

  /* Auto-select the first tab if nothing valid is active. */
  useEffect(() => {
    if (active === 'overall' && tabs.length) onActive(tabs[0].id)
    else if (!tabs.find(t => t.id === active) && tabs.length) onActive(tabs[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.length])

  if (!tabs.length) return null

  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        overflowX: 'auto',
        borderBottom: '1px solid #E5EAF3',
        paddingBottom: 1,
      }}
    >
      {tabs.map(t => {
        const isActive = active === t.id
        return (
          <button
            key={t.id}
            onClick={() => onActive(t.id)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '10px 14px',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              fontWeight: 500,
              color: isActive ? '#0B1224' : '#64748B',
              borderBottom: `2px solid ${isActive ? '#2563FF' : 'transparent'}`,
              marginBottom: -1,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
          >
            {t.accent && <Crosshair size={12} style={{ color: '#F59E0B' }} />}
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function MatchDetail({ match }) {
  if (!match) {
    return (
      <div style={cardStyle}>
        <EmptyBlock title="Pick a match" desc="Choose a match tab to see per-match standings." />
      </div>
    )
  }

  const standings = Array.isArray(match.standings) ? match.standings : []
  const rows = standings.slice().sort(
    (a, b) => (Number(b.totalPoints) || 0) - (Number(a.totalPoints) || 0),
  ).map((row, i) => ({ ...row, rank: Number(row.rank) || (i + 1) }))

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title" style={{
          fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 400,
          fontSize: 20, letterSpacing: '0.04em',
        }}>
          {match.round || `Match ${match.matchNumber || ''}`}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {match.map && <span style={{ background: '#EEF4FF', color: '#2563FF', border: '1px solid rgba(37,99,255,0.2)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{match.map}</span>}
          {match.date && (
            <span style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E5EAF3', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {fmtDate(match.date)}
            </span>
          )}
          <MatchStatusBadge status={match.status} />
        </div>
      </div>

      {match.status === 'upcoming' || rows.length === 0 ? (
        <EmptyBlock
          title={match.status === 'upcoming' ? 'Match not played yet' : 'No standings yet'}
          desc={match.status === 'upcoming' ? 'Standings will appear here once the match is completed.' : 'Waiting for admin to upload results.'}
        />
      ) : (
        <div className="mk-table-scroll">
          <table className="mk-light-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Kills</th>
                <th>Placement Pts</th>
                <th>Total Pts</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.teamName}-${i}`} style={{ background: MEDAL_ROW_BG[row.rank] || undefined }}>
                  <td><RankCell rank={row.rank} /></td>
                  <td style={{ fontWeight: 600, color: '#0B1224' }}>{row.teamName || 'â€”'}</td>
                  <td style={{ fontFamily: 'Inter, sans-serif', color: '#F59E0B' }}>{Number(row.kills) || 0}</td>
                  <td style={{ fontFamily: 'Inter, sans-serif' }}>{Number(row.placementPoints) || 0}</td>
                  <td style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>{Number(row.totalPoints) || 0}</td>
                  <td style={{ fontFamily: 'Inter, sans-serif', color: '#475569', fontSize: 12 }}>{row.notes || 'â€”'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function MatchStatusBadge({ status }) {
  if (status === 'completed') return <span style={{ background: '#DCFCE7', color: '#16A34A', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Completed</span>
  if (status === 'upcoming')  return <span style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E5EAF3', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Upcoming</span>
  return <span style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E5EAF3', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{String(status || '').toUpperCase() || 'â€”'}</span>
}

/* ============================================================
   KILL BOARD
   ============================================================ */
function KillBoard({ rows }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Crosshair size={15} style={{ color: '#F59E0B' }} />
          <span style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: 400,
            fontSize: 20,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#0B1224',
          }}>
            Kill Leaderboard
          </span>
        </div>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B' }}>Top {rows.length}</div>
      </div>
      {rows.length === 0 ? (
        <EmptyBlock title="No kills logged" desc="Kill counts will appear here as matches are added." />
      ) : (
        <div className="mk-table-scroll">
          <table className="mk-light-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Total Kills</th>
                <th>Avg / Match</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.teamName} style={{ background: MEDAL_ROW_BG[row.rank] || undefined }}>
                  <td><RankCell rank={row.rank} /></td>
                  <td style={{ fontWeight: 600, color: '#0B1224' }}>{row.teamName}</td>
                  <td style={{ fontFamily: 'Inter, sans-serif', color: '#F59E0B', fontWeight: 700 }}>{row.totalKills}</td>
                  <td style={{ fontFamily: 'Inter, sans-serif', color: '#475569' }}>{row.avg.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   AGGREGATION
   ============================================================ */
function aggregateStandings(matches) {
  const bucket = new Map()
  for (const m of matches) {
    const standings = Array.isArray(m.standings) ? m.standings : []
    for (const s of standings) {
      const name = (s.teamName || '').trim()
      if (!name) continue
      const b = bucket.get(name) || {
        teamName: name,
        totalKills: 0,
        totalPlacementPoints: 0,
        totalPoints: 0,
        totalWWC: 0,
        chickenDinners: 0,
        matchesPlayed: 0,
      }
      b.totalKills            += Number(s.kills)            || 0
      b.totalPlacementPoints  += Number(s.placementPoints)  || 0
      b.totalPoints           += Number(s.totalPoints)      || 0
      b.totalWWC              += Number(s.wwcPoints)        || 0
      b.chickenDinners        += Number(s.chickenDinners)   || (Number(s.rank) === 1 ? 1 : 0)
      b.matchesPlayed++
      bucket.set(name, b)
    }
  }
  const rows = Array.from(bucket.values())
  rows.sort((a, b) => (b.totalPoints - a.totalPoints)
                   || (b.totalKills  - a.totalKills)
                   || a.teamName.localeCompare(b.teamName))
  rows.forEach((r, i) => { r.rank = i + 1 })
  return rows
}

function aggregateKills(matches) {
  const bucket = new Map()
  for (const m of matches) {
    const standings = Array.isArray(m.standings) ? m.standings : []
    for (const s of standings) {
      const name = (s.teamName || '').trim()
      if (!name) continue
      const b = bucket.get(name) || { teamName: name, totalKills: 0, matches: 0 }
      b.totalKills += Number(s.kills) || 0
      b.matches++
      bucket.set(name, b)
    }
  }
  const rows = Array.from(bucket.values())
    .map(r => ({ ...r, avg: r.matches ? r.totalKills / r.matches : 0 }))
  rows.sort((a, b) => (b.totalKills - a.totalKills)
                   || a.teamName.localeCompare(b.teamName))
  const top = rows.slice(0, 10)
  top.forEach((r, i) => { r.rank = i + 1 })
  return top
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
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13 }}>Loading tournamentâ€¦</span>
      <TableStyles />
    </div>
  )
}

function ErrorState({ message, onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="page-transition">
      <BackLink onClick={onBack} />
      <div style={{ ...cardStyle, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <AlertTriangle size={18} style={{ color: '#EF3340', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, color: 'var(--text-primary)' }}>
            Couldn't load this tournament
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {message}
          </div>
        </div>
      </div>
    </div>
  )
}

function NotFoundState({ onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="page-transition">
      <BackLink onClick={onBack} />
      <div style={{ ...cardStyle, textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Trophy size={48} style={{ color: '#E5EAF3' }} />
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 18, color: '#0B1224', textTransform: 'uppercase' }}>Tournament not found</div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#475569' }}>It may have been deleted or the link is out of date.</div>
      </div>
    </div>
  )
}

function EmptyBlock({ title, desc }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 16, color: '#0B1224', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#475569' }}>{desc}</div>
    </div>
  )
}

/* ============================================================
   STYLES
   ============================================================ */
function TableStyles() {
  return (
    <style>{`
      .mk-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .mk-table-scroll .mk-light-table { min-width: 620px; }
      .mk-light-table { width: 100%; border-collapse: collapse; font-family: Inter, sans-serif; font-size: 13px; }
      .mk-light-table thead tr { border-bottom: 2px solid #E5EAF3; }
      .mk-light-table th { padding: 8px 12px; text-align: left; font-family: Rajdhani, sans-serif; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748B; white-space: nowrap; }
      .mk-light-table td { padding: 10px 12px; border-bottom: 1px solid #F1F5F9; color: #475569; font-size: 13px; }
      .mk-light-table tbody tr:hover { background: #F8FAFD; }
      .mk-light-table tbody tr:last-child td { border-bottom: none; }
      .animate-spin { animation: ee-tourn-detail-spin 0.9s linear infinite; }
      @keyframes ee-tourn-detail-spin { to { transform: rotate(360deg); } }
    `}</style>
  )
}
