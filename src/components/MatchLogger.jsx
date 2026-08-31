/**
 * MatchLogger.jsx
 *
 * Standalone match logger component extracted from Training.jsx.
 * Handles Classic / Scrims / Tournament match logging with:
 *   • Firestore persistence via addMatch()
 *   • XP awards via updateXP() (Classic +30, Scrims +35, Tournament +40)
 *   • Session banner + End Match Session modal
 */

import { useMemo, useRef, useState } from 'react'
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
import { useUserTeamId, useTeam } from '../hooks/useTeam.js'
import { isTrialExpired } from '../utils/trial.js'
import { useAuth } from '../context/AuthContext.jsx'
import { addMatch } from '../utils/db.js'
import ScreenshotImport from './matchlogger/ScreenshotImport.jsx'
import {
  STORAGE_KEYS,
  MAPS_CLASSIC,
  MAPS_SCRIMS,
  CLASSIC_TEAM_SIZES,
  WEAPON_CATEGORIES,
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
    weakestPoints: [], strongestPoints: [], notes: '', weaponUsed: '',
  },
  Scrims: {
    map: 'Erangel', teamPosition: '', teamKills: '', individualKills: '',
    weakestPoints: [], strongestPoints: [], notes: '', weaponUsed: '',
  },
  Tournament: {
    tournamentName: '', stage: 'Group Stage', map: 'Erangel',
    teamPosition: '', teamKills: '', individualKills: '', playerKills: [],
    weakestPoints: [], strongestPoints: [], notes: '', weaponUsed: '',
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

  const [userProfile] = useLocalStorage(STORAGE_KEYS.USER, {})
  const userIgns = useMemo(() => {
    const arr = Array.isArray(userProfile?.igns) ? userProfile.igns : []
    const cleaned = arr.map(s => String(s || '').trim()).filter(Boolean)
    if (cleaned.length) return cleaned.slice(0, 3)
    return userProfile?.ign ? [String(userProfile.ign).trim()] : []
  }, [userProfile])

  const { teamId } = useUserTeamId()
  const { members } = useTeam(teamId)
  const rosterIgns = useMemo(
    () => (members || []).map(m => ({
      uid: m.uid,
      ign: m.ign || '',
      igns: (Array.isArray(m.igns) && m.igns.length ? m.igns : [m.ign])
        .map(s => String(s || '').trim()).filter(Boolean),
    })),
    [members],
  )

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

  /* Screenshot import → pre-fill the current form. Never auto-saves;
     the user still has to click "Log Match". */
  function applyExtracted(fieldsObj) {
    setForms(prev => ({ ...prev, [activeType]: { ...prev[activeType], ...fieldsObj } }))
  }
  function applyExtractedPlayers(arr) {
    setForms(prev => ({ ...prev, Tournament: { ...prev.Tournament, playerKills: arr } }))
  }
  /* Classic maps individual-vs-team kills onto the same `kills` field. */
  const classicSubMode = forms.Classic.teamSize

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
    if (activeType === 'Tournament') {
      entry.playerKills = (Array.isArray(form.playerKills) ? form.playerKills : [])
        .filter(r => (r.name || '').trim() || r.uid)
        .map(r => ({
          uid: r.uid || null,
          name: (r.name || '').trim(),
          kills: r.kills === '' || r.kills == null ? null : Number(r.kills),
          unmatched: !!r.unmatched && !r.uid,
        }))
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

            <ScreenshotImport
              key={activeType + (activeType === 'Classic' ? classicSubMode : '')}
              matchType={activeType}
              subMode={activeType === 'Classic' ? classicSubMode : ''}
              userIgns={userIgns}
              rosterIgns={rosterIgns}
              onApply={applyExtracted}
              onApplyPlayers={applyExtractedPlayers}
            />

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
                      <th>Weapon</th>
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
                          <td className="text-sm text-text-secondary">{m.weaponUsed || '—'}</td>
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

/* ─── Weapon select shared across all forms ──────────────────── */
function WeaponSelect({ value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="input-field">
      <option value="">— Optional —</option>
      {WEAPON_CATEGORIES.map(cat => (
        <optgroup key={cat.id} label={cat.label}>
          {cat.weapons.map(w => (
            <option key={w} value={w}>{w}</option>
          ))}
        </optgroup>
      ))}
    </select>
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
      <FormField label="Primary Weapon Used">
        <WeaponSelect value={form.weaponUsed} onChange={v => update('weaponUsed', v)} />
      </FormField>
      <FormField label="Position (1–100)">
        <input type="number" min="1" max="100" value={form.position}
          onChange={e => update('position', e.target.value)} className="input-field" placeholder="e.g. 4" />
      </FormField>
      <FormField label="Kills">
        <input type="number" min="0" value={form.kills}
          onChange={e => update('kills', e.target.value)} className="input-field" placeholder="e.g. 6" />
      </FormField>
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
      <FormField label="Primary Weapon Used">
        <WeaponSelect value={form.weaponUsed} onChange={v => update('weaponUsed', v)} />
      </FormField>
      <div />
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
      <FormField label="Primary Weapon Used">
        <WeaponSelect value={form.weaponUsed} onChange={v => update('weaponUsed', v)} />
      </FormField>
      <div />
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

      <FormField label="Per-player Kills" className="md:col-span-2">
        <PlayerKillsEditor
          value={Array.isArray(form.playerKills) ? form.playerKills : []}
          onChange={rows => update('playerKills', rows)}
        />
      </FormField>

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

/* Per-player kills for a tournament match. Rows can come from a
   screenshot import (some flagged "unmatched") or be added manually.
   Inline styles here rather than .input-field so the ign + kills
   inputs sit side-by-side instead of each taking a full row. */
const pkInput = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  padding: '8px 10px',
}
function PlayerKillsEditor({ value, onChange }) {
  const rows = Array.isArray(value) ? value : []
  function setRow(i, patch) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function addRow() {
    onChange([...rows, { uid: null, name: '', kills: '', unmatched: false, manual: true }])
  }
  function removeRow(i) {
    onChange(rows.filter((_, idx) => idx !== i))
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-subtle)', margin: 0 }}>
          Optional. Import a screenshot to auto-fill, or add rows manually.
        </p>
      )}
      {rows.map((r, i) => {
        const flagged = (r.unmatched || !r.uid) && !r.manual
        return (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              padding: 8, borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-elevated)',
              border: `1px solid ${flagged ? 'rgba(245,158,11,0.5)' : 'var(--border)'}`,
            }}
          >
            <input
              style={{ ...pkInput, flex: 1, minWidth: 130 }}
              value={r.name || ''}
              onChange={e => setRow(i, { name: e.target.value })}
              placeholder="Player IGN"
            />
            <input
              style={{ ...pkInput, width: 72 }}
              value={r.kills ?? ''}
              onChange={e => setRow(i, { kills: e.target.value })}
              placeholder="kills"
              inputMode="numeric"
            />
            {flagged && (
              <span
                style={{
                  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
                  padding: '3px 7px', borderRadius: 4,
                  background: 'var(--amber-tint)', color: 'var(--amber)',
                }}
                title="This name did not match a registered roster IGN"
              >
                Unmatched
              </span>
            )}
            <button
              type="button"
              onClick={() => removeRow(i)}
              style={{
                display: 'inline-flex', padding: 6, borderRadius: 6,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-subtle)',
              }}
              aria-label="Remove player row"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )
      })}
      <button type="button" onClick={addRow} className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
        + Add player
      </button>
    </div>
  )
}
