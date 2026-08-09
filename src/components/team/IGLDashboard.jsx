import { useEffect, useMemo, useState } from 'react'
import { collectionGroup, getDocs, query, where } from 'firebase/firestore'
import {
  Trophy, Crosshair, Flame, TrendingDown, Loader2, Target,
  UserCheck, UserX, AlertTriangle, ChevronDown, ChevronUp, Users,
} from 'lucide-react'
import { db } from '../../utils/firebase.js'
import { getPractices } from '../../utils/team.js'

/* ============================================================
   IGL Dashboard — squad-level insights for owner/IGL.
   Renders `null` for anyone else so the tab never leaks.
   ============================================================ */
export default function IGLDashboard({ team, members, myRole, teamId }) {
  const [playerMatches, setPlayerMatches] = useState({})   /* uid → matches[] */
  const [practices, setPractices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (myRole !== 'owner' && myRole !== 'igl') return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [byUid, prac] = await Promise.all([
          fetchAllMatches(members),
          getPractices(teamId),
        ])
        if (cancelled) return
        setPlayerMatches(byUid)
        setPractices(prac)
      } catch { /* fail-soft */ }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [teamId, members, myRole])

  if (myRole !== 'owner' && myRole !== 'igl') return null

  const perPlayer = useMemo(
    () => members.map((m) => ({ member: m, stats: computeStats(playerMatches[m.uid] || []) })),
    [members, playerMatches],
  )

  const overview = useMemo(() => computeOverview(perPlayer), [perPlayer])
  const heatmap = useMemo(() => computeSquadHeatmap(perPlayer), [perPlayer])
  const attendance = useMemo(() => computeAttendance(practices, members), [practices, members])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* SECTION 1 — Squad overview */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionHeading>Squad overview</SectionHeading>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <OverviewTile icon={<Trophy size={18} />}   label="Total squad matches" value={overview.totalMatches} />
          <OverviewTile icon={<Flame size={18} />}    label="Best K/D player"     value={overview.bestKd?.name || '—'}
            sub={overview.bestKd ? `KD ${overview.bestKd.kd.toFixed(2)}` : ''} />
          <OverviewTile icon={<Crosshair size={18} />} label="Most matches"        value={overview.mostMatches?.name || '—'}
            sub={overview.mostMatches ? `${overview.mostMatches.count} matches` : ''} />
          <OverviewTile icon={<TrendingDown size={18} />} label="Improvement needed" value={overview.needsWork?.name || '—'}
            sub={overview.needsWork ? overview.needsWork.top : ''} />
        </div>
      </section>

      {/* SECTION 2 — Player performance grid */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionHeading>Player performance</SectionHeading>
        {loading ? <LoadingRow /> : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 14,
            }}
          >
            {perPlayer.map(({ member, stats }) => (
              <PlayerCard key={member.uid} m={member} stats={stats} />
            ))}
          </div>
        )}
      </section>

      {/* SECTION 3 — Squad weakness heatmap */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionHeading>Squad weakness heatmap</SectionHeading>
        <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: -6 }}>
          Combined analysis across all players.
        </div>
        <div className="card">
          {heatmap.top.length === 0 ? (
            <div className="empty-state">
              <Target size={32} className="empty-state-icon" />
              <div className="empty-state-title">No weakness data yet</div>
              <div className="empty-state-desc">Weaknesses show up as players log matches.</div>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {heatmap.top.map((row) => (
                <li key={row.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: row.color }}>
                      {row.count} mention{row.count === 1 ? '' : 's'} · {row.players.length} player{row.players.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="xp-bar-track">
                    <div className="xp-bar-fill" style={{ width: `${row.percentage}%`, background: row.color }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {heatmap.focus.length > 0 && (
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Recommended focus areas</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 12,
              }}
            >
              {heatmap.focus.slice(0, 3).map((f) => (
                <div key={f.name} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                    {f.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                    Most flagged by: <span style={{ color: 'var(--text-primary)' }}>{f.players.join(', ')}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
                    Suggested drill: <span style={{ color: 'var(--text-primary)' }}>{f.drill}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* SECTION 4 — Attendance overview */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionHeading>Attendance overview</SectionHeading>
        <div className="card">
          {loading ? <LoadingRow /> : attendance.rows.length === 0 ? (
            <div className="empty-state">
              <UserCheck size={32} className="empty-state-icon" />
              <div className="empty-state-title">No practice history yet</div>
              <div className="empty-state-desc">Attendance appears once you schedule sessions.</div>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Practice</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Present</th>
                      <th style={{ textAlign: 'right' }}>Late</th>
                      <th style={{ textAlign: 'right' }}>Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.title}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{r.date || '—'}</td>
                        <td style={{ textAlign: 'right', color: 'var(--green)' }}>{r.present}</td>
                        <td style={{ textAlign: 'right', color: 'var(--amber)' }}>{r.late}</td>
                        <td style={{ textAlign: 'right', color: 'var(--red)' }}>{r.absent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {attendance.mostAbsent && (
                <div
                  style={{
                    marginTop: 14,
                    padding: '10px 12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <UserX size={14} style={{ color: 'var(--text-muted)' }} />
                  <span className="label">Most absent</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {attendance.mostAbsent.name}
                  </span>
                  <span className="badge badge-red">
                    {attendance.mostAbsent.absent} absence{attendance.mostAbsent.absent === 1 ? '' : 's'}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <style>{`.animate-spin{animation:ee-igl-spin .9s linear infinite}@keyframes ee-igl-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

/* ============================================================
   PLAYER CARD
   ============================================================ */
function PlayerCard({ m, stats }) {
  const [expanded, setExpanded] = useState(false)
  const teamRoleBadge =
    m.role === 'owner' ? { className: 'badge badge-red', label: 'Owner' } :
    m.role === 'igl'   ? { className: 'badge badge-amber', label: 'IGL' } :
    { className: 'badge', label: 'Player' }

  const hasData = stats.matches > 0

  /* Top weakness picking */
  const topWeakness = stats.topWeakness
  const bar = topWeakness
    ? weaknessBar(topWeakness.count, stats.matches)
    : null

  /* Last 5 result circles */
  const last5 = stats.last5   /* array of 'win'|'loss'|null */

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={m.ign} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 18,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {m.ign || 'Player'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
            {m.inGameRole || 'Unassigned'}
          </div>
        </div>
        <span className={teamRoleBadge.className}>{teamRoleBadge.label}</span>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
        }}
      >
        <Mini label="Matches" value={stats.matches} />
        <Mini label="Avg KD" value={stats.kd.toFixed(2)} />
        <Mini label="Avg dmg" value={Math.round(stats.avgDamage)} />
        <Mini label="Avg place" value={`#${stats.avgPlacement.toFixed(1)}`} />
      </div>

      {/* Weakness bar */}
      {topWeakness && bar && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Top weakness: <span style={{ color: 'var(--text-primary)' }}>{topWeakness.name}</span></span>
            <span style={{ color: bar.color, fontWeight: 600 }}>{Math.round(bar.percentage)}%</span>
          </div>
          <div className="xp-bar-track">
            <div className="xp-bar-fill" style={{ width: `${bar.percentage}%`, background: bar.color }} />
          </div>
        </div>
      )}

      {/* Last 5 circles */}
      <div>
        <div className="label" style={{ marginBottom: 6 }}>Last 5 matches</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {last5.map((r, i) => (
            <ResultDot key={i} result={r} />
          ))}
        </div>
      </div>

      {/* Expand */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 12,
          fontWeight: 600,
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        {expanded ? <>Hide full stats <ChevronUp size={13} /></> : <>View full stats <ChevronDown size={13} /></>}
      </button>

      {expanded && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* All weaknesses */}
          <div>
            <div className="label" style={{ marginBottom: 6 }}>All weaknesses</div>
            {stats.weaknesses.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>None logged.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {stats.weaknesses.map((w) => (
                  <li key={w.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{w.name}</span>
                    <span className="mono" style={{ color: 'var(--text-primary)' }}>×{w.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Best / worst */}
          {hasData && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 8,
              }}
            >
              <Mini label="Avg damage" value={Math.round(stats.avgDamage)} />
              {stats.best && (
                <Mini
                  label="Best match"
                  value={`${stats.best.kills} kills`}
                />
              )}
              {stats.worst && (
                <Mini
                  label="Worst match"
                  value={`#${stats.worst.placement}`}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultDot({ result }) {
  const size = 16
  if (result === 'win') {
    return <span style={{ width: size, height: size, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
  }
  if (result === 'loss') {
    return <span style={{ width: size, height: size, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />
  }
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'transparent',
        border: '1px solid var(--border)',
        display: 'inline-block',
      }}
    />
  )
}

/* ============================================================
   TILES / MINI PARTS
   ============================================================ */
function SectionHeading({ children }) {
  return (
    <h2
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
      {children}
    </h2>
  )
}

function OverviewTile({ icon, label, value, sub }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          width: 34, height: 34,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: 26,
          letterSpacing: '0.04em',
          color: 'var(--text-primary)',
          lineHeight: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
      <div className="stat-label">{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{sub}</div>}
    </div>
  )
}

function Mini({ label, value }) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '6px 8px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 20, letterSpacing: '0.04em', color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  )
}

function Avatar({ name, size = 40 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        fontFamily: 'Bebas Neue, sans-serif',
        fontSize: Math.round(size * 0.45),
        letterSpacing: '0.04em',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  )
}

function LoadingRow() {
  return (
    <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)' }}>
      <Loader2 size={16} className="animate-spin" /> <span style={{ fontSize: 13 }}>Loading…</span>
    </div>
  )
}

/* ============================================================
   COMPUTATION HELPERS
   ============================================================ */
const HEATMAP_SKILLS = [
  { name: 'Spray Control', keywords: ['spray', 'recoil', 'burst', 'auto'], drill: 'Recoil Master' },
  { name: 'Close Range',   keywords: ['close', 'tdm', 'hipfire', 'jiggle', 'peek', 'rush'], drill: 'TDM warm-up' },
  { name: 'Mid Range',     keywords: ['mid', 'medium', '2x', '3x'], drill: 'Mid-range ADS' },
  { name: 'Long Range',    keywords: ['long', 'snipe', 'scope', '6x', '8x'], drill: 'Sniper practice' },
  { name: 'Movement',      keywords: ['movement', 'rotate', 'position', 'zone', 'jump'], drill: 'Movement drills' },
  { name: 'Rotations',     keywords: ['rotation', 'zone', 'circle', 'ring', 'third'], drill: 'Rotation review' },
  { name: 'Team Play',     keywords: ['callout', 'squad', 'team', 'sync', 'revive', 'communication'], drill: 'Comms scrim' },
  { name: 'Survival',      keywords: ['survive', 'heal', 'loot', 'placement', 'endgame', 'zone'], drill: 'Endgame practice' },
]

async function fetchAllMatches(members) {
  const out = {}
  await Promise.all(
    (members || []).map(async (m) => {
      try {
        const snap = await getDocs(
          query(collectionGroup(db, 'matches'), where('uid', '==', m.uid))
        )
        const list = []
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }))
        out[m.uid] = list
      } catch {
        out[m.uid] = []
      }
    })
  )
  return out
}

function computeStats(matches) {
  const empty = {
    matches: 0,
    kd: 0,
    avgDamage: 0,
    avgPlacement: 0,
    topWeakness: null,
    weaknesses: [],
    last5: [null, null, null, null, null],
    best: null,
    worst: null,
  }
  if (!matches || matches.length === 0) return empty

  let kills = 0, damage = 0, placementSum = 0, placementCount = 0
  const weaknessCounts = {}
  matches.forEach((m) => {
    kills += Number(m.kills || m.individualKills || 0)
    damage += Number(m.damage || 0)
    const p = Number(m.position || m.teamPosition || 0)
    if (p > 0) { placementSum += p; placementCount++ }
    /* Weakness parsing — both string and array forms */
    const raw =
      Array.isArray(m.weakestPoints) && m.weakestPoints.length > 0 ? m.weakestPoints.join(' ') :
      m.weaknesses || m.weakestPoint || m.weakness || ''
    const str = String(raw).toLowerCase()
    HEATMAP_SKILLS.forEach((skill) => {
      if (skill.keywords.some((k) => str.includes(k))) {
        weaknessCounts[skill.name] = (weaknessCounts[skill.name] || 0) + 1
      }
    })
  })

  const total = matches.length
  const weaknesses = Object.entries(weaknessCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  /* Sort matches by timestamp desc for last-5 */
  const chrono = [...matches].sort((a, b) => {
    const at = a.timestamp || a.createdAt?.toMillis?.() || 0
    const bt = b.timestamp || b.createdAt?.toMillis?.() || 0
    return bt - at
  })

  const last5 = []
  for (let i = 0; i < 5; i++) {
    const m = chrono[i]
    if (!m) { last5.push(null); continue }
    const place = Number(m.position || m.teamPosition || 0)
    if (!place) { last5.push(null); continue }
    last5.push(place <= 3 ? 'win' : 'loss')
  }

  const withKills = matches.filter((m) => Number(m.kills || m.individualKills || 0) > 0)
  const best = withKills.length > 0
    ? [...withKills].sort((a, b) => (Number(b.kills || b.individualKills) - Number(a.kills || a.individualKills)))[0]
    : null
  const worstList = matches.filter((m) => Number(m.position || m.teamPosition || 0) > 0)
  const worst = worstList.length > 0
    ? [...worstList].sort((a, b) => (Number(b.position || b.teamPosition) - Number(a.position || a.teamPosition)))[0]
    : null

  return {
    matches: total,
    kd: kills / total,
    avgDamage: damage / total,
    avgPlacement: placementCount > 0 ? placementSum / placementCount : 0,
    topWeakness: weaknesses[0] || null,
    weaknesses,
    last5,
    best: best ? { kills: Number(best.kills || best.individualKills || 0) } : null,
    worst: worst ? { placement: Number(worst.position || worst.teamPosition || 0) } : null,
  }
}

function weaknessBar(count, total) {
  if (!total) return null
  const pct = Math.min(100, Math.round((count / total) * 100))
  const color =
    pct >= 50 ? 'var(--red)' :
    pct >= 25 ? 'var(--amber)' :
    'var(--green)'
  return { percentage: pct, color }
}

function computeOverview(perPlayer) {
  let totalMatches = 0
  let bestKd = null, mostMatches = null, needsWork = null
  perPlayer.forEach(({ member, stats }) => {
    totalMatches += stats.matches
    if (stats.matches > 0 && (!bestKd || stats.kd > bestKd.kd)) {
      bestKd = { name: member.ign || 'Player', kd: stats.kd }
    }
    if (stats.matches > 0 && (!mostMatches || stats.matches > mostMatches.count)) {
      mostMatches = { name: member.ign || 'Player', count: stats.matches }
    }
    if (stats.topWeakness && (!needsWork || stats.topWeakness.count > needsWork.count)) {
      needsWork = { name: member.ign || 'Player', top: stats.topWeakness.name, count: stats.topWeakness.count }
    }
  })
  return { totalMatches, bestKd, mostMatches, needsWork }
}

function computeSquadHeatmap(perPlayer) {
  const totals = {}
  const playersByWeakness = {}
  let squadMatches = 0
  perPlayer.forEach(({ member, stats }) => {
    squadMatches += stats.matches
    stats.weaknesses.forEach((w) => {
      totals[w.name] = (totals[w.name] || 0) + w.count
      if (!playersByWeakness[w.name]) playersByWeakness[w.name] = []
      playersByWeakness[w.name].push({ name: member.ign || 'Player', count: w.count })
    })
  })
  const list = Object.entries(totals)
    .map(([name, count]) => {
      const players = (playersByWeakness[name] || []).sort((a, b) => b.count - a.count)
      const drill = HEATMAP_SKILLS.find((s) => s.name === name)?.drill || 'Practice module'
      const pct = squadMatches > 0
        ? Math.min(100, Math.round((count / squadMatches) * 100))
        : Math.min(100, count * 15)
      const color =
        pct >= 50 ? 'var(--red)' :
        pct >= 25 ? 'var(--amber)' :
        'var(--green)'
      return {
        name, count, percentage: pct, color,
        players: players.map((p) => p.name),
        drill,
      }
    })
    .sort((a, b) => b.count - a.count)

  return {
    top: list.slice(0, 6),
    focus: list.slice(0, 3),
  }
}

function computeAttendance(practices, members) {
  const past = (practices || []).filter((p) => {
    const today = new Date().toISOString().split('T')[0]
    return (p.date || '') < today
  })
  const recent = past.slice(0, 5)

  const rows = recent.map((p) => {
    const att = p.attendance || {}
    let present = 0, late = 0, absent = 0
    Object.values(att).forEach((s) => {
      if (s === 'present') present++
      else if (s === 'late') late++
      else if (s === 'absent') absent++
    })
    return {
      id: p.id,
      title: p.title || 'Practice',
      date: p.date || '',
      present, late, absent,
    }
  })

  /* Aggregate absences to find "most absent" player */
  const absentCounts = {}
  recent.forEach((p) => {
    const att = p.attendance || {}
    Object.entries(att).forEach(([uid, s]) => {
      if (s === 'absent') absentCounts[uid] = (absentCounts[uid] || 0) + 1
    })
  })
  let mostAbsent = null
  Object.entries(absentCounts).forEach(([uid, count]) => {
    if (!mostAbsent || count > mostAbsent.absent) {
      const m = (members || []).find((x) => x.uid === uid)
      mostAbsent = { name: m?.ign || 'Player', absent: count }
    }
  })

  return { rows, mostAbsent }
}
