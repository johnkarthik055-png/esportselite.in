import { useEffect, useMemo, useState } from 'react'
import { collectionGroup, getDocs, query, where } from 'firebase/firestore'
import {
  BarChart3, Trophy, Percent, Crosshair, Award, Users, Loader2,
} from 'lucide-react'
import { db } from '../../utils/firebase.js'
import { getScrims } from '../../utils/team.js'

export default function TeamStats({ team, members, teamId }) {
  const [scrims, setScrims] = useState([])
  const [playerStats, setPlayerStats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!teamId) return
      setLoading(true)
      try {
        const [s, ps] = await Promise.all([
          getScrims(teamId),
          fetchPlayerStats(members),
        ])
        if (cancelled) return
        setScrims(s)
        setPlayerStats(ps)
      } catch { /* fail-soft */ }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [teamId, members])

  const stats = team?.stats || {}
  const totalMatches = Number(stats.totalMatches) || 0
  const wins = Number(stats.wins) || 0
  const totalKills = Number(stats.totalKills) || 0
  const totalPlacements = Number(stats.totalPlacements) || 0

  const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : '0.0'
  const kd = totalMatches > 0 ? (totalKills / totalMatches).toFixed(2) : '0.00'
  const avgPlacement = totalMatches > 0 ? (totalPlacements / totalMatches).toFixed(1) : '0.0'

  const recent = useMemo(
    () => scrims.filter(s => s.result).slice(0, 5),
    [scrims],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Team Stats section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontWeight: 400,
            fontSize: 24,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Team stats
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          <StatTile icon={<BarChart3 size={18} />} label="Total matches" value={totalMatches} />
          <StatTile icon={<Trophy size={18} />}    label="Wins"          value={wins}  accent="green" />
          <StatTile icon={<Percent size={18} />}   label="Win rate"      value={`${winRate}%`} />
          <StatTile icon={<Crosshair size={18} />} label="Total kills"   value={totalKills} />
          <StatTile icon={<Award size={18} />}     label="Avg placement" value={`#${avgPlacement}`} />
          <StatTile icon={<Users size={18} />}     label="Team K/D"      value={kd} />
        </div>

        {/* Recent performance */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent performance</div>
            <div className="label">Last 5 scrims</div>
          </div>
          {loading ? (
            <LoadingRow />
          ) : recent.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No scrim results yet</div>
              <div className="empty-state-desc">Results will appear here as you save them.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Opponent</th>
                    <th>Result</th>
                    <th>Kills</th>
                    <th style={{ textAlign: 'right' }}>Placement</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(s => {
                    const won = s.result?.won
                    return (
                      <tr key={s.id}>
                        <td style={{ borderLeft: `3px solid ${won ? 'var(--green)' : 'var(--red)'}` }}>
                          {s.opponent || 'TBD'}
                        </td>
                        <td>
                          {won
                            ? <span className="badge badge-green">WON</span>
                            : <span className="badge badge-red">LOST</span>}
                        </td>
                        <td className="mono">
                          {s.result?.ourKills ?? 0} / {s.result?.opponentKills ?? 0}
                        </td>
                        <td style={{ textAlign: 'right' }} className="mono">#{s.result?.placement ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Player Stats section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontWeight: 400,
            fontSize: 24,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Player stats
        </h2>

        {loading ? (
          <LoadingRow />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            {members.map(m => (
              <PlayerStatCard
                key={m.uid}
                m={m}
                data={playerStats[m.uid]}
              />
            ))}
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--text-subtle)', textAlign: 'center', marginTop: 4 }}>
          Player stats are pulled from their personal match logs. Stats improve as they log more matches.
        </div>
      </section>
    </div>
  )
}

/* ============================================================ */
function StatTile({ icon, label, value, accent }) {
  const color =
    accent === 'green' ? 'var(--green)' :
    accent === 'amber' ? 'var(--amber)' :
    'var(--text-primary)'
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
          fontWeight: 400,
          fontSize: 32,
          letterSpacing: '0.04em',
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function PlayerStatCard({ m, data }) {
  const hasData = data && data.matches > 0
  const roleBadge =
    m.role === 'owner' ? { className: 'badge badge-red', label: 'Owner' } :
    m.role === 'igl'   ? { className: 'badge badge-amber', label: 'IGL' } :
    { className: 'badge', label: 'Player' }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={m.ign} />
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
            {m.inGameRole || '—'}
          </div>
        </div>
        <span className={roleBadge.className}>{roleBadge.label}</span>
      </div>

      {hasData ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
            gap: 8,
          }}
        >
          <Mini label="Matches" value={data.matches} />
          <Mini label="K/D" value={data.kd.toFixed(2)} />
          <Mini label="Avg dmg" value={Math.round(data.avgDamage)} />
          <Mini label="Avg place" value={`#${data.avgPlacement.toFixed(1)}`} />
          <Mini label="HS %" value={`${Math.round(data.headshotPct)}%`} />
        </div>
      ) : (
        <div className="empty-state" style={{ padding: '18px 12px' }}>
          <div className="empty-state-title">No match data</div>
          <div className="empty-state-desc" style={{ fontSize: 12 }}>
            Logged matches will populate these stats.
          </div>
        </div>
      )}
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
        padding: '8px 10px',
      }}
    >
      <div
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: 18,
          letterSpacing: '0.04em',
          color: 'var(--text-primary)',
        }}
      >
        {value}
      </div>
      <div className="stat-label" style={{ marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Avatar({ name }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <div
      style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        fontFamily: 'Bebas Neue, sans-serif',
        fontSize: 15,
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
      <style>{`.animate-spin{animation:ee-ts-spin .9s linear infinite}@keyframes ee-ts-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

/* ============================================================
   Best-effort per-player aggregation from users/{uid}/matches.
   Each member's stats come from their own match log; if the
   collectionGroup read is blocked by rules this fails soft with
   `null` for every UID.
   ============================================================ */
async function fetchPlayerStats(members) {
  const out = {}
  await Promise.all(
    (members || []).map(async m => {
      try {
        const snap = await getDocs(
          query(collectionGroup(db, 'matches'), where('uid', '==', m.uid))
        )
        if (snap.empty) { out[m.uid] = null; return }
        let matches = 0, kills = 0, damage = 0, placement = 0, hs = 0, hsShots = 0, shots = 0
        snap.forEach(d => {
          const m2 = d.data() || {}
          matches++
          kills += Number(m2.kills || m2.individualKills || 0)
          damage += Number(m2.damage || 0)
          placement += Number(m2.position || m2.teamPosition || 0)
          hs += Number(m2.headshots || 0)
          hsShots += Number(m2.headshotShots || 0)
          shots += Number(m2.shots || 0)
        })
        if (matches === 0) { out[m.uid] = null; return }
        out[m.uid] = {
          matches,
          kd: kills / matches,
          avgDamage: damage / matches,
          avgPlacement: placement / matches,
          headshotPct: shots > 0
            ? (hsShots / shots) * 100
            : (kills > 0 ? (hs / kills) * 100 : 0),
        }
      } catch {
        out[m.uid] = null
      }
    })
  )
  return out
}
