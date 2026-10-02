import { useEffect, useMemo, useState } from 'react'
import { collectionGroup, getDocs, query, where } from 'firebase/firestore'
import {
  BarChart3, Trophy, Percent, Crosshair, Award, Users, Loader2,
} from 'lucide-react'
import { db } from '../../utils/firebase.js'
import { getScrims } from '../../utils/team.js'

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E5EAF3',
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
}

const badgeBase = {
  borderRadius: 20, padding: '3px 10px', fontSize: 10,
  fontFamily: 'Rajdhani, sans-serif', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.08em',
}

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
<<<<<<< HEAD
        <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 24, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#0B1224', margin: 0 }}>
=======
        <h2
          style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: 400,
            fontSize: 24,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
>>>>>>> 6f9a468 (fix: replace all old fonts with Barlow Condensed, Inter, Rajdhani, Anton)
          Team stats
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <StatTile icon={<BarChart3 size={18} />} label="Total matches" value={totalMatches} />
          <StatTile icon={<Trophy size={18} />}    label="Wins"          value={wins}  accent="green" />
          <StatTile icon={<Percent size={18} />}   label="Win rate"      value={`${winRate}%`} />
          <StatTile icon={<Crosshair size={18} />} label="Total kills"   value={totalKills} />
          <StatTile icon={<Award size={18} />}     label="Avg placement" value={`#${avgPlacement}`} />
          <StatTile icon={<Users size={18} />}     label="Team K/D"      value={kd} />
        </div>

        {/* Recent performance */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 16, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recent performance</div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B' }}>Last 5 scrims</div>
          </div>
          {loading ? (
            <LoadingRow />
          ) : recent.length === 0 ? (
            <EmptyState title="No scrim results yet" desc="Results will appear here as you save them." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E5EAF3' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B' }}>Opponent</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B' }}>Result</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B' }}>Kills</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B' }}>Placement</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(s => {
                    const won = s.result?.won
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 12px', borderLeft: `3px solid ${won ? '#16A34A' : '#EF3340'}`, color: '#0B1224' }}>
                          {s.opponent || 'TBD'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {won
                            ? <span style={{ ...badgeBase, background: '#DCFCE7', color: '#16A34A', border: '1px solid rgba(22,163,74,0.2)' }}>WON</span>
                            : <span style={{ ...badgeBase, background: '#FEE2E2', color: '#EF3340', border: '1px solid rgba(239,51,64,0.2)' }}>LOST</span>}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#475569' }}>
                          {s.result?.ourKills ?? 0} / {s.result?.opponentKills ?? 0}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>#{s.result?.placement ?? '—'}</td>
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
<<<<<<< HEAD
        <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 24, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#0B1224', margin: 0 }}>
=======
        <h2
          style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: 400,
            fontSize: 24,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
>>>>>>> 6f9a468 (fix: replace all old fonts with Barlow Condensed, Inter, Rajdhani, Anton)
          Player stats
        </h2>

        {loading ? (
          <LoadingRow />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {members.map(m => (
              <PlayerStatCard key={m.uid} m={m} data={playerStats[m.uid]} />
            ))}
          </div>
        )}

        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 4 }}>
          Player stats are pulled from their personal match logs. Stats improve as they log more matches.
        </div>
      </section>
    </div>
  )
}

/* ============================================================ */
function StatTile({ icon, label, value, accent }) {
  const color =
    accent === 'green' ? '#16A34A' :
    accent === 'amber' ? '#F59E0B' :
    '#0B1224'
  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        width: 34, height: 34,
        borderRadius: 8,
        background: '#EEF4FF',
        border: '1px solid #E5EAF3',
        color: '#2563FF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
<<<<<<< HEAD
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 32, letterSpacing: '0.04em', color, lineHeight: 1 }}>
=======
      <div
        style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          fontWeight: 400,
          fontSize: 32,
          letterSpacing: '0.04em',
          color,
          lineHeight: 1,
        }}
      >
>>>>>>> 6f9a468 (fix: replace all old fonts with Barlow Condensed, Inter, Rajdhani, Anton)
        {value}
      </div>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B' }}>{label}</div>
    </div>
  )
}

function PlayerStatCard({ m, data }) {
  const hasData = data && data.matches > 0
  const roleBadge =
    m.role === 'owner' ? { style: { background: '#FEE2E2', color: '#EF3340', border: '1px solid rgba(239,51,64,0.2)' }, label: 'Owner' } :
    m.role === 'igl'   ? { style: { background: '#FEF3C7', color: '#D97706', border: '1px solid rgba(217,119,6,0.2)' }, label: 'IGL' } :
    { style: { background: '#F1F5F9', color: '#475569', border: '1px solid #E5EAF3' }, label: 'Player' }

  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={m.ign} />
        <div style={{ flex: 1, minWidth: 0 }}>
<<<<<<< HEAD
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#0B1224', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
=======
          <div
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: 18,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
>>>>>>> 6f9a468 (fix: replace all old fonts with Barlow Condensed, Inter, Rajdhani, Anton)
            {m.ign || 'Player'}
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#64748B' }}>
            {m.inGameRole || '—'}
          </div>
        </div>
        <span style={{ ...badgeBase, ...roleBadge.style }}>{roleBadge.label}</span>
      </div>

      {hasData ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8 }}>
          <Mini label="Matches" value={data.matches} />
          <Mini label="K/D" value={data.kd.toFixed(2)} />
          <Mini label="Avg dmg" value={Math.round(data.avgDamage)} />
          <Mini label="Avg place" value={`#${data.avgPlacement.toFixed(1)}`} />
          <Mini label="HS %" value={`${Math.round(data.headshotPct)}%`} />
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '18px 12px' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 14, color: '#0B1224', textTransform: 'uppercase' }}>No match data</div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#475569', marginTop: 4 }}>
            Logged matches will populate these stats.
          </div>
        </div>
      )}
    </div>
  )
}

function Mini({ label, value }) {
  return (
<<<<<<< HEAD
    <div style={{ background: '#F8FAFD', border: '1px solid #E5EAF3', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 18, letterSpacing: '0.04em', color: '#0B1224' }}>
=======
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
          fontFamily: 'Barlow Condensed, sans-serif',
          fontSize: 18,
          letterSpacing: '0.04em',
          color: 'var(--text-primary)',
        }}
      >
>>>>>>> 6f9a468 (fix: replace all old fonts with Barlow Condensed, Inter, Rajdhani, Anton)
        {value}
      </div>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Avatar({ name }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  return (
<<<<<<< HEAD
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: '#EEF4FF',
      border: '1px solid #E5EAF3',
      color: '#2563FF',
      fontFamily: 'Barlow Condensed, sans-serif',
      fontWeight: 900,
      fontSize: 15,
      letterSpacing: '0.04em',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
=======
    <div
      style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        fontFamily: 'Barlow Condensed, sans-serif',
        fontSize: 15,
        letterSpacing: '0.04em',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
>>>>>>> 6f9a468 (fix: replace all old fonts with Barlow Condensed, Inter, Rajdhani, Anton)
      {initial}
    </div>
  )
}

function EmptyState({ title, desc }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 14, color: '#0B1224', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#475569', marginTop: 4 }}>{desc}</div>
    </div>
  )
}

function LoadingRow() {
  return (
    <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#475569' }}>
      <Loader2 size={16} className="animate-spin" />
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13 }}>Loading…</span>
      <style>{`.animate-spin{animation:ee-ts-spin .9s linear infinite}@keyframes ee-ts-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

/* ============================================================
   Best-effort per-player aggregation from users/{uid}/matches.
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
