import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  collection, limit, onSnapshot, orderBy, query, where,
} from 'firebase/firestore'
import { Trophy, ArrowRight } from 'lucide-react'
import { db } from '../../utils/firebase.js'

const MEDAL_COLORS = {
  1: 'var(--gold)',
  2: '#C0C0C0',
  3: '#CD7F32',
}

/* Featured Tournament widget for the Dashboard.
 * - Subscribes to the single most-recent tournament with
 *   featured == true (via a where + orderBy query).
 * - Once we have that tournament, subscribes to its matches
 *   subcollection and aggregates a top-3 leaderboard.
 * - Renders nothing if there's no featured tournament, so the
 *   Dashboard flow is untouched until an admin picks one. */
export default function FeaturedTournamentCard() {
  const [tournament, setTournament] = useState(null)
  const [matches, setMatches] = useState([])
  const [error, setError] = useState(false)

  /* Featured tournament subscription. */
  useEffect(() => {
    let unsub = () => {}
    try {
      const q = query(
        collection(db, 'tournaments'),
        where('featured', '==', true),
        orderBy('updatedAt', 'desc'),
        limit(1),
      )
      unsub = onSnapshot(
        q,
        (snap) => {
          const d = snap.docs[0]
          setTournament(d ? { id: d.id, ...d.data() } : null)
        },
        () => {
          /* If the composite index isn't provisioned yet, degrade
             to an unfiltered pass and pick the featured one client
             side. Dashboard still works — just a touch slower. */
          const unsubAll = onSnapshot(
            collection(db, 'tournaments'),
            (snap) => {
              const featured = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(t => t.featured)
                .sort((a, b) => tsMs(b.updatedAt) - tsMs(a.updatedAt))
              setTournament(featured[0] || null)
            },
            () => setError(true),
          )
          unsub = unsubAll
        },
      )
    } catch {
      setError(true)
    }
    return () => unsub()
  }, [])

  /* Matches subscription, only after we know which tournament. */
  useEffect(() => {
    if (!tournament?.id) { setMatches([]); return }
    const unsub = onSnapshot(
      collection(db, 'tournaments', tournament.id, 'matches'),
      (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => setMatches([]),
    )
    return unsub
  }, [tournament?.id])

  const top3 = useMemo(() => aggregateTop3(matches), [matches])

  if (error || !tournament) return null

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card-header" style={{ marginBottom: 0 }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={15} style={{ color: 'var(--gold)' }} />
          Featured Tournament
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <TypeBadgeInline type={tournament.type} />
          <StatusBadgeInline status={tournament.status} />
        </div>
      </div>

      <div>
        <div
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontWeight: 400,
            fontSize: 18,
            letterSpacing: '0.04em',
            color: 'var(--text-primary)',
            lineHeight: 1.2,
          }}
        >
          {tournament.name || 'Tournament'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {tournament.organizer || '—'}
        </div>
      </div>

      {tournament.prizePool && (
        <div
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 18,
            letterSpacing: '0.04em',
            color: 'var(--gold)',
          }}
        >
          {tournament.prizePool}
        </div>
      )}

      {top3.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
          No standings yet — check back once matches begin.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {top3.map(row => (
            <li
              key={row.teamName}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '6px 10px',
              }}
            >
              <span style={{
                fontFamily: 'Bebas Neue, sans-serif',
                fontSize: 16,
                color: MEDAL_COLORS[row.rank] || 'var(--text-muted)',
                minWidth: 22,
                textAlign: 'center',
              }}>
                #{row.rank}
              </span>
              <span style={{
                flex: 1,
                fontSize: 13,
                color: 'var(--text-primary)',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {row.teamName}
              </span>
              <span style={{
                fontFamily: 'SF Mono, monospace',
                fontSize: 12,
                color: 'var(--text-muted)',
              }}>
                {row.totalPoints} pts
              </span>
            </li>
          ))}
        </ul>
      )}

      <Link
        to={`/tournaments/${tournament.id}`}
        className="btn btn-secondary btn-sm"
        style={{ width: '100%', justifyContent: 'center' }}
      >
        View Full Standings <ArrowRight size={13} />
      </Link>
    </div>
  )
}

/* ============================================================
   HELPERS (kept local — Dashboard imports one thing.)
   ============================================================ */
function aggregateTop3(matches) {
  const bucket = new Map()
  for (const m of matches) {
    const standings = Array.isArray(m.standings) ? m.standings : []
    for (const s of standings) {
      const name = (s.teamName || '').trim()
      if (!name) continue
      const b = bucket.get(name) || { teamName: name, totalPoints: 0 }
      b.totalPoints += Number(s.totalPoints) || 0
      bucket.set(name, b)
    }
  }
  const rows = Array.from(bucket.values())
  rows.sort((a, b) => b.totalPoints - a.totalPoints || a.teamName.localeCompare(b.teamName))
  return rows.slice(0, 3).map((r, i) => ({ ...r, rank: i + 1 }))
}

function tsMs(v) {
  if (v && typeof v.toMillis === 'function') return v.toMillis()
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const t = new Date(v).getTime()
    return isNaN(t) ? 0 : t
  }
  if (v instanceof Date) return v.getTime()
  return 0
}

function TypeBadgeInline({ type }) {
  if (type === 'community') return <span className="badge badge-blue">Community</span>
  if (type === 'official')  return <span className="badge badge-amber">Official</span>
  return null
}

function StatusBadgeInline({ status }) {
  if (status === 'ongoing') return <span className="badge badge-green">Live</span>
  if (status === 'upcoming') return <span className="badge">Upcoming</span>
  if (status === 'completed') return <span className="badge">Ended</span>
  return null
}
