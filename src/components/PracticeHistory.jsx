import { useMemo, useState } from 'react'
import { ChevronDown, Trash2, Calendar, Filter } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useConfirm } from '../hooks/useConfirm.js'
import ConfirmModal from './ConfirmModal.jsx'
import { STORAGE_KEYS } from '../utils/constants.js'
import {
  dateKey,
  todayKey,
  formatHHMM,
  formatMS,
  formatDuration,
  formatDateLong,
  normalizeSessions,
} from '../utils/helpers.js'

/**
 * Day-wise practice history.
 *
 * Props:
 *  - modules: array of all known modules (defaults + custom)
 *             used to populate filter chips and show readable module names.
 */
export default function PracticeHistory({ modules = [] }) {
  const { confirm, confirmModalProps } = useConfirm()
  const [sessionsRaw, setSessions] = useLocalStorage(STORAGE_KEYS.SESSIONS, [])
  const sessions = useMemo(() => normalizeSessions(sessionsRaw), [sessionsRaw])

  const [filter, setFilter] = useState('all')
  const today = todayKey()
  const [expanded, setExpanded] = useState(() => new Set([today]))

  /* Build the list of filter chips: All + every module that has sessions OR is in catalog. */
  const filterChips = useMemo(() => {
    const present = new Set(sessions.map(s => s.moduleId).filter(Boolean))
    const catalogIds = modules.map(m => m.id)
    const ids = Array.from(new Set([...catalogIds, ...present]))
    return [
      { id: 'all', label: 'All', icon: '📋' },
      ...ids.map(id => {
        const mod = modules.find(m => m.id === id)
        return {
          id,
          label: mod?.short || mod?.name || 'Other',
          icon: mod?.icon || '🎯',
        }
      }),
      { id: 'custom', label: 'Custom', icon: '🛠' },
    ]
  }, [sessions, modules])

  /* Apply filter. */
  const filtered = useMemo(() => {
    if (filter === 'all') return sessions
    if (filter === 'custom') return sessions.filter(s => s.isCustom)
    return sessions.filter(s => s.moduleId === filter)
  }, [sessions, filter])

  /* Group by calendar day, newest first. */
  const groups = useMemo(() => {
    const map = {}
    filtered.forEach(s => {
      const k = dateKey(s.timestamp)
      if (!map[k]) map[k] = []
      map[k].push(s)
    })
    return Object.entries(map)
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => a.timestamp - b.timestamp),
        totalSeconds: items.reduce((sum, s) => sum + (Number(s.durationSeconds) || 0), 0),
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [filtered])

  function toggle(date) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  async function deleteSession(id) {
    if (!await confirm('Delete this practice session? This cannot be undone.')) return
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  function moduleShortFor(s) {
    if (s.module) return s.module
    const m = modules.find(x => x.id === s.moduleId)
    return m?.short || m?.name || 'Training'
  }

  return (
    <>
    <div className="glass clip-corner-sm p-6 lg:p-7 relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-accent-primary opacity-[0.08] blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="heading text-xl text-white tracking-wide flex items-center gap-2">
            <Calendar size={20} className="text-accent-secondary" /> PRACTICE HISTORY
          </h3>
          <p className="text-xs text-text-secondary mt-1 uppercase tracking-widest">
            All past sessions grouped by date
          </p>
        </div>
        <div className="text-xs text-text-secondary heading uppercase tracking-widest">
          {sessions.length} session{sessions.length === 1 ? '' : 's'} total
        </div>
      </div>

      {/* Filter chips */}
      {sessions.length > 0 && (
        <div className="relative z-10 mb-5 flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-text-muted" />
          {filterChips.map(c => (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`pill text-xs flex items-center gap-1.5 transition-all ${
                filter === c.id
                  ? 'pill-red shadow-red-glow'
                  : 'hover:border-accent-primary hover:text-white'
              }`}
            >
              <span>{c.icon}</span> {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Groups */}
      <div className="relative z-10 space-y-3">
        {sessions.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="No practice sessions yet."
            subtitle="Start a drill below."
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon="🔎"
            title="No sessions match this filter."
            subtitle="Try a different category."
          />
        ) : (
          groups.map(g => {
            const isOpen = expanded.has(g.date)
            return (
              <div
                key={g.date}
                className="border border-border rounded-md bg-bg-elevated/40 overflow-hidden"
              >
                <button
                  onClick={() => toggle(g.date)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      size={16}
                      className={`text-text-secondary transition-transform ${
                        isOpen ? 'rotate-0 text-accent-secondary' : '-rotate-90'
                      }`}
                    />
                    <span className="heading text-base text-white tracking-wide">
                      {formatDateLong(g.date)}
                      {g.date === today && (
                        <span className="ml-2 pill pill-red text-[10px] tracking-widest">
                          TODAY
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-text-secondary">
                      {g.items.length} session{g.items.length === 1 ? '' : 's'}
                    </span>
                    <span className="text-text-muted">•</span>
                    <span className="mono text-accent-secondary">
                      Total: {formatDuration(g.totalSeconds)}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <ul className="divide-y divide-border animate-fade-in">
                    {g.items.map(s => (
                      <li
                        key={s.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-all"
                      >
                        <span className="text-text-muted text-sm flex-shrink-0">─</span>
                        <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                          <span className="heading text-white">
                            {moduleShortFor(s)}
                          </span>
                          {s.gunsSelected && s.gunsSelected.length > 0 && (
                            <>
                              <span className="text-text-muted">/</span>
                              <span className="mono text-accent-secondary text-xs">
                                {s.gunsSelected.join(' + ')}
                              </span>
                            </>
                          )}
                          <span className="text-text-muted">/</span>
                          <span className="text-text-secondary truncate">
                            {s.drillName}
                          </span>
                        </div>
                        <span className="mono text-xs text-text-muted flex-shrink-0">
                          {formatHHMM(s.timestamp)}
                        </span>
                        <span className="text-text-muted">•</span>
                        <span className="mono text-xs text-accent-secondary flex-shrink-0 min-w-[72px] text-right">
                          {formatMS(s.durationSeconds)}
                        </span>
                        <button
                          onClick={() => deleteSession(s.id)}
                          className="p-1.5 rounded-md text-text-muted hover:text-accent-secondary hover:bg-[rgba(232,0,28,0.08)] transition-all flex-shrink-0"
                          title="Delete session"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
    <ConfirmModal {...confirmModalProps} />
    </>
  )
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="text-4xl mb-3 opacity-70">{icon}</div>
      <p className="text-text-secondary text-sm">{title}</p>
      {subtitle && <p className="text-text-muted text-xs mt-1">{subtitle}</p>}
    </div>
  )
}
