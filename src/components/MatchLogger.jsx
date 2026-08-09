/**
 * MatchLogger.jsx
 *
 * Standalone match logger component extracted from Training.jsx.
 * Handles Classic / Scrims / Tournament match logging with:
 *   • Firestore persistence via addMatch()
 *   • XP awards via updateXP() (Classic +30, Scrims +35, Tournament +40)
 *   • Session banner + End Match Session modal
 */

import { useRef, useState } from 'react'
import {
  Swords,
  Crosshair,
  Trophy,
  BarChart3,
  Save,
  Trash2,
  Filter,
} from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useSuggestions } from '../hooks/useSuggestions.js'
import { useSwipeGesture } from '../hooks/useSwipeGesture.js'
import { useUserData } from '../hooks/useUserData.js'
import { isTrialExpired } from '../utils/trial.js'
import { useAuth } from '../context/AuthContext.jsx'
import { addMatch } from '../utils/db.js'
import {
  STORAGE_KEYS,
  MAPS_CLASSIC,
  MAPS_SCRIMS,
  CLASSIC_TEAM_SIZES,
  teamSizeLabel,
} from '../utils/constants.js'
import { uid, formatDateShort } from '../utils/helpers.js'
import StageManager from './StageManager.jsx'
import SuggestionDropdown from './SuggestionDropdown.jsx'
import PerformanceGraphs from './PerformanceGraphs.jsx'
import CalendarStrip from './CalendarStrip.jsx'

/* XP amounts per match type */
const MATCH_XP = { Classic: 30, Scrims: 35, Tournament: 40 }

const TYPE_TABS = [
  { id: 'Classic',     label: 'Classic',     icon: Swords   },
  { id: 'Scrims',      label: 'Scrims',       icon: Crosshair },
  { id: 'Tournament',  label: 'Tournament',   icon: Trophy   },
  { id: 'Performance', label: 'Performance',  icon: BarChart3 },
]

const EMPTY_FORM = {
  Classic: {
    teamSize: 'Squad', map: 'Erangel', position: '', kills: '',
    weakestPoints: [], strongestPoints: [], notes: '',
  },
  Scrims: {
    map: 'Erangel', teamPosition: '', teamKills: '', individualKills: '',
    weakestPoints: [], strongestPoints: [], notes: '',
  },
  Tournament: {
    tournamentName: '', stage: 'Group Stage', map: 'Erangel',
    teamPosition: '', teamKills: '', individualKills: '',
    weakestPoints: [], strongestPoints: [], notes: '',
  },
}

/* Row color helpers */
function positionColorFor(pos) {
  const p = Number(pos)
  if (!p || Number.isNaN(p)) return '#555566'
  if (p <= 3)  return '#00E676'
  if (p <= 10) return '#FFD700'
  if (p <= 20) return '#FF9800'
  return '#555566'
}
function killsColorFor(k) {
  const n = Number(k) || 0
  if (n >= 8) return '#00E676'
  if (n >= 4) return '#FFD700'
  return '#9999AA'
}

export default function MatchLogger() {
  const [matches, setMatches] = useLocalStorage(STORAGE_KEYS.MATCHES, [])
  const [activeType, setActiveType] = useState('Classic')
  const [forms, setForms] = useState(EMPTY_FORM)
  const [filter, setFilter] = useState('All')
  const [toast, setToast] = useState('')

  const { getById } = useSuggestions()
  const { updateXP } = useUserData()
  const formRef = useRef(null)
  const { user: authUser } = useAuth()
  const trialExpired = isTrialExpired(authUser?.uid)

  const SUB_ORDER = ['Classic', 'Scrims', 'Tournament', 'Performance']
  const subSwipe = useSwipeGesture({
    onSwipeLeft:  () => { const i = SUB_ORDER.indexOf(activeType); if (i >= 0 && i < SUB_ORDER.length - 1) setActiveType(SUB_ORDER[i + 1]) },
    onSwipeRight: () => { const i = SUB_ORDER.indexOf(activeType); if (i > 0) setActiveType(SUB_ORDER[i - 1]) },
  })

  const form = forms[activeType]

  function pointsLabel(idsField, legacyField, m) {
    if (Array.isArray(m[idsField]) && m[idsField].length > 0) {
      return m[idsField].map(id => getById(id)?.name).filter(Boolean).join(', ')
    }
    return m[legacyField] || ''
  }

  function update(field, value) {
    setForms(prev => ({ ...prev, [activeType]: { ...prev[activeType], [field]: value } }))
  }

  async function logMatch() {
    if (trialExpired) {
      setToast('Free trial ended — premium plan coming soon.')
      setTimeout(() => setToast(''), 2500)
      return
    }

    const entry = { id: uid(), type: activeType, timestamp: Date.now(), ...form }
    if (activeType === 'Classic') {
      entry.position = form.position ? Number(form.position) : null
      entry.kills    = form.kills    ? Number(form.kills)    : 0
    } else {
      entry.teamPosition    = form.teamPosition    ? Number(form.teamPosition)    : null
      entry.teamKills       = form.teamKills       ? Number(form.teamKills)       : 0
      entry.individualKills = form.individualKills ? Number(form.individualKills) : 0
    }

    /* Dual-write: localStorage (immediate UI) + Firestore (persistence) */
    setMatches(prev => [entry, ...prev])
    addMatch(entry).catch(() => { /* ignore Firestore failure */ })

    /* XP: Classic +30 / Scrims +35 / Tournament +40 */
    updateXP(MATCH_XP[activeType] || 30)

    setForms(prev => ({ ...prev, [activeType]: EMPTY_FORM[activeType] }))
    setToast('Match logged successfully.')
    setTimeout(() => setToast(''), 2500)
  }

  function deleteMatch(id) { setMatches(prev => prev.filter(m => m.id !== id)) }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const filtered = filter === 'All' ? matches : matches.filter(m => m.type === filter)

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Calendar */}
      <CalendarStrip context="matches" onTodayAction={scrollToForm} />

      {/* Sub-tabs */}
      <div
        ref={formRef}
        className="flex gap-2 border-b border-border overflow-x-auto whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0"
        {...subSwipe}
      >
        {TYPE_TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setActiveType(t.id)}
              className={`tab-btn flex items-center gap-2 flex-shrink-0 ${activeType === t.id ? 'active' : ''}`}
            >
              <Icon size={15} /> {t.label}
            </button>
          )
        })}
      </div>

      {activeType === 'Performance' ? (
        <PerformanceGraphs />
      ) : (
        <>
          {/* Form */}
          <div className="glass clip-corner-sm p-6 lg:p-7 relative">
            <div className="flex items-center justify-between mb-5">
              <h3 className="heading text-xl text-white tracking-wide">Log {activeType} Match</h3>
              <span className="pill pill-red text-xs mono">{activeType.toUpperCase()}</span>
            </div>

            {activeType === 'Classic'    && <ClassicForm    form={form} update={update} />}
            {activeType === 'Scrims'     && <ScrimsForm     form={form} update={update} />}
            {activeType === 'Tournament' && <TournamentForm form={form} update={update} />}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={logMatch}
                disabled={trialExpired}
                title={trialExpired ? 'Free trial ended — premium plan coming soon' : undefined}
                className="btn-red px-6 py-3 rounded-md text-sm uppercase tracking-[0.15em] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} /> Log Match
              </button>
              {toast && (
                <span className="toast-success px-3 py-2 rounded-md text-xs mono">{toast}</span>
              )}
            </div>
          </div>

          {/* Match table */}
          <div className="glass clip-corner-sm p-6 lg:p-7">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div>
                <h3 className="heading text-xl text-white tracking-wide">Match History</h3>
                <p className="text-xs text-text-secondary uppercase tracking-widest mt-1">
                  {matches.length} total {matches.length === 1 ? 'entry' : 'entries'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-text-secondary" />
                <select
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  className="input-field py-2 px-3 text-sm"
                >
                  <option value="All">All Types</option>
                  <option value="Classic">Classic</option>
                  <option value="Scrims">Scrims</option>
                  <option value="Tournament">Tournament</option>
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-3 opacity-70">📋</div>
                <p className="text-text-secondary">No matches logged yet. Start tracking your performance.</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="match-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Type</th><th>Map</th>
                      <th>Position</th><th>Kills</th>
                      <th>Weakest</th><th>Strongest</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(m => {
                      const pos = m.type === 'Classic' ? m.position : m.teamPosition
                      const indKills = m.type === 'Classic' ? Number(m.kills) || 0 : Number(m.individualKills) || 0
                      const killsDisplay = m.type === 'Classic' ? m.kills : `${m.individualKills ?? 0} / ${m.teamKills ?? 0}`
                      const rowColor  = positionColorFor(pos)
                      const killColor = killsColorFor(indKills)
                      const isHardMode = m.type === 'Classic' && m.teamSize === 'solo_vs_squad'
                      return (
                        <tr key={m.id}>
                          <td className="mono text-text-secondary text-sm" style={{ borderLeft: `3px solid ${rowColor}` }}>
                            {formatDateShort(m.timestamp)}
                          </td>
                          <td>
                            <span className={'pill text-xs ' + (m.type === 'Tournament' ? 'bg-[rgba(255,215,0,0.1)] border-[rgba(255,215,0,0.35)] text-gold' : m.type === 'Scrims' ? 'pill-red' : '')}>
                              {m.type}
                              {m.type === 'Classic' && m.teamSize && (
                                <span className="ml-1 text-[10px] opacity-80">• {teamSizeLabel(m.teamSize)}</span>
                              )}
                              {m.type === 'Tournament' && m.tournamentName && (
                                <span className="ml-1 text-[10px] opacity-80">• {m.tournamentName}</span>
                              )}
                            </span>
                          </td>
                          <td>{m.map}</td>
                          <td className="mono whitespace-nowrap" style={{ color: rowColor }}>
                            {Number(pos) === 1 && <span className="mr-1">🏆</span>}
                            {isHardMode && <span className="mr-1">💀</span>}
                            #{pos ?? '—'}
                          </td>
                          <td className="mono" style={{ color: killColor }}>{killsDisplay ?? 0}</td>
                          <td className="text-sm text-text-secondary max-w-[180px] truncate" title={pointsLabel('weakestPoints', 'weakestPoint', m)}>
                            {pointsLabel('weakestPoints', 'weakestPoint', m) || '—'}
                          </td>
                          <td className="text-sm text-text-secondary max-w-[180px] truncate" title={pointsLabel('strongestPoints', 'strongestPoint', m)}>
                            {pointsLabel('strongestPoints', 'strongestPoint', m) || '—'}
                          </td>
                          <td className="text-right">
                            <button
                              onClick={() => deleteMatch(m.id)}
                              className="p-2 rounded-md text-text-secondary hover:text-accent-secondary hover:bg-[rgba(232,0,28,0.08)] transition-all"
                              title="Delete match"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  )
}

/* ─── Form helpers ──────────────────────────────────────────── */

function FormField({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs uppercase tracking-[0.15em] text-text-secondary mb-2 heading">
        {label}
      </label>
      {children}
    </div>
  )
}

function ClassicForm({ form, update }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <FormField label="Match Type">
        <input type="text" value="Classic" readOnly className="input-field opacity-70 cursor-not-allowed" />
      </FormField>
      <FormField label="Team Size">
        <div className="seg w-full flex-wrap">
          {CLASSIC_TEAM_SIZES.map(t => (
            <button key={t.id} onClick={() => update('teamSize', t.id)}
              className={`seg-btn flex-1 whitespace-nowrap ${form.teamSize === t.id ? 'active' : ''}`}>
              {t.label}
            </button>
          ))}
        </div>
        {form.teamSize === 'solo_vs_squad' && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-warning/15 border border-warning/40 text-warning text-xs">
            🎯 <span className="heading uppercase tracking-widest">Hard mode</span>
            <span className="text-text-secondary">— playing solo against squads</span>
          </div>
        )}
      </FormField>
      <FormField label="Map">
        <select value={form.map} onChange={e => update('map', e.target.value)} className="input-field">
          {MAPS_CLASSIC.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </FormField>
      <FormField label="Position (1–100)">
        <input type="number" min="1" max="100" value={form.position}
          onChange={e => update('position', e.target.value)} className="input-field" placeholder="e.g. 4" />
      </FormField>
      <FormField label="Kills">
        <input type="number" min="0" value={form.kills}
          onChange={e => update('kills', e.target.value)} className="input-field" placeholder="e.g. 6" />
      </FormField>
      <div />
      <FormField label="Weakest Points">
        <SuggestionDropdown value={form.weakestPoints} onChange={ids => update('weakestPoints', ids)} placeholder="Pick or type a weakness…" />
      </FormField>
      <FormField label="Strongest Points">
        <SuggestionDropdown value={form.strongestPoints} onChange={ids => update('strongestPoints', ids)} placeholder="Pick or type a strength…" />
      </FormField>
      <FormField label="Notes" className="md:col-span-2">
        <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3}
          className="input-field resize-none" placeholder="Any reflections, rotation calls, mistakes..." />
      </FormField>
    </div>
  )
}

function ScrimsForm({ form, update }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <FormField label="Match Type">
        <input type="text" value="Scrims" readOnly className="input-field opacity-70 cursor-not-allowed" />
      </FormField>
      <FormField label="Map">
        <select value={form.map} onChange={e => update('map', e.target.value)} className="input-field">
          {MAPS_SCRIMS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </FormField>
      <FormField label="Team Position (1–16)">
        <input type="number" min="1" max="16" value={form.teamPosition}
          onChange={e => update('teamPosition', e.target.value)} className="input-field" placeholder="e.g. 3" />
      </FormField>
      <FormField label="Overall Kills (Team)">
        <input type="number" min="0" value={form.teamKills}
          onChange={e => update('teamKills', e.target.value)} className="input-field" placeholder="e.g. 12" />
      </FormField>
      <FormField label="Individual Kills">
        <input type="number" min="0" value={form.individualKills}
          onChange={e => update('individualKills', e.target.value)} className="input-field" placeholder="e.g. 4" />
      </FormField>
      <div />
      <FormField label="Weakest Points">
        <SuggestionDropdown value={form.weakestPoints} onChange={ids => update('weakestPoints', ids)} placeholder="Pick or type a weakness…" />
      </FormField>
      <FormField label="Strongest Points">
        <SuggestionDropdown value={form.strongestPoints} onChange={ids => update('strongestPoints', ids)} placeholder="Pick or type a strength…" />
      </FormField>
      <FormField label="Notes" className="md:col-span-2">
        <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3}
          className="input-field resize-none" placeholder="Team communication notes, callouts..." />
      </FormField>
    </div>
  )
}

function TournamentForm({ form, update }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <FormField label="Tournament Name" className="md:col-span-2">
        <input type="text" value={form.tournamentName}
          onChange={e => update('tournamentName', e.target.value)}
          className="input-field" placeholder="e.g. BMPS 2025 Season 1" />
      </FormField>
      <FormField label="Stage">
        <StageManager value={form.stage} onChange={name => update('stage', name)} />
      </FormField>
      <FormField label="Map">
        <select value={form.map} onChange={e => update('map', e.target.value)} className="input-field">
          {MAPS_SCRIMS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </FormField>
      <FormField label="Team Position (1–16)">
        <input type="number" min="1" max="16" value={form.teamPosition}
          onChange={e => update('teamPosition', e.target.value)} className="input-field" placeholder="e.g. 2" />
      </FormField>
      <FormField label="Overall Kills (Team)">
        <input type="number" min="0" value={form.teamKills}
          onChange={e => update('teamKills', e.target.value)} className="input-field" placeholder="e.g. 15" />
      </FormField>
      <FormField label="Individual Kills">
        <input type="number" min="0" value={form.individualKills}
          onChange={e => update('individualKills', e.target.value)} className="input-field" placeholder="e.g. 5" />
      </FormField>
      <div />
      <FormField label="Weakest Points">
        <SuggestionDropdown value={form.weakestPoints} onChange={ids => update('weakestPoints', ids)} placeholder="Pick or type a weakness…" />
      </FormField>
      <FormField label="Strongest Points">
        <SuggestionDropdown value={form.strongestPoints} onChange={ids => update('strongestPoints', ids)} placeholder="Pick or type a strength…" />
      </FormField>
      <FormField label="Notes" className="md:col-span-2">
        <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3}
          className="input-field resize-none" placeholder="Bracket details, opponents, key moments..." />
      </FormField>
    </div>
  )
}
