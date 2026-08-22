import { LAYER_GROUPS, VERIFIED_SPAWN_DATA, SPAWN_STATUS } from '../../utils/strategyDataSchema.js'
import { getSpawnReference } from '../../utils/spawnReferenceData.js'
import { useStrategyStore, toggleLayerGroup, toggleSpawnRef } from './strategyStore.js'
import { SectionLabel } from './strategyUI.jsx'

export default function LayersPanel({ mapId }) {
  const st = useStrategyStore()
  const vehicleStatus = VERIFIED_SPAWN_DATA[mapId]?.vehicle ?? SPAWN_STATUS.PENDING
  const boatStatus = VERIFIED_SPAWN_DATA[mapId]?.boat ?? SPAWN_STATUS.PENDING
  const vehiclePositions = getSpawnReference(mapId, 'vehicle')
  const boatPositions = getSpawnReference(mapId, 'boat')

  return (
    <div className="card">
      <SectionLabel>Layers</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
        {LAYER_GROUPS.map(g => {
          const count = st.objects.filter(o => o.phase === st.activePhase && g.match(o)).length
          const active = st.visibleLayerGroups.has(g.key)
          return (
            <LayerRow key={g.key} active={active} onClick={() => toggleLayerGroup(g.key)} label={g.label} count={count} />
          )
        })}
      </div>

      <SectionLabel small>Vehicle Spawns (Reference Data)</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <SpawnRefRow
          status={vehicleStatus} label="Vehicle Spawns"
          active={st.showSpawnRefVehicle} onClick={() => toggleSpawnRef('vehicle')}
          count={vehiclePositions?.length || 0}
        />
        <SpawnRefRow
          status={boatStatus} label="Boat Spawns"
          active={st.showSpawnRefBoat} onClick={() => toggleSpawnRef('boat')}
          count={boatPositions?.length || 0}
          notApplicableLabel="No boat spawns on this map"
        />
      </div>
    </div>
  )
}

function SpawnRefRow({ status, label, active, onClick, count, notApplicableLabel }) {
  if (status === SPAWN_STATUS.VERIFIED) {
    return <LayerRow active={active} onClick={onClick} label={label} count={count} />
  }
  if (status === SPAWN_STATUS.NOT_APPLICABLE) {
    return <NotApplicableRow label={label} detail={notApplicableLabel} />
  }
  return <UnavailableRow label={label} />
}

function LayerRow({ active, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px', background: 'transparent', border: 'none',
        borderRadius: 6, cursor: 'pointer', width: '100%', textAlign: 'left',
        fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-primary)',
      }}
    >
      <span aria-hidden style={{
        width: 15, height: 15, borderRadius: 4, flexShrink: 0,
        background: active ? 'var(--blue)' : 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 9, fontWeight: 800,
      }}>
        {active ? '✓' : ''}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{
        fontSize: 10, color: 'var(--text-subtle)', background: 'var(--bg-elevated)',
        border: '1px solid var(--border)', padding: '1px 7px', borderRadius: 999,
      }}>
        {count}
      </span>
    </button>
  )
}

function UnavailableRow({ label }) {
  return (
    <div
      title="No verified spawn coordinates exist for this map yet — nothing is plotted rather than guessing. This kind of spawn does exist in-game here; the data just hasn't been wired in yet."
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px', borderRadius: 6,
        fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-subtle)',
        opacity: 0.6,
      }}
    >
      <span style={{ width: 15, height: 15, borderRadius: 4, flexShrink: 0, border: '1px dashed var(--border)' }} />
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontSize: 10, fontStyle: 'italic' }}>Data unavailable</span>
    </div>
  )
}

/* Distinct from UnavailableRow on purpose: this isn't a data gap that
   might get filled in later, it's a confirmed permanent fact about
   the map (e.g. Rondo has no navigable water, so it has no boat
   spawns to ever find) — a solid "—" glyph instead of a dashed empty
   box, and copy that says "not on this map" rather than "unavailable",
   so it doesn't read as a to-do. */
function NotApplicableRow({ label, detail }) {
  return (
    <div
      title={detail ? `${detail} — confirmed, not pending data.` : 'This spawn kind does not exist on this map — confirmed, not pending data.'}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px', borderRadius: 6,
        fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-subtle)',
        opacity: 0.55,
      }}
    >
      <span style={{
        width: 15, height: 15, borderRadius: 4, flexShrink: 0,
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, lineHeight: 1, color: 'var(--text-subtle)',
      }}>
        &mdash;
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontSize: 10, fontStyle: 'italic' }}>{detail || 'Not on this map'}</span>
    </div>
  )
}
