import { useEffect, useState, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Target, ClipboardList, Plus, RotateCcw, Sparkles,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useModules } from '../hooks/useModules.js'
import { useDailySessions, useDailyMatches } from '../hooks/useDailySessions.js'
import { useSwipeGesture } from '../hooks/useSwipeGesture.js'
import { useUserData } from '../hooks/useUserData.js'
import { useAuth } from '../context/AuthContext.jsx'
import { awardXP, XP_AWARDS } from '../utils/xp.js'
import { saveDailySession } from '../utils/db.js'
import { todayKey } from '../utils/helpers.js'

import PracticeHistory from '../components/PracticeHistory.jsx'
import ModuleCard from '../components/ModuleCard.jsx'
import CreateModuleModal from '../components/CreateModuleModal.jsx'
import CalendarStrip from '../components/CalendarStrip.jsx'
import SessionBanner from '../components/SessionBanner.jsx'
import EndSessionModal from '../components/EndSessionModal.jsx'
import TodayPlanBanner from '../components/TodayPlanBanner.jsx'
import MatchLogger from '../components/MatchLogger.jsx'

const PLANS_KEY = 'esportselite_training_plans'

const TABS = [
  { id: 'modules', label: 'Training Modules', icon: Target },
  { id: 'logger',  label: 'Match Logger',     icon: ClipboardList },
]

export default function Training() {
  const [searchParams] = useSearchParams()
  const focusModuleId = searchParams.get('focus') || null
  const [tab, setTab] = useState('modules')
  const [endOpen, setEndOpen] = useState(false)
  const { user: authUser } = useAuth()
  const { refreshData } = useUserData()

  const trainingDaily = useDailySessions()
  const matchesDaily  = useDailyMatches()

  const drillCount    = trainingDaily.todaysActivity.drillCount    || 0
  const matchCount    = matchesDaily.todaysActivity.matchCount     || 0
  const totalDuration = trainingDaily.todaysActivity.totalDuration || 0

  const combinedStatus = useMemo(() => {
    if (trainingDaily.todaysStatus === 'completed' || matchesDaily.todaysStatus === 'completed') return 'completed'
    if (drillCount > 0 || matchCount > 0) return 'in_progress'
    return 'not_started'
  }, [trainingDaily.todaysStatus, matchesDaily.todaysStatus, drillCount, matchCount])

  useEffect(() => { refreshData(); /* eslint-disable-next-line */ }, [])
  useEffect(() => { if (focusModuleId) setTab('modules') }, [focusModuleId])
  useEffect(() => {
    try {
      if (sessionStorage.getItem('esportselite_open_match_logger')) {
        sessionStorage.removeItem('esportselite_open_match_logger')
        setTab('logger')
      }
    } catch { /* ignore */ }
  }, [])

  const tabSwipe = useSwipeGesture({
    onSwipeLeft:  () => { if (tab === 'modules') setTab('logger') },
    onSwipeRight: () => { if (tab === 'logger')  setTab('modules') },
  })

  useEffect(() => {
    let flag = null
    try { flag = sessionStorage.getItem('esportselite_scroll_to_plan') } catch {}
    if (!flag) return
    try { sessionStorage.removeItem('esportselite_scroll_to_plan') } catch {}
    const t = setTimeout(() => {
      document.getElementById('today-plan-banner')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 250)
    return () => clearTimeout(t)
  }, [])

  async function endSession({ mood, notes }) {
    const today = todayKey()
    const uid = authUser?.uid
    trainingDaily.endTodaysSession({ mood, notes })
    matchesDaily.endTodaysMatches({ performance: mood, takeaway: notes })
    if (uid) {
      saveDailySession(uid, today, {
        status: 'completed',
        endedAt: new Date().toISOString(),
        mood: mood || null,
        notes: (notes || '').trim(),
        drillCount, matchCount, totalDuration,
      }).catch(() => {})
    }
    awardXP(XP_AWARDS.SESSION_ENDED, 'Session Ended')
    setEndOpen(false)
  }

  return (
    <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SessionBanner
        drillCount={drillCount}
        matchCount={matchCount}
        totalDuration={totalDuration}
        status={combinedStatus}
        onEndSession={() => setEndOpen(true)}
      />

      <TodayPlanBanner />

      {/* Tab bar */}
      <div
        {...tabSwipe}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: 3,
          display: 'inline-flex',
          gap: 2,
          alignSelf: 'flex-start',
          width: '100%',
          maxWidth: 'fit-content',
        }}
      >
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: active ? 'var(--bg-elevated)' : 'transparent',
                border: active ? '1px solid var(--border)' : '1px solid transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-subtle)',
                padding: '8px 14px',
                borderRadius: 4,
                fontSize: 13,
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'background 0.15s, color 0.15s, border-color 0.15s',
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'modules' ? (
        <TrainingModulesTab focusModuleId={focusModuleId} />
      ) : (
        <MatchLogger />
      )}

      <EndSessionModal
        open={endOpen}
        drillCount={drillCount}
        matchCount={matchCount}
        totalDuration={totalDuration}
        onClose={() => setEndOpen(false)}
        onConfirm={endSession}
      />
    </div>
  )
}

function TrainingModulesTab({ focusModuleId }) {
  const {
    modules, addModule, updateModule, deleteModule, duplicateModule,
    restoreDefaults, reorderModules, reorderDrills,
  } = useModules()

  const [createOpen, setCreateOpen] = useState(false)
  const modulesRef = useRef(null)
  const focusRowRef = useRef(null)

  const [plans] = useLocalStorage(PLANS_KEY, [])
  const todayPlanned = useMemo(() => {
    const active = (Array.isArray(plans) ? plans : []).find(p => p.isActive)
    if (!active) return {}
    const idx = (new Date().getDay() + 6) % 7
    const day = (active.days || []).find(d => d.dayIndex === idx) || (active.days || [])[idx]
    if (!day || day.isRestDay) return {}
    const map = {}
    ;(day.sessions || []).forEach(s => {
      if (!s.moduleName) return
      map[s.moduleName] = (map[s.moduleName] || 0) + (Number(s.duration) || 0)
    })
    return map
  }, [plans])

  function planForModule(name) {
    const ml = (name || '').toLowerCase()
    let total = 0
    for (const [pn, dur] of Object.entries(todayPlanned)) {
      const nl = pn.toLowerCase()
      if (nl === ml || ml.includes(nl) || nl.includes(ml)) total += dur
    }
    return total > 0 ? { planned: true, duration: total } : undefined
  }

  const moduleSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleModuleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = modules.findIndex(m => m.id === active.id)
    const newIndex = modules.findIndex(m => m.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    reorderModules(arrayMove(modules, oldIndex, newIndex))
  }

  useEffect(() => {
    if (!focusModuleId) return
    const t = setTimeout(() => focusRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    return () => clearTimeout(t)
  }, [focusModuleId])

  function createModule({ name, description, icon }) {
    addModule({ name, description, icon }); setCreateOpen(false)
  }
  function scrollToModules() { modulesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  const orderedModules = modules
  const customCount = modules.filter(m => !m.isDefault).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <CalendarStrip context="training" onTodayAction={scrollToModules} />
      <PracticeHistory modules={modules} />

      <div ref={modulesRef} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h3 className="section-heading" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Target size={16} style={{ color: 'var(--text-subtle)' }} /> Modules
            </h3>
            <div className="label" style={{ marginTop: 2 }}>
              {modules.length} module{modules.length === 1 ? '' : 's'}
              {customCount > 0 && <> · {customCount} custom</>}
            </div>
          </div>
          <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm">
            <Plus size={13} /> Create module
          </button>
        </div>

        {orderedModules.length === 0 ? (
          <div className="card empty-state">
            <Sparkles size={28} className="empty-state-icon" />
            <div className="empty-state-title">No modules yet</div>
            <div className="empty-state-desc">Restore the defaults or build your own.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm">
                <Plus size={13} /> Create module
              </button>
              <button onClick={restoreDefaults} className="btn btn-secondary btn-sm">
                <RotateCcw size={13} /> Restore defaults
              </button>
            </div>
          </div>
        ) : (
          <DndContext sensors={moduleSensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
            <SortableContext items={orderedModules.map(m => m.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {orderedModules.map((m, i) => {
                  const isFocused = focusModuleId === m.id
                  return (
                    <div key={m.id} ref={isFocused ? focusRowRef : undefined}>
                      <ModuleCard
                        module={m}
                        defaultOpen={isFocused || (!focusModuleId && i === 0)}
                        onUpdate={updateModule}
                        onDelete={() => deleteModule(m.id)}
                        onDuplicate={() => duplicateModule(m.id)}
                        onReorderDrills={reorderDrills}
                        todayPlan={planForModule(m.name)}
                      />
                    </div>
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {orderedModules.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <button onClick={restoreDefaults} className="btn btn-secondary btn-sm">
              <RotateCcw size={13} /> Restore default modules
            </button>
          </div>
        )}
      </div>

      <CreateModuleModal
        open={createOpen} mode="create"
        onClose={() => setCreateOpen(false)}
        onSubmit={createModule}
      />
    </div>
  )
}
