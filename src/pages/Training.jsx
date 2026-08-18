import { useEffect, useState, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Target, ClipboardList, Plus, RotateCcw, Sparkles, CalendarClock,
  CheckCircle2, ArrowRight, Swords, Skull, Star, TrendingUp, Flame,
  Trophy, BarChart2, Lightbulb, Clock, Zap, X,
  Clipboard,
} from 'lucide-react'
import {
  collection, getDocs, orderBy, query, updateDoc, doc,
} from 'firebase/firestore'
import { db } from '../utils/firebase.js'
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

const MATCH_SUBTABS = [
  { id: 'classic',     label: 'Classic',     icon: Swords },
  { id: 'scrims',      label: 'Scrims',      icon: Target },
  { id: 'tournament',  label: 'Tournament',  icon: Trophy },
  { id: 'performance', label: 'Performance', icon: BarChart2 },
]

/* ── helpers ── */
function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Date.now() - Number(ts)
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

function findModuleIdByName(modules, moduleName) {
  if (!moduleName || !Array.isArray(modules)) return null
  const lower = moduleName.toLowerCase()
  const exact = modules.find(m => (m.name || '').toLowerCase() === lower)
  if (exact) return exact.id
  const partial = modules.find(m => {
    const mn = (m.name || '').toLowerCase()
    return mn.includes(lower) || lower.includes(mn)
  })
  return partial?.id || null
}

/* ================================================================
   ROOT PAGE
   ================================================================ */
export default function Training() {
  const [searchParams] = useSearchParams()
  const focusModuleId = searchParams.get('focus') || null
  const [tab, setTab] = useState('modules')
  const [endOpen, setEndOpen] = useState(false)
  const { user: authUser } = useAuth()
  const { refreshData, matches, sessions, xp, streak, profile } = useUserData()

  /* weapons selected in the active drill — written by ModuleCard via localStorage */
  const [sessionWeapons, setSessionWeapons] = useLocalStorage('ee_session_weapons', [])

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
        weapons: Array.isArray(sessionWeapons) && sessionWeapons.length > 0
          ? sessionWeapons
          : null,
      }).catch(() => {})
    }
    awardXP(XP_AWARDS.SESSION_ENDED, 'Session Ended')
    setSessionWeapons([])
    setEndOpen(false)
  }

  return (
    <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <SessionBanner
        drillCount={drillCount}
        matchCount={matchCount}
        totalDuration={totalDuration}
        status={combinedStatus}
        weapons={Array.isArray(sessionWeapons) ? sessionWeapons : []}
        onEndSession={() => setEndOpen(true)}
      />

      <TodayPlanBanner />

      {/* Page header */}
      <div style={{ marginBottom: 20, marginTop: 4 }}>
        <h1 style={{
          fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 32,
          color: '#F8FAFC', margin: '0 0 6px', letterSpacing: '0.01em',
        }}>
          Training Center
        </h1>
        <p style={{
          fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 400,
          fontSize: 14, color: '#94A3B8', margin: 0,
        }}>
          Track your practice, improve and dominate.
        </p>
      </div>

      {/* Tab switcher */}
      <div {...tabSwipe} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: active ? '#101A30' : 'transparent',
                border: `1px solid ${active ? '#3B82F6' : '#1B2A45'}`,
                color: active ? '#F8FAFC' : '#94A3B8',
                padding: '10px 20px', borderRadius: 8,
                fontSize: 14, fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 500,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={15} /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'modules' ? (
        <TrainingModulesTab
          focusModuleId={focusModuleId}
          uid={authUser?.uid}
          sessions={Array.isArray(sessions) ? sessions : []}
          streak={streak || profile?.streak || null}
          drillCount={drillCount}
          totalDuration={totalDuration}
          onWeaponsChange={setSessionWeapons}
        />
      ) : (
        <MatchLoggerTab
          uid={authUser?.uid}
          matches={Array.isArray(matches) ? matches : []}
          xp={xp || 0}
          matchCount={matchCount}
        />
      )}

      <EndSessionModal
        open={endOpen}
        drillCount={drillCount}
        matchCount={matchCount}
        totalDuration={totalDuration}
        onClose={() => setEndOpen(false)}
        onConfirm={endSession}
      />

      <TrainingStyles />
    </div>
  )
}

/* ================================================================
   TRAINING MODULES TAB — 2-column layout
   ================================================================ */
function TrainingModulesTab({ focusModuleId, uid, sessions, streak, drillCount, totalDuration, onWeaponsChange }) {
  const {
    modules, addModule, updateModule, deleteModule, duplicateModule,
    restoreDefaults, reorderModules, reorderDrills,
  } = useModules()

  const [createOpen, setCreateOpen] = useState(false)
  const modulesRef  = useRef(null)
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
  function scrollToModules() {
    modulesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const customCount = modules.filter(m => !m.isDefault).length

  return (
    <div className="tc-two-col">
      {/* ── Left column ── */}
      <div className="tc-left" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TodayScheduledDrills uid={uid} />
        <CalendarStrip context="training" onTodayAction={scrollToModules} />

        <div id="training-modules-section" ref={modulesRef} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 14, fontWeight: 600, color: '#F8FAFC' }}>
                <Target size={15} style={{ color: '#94A3B8' }} />
                DRILLS ({modules.reduce((acc, m) => acc + (m.drills?.length || 0), 0)})
              </div>
              <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'Inter, DM Sans, sans-serif', marginTop: 2 }}>
                {modules.length} module{modules.length === 1 ? '' : 's'}
                {customCount > 0 ? ` · ${customCount} custom` : ''}
              </div>
            </div>
            <button
              onClick={() => setCreateOpen(true)}
              style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 16px', fontSize: 13, fontFamily: 'Oxanium, Inter, sans-serif', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={13} /> Add Drill
            </button>
          </div>

          {modules.length === 0 ? (
            <div className="card empty-state">
              <Sparkles size={28} className="empty-state-icon" />
              <div className="empty-state-title">No modules yet</div>
              <div className="empty-state-desc">Restore the defaults or build your own.</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm"><Plus size={13} /> Create module</button>
                <button onClick={restoreDefaults} className="btn btn-secondary btn-sm"><RotateCcw size={13} /> Restore defaults</button>
              </div>
            </div>
          ) : (
            <DndContext sensors={moduleSensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
              <SortableContext items={modules.map(m => m.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {modules.map((m, i) => {
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
                          onWeaponsChange={onWeaponsChange}
                        />
                      </div>
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {modules.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
              <button onClick={restoreDefaults} className="btn btn-secondary btn-sm">
                <RotateCcw size={13} /> Restore default modules
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Right column ── */}
      <div className="tc-right" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <QuickStatsCard sessions={sessions} streak={streak} drillCount={drillCount} totalDuration={totalDuration} />
        <MotivationalCard />
      </div>

      <CreateModuleModal
        open={createOpen} mode="create"
        onClose={() => setCreateOpen(false)}
        onSubmit={createModule}
      />
    </div>
  )
}

/* ================================================================
   MATCH LOGGER TAB
   ================================================================ */
function MatchLoggerTab({ uid, matches, xp, matchCount }) {
  const [subTab, setSubTab] = useState('classic')
  const todayStr = new Date().toISOString().split('T')[0]
  const todayMatches = useMemo(() =>
    matches.filter(m => {
      const d = m.timestamp ? new Date(Number(m.timestamp)).toISOString().split('T')[0] : ''
      return d === todayStr
    }),
    [matches, todayStr]
  )
  const avgKills     = todayMatches.length ? (todayMatches.reduce((s, m) => s + (Number(m.kills) || 0), 0) / todayMatches.length).toFixed(1) : null
  const avgPlacement = todayMatches.length ? Math.round(todayMatches.reduce((s, m) => s + (Number(m.teamPosition) || 0), 0) / todayMatches.length) : null
  const wins         = todayMatches.filter(m => Number(m.teamPosition) === 1).length
  const winRate      = todayMatches.length ? Math.round((wins / todayMatches.length) * 100) : null
  const avgDamage    = todayMatches.length && todayMatches.some(m => m.damage)
    ? Math.round(todayMatches.reduce((s, m) => s + (Number(m.damage) || 0), 0) / todayMatches.length)
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TodayMatchStatsRow matchCount={matchCount} avgKills={avgKills} avgPlacement={avgPlacement} winRate={winRate} avgDamage={avgDamage} />
      <CalendarStrip context="matches" />
      <MatchSubTabs active={subTab} onChange={setSubTab} />
      <div className="tc-two-col">
        <div className="tc-left"><MatchLogger /></div>
        <div className="tc-right" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PerformanceScoreCard matches={matches} />
          <XPRewardCard xp={xp} />
          <RecentMatchesCard matches={matches} />
          <TipCard />
        </div>
      </div>
    </div>
  )
}

/* ================================================================
   TODAY'S SCHEDULED DRILLS (Firestore sync)
   ================================================================ */
function TodayScheduledDrills({ uid }) {
  const navigate = useNavigate()
  const { modules } = useModules()
  const [data, setData] = useState({ loading: true, drillTasks: [], allTasks: [], scheduleId: null, dayId: null, planName: '' })

  useEffect(() => {
    if (!uid) { setData(d => ({ ...d, loading: false })); return }
    let cancelled = false
    ;(async () => {
      try {
        const schedSnap = await getDocs(query(collection(db, 'users', uid, 'schedules'), orderBy('createdAt', 'desc')))
        const active = schedSnap.docs.map(d => ({ id: d.id, ...d.data() })).find(s => s.status === 'active' || s.status === 'paused')
        if (!active) { if (!cancelled) setData({ loading: false, drillTasks: [], allTasks: [], scheduleId: null, dayId: null, planName: '' }); return }
        const today = new Date().toISOString().split('T')[0]
        const daysSnap = await getDocs(collection(db, 'users', uid, 'schedules', active.id, 'days'))
        const todayDay = daysSnap.docs.map(d => ({ id: d.id, ...d.data() })).find(d => d.date === today)
        if (!cancelled) {
          const allTasks = Array.isArray(todayDay?.tasks) ? todayDay.tasks : []
          setData({ loading: false, drillTasks: allTasks.filter(t => t.type === 'drill'), allTasks, scheduleId: active.id, dayId: todayDay?.id || null, planName: active.title || 'Training Plan' })
        }
      } catch { if (!cancelled) setData({ loading: false, drillTasks: [], allTasks: [], scheduleId: null, dayId: null, planName: '' }) }
    })()
    return () => { cancelled = true }
  }, [uid])

  async function markTaskDone(taskId, done) {
    if (!data.scheduleId || !data.dayId) return
    const nextAll = data.allTasks.map(t => t.id === taskId ? { ...t, done, doneAt: done ? new Date().toISOString() : null } : t)
    try {
      await updateDoc(doc(db, 'users', uid, 'schedules', data.scheduleId, 'days', data.dayId), { tasks: nextAll })
      setData(s => ({ ...s, allTasks: nextAll, drillTasks: nextAll.filter(t => t.type === 'drill') }))
    } catch { /* non-fatal */ }
  }

  function startDrill(task) {
    const modId = findModuleIdByName(modules, task.module)
    if (modId) navigate(`/training?focus=${modId}`)
    setTimeout(() => { document.getElementById('training-modules-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 120)
  }

  if (data.loading || !data.scheduleId) return null

  const drillTasks = data.drillTasks
  const allDrillsDone = drillTasks.length > 0 && drillTasks.every(t => t.done)

  if (drillTasks.length === 0) {
    return (
      <div style={{ background: '#0D1528', border: '1px solid #1B2A45', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <CalendarClock size={14} style={{ color: '#3B82F6', flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: '#94A3B8', fontFamily: 'Inter, DM Sans, sans-serif' }}>
          No drills scheduled for today. Check your{' '}
          <button onClick={() => navigate('/scheduler')} style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'inherit' }}>full plan</button>
          {' '}for other tasks.
        </span>
      </div>
    )
  }

  return (
    <div style={{ background: '#0D1528', border: '1px solid #1B2A45', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <CalendarClock size={15} style={{ color: '#3B82F6', flexShrink: 0 }} />
          <span style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: '#94A3B8' }}>Today's Scheduled Drills</span>
          <span style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.30)', color: '#3B82F6', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 500 }}>
            {data.planName}
          </span>
        </div>
        <button onClick={() => navigate('/scheduler')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3B82F6', fontSize: 12, fontFamily: 'Inter, DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 4, padding: 0, flexShrink: 0 }}>
          View Full Plan <ArrowRight size={11} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {drillTasks.map(task => (
          <ScheduledDrillRow key={task.id} task={task} onToggle={(done) => markTaskDone(task.id, done)} onStart={() => startDrill(task)} />
        ))}
      </div>
      {allDrillsDone && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(0,201,110,0.08)', border: '1px solid rgba(0,201,110,0.30)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green)', fontSize: 12, fontFamily: 'Inter, DM Sans, sans-serif' }}>
          <CheckCircle2 size={13} />
          All drills done! Go to{' '}
          <button onClick={() => navigate('/scheduler')} style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', fontSize: 12, padding: 0, fontWeight: 600, fontFamily: 'inherit' }}>Scheduler</button>
          {' '}to complete the day and earn XP.
        </div>
      )}
    </div>
  )
}

function ScheduledDrillRow({ task, onToggle, onStart }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(27,42,69,0.45)', border: `1px solid ${task.done ? 'rgba(0,201,110,0.25)' : '#1B2A45'}`, borderRadius: 8, transition: 'border-color 0.15s ease' }}>
      <button type="button" onClick={() => onToggle(!task.done)} style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2, background: task.done ? 'var(--green)' : 'transparent', border: `1px solid ${task.done ? 'var(--green)' : '#2D4060'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'all 0.15s ease' }}>
        {task.done && <CheckCircle2 size={11} strokeWidth={3} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: task.description ? 3 : 0 }}>
          <span style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 14, fontWeight: 500, color: task.done ? '#94A3B8' : '#F8FAFC', textDecoration: task.done ? 'line-through' : 'none' }}>{task.title || 'Drill'}</span>
          {task.duration > 0 && (
            <span style={{ background: '#101A30', border: '1px solid #1B2A45', color: '#94A3B8', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontFamily: 'Inter, DM Sans, sans-serif' }}>{task.duration} min</span>
          )}
        </div>
        {task.description && (
          <div style={{ fontSize: 12, fontFamily: 'Inter, DM Sans, sans-serif', color: '#94A3B8', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.description}</div>
        )}
      </div>
      {task.done ? (
        <span style={{ border: '1px solid rgba(0,201,110,0.4)', color: 'var(--green)', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontFamily: 'Oxanium, Inter, sans-serif', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Completed ✓</span>
      ) : (
        <button onClick={onStart} style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontFamily: 'Oxanium, Inter, sans-serif', fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
          Start
        </button>
      )}
    </div>
  )
}

/* ================================================================
   MATCH LOGGER TAB — stat row + sub-tabs
   ================================================================ */
function TodayMatchStatsRow({ matchCount, avgKills, avgPlacement, winRate, avgDamage }) {
  const cards = [
    { Icon: Swords,     color: '#3B82F6', label: 'Matches Logged', value: matchCount || '—' },
    { Icon: Target,     color: '#22D3EE', label: 'Avg Placement',  value: avgPlacement != null ? `#${avgPlacement}` : '—' },
    { Icon: Skull,      color: '#EF4444', label: 'Avg Kills',      value: avgKills ?? '—' },
    { Icon: Star,       color: '#F59E0B', label: 'Win Rate',       value: winRate != null ? `${winRate}%` : '—' },
    { Icon: TrendingUp, color: '#22C55E', label: 'Avg Damage',     value: avgDamage != null ? avgDamage : '—' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
      {cards.map(({ Icon, color, label, value }) => (
        <div key={label} style={{ background: '#0D1528', border: '1px solid #1B2A45', borderRadius: 10, padding: 16 }}>
          <Icon size={18} style={{ color, marginBottom: 8 }} />
          <div style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 11, color: '#94A3B8', marginBottom: 4, lineHeight: 1.3 }}>{label}</div>
          <div style={{ fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 24, color: '#F8FAFC', lineHeight: 1 }}>{value}</div>
          <div style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 10, color: '#64748B', marginTop: 4 }}>Today</div>
        </div>
      ))}
    </div>
  )
}

function MatchSubTabs({ active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1B2A45' }}>
      {MATCH_SUBTABS.map(t => {
        const Icon = t.icon
        const isActive = active === t.id
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{ background: 'transparent', border: 'none', borderBottom: `2px solid ${isActive ? '#3B82F6' : 'transparent'}`, color: isActive ? '#F8FAFC' : '#94A3B8', padding: '10px 16px', cursor: 'pointer', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 0.15s ease', marginBottom: -1 }}>
            <Icon size={14} /> {t.label}
          </button>
        )
      })}
    </div>
  )
}

/* ================================================================
   RIGHT SIDEBAR — TRAINING MODULES TAB
   ================================================================ */
function QuickStatsCard({ sessions, streak, drillCount, totalDuration }) {
  const totalSessions = Array.isArray(sessions) ? sessions.length : 0
  const totalMinutes  = Array.isArray(sessions) ? sessions.reduce((s, sess) => s + (Number(sess.durationSeconds || 0) / 60), 0) : 0
  const hours = Math.floor(totalMinutes / 60)
  const mins  = Math.round(totalMinutes % 60)
  const currentStreak = streak?.count || 0
  const bestStreak    = streak?.longestStreak || streak?.bestStreak || 0

  const STATS = [
    { Icon: Clock,         color: '#3B82F6', label: 'Total Practice Time', value: `${hours}h ${mins}m` },
    { Icon: CalendarClock, color: '#22D3EE', label: 'Sessions Completed',  value: totalSessions },
    { Icon: Target,        color: '#7C3AED', label: 'Drills Completed',    value: totalSessions },
    { Icon: Flame,         color: '#F59E0B', label: 'Current Streak',      value: `${currentStreak}d` },
    { Icon: Trophy,        color: '#EF4444', label: 'Best Streak',         value: `${bestStreak}d` },
    { Icon: TrendingUp,    color: '#22C55E', label: 'Consistency',         value: totalSessions > 0 ? `${Math.min(100, Math.round((currentStreak / 7) * 100))}%` : '—' },
  ]

  return (
    <div style={{ background: '#0D1528', border: '1px solid #1B2A45', borderRadius: 12, padding: 20 }}>
      <div style={{ ...sectionLabelStyle, marginBottom: 14 }}>QUICK STATS</div>
      {STATS.map(({ Icon, color, label, value }, i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < STATS.length - 1 ? '1px solid rgba(27,42,69,0.7)' : 'none' }}>
          <Icon size={16} style={{ color, flexShrink: 0 }} />
          <span style={{ flex: 1, fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 13, color: '#94A3B8' }}>{label}</span>
          <span style={{ fontFamily: 'Oxanium, sans-serif', fontWeight: 600, fontSize: 14, color: '#F8FAFC' }}>{value}</span>
        </div>
      ))}
    </div>
  )
}

function MotivationalCard() {
  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(124,58,237,0.15))', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 12, padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Target size={24} style={{ color: '#3B82F6', marginBottom: 10 }} />
        <div style={{ fontFamily: 'Oxanium, sans-serif', fontWeight: 600, fontSize: 16, color: '#F8FAFC', marginBottom: 8, lineHeight: 1.4 }}>Stay consistent, get better every day.</div>
        <div style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 12, color: '#94A3B8', lineHeight: 1.6 }}>Consistency is the key to becoming unstoppable.</div>
      </div>
      <div style={{ position: 'absolute', right: -24, top: -24, width: 100, height: 100, borderRadius: '50%', background: 'rgba(59,130,246,0.08)', zIndex: 0 }} />
      <div style={{ position: 'absolute', right: 10, bottom: -20, width: 60, height: 60, borderRadius: '50%', background: 'rgba(124,58,237,0.1)', zIndex: 0 }} />
    </div>
  )
}

/* ================================================================
   RIGHT SIDEBAR — MATCH LOGGER TAB
   ================================================================ */
function PerformanceScoreCard({ matches }) {
  const score = useMemo(() => {
    if (!Array.isArray(matches) || matches.length === 0) return null
    const recent = [...matches].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)).slice(0, 5)
    const avgKills = recent.reduce((s, m) => s + (Number(m.kills) || 0), 0) / recent.length
    const avgPlace = recent.reduce((s, m) => s + (Number(m.teamPosition) || 50), 0) / recent.length
    return Math.round(Math.min(avgKills * 8, 50) + Math.max(0, 50 - avgPlace))
  }, [matches])

  const radius = 44
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - Math.min(1, (score || 0) / 100) * circumference

  return (
    <div style={{ background: '#0D1528', border: '1px solid #1B2A45', borderRadius: 12, padding: 20 }}>
      <div style={{ ...sectionLabelStyle, marginBottom: 16 }}>PERFORMANCE SCORE</div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: score === null ? 10 : 0 }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#1B2A45" strokeWidth="10" />
          {score !== null && (
            <circle cx="60" cy="60" r={radius} fill="none" stroke="url(#sg)" strokeWidth="10"
              strokeDasharray={circumference} strokeDashoffset={dashOffset}
              strokeLinecap="round" transform="rotate(-90 60 60)" />
          )}
          <defs>
            <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2563EB" /><stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
          <text x="60" y="55" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: 'Oxanium, sans-serif', fontWeight: 800, fontSize: 30, fill: '#F8FAFC' }}>
            {score !== null ? score : '—'}
          </text>
          {score !== null && <text x="60" y="74" textAnchor="middle" style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fill: '#94A3B8' }}>/100</text>}
        </svg>
      </div>
      {score === null && <div style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8', fontFamily: 'Inter, DM Sans, sans-serif', lineHeight: 1.5 }}>Complete matches to unlock your score</div>}
    </div>
  )
}

function XPRewardCard({ xp }) {
  const XP_NEXT    = 250
  const xpProgress = Math.max(0, (xp || 0) % XP_NEXT)
  return (
    <div style={{ background: '#0D1528', border: '1px solid #1B2A45', borderRadius: 12, padding: 20 }}>
      <div style={{ ...sectionLabelStyle, marginBottom: 14 }}>XP REWARD</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Zap size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontFamily: 'Oxanium, sans-serif', fontWeight: 700, fontSize: 20, color: '#F8FAFC' }}>+25 XP</div>
          <div style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 12, color: '#94A3B8' }}>Per match logged</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'Inter, DM Sans, sans-serif' }}>{xpProgress} / {XP_NEXT} XP</span>
        <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'Inter, DM Sans, sans-serif' }}>Next Reward: {XP_NEXT} XP</span>
      </div>
      <div style={{ height: 6, background: '#1B2A45', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, (xpProgress / XP_NEXT) * 100)}%`, background: 'linear-gradient(90deg, #2563EB, #3B82F6)', borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

function RecentMatchesCard({ matches }) {
  const recent = useMemo(() =>
    [...(Array.isArray(matches) ? matches : [])].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)).slice(0, 3),
    [matches]
  )
  return (
    <div style={{ background: '#0D1528', border: '1px solid #1B2A45', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={sectionLabelStyle}>RECENT MATCHES</span>
        <button style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, DM Sans, sans-serif' }}>View All →</button>
      </div>
      {recent.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <Clipboard size={36} style={{ color: '#94A3B8', opacity: 0.3, display: 'block', margin: '0 auto 10px' }} />
          <div style={{ fontFamily: 'Oxanium, sans-serif', fontWeight: 600, fontSize: 14, color: '#F8FAFC', marginBottom: 6 }}>No matches logged yet</div>
          <div style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 12, color: '#94A3B8', lineHeight: 1.5 }}>Start logging matches to see your history.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recent.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#101A30', border: '1px solid #1B2A45', borderRadius: 8 }}>
              <Swords size={14} style={{ color: '#3B82F6', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontFamily: 'Inter, DM Sans, sans-serif', color: '#F8FAFC', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.mapName || 'Unknown Map'}</div>
                <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'Inter, DM Sans, sans-serif' }}>#{m.teamPosition || '—'} · {m.kills || 0} kills</div>
              </div>
              <span style={{ fontSize: 10, color: '#64748B', flexShrink: 0, whiteSpace: 'nowrap' }}>{timeAgo(m.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TipCard() {
  return (
    <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start', position: 'relative', overflow: 'hidden' }}>
      <Lightbulb size={18} style={{ color: '#F59E0B', flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 11, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>TIP</div>
        <div style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: 12, color: '#94A3B8', lineHeight: 1.6 }}>The more matches you log, the better your insights!</div>
      </div>
      <Target size={36} style={{ position: 'absolute', right: 10, top: 10, color: '#3B82F6', opacity: 0.08 }} />
    </div>
  )
}

/* ================================================================
   SHARED STYLE CONSTANTS
   ================================================================ */
const sectionLabelStyle = {
  fontFamily: 'Inter, DM Sans, sans-serif',
  fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.10em',
  color: '#94A3B8',
}

/* ================================================================
   RESPONSIVE STYLES
   ================================================================ */
function TrainingStyles() {
  return (
    <style>{`
      .tc-two-col { display: flex; gap: 20px; align-items: flex-start; }
      .tc-left { flex: 2; min-width: 0; }
      .tc-right { width: 340px; flex-shrink: 0; }
      @media (max-width: 960px) {
        .tc-two-col { flex-direction: column; }
        .tc-right { width: 100%; }
      }
    `}</style>
  )
}
