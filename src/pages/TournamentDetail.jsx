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
  1: 'var(--gold)',
  2: '#C0C0C0',
  3: '#CD7F32',
}
const MEDAL_ROW_BG = {
  1: 'rgba(255, 215, 0, 0.05)',
  2: 'rgba(192, 192, 192, 0.05)',
  3: 'rgba(205, 127, 50, 0.05)',
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
        /* Some matches might lack matchNumber — fall back to an
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
        color: 'var(--text-muted)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: 4,
        fontFamily: 'DM Sans, sans-serif',
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
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <TypeBadge type={tournament.type} />
        <StatusBadge status={tournament.status} />
        {tournament.featured && (
          <span className="badge badge-red" style={{ letterSpacing: '0.10em' }}>Featured</span>
        )}
      </div>

      <div>
        <h1
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontWeight: 400,
            fontSize: 32,
            letterSpacing: '0.04em',
            color: 'var(--text-primary)',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {tournament.name || 'Tournament'}
        </h1>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
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
          value={tournament.prizePool || '—'}
          accent="var(--gold)"
        />
        <StatBlock
          icon={<Calendar size={14} />}
          label="Dates"
          value={fmtDateRange(tournament.startDate, tournament.endDate)}
        />
        <StatBlock
          icon={<Layers size={14} />}
          label="Format"
          value={tournament.format || '—'}
        />
        <StatBlock
          icon={<MapIcon size={14} />}
          label="Maps"
          value={maps.length ? maps.join(', ') : '—'}
        />
      </div>

      {tournament.description && (
        <p
          style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 14,
            color: 'var(--text-muted)',
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
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span style={{
        fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--text-subtle)',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ color: 'var(--text-subtle)' }}>{icon}</span>
        {label}
      </span>
      <span
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontWeight: 400,
          fontSize: 20,
          letterSpacing: '0.04em',
          color: accent || 'var(--text-primary)',
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
    <div className="card">
      <div className="card-header">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={15} style={{ color: 'var(--text-subtle)' }} />
          <span style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontWeight: 400,
            fontSize: 20,
            letterSpacing: '0.04em',
          }}>
            Overall Standings
          </span>
        </div>
        <div className="label">{overall.length} team{overall.length === 1 ? '' : 's'}</div>
      </div>
      {overall.length === 0 ? (
        <EmptyBlock title="No standings yet" desc="Match results will roll up here as they're added." />
      ) : (
        <div className="mk-table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th className="mono">Matches</th>
                <th className="mono">Kills</th>
                <th className="mono">Placement Pts</th>
                <th className="mono">Total Pts</th>
                <th className="mono">WWC Pts</th>
                <th className="mono">Chicken Dinners</th>
              </tr>
            </thead>
            <tbody>
              {overall.map(row => (
                <tr key={row.teamName} style={{ background: MEDAL_ROW_BG[row.rank] || undefined }}>
                  <td>
                    <RankCell rank={row.rank} />
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.teamName}</td>
                  <td className="mono">{row.matchesPlayed}</td>
                  <td className="mono" style={{ color: 'var(--amber)' }}>{row.totalKills}</td>
                  <td className="mono">{row.totalPlacementPoints}</td>
                  <td className="mono" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{row.totalPoints}</td>
                  <td className="mono">{row.totalWWC || '—'}</td>
                  <td className="mono">{row.chickenDinners || '—'}</td>
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
  const color = MEDAL_COLORS[rank] || 'var(--text-muted)'
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
        borderBottom: '1px solid var(--border)',
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
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 13,
              fontWeight: 500,
              color: isActive ? 'var(--text-primary)' : 'var(--text-subtle)',
              borderBottom: `2px solid ${isActive ? 'var(--red)' : 'transparent'}`,
              marginBottom: -1,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
          >
            {t.accent && <Crosshair size={12} style={{ color: 'var(--amber)' }} />}
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
      <div className="card">
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
          fontFamily: 'Bebas Neue, sans-serif', fontWeight: 400,
          fontSize: 20, letterSpacing: '0.04em',
        }}>
          {match.round || `Match ${match.matchNumber || ''}`}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {match.map && <span className="badge badge-blue">{match.map}</span>}
          {match.date && (
            <span className="badge" style={{ color: 'var(--text-muted)' }}>
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
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th className="mono">Kills</th>
                <th className="mono">Placement Pts</th>
                <th className="mono">Total Pts</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.teamName}-${i}`} style={{ background: MEDAL_ROW_BG[row.rank] || undefined }}>
                  <td><RankCell rank={row.rank} /></td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.teamName || '—'}</td>
                  <td className="mono" style={{ color: 'var(--amber)' }}>{Number(row.kills) || 0}</td>
                  <td className="mono">{Number(row.placementPoints) || 0}</td>
                  <td className="mono" style={{ fontWeight: 700 }}>{Number(row.totalPoints) || 0}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{row.notes || '—'}</td>
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
  if (status === 'completed') return <span className="badge badge-green">Completed</span>
  if (status === 'upcoming')  return <span className="badge">Upcoming</span>
  return <span className="badge">{String(status || '').toUpperCase() || '—'}</span>
}

/* ============================================================
   KILL BOARD
   ============================================================ */
function KillBoard({ rows }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Crosshair size={15} style={{ color: 'var(--amber)' }} />
          <span style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontWeight: 400,
            fontSize: 20,
            letterSpacing: '0.04em',
          }}>
            Kill Leaderboard
          </span>
        </div>
        <div className="label">Top {rows.length}</div>
      </div>
      {rows.length === 0 ? (
        <EmptyBlock title="No kills logged" desc="Kill counts will appear here as matches are added." />
      ) : (
        <div className="mk-table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th className="mono">Total Kills</th>
                <th className="mono">Avg / Match</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.teamName} style={{ background: MEDAL_ROW_BG[row.rank] || undefined }}>
                  <td><RankCell rank={row.rank} /></td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.teamName}</td>
                  <td className="mono" style={{ color: 'var(--amber)', fontWeight: 700 }}>{row.totalKills}</td>
                  <td className="mono" style={{ color: 'var(--text-muted)' }}>{row.avg.toFixed(1)}</td>
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
      minHeight: '40vh', gap: 10, color: 'var(--text-muted)',
    }}>
      <Loader2 size={18} className="animate-spin" />
      <span style={{ fontSize: 13 }}>Loading tournament…</span>
      <TableStyles />
    </div>
  )
}

function ErrorState({ message, onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="page-transition">
      <BackLink onClick={onBack} />
      <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <AlertTriangle size={18} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, color: 'var(--text-primary)' }}>
            Couldn't load this tournament
          </div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
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
      <div className="card empty-state">
        <Trophy size={48} className="empty-state-icon" />
        <div className="empty-state-title">Tournament not found</div>
        <div className="empty-state-desc">It may have been deleted or the link is out of date.</div>
      </div>
    </div>
  )
}

function EmptyBlock({ title, desc }) {
  return (
    <div className="empty-state">
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-desc">{desc}</div>
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
      .mk-table-scroll .table { min-width: 620px; }
      .animate-spin { animation: ee-tourn-detail-spin 0.9s linear infinite; }
      @keyframes ee-tourn-detail-spin { to { transform: rotate(360deg); } }
    `}</style>
  )
}
