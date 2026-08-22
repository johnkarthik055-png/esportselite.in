/* ============================================================
   STRATEGY MAKER — STATE STORE
   ------------------------------------------------------------
   Same pattern MapKnowledge.jsx already uses for its Dev Editor
   drawing state (a module-scoped mutable object + a tiny
   EventTarget bus, subscribed to via a hook that just forces a
   re-render on change) — kept consistent rather than introducing
   a second state-management approach for one page.

   Map isolation (Issue 17): objects are cleared whenever the
   active map changes to one the store wasn't already tracking,
   so switching Erangel -> Miramar never carries the previous
   map's objects along. Loading a saved strategy (which is always
   fetched from that map's own Firestore subcollection already)
   then repopulates objects for the map it belongs to.
   ============================================================ */
import { useEffect, useState } from 'react'
import {
  createEmptyStrategy, createStrategyObject, PHASES, DEFAULT_VISIBLE_LAYER_GROUPS,
} from '../../utils/strategyDataSchema.js'

const bus = new EventTarget()
function fire() { bus.dispatchEvent(new Event('change')) }

const MAX_HISTORY = 50

export const strategyStore = {
  mapId: null,
  tool: 'select',
  activeType: {
    marker: 'player_position',
    rotation: 'safe_rotation',
    combat: 'attack',
    utility: 'smoke',
    vision: 'line_of_sight',
    zone: 'zone',
    vehicle: 'vehicle_pickup',
  },
  activeFormationKey: null,
  activePlayerId: null,
  activePhase: 'phase-1',
  viewMode: 'coach', /* 'coach' | 'player' */
  playerModeSelectedId: null,
  visibleLayerGroups: new Set(DEFAULT_VISIBLE_LAYER_GROUPS),
  showSpawnRefVehicle: false,
  showSpawnRefBoat: false,
  selectedObjectId: null,
  measureFrom: null,
  measureTo: null,
  drafting: null, /* in-progress multi-click placement */

  strategyDocId: null,
  name: '',
  description: '',
  gameMode: 'Scrim',
  tags: [],
  players: [],
  phases: PHASES.map(p => ({ id: p.id, name: p.name })),
  objects: [],

  history: [],
  future: [],
}

export function useStrategyStore() {
  const [, tick] = useState(0)
  useEffect(() => {
    function onChange() { tick(v => v + 1) }
    bus.addEventListener('change', onChange)
    return () => bus.removeEventListener('change', onChange)
  }, [])
  return strategyStore
}

/* ---- map isolation ---- */
export function resetForMap(mapId) {
  if (strategyStore.mapId === mapId) return
  strategyStore.mapId = mapId
  strategyStore.objects = []
  strategyStore.selectedObjectId = null
  strategyStore.drafting = null
  strategyStore.measureFrom = null
  strategyStore.measureTo = null
  strategyStore.history = []
  strategyStore.future = []
  const fresh = createEmptyStrategy(mapId)
  strategyStore.strategyDocId = null
  strategyStore.name = fresh.name
  strategyStore.description = fresh.description
  strategyStore.gameMode = fresh.mode
  strategyStore.tags = fresh.tags
  strategyStore.players = fresh.players
  strategyStore.phases = fresh.phases
  fire()
}

/* ---- undo/redo ---- */
function snapshot() {
  return JSON.stringify(strategyStore.objects)
}
function pushHistory() {
  strategyStore.history.push(snapshot())
  if (strategyStore.history.length > MAX_HISTORY) strategyStore.history.shift()
  strategyStore.future = []
}
export function undo() {
  if (strategyStore.history.length === 0) return
  strategyStore.future.push(snapshot())
  strategyStore.objects = JSON.parse(strategyStore.history.pop())
  strategyStore.selectedObjectId = null
  fire()
}
export function redo() {
  if (strategyStore.future.length === 0) return
  strategyStore.history.push(snapshot())
  strategyStore.objects = JSON.parse(strategyStore.future.pop())
  strategyStore.selectedObjectId = null
  fire()
}

/* ---- tool / selection ---- */
export function setTool(tool) {
  strategyStore.tool = tool
  strategyStore.drafting = null
  if (tool !== 'select') strategyStore.selectedObjectId = null
  if (tool !== 'measure') { strategyStore.measureFrom = null; strategyStore.measureTo = null }
  fire()
}
export function setActiveType(tool, key) {
  strategyStore.activeType[tool] = key
  fire()
}
export function setActiveFormationKey(key) {
  strategyStore.activeFormationKey = key
  fire()
}
export function setActivePlayer(id) {
  strategyStore.activePlayerId = id
  fire()
}
export function setActivePhase(id) {
  strategyStore.activePhase = id
  strategyStore.selectedObjectId = null
  fire()
}
export function setViewMode(mode) {
  strategyStore.viewMode = mode
  strategyStore.selectedObjectId = null
  strategyStore.drafting = null
  fire()
}
export function setPlayerModeSelectedId(id) {
  strategyStore.playerModeSelectedId = id
  fire()
}
export function selectObject(id) {
  strategyStore.selectedObjectId = id
  fire()
}
export function setDrafting(drafting) {
  strategyStore.drafting = drafting
  fire()
}
export function setMeasurePoints(from, to) {
  strategyStore.measureFrom = from
  strategyStore.measureTo = to
  fire()
}
export function toggleLayerGroup(key) {
  const next = new Set(strategyStore.visibleLayerGroups)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  strategyStore.visibleLayerGroups = next
  fire()
}
export function toggleSpawnRef(kind) {
  if (kind === 'vehicle') strategyStore.showSpawnRefVehicle = !strategyStore.showSpawnRefVehicle
  else strategyStore.showSpawnRefBoat = !strategyStore.showSpawnRefBoat
  fire()
}

/* ---- object CRUD ---- */
export function addObject(partial) {
  pushHistory()
  const obj = createStrategyObject({
    ...partial,
    player: partial.player ?? strategyStore.activePlayerId,
    phase: partial.phase ?? strategyStore.activePhase,
    color: partial.color,
  })
  strategyStore.objects = [...strategyStore.objects, obj]
  strategyStore.selectedObjectId = obj.id
  strategyStore.drafting = null
  fire()
  return obj
}
export function addObjects(partials) {
  pushHistory()
  const created = partials.map(p => createStrategyObject({
    ...p,
    player: p.player ?? strategyStore.activePlayerId,
    phase: p.phase ?? strategyStore.activePhase,
  }))
  strategyStore.objects = [...strategyStore.objects, ...created]
  fire()
  return created
}
export function updateObject(id, patch, { silent } = {}) {
  if (!silent) pushHistory()
  strategyStore.objects = strategyStore.objects.map(o => o.id === id ? { ...o, ...patch } : o)
  fire()
}
export function deleteObject(id) {
  pushHistory()
  strategyStore.objects = strategyStore.objects.filter(o => o.id !== id)
  if (strategyStore.selectedObjectId === id) strategyStore.selectedObjectId = null
  fire()
}
export function deleteSelected() {
  if (!strategyStore.selectedObjectId) return
  deleteObject(strategyStore.selectedObjectId)
}
export function clearAllObjects() {
  pushHistory()
  strategyStore.objects = []
  strategyStore.selectedObjectId = null
  fire()
}

/* ---- players / metadata ---- */
export function setPlayers(players) { strategyStore.players = players; fire() }
export function setName(name) { strategyStore.name = name; fire() }
export function setDescription(description) { strategyStore.description = description; fire() }
export function setGameMode(mode) { strategyStore.gameMode = mode; fire() }
export function setTags(tags) { strategyStore.tags = tags; fire() }
export function setStrategyDocId(id) { strategyStore.strategyDocId = id; fire() }

/* ---- save / load ---- */
export function toSaveableDoc() {
  return {
    name: strategyStore.name.trim(),
    description: strategyStore.description.trim(),
    map: strategyStore.mapId,
    mode: strategyStore.gameMode,
    tags: strategyStore.tags,
    phases: strategyStore.phases,
    players: strategyStore.players,
    objects: strategyStore.objects,
    isPublic: false,
  }
}
export function loadStrategyData(data) {
  strategyStore.strategyDocId = data.strategyId ?? data.id ?? null
  strategyStore.name = data.name || ''
  strategyStore.description = data.description || ''
  strategyStore.gameMode = data.mode || 'Scrim'
  strategyStore.tags = Array.isArray(data.tags) ? data.tags : []
  strategyStore.phases = Array.isArray(data.phases) && data.phases.length
    ? data.phases
    : PHASES.map(p => ({ id: p.id, name: p.name }))
  strategyStore.players = Array.isArray(data.players) && data.players.length
    ? data.players
    : createEmptyStrategy(strategyStore.mapId).players
  strategyStore.objects = Array.isArray(data.objects) ? data.objects : []
  strategyStore.activePhase = strategyStore.phases[0]?.id || 'phase-1'
  strategyStore.selectedObjectId = null
  strategyStore.history = []
  strategyStore.future = []
  fire()
}
