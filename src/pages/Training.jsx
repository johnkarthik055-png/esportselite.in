import { useEffect, useState, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Target, ClipboardList, Plus, RotateCcw, Sparkles, CalendarClock,
  CheckCircle2, ArrowRight, Swords, Skull, Star, TrendingUp, Flame,
  Trophy, Lightbulb, Clock, Zap, X,
  Clipboard, BarChart3,
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
import { todayKey, dateKey } from '../utils/helpers.js'

import ModuleCard from '../components/ModuleCard.jsx'
import CreateModuleModal from '../components/CreateModuleModal.jsx'
import CalendarStrip from '../components/CalendarStrip.jsx'
import SessionBanner from '../components/SessionBanner.jsx'
import EndSessionModal from '../components/EndSessionModal.jsx'
import TodayPlanBanner from '../components/TodayPlanBanner.jsx'
import MatchLogger from '../components/MatchLogger.jsx'
import MotivationCarousel from '../components/MotivationCarousel.jsx'

const PLANS_KEY = 'esportselite_training_plans'

/* Emil-style strong ease-out — the house curve for entrances. */
const EASE = [0.22, 1, 0.36, 1]

const TABS = [
  { id: 'modules', label: 'Training Modules', icon: Target },
  { id: 'logger',  label: 'Match Logger',     icon: ClipboardList },
]

/* A soft daily target used only to render the hero completion ring:
   three drills plus one logged match reads as a full day. */
const DAILY_GOAL_UNITS = 4

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

/* rAF count-up. Returns the live value; jumps straight to target when
   reduced motion is on or the value isn't numeric. */
function useCountUp(target, { duration = 900, enabled = true } = {}) {
  const numeric = Number(target)
  const isNum = Number.isFinite(numeric)
  const [val, setVal] = useState(enabled && isNum ? 0 : numeric)

  useEffect(() => {
    if (!isNum) return
    if (!enabled) { setVal(numeric); return }
    let raf = 0
    let start
    const step = (t) => {
      if (start === undefined) start = t
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(numeric * eased)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [numeric, isNum, duration, enabled])

  return isNum ? val : numeric
}

/* Renders a stat value that counts up on mount. `value` of null renders
   the em-dash placeholder without any animation. */
function CountStat({ value, prefix = '', suffix = '', decimals = 0, style }) {
  const reduce = useReducedMotion()
  const isEmpty = value === null || value === undefined || value === ''
  const live = useCountUp(isEmpty ? 0 : value, { enabled: !reduce && !isEmpty })

  if (isEmpty) return <span style={style}>—</span>

  const shown = decimals > 0
    ? live.toFixed(decimals)
    : Math.round(live).toLocaleString()

  return <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{prefix}{shown}{suffix}</span>
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
  const reduce = useReducedMotion()

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

  /* Hero ring: today's completion against the soft daily target. */
  const todayPct = useMemo(() => {
    if (combinedStatus === 'completed') return 100
    const units = drillCount + matchCount
    return Math.min(100, Math.round((units / DAILY_GOAL_UNITS) * 100))
  }, [combinedStatus, drillCount, matchCount])

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

      <HeroHeader
        pct={todayPct}
        drillCount={drillCount}
        matchCount={matchCount}
        reduce={reduce}
      />

      <TabSwitcher tab={tab} onChange={setTab} swipe={tabSwipe} />

      <div key={tab} className="tc-tab-content">
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
      </div>

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
   HERO HEADER — gradient field, layered depth, live completion ring
   ================================================================ */
function HeroHeader({ pct, drillCount, matchCount, reduce }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="tc-hero"
    >
      {/* Decorative layers — pointer-events none, below content */}
      <div className="tc-hero-dots" aria-hidden />
      <div className="tc-hero-glow-blue" aria-hidden />
      <div className="tc-hero-glow-red" aria-hidden />

      <div className="tc-hero-inner">
        <div style={{ minWidth: 0 }}>
          <div className="tc-hero-kicker">
            <Sparkles size={13} /> Your Practice Hub
          </div>
          <h1 className="tc-hero-title">Training Center</h1>
          <motion.div
            className="tc-hero-accent"
            initial={{ scaleX: reduce ? 1 : 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.25, ease: EASE }}
          />
          <p className="tc-hero-sub">Track your practice, improve and dominate.</p>
        </div>

        <CompletionRing
          pct={pct}
          drillCount={drillCount}
          matchCount={matchCount}
          reduce={reduce}
        />
      </div>
    </motion.div>
  )
}

/* Circular SVG progress — stroke-dashoffset animated from empty to pct. */
function CompletionRing({ pct, drillCount, matchCount, reduce }) {
  const size = 92
  const stroke = 8
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const safePct = Math.max(0, Math.min(100, Number(pct) || 0))
  const offset = circumference - (safePct / 100) * circumference

  return (
    <div className="tc-hero-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#E5EAF3" strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#2563FF" strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduce ? offset : circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, delay: 0.35, ease: EASE }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="tc-hero-ring-center">
        <CountStat
          value={safePct}
          suffix="%"
          style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 800,
            fontSize: 20, color: '#0B1224', lineHeight: 1,
          }}
        />
        <span className="tc-hero-ring-label">Today</span>
      </div>
      <div className="tc-hero-ring-meta">
        {drillCount} drill{drillCount === 1 ? '' : 's'} · {matchCount} match{matchCount === 1 ? '' : 'es'}
      </div>
    </div>
  )
}

/* ================================================================
   TAB SWITCHER — sliding layoutId pill
   ================================================================ */
function TabSwitcher({ tab, onChange, swipe }) {
  const reduce = useReducedMotion()
  return (
    <div {...swipe} className="tc-tab-switcher">
      {TABS.map(t => {
        const Icon = t.icon
        const active = tab === t.id
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`tc-tab-btn ${active ? 'is-active' : ''}`}
            aria-pressed={active}
          >
            {active && (
              <motion.span
                layoutId="trainingTab"
                className="tc-tab-pill"
                aria-hidden
                transition={reduce
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="tc-tab-label">
              <Icon size={15} /> {t.label}
            </span>
          </button>
        )
      })}
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
  const reduce = useReducedMotion()

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
  const totalDrills = modules.reduce((acc, m) => acc + (m.drills?.length || 0), 0)

  return (
    <div className="tc-two-col">
      {/* ── Left column ── */}
      <div className="tc-left" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TodayScheduledDrills uid={uid} />
        <CalendarStrip context="training" onTodayAction={scrollToModules} />

        <div id="training-modules-section" ref={modulesRef} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="tc-section-head">
            <div style={{ minWidth: 0 }}>
              <div className="tc-section-title">
                <span className="tc-section-icon"><Target size={14} /></span>
                Training Blocks
              </div>
              <div className="tc-section-meta">
                {totalDrills} drill{totalDrills === 1 ? '' : 's'} across {modules.length} module{modules.length === 1 ? '' : 's'}
                {customCount > 0 ? ` · ${customCount} custom` : ''}
              </div>
            </div>
            <motion.button
              onClick={() => setCreateOpen(true)}
              className="tc-pill-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              Add Drill
              <span className="tc-pill-btn-icon"><Plus size={13} /></span>
            </motion.button>
          </div>

          {modules.length === 0 ? (
            <div className="tc-empty-card">
              <LayeredIcon Icon={Sparkles} tint="#2563FF" />
              <div className="tc-empty-title">No modules yet</div>
              <div className="tc-empty-desc">Restore the defaults or build your own training block.</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                <motion.button
                  onClick={() => setCreateOpen(true)}
                  className="tc-btn-primary"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Plus size={13} /> Create module
                </motion.button>
                <motion.button
                  onClick={restoreDefaults}
                  className="tc-btn-ghost"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <RotateCcw size={13} /> Restore defaults
                </motion.button>
              </div>
            </div>
          ) : (
            <DndContext sensors={moduleSensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
              <SortableContext items={modules.map(m => m.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {modules.map((m, i) => {
                    const isFocused = focusModuleId === m.id
                    return (
                      <motion.div
                        key={m.id}
                        ref={isFocused ? focusRowRef : undefined}
                        initial={{ opacity: 0, x: reduce ? 0 : -14 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.38, delay: Math.min(i, 6) * 0.05, ease: EASE }}
                      >
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
                      </motion.div>
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {modules.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
              <motion.button
                onClick={restoreDefaults}
                className="tc-btn-ghost"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                <RotateCcw size={13} /> Restore default modules
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {/* ── Right column — Training Intelligence ── */}
      <div className="tc-right" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <QuickStatsCard sessions={sessions} streak={streak} drillCount={drillCount} totalDuration={totalDuration} />
        <ThisWeekChart sessions={sessions} />
        <MotivationCarousel />
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
      {/* MatchLogger below already renders its own calendar strip and
          Classic/Scrims/Tournament sub-tabs (wired to its own
          activeType state) — rendering them here too duplicated both
          on screen, and this outer copy was never even connected to
          MatchLogger's filtering, so it did nothing when clicked. */}
      <TodayMatchStatsRow matchCount={matchCount} avgKills={avgKills} avgPlacement={avgPlacement} winRate={winRate} avgDamage={avgDamage} />
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
      <div className="tc-note-card">
        <CalendarClock size={14} style={{ color: '#2563FF', flexShrink: 0 }} />
        <span className="tc-note-text">
          No drills scheduled for today. Check your{' '}
          <button onClick={() => navigate('/scheduler')} className="tc-inline-link">full plan</button>
          {' '}for other tasks.
        </span>
      </div>
    )
  }

  return (
    <div className="tc-card">
      <div className="tc-card-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <CalendarClock size={15} style={{ color: '#2563FF', flexShrink: 0 }} />
          <span className="tc-card-label">Today's Scheduled Drills</span>
          <span className="tc-plan-chip">{data.planName}</span>
        </div>
        <button onClick={() => navigate('/scheduler')} className="tc-link-btn">
          View Full Plan <ArrowRight size={11} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {drillTasks.map((task, i) => (
          <ScheduledDrillRow
            key={task.id}
            task={task}
            index={i}
            onToggle={(done) => markTaskDone(task.id, done)}
            onStart={() => startDrill(task)}
          />
        ))}
      </div>

      {allDrillsDone && (
        <div className="tc-all-done">
          <CheckCircle2 size={13} />
          All drills done! Go to{' '}
          <button onClick={() => navigate('/scheduler')} className="tc-inline-link tc-inline-link--green">Scheduler</button>
          {' '}to complete the day and earn XP.
        </div>
      )}
    </div>
  )
}

function ScheduledDrillRow({ task, index, onToggle, onStart }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={`tc-drill-row ${task.done ? 'is-done' : ''}`}
      initial={{ opacity: 0, y: reduce ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: (index || 0) * 0.04, ease: EASE }}
    >
      <CheckToggle done={!!task.done} onToggle={() => onToggle(!task.done)} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: task.description ? 3 : 0 }}>
          <span className={`tc-drill-name ${task.done ? 'is-done' : ''}`}>{task.title || 'Drill'}</span>
          {task.duration > 0 && <span className="tc-dur-chip">{task.duration} min</span>}
        </div>
        {task.description && <div className="tc-drill-desc">{task.description}</div>}
      </div>

      {task.done ? (
        <span className="tc-done-badge">Completed</span>
      ) : (
        <motion.button
          onClick={onStart}
          className="tc-start-btn"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          Start
          <span className="tc-start-btn-icon"><ArrowRight size={11} /></span>
        </motion.button>
      )}
    </motion.div>
  )
}

/* Completion toggle with a scale-pop + colour flash on commit. */
function CheckToggle({ done, onToggle }) {
  const reduce = useReducedMotion()
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      aria-label={done ? 'Mark as not done' : 'Mark as done'}
      className={`tc-check ${done ? 'is-done' : ''}`}
    >
      <AnimatePresence initial={false}>
        {done && (
          <motion.span
            key="tick"
            initial={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { scale: [0, 1.2, 1], opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0.15 : 0.32, ease: EASE }}
            style={{ display: 'flex' }}
          >
            <CheckCircle2 size={12} strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}

/* ================================================================
   MATCH LOGGER TAB — stat row with count-up numbers
   ================================================================ */
function TodayMatchStatsRow({ matchCount, avgKills, avgPlacement, winRate, avgDamage }) {
  const reduce = useReducedMotion()
  const cards = [
    { Icon: Swords,     color: '#2563FF', tint: '#EAF2FF', label: 'Matches Logged', num: matchCount || null, prefix: '',  suffix: '',  decimals: 0 },
    { Icon: Target,     color: '#5B3DF5', tint: '#F0EEFF', label: 'Avg Placement',  num: avgPlacement,        prefix: '#', suffix: '',  decimals: 0 },
    { Icon: Skull,      color: '#EF3340', tint: '#FFF0F2', label: 'Avg Kills',      num: avgKills,            prefix: '',  suffix: '',  decimals: 1 },
    { Icon: Star,       color: '#F59E0B', tint: '#FFFBEB', label: 'Win Rate',       num: winRate,             prefix: '',  suffix: '%', decimals: 0 },
    { Icon: TrendingUp, color: '#16A34A', tint: '#F0FDF4', label: 'Avg Damage',     num: avgDamage,           prefix: '',  suffix: '',  decimals: 0 },
  ]

  return (
    <div className="match-logger-stats-row" style={{ gap: 10 }}>
      {cards.map(({ Icon, color, tint, label, num, prefix, suffix, decimals }, i) => (
        <motion.div
          key={label}
          className="tc-stat-card"
          initial={{ opacity: 0, y: reduce ? 0 : 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.055, ease: EASE }}
          whileHover={{ y: -2 }}
        >
          <div className="tc-stat-icon" style={{ background: tint }}>
            <Icon size={18} style={{ color }} />
          </div>
          <div className="tc-stat-label">{label}</div>
          <CountStat
            value={num}
            prefix={prefix}
            suffix={suffix}
            decimals={decimals}
            style={{
              fontFamily: 'Inter, sans-serif', fontWeight: 800,
              fontSize: 24, color: '#0B1224', lineHeight: 1,
              display: 'block',
            }}
          />
          <div className="tc-stat-foot">Today</div>
        </motion.div>
      ))}
    </div>
  )
}

/* ================================================================
   RIGHT SIDEBAR — TRAINING INTELLIGENCE
   ================================================================ */
function QuickStatsCard({ sessions, streak, drillCount, totalDuration }) {
  const reduce = useReducedMotion()
  const totalSessions = Array.isArray(sessions) ? sessions.length : 0
  const totalMinutes  = Array.isArray(sessions) ? sessions.reduce((s, sess) => s + (Number(sess.durationSeconds || 0) / 60), 0) : 0
  const hours = Math.floor(totalMinutes / 60)
  const mins  = Math.round(totalMinutes % 60)
  const currentStreak = streak?.count || 0
  const bestStreak    = streak?.longestStreak || streak?.bestStreak || 0

  const STATS = [
    { Icon: Clock,         color: '#2563FF', tint: '#EAF2FF', label: 'Practice Time', text: `${hours}h ${mins}m` },
    { Icon: CalendarClock, color: '#5B3DF5', tint: '#F0EEFF', label: 'Sessions',      num: totalSessions },
    { Icon: Target,        color: '#1677FF', tint: '#EAF2FF', label: 'Drills Done',   num: totalSessions },
    { Icon: Flame,         color: '#EF3340', tint: '#FFF0F2', label: 'Streak',        num: currentStreak, suffix: 'd' },
    { Icon: Trophy,        color: '#F59E0B', tint: '#FFFBEB', label: 'Best Streak',   num: bestStreak, suffix: 'd' },
    { Icon: TrendingUp,    color: '#16A34A', tint: '#F0FDF4', label: 'Consistency',   num: totalSessions > 0 ? Math.min(100, Math.round((currentStreak / 7) * 100)) : null, suffix: '%' },
  ]

  return (
    <div className="tc-card">
      <div className="tc-card-label" style={{ marginBottom: 14 }}>Quick Stats</div>
      <div className="tc-stat-grid">
        {STATS.map(({ Icon, color, tint, label, num, text, suffix }, i) => (
          <motion.div
            key={label}
            className="tc-stat-tile"
            style={{ background: tint }}
            initial={{ opacity: 0, y: reduce ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04, ease: EASE }}
          >
            <Icon size={15} style={{ color, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div className="tc-stat-tile-val">
                {text !== undefined
                  ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{text}</span>
                  : <CountStat value={num} suffix={suffix || ''} />}
              </div>
              <div className="tc-stat-tile-label">{label}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* "This Week" — practice minutes per weekday, derived from the same
   sessions array QuickStats uses (timestamp + durationSeconds). */
function ThisWeekChart({ sessions }) {
  const reduce = useReducedMotion()
  const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  const week = useMemo(() => {
    /* Monday-start week keys for the current week. */
    const now = new Date()
    const mondayOffset = (now.getDay() + 6) % 7
    const monday = new Date(now)
    monday.setHours(0, 0, 0, 0)
    monday.setDate(now.getDate() - mondayOffset)

    const keys = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      keys.push(dateKey(d))
    }

    const totals = keys.map(() => 0)
    ;(Array.isArray(sessions) ? sessions : []).forEach(s => {
      if (!s?.timestamp) return
      const k = dateKey(s.timestamp)
      const idx = keys.indexOf(k)
      if (idx >= 0) totals[idx] += (Number(s.durationSeconds) || 0) / 60
    })

    return keys.map((k, i) => ({ key: k, minutes: Math.round(totals[i]) }))
  }, [sessions])

  const max = Math.max(...week.map(d => d.minutes), 0)
  const hasData = max > 0
  const todayK = todayKey()

  return (
    <div className="tc-card">
      <div className="tc-card-head" style={{ marginBottom: 14 }}>
        <span className="tc-card-label">This Week</span>
        <span className="tc-card-meta">
          {hasData ? `${week.reduce((s, d) => s + d.minutes, 0)} min total` : 'No data yet'}
        </span>
      </div>

      {hasData ? (
        <div className="tc-bars">
          {week.map((d, i) => {
            const h = max > 0 ? Math.max(4, Math.round((d.minutes / max) * 100)) : 4
            const isToday = d.key === todayK
            return (
              <div key={d.key} className="tc-bar-col" title={`${d.minutes} min`}>
                <div className="tc-bar-track">
                  <motion.div
                    className={`tc-bar-fill ${isToday ? 'is-today' : ''}`}
                    initial={{ height: reduce ? `${h}%` : '0%' }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.6, delay: 0.1 + i * 0.05, ease: EASE }}
                  />
                </div>
                <span className={`tc-bar-label ${isToday ? 'is-today' : ''}`}>{DOW[i]}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="tc-bars-empty">
          <BarChart3 size={22} style={{ color: '#94A3B8', opacity: 0.5 }} />
          <span>Log a drill to start charting your week.</span>
        </div>
      )}
    </div>
  )
}

/* ================================================================
   RIGHT SIDEBAR — MATCH LOGGER TAB
   ================================================================ */
function PerformanceScoreCard({ matches }) {
  const reduce = useReducedMotion()
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
    <div className="tc-card">
      <div className="tc-card-label" style={{ marginBottom: 16 }}>Performance Score</div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: score === null ? 10 : 0 }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#E5EAF3" strokeWidth="10" />
          {score !== null && (
            <motion.circle
              cx="60" cy="60" r={radius} fill="none" stroke="#2563FF" strokeWidth="10"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: reduce ? dashOffset : circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 1, delay: 0.2, ease: EASE }}
              strokeLinecap="round" transform="rotate(-90 60 60)"
            />
          )}
          <text x="60" y="55" textAnchor="middle" dominantBaseline="middle"
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 30, fill: '#0B1224' }}>
            {score !== null ? score : '—'}
          </text>
          {score !== null && (
            <text x="60" y="74" textAnchor="middle"
              style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fill: '#64748B' }}>/100</text>
          )}
        </svg>
      </div>
      {score === null && (
        <div className="tc-card-empty-text">Complete matches to unlock your score</div>
      )}
    </div>
  )
}

function XPRewardCard({ xp }) {
  const reduce = useReducedMotion()
  const XP_NEXT    = 250
  const xpProgress = Math.max(0, (xp || 0) % XP_NEXT)
  const pct = Math.min(100, (xpProgress / XP_NEXT) * 100)

  return (
    <div className="tc-card tc-card--xp">
      <div className="tc-card-label" style={{ color: '#5B3DF5', marginBottom: 14 }}>XP Reward</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div className="tc-xp-icon"><Zap size={17} color="#2563FF" /></div>
        <div style={{ minWidth: 0 }}>
          <div className="tc-xp-amount">+25 XP</div>
          <div className="tc-xp-sub">Per match logged</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
        <span className="tc-xp-meta" style={{ fontVariantNumeric: 'tabular-nums' }}>{xpProgress} / {XP_NEXT} XP</span>
        <span className="tc-xp-meta tc-xp-meta--faint">Next: {XP_NEXT} XP</span>
      </div>
      <div className="tc-xp-track">
        <motion.div
          className="tc-xp-fill"
          initial={{ width: reduce ? `${pct}%` : '0%' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
        />
      </div>
    </div>
  )
}

function RecentMatchesCard({ matches }) {
  const reduce = useReducedMotion()
  const recent = useMemo(() =>
    [...(Array.isArray(matches) ? matches : [])].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)).slice(0, 3),
    [matches]
  )

  return (
    <div className="tc-card">
      <div className="tc-card-head" style={{ marginBottom: 14 }}>
        <span className="tc-card-label">Recent Matches</span>
        {recent.length > 0 && <span className="tc-card-meta">Last {recent.length}</span>}
      </div>

      {recent.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <LayeredIcon Icon={Clipboard} tint="#2563FF" />
          <div className="tc-empty-title" style={{ fontSize: 14 }}>No matches logged yet</div>
          <div className="tc-empty-desc">Log your first match to start building history.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recent.map((m, i) => (
            <motion.div
              key={i}
              className="tc-recent-row"
              initial={{ opacity: 0, y: reduce ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05, ease: EASE }}
            >
              <span className="tc-recent-icon"><Swords size={13} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tc-recent-map">{m.mapName || 'Unknown Map'}</div>
                <div className="tc-recent-meta">#{m.teamPosition || '—'} · {m.kills || 0} kills</div>
              </div>
              <span className="tc-recent-time">{timeAgo(m.timestamp)}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function TipCard() {
  return (
    <div className="tc-tip-card">
      <div className="tc-tip-icon">
        <Lightbulb size={16} style={{ color: '#F59E0B' }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="tc-tip-label">Tip</div>
        <div className="tc-tip-text">The more matches you log, the better your insights.</div>
      </div>
    </div>
  )
}

/* Empty-state icon with layered circles behind it for depth. */
function LayeredIcon({ Icon, tint = '#2563FF' }) {
  return (
    <div className="tc-layered-icon" aria-hidden>
      <span className="tc-layered-ring tc-layered-ring--outer" style={{ background: `${tint}0D` }} />
      <span className="tc-layered-ring tc-layered-ring--mid" style={{ background: `${tint}14` }} />
      <span className="tc-layered-ring tc-layered-ring--inner" style={{ background: `${tint}1F` }}>
        <Icon size={20} style={{ color: tint }} />
      </span>
    </div>
  )
}

/* ================================================================
   STYLES
   ================================================================ */
function TrainingStyles() {
  return (
    <style>{`
      /* ─────────────── HERO ─────────────── */
      .tc-hero {
        position: relative; overflow: hidden;
        background: linear-gradient(135deg, #F7F9FD 0%, #EEF4FF 60%, #FFF0F2 100%);
        border: 1px solid #E5EAF3;
        border-radius: 18px;
        padding: clamp(24px, 4vw, 36px);
        margin: 4px 0 20px;
        box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 16px 48px rgba(15,23,42,0.05);
      }
      .tc-hero-dots {
        position: absolute; inset: 0; pointer-events: none; z-index: 0;
        background-image: radial-gradient(circle, rgba(37,99,255,0.06) 1px, transparent 1px);
        background-size: 24px 24px;
      }
      .tc-hero-glow-blue {
        position: absolute; top: -80px; left: -80px; width: 320px; height: 320px;
        border-radius: 50%; pointer-events: none; z-index: 0;
        background: radial-gradient(circle, rgba(37,99,255,0.10) 0%, transparent 65%);
      }
      .tc-hero-glow-red {
        position: absolute; bottom: -60px; right: -60px; width: 280px; height: 280px;
        border-radius: 50%; pointer-events: none; z-index: 0;
        background: radial-gradient(circle, rgba(239,51,64,0.07) 0%, transparent 65%);
      }
      .tc-hero-inner {
        position: relative; z-index: 1;
        display: flex; align-items: center; justify-content: space-between;
        gap: 24px; flex-wrap: wrap;
      }
      .tc-hero-kicker {
        display: inline-flex; align-items: center; gap: 6px;
        font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 11px;
        text-transform: uppercase; letter-spacing: 0.15em; color: #2563FF;
      }
      .tc-hero-title {
        font-family: 'Barlow Condensed', sans-serif; font-weight: 900;
        font-size: clamp(32px, 6vw, 48px); line-height: 1;
        text-transform: uppercase; letter-spacing: 0.02em;
        color: #0B1224; margin: 6px 0 0;
      }
      .tc-hero-accent {
        width: 64px; height: 3px; transform-origin: left;
        background: linear-gradient(90deg, #2563FF 0%, #5B3DF5 50%, #EF3340 100%);
        border-radius: 2px; margin: 12px 0;
      }
      .tc-hero-sub {
        font-family: 'Inter', sans-serif; font-size: 15px; color: #64748B; margin: 0;
      }

      /* Completion ring */
      .tc-hero-ring { position: relative; flex-shrink: 0; display: none; }
      @media (min-width: 720px) { .tc-hero-ring { display: block; } }
      .tc-hero-ring-center {
        position: absolute; top: 0; left: 0; width: 92px; height: 92px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 1px; pointer-events: none;
      }
      .tc-hero-ring-label {
        font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 9px;
        text-transform: uppercase; letter-spacing: 0.14em; color: #94A3B8;
      }
      .tc-hero-ring-meta {
        margin-top: 8px; text-align: center; white-space: nowrap;
        font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 500; color: #64748B;
      }

      /* ─────────── TAB SWITCHER ─────────── */
      .tc-tab-switcher {
        display: inline-flex; align-self: flex-start;
        background: #FFFFFF; border: 1px solid #E5EAF3;
        border-radius: 12px; padding: 4px; gap: 4px;
        margin-bottom: 24px; position: relative;
        box-shadow: 0 2px 8px rgba(15,23,42,0.04);
      }
      .tc-tab-btn {
        position: relative; border: none; background: transparent;
        border-radius: 8px; padding: 10px 22px; cursor: pointer;
        font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500;
        color: #64748B; white-space: nowrap;
        transition: color 0.18s ease, background 0.18s ease;
      }
      .tc-tab-btn.is-active { color: #FFFFFF; font-weight: 600; }
      @media (hover: hover) and (pointer: fine) {
        .tc-tab-btn:not(.is-active):hover { background: #F8FAFF; color: #0B1224; }
      }
      .tc-tab-pill {
        position: absolute; inset: 0; border-radius: 8px; z-index: 0;
        background: linear-gradient(135deg, #2563FF, #5B3DF5);
        box-shadow: 0 4px 12px rgba(37,99,255,0.28);
      }
      .tc-tab-label {
        position: relative; z-index: 1;
        display: inline-flex; align-items: center; gap: 8px;
      }

      /* Tab content: opacity-only, near-imperceptible — switched tens/day */
      .tc-tab-content { animation: tc-fadein 0.15s ease both; }
      @keyframes tc-fadein { from { opacity: 0; } to { opacity: 1; } }

      /* ───────────── CARDS ───────────── */
      .tc-card {
        background: #FFFFFF; border: 1px solid #E5EAF3;
        border-radius: 16px; padding: 20px;
        box-shadow: 0 4px 20px rgba(15,23,42,0.04);
        transition: box-shadow 0.2s ease;
      }
      .tc-card--xp {
        background: linear-gradient(135deg, #EEF4FF, #F0EEFF);
        border-color: #DCE5FA;
      }
      .tc-card-head {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; flex-wrap: wrap; margin-bottom: 16px;
      }
      .tc-card-label {
        font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 11px;
        text-transform: uppercase; letter-spacing: 0.14em; color: #64748B;
      }
      .tc-card-meta {
        font-family: 'Inter', sans-serif; font-size: 11.5px; color: #94A3B8;
        font-variant-numeric: tabular-nums;
      }
      .tc-card-empty-text {
        text-align: center; font-family: 'Inter', sans-serif;
        font-size: 13px; color: #64748B; line-height: 1.5;
      }
      .tc-plan-chip {
        background: #EAF2FF; border: 1px solid rgba(37,99,255,0.2);
        color: #2563FF; border-radius: 6px; padding: 2px 9px;
        font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 500;
      }
      .tc-link-btn {
        background: transparent; border: none; cursor: pointer; padding: 0;
        color: #2563FF; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
        display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
      }
      .tc-inline-link {
        background: none; border: none; padding: 0; cursor: pointer;
        color: #2563FF; font-family: inherit; font-size: inherit; font-weight: 600;
      }
      .tc-inline-link--green { color: #16A34A; }

      .tc-note-card {
        background: #FFFFFF; border: 1px solid #E5EAF3; border-radius: 12px;
        padding: 14px 20px; display: flex; align-items: center; gap: 10px;
        box-shadow: 0 4px 20px rgba(15,23,42,0.04);
      }
      .tc-note-text { font-family: 'Inter', sans-serif; font-size: 13px; color: #64748B; }

      .tc-all-done {
        margin-top: 12px; padding: 9px 13px;
        background: rgba(22,163,74,0.06); border: 1px solid rgba(22,163,74,0.2);
        border-radius: 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        color: #16A34A; font-size: 12.5px; font-family: 'Inter', sans-serif;
      }

      /* ───────── SECTION HEADER ───────── */
      .tc-section-head {
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px; flex-wrap: wrap;
      }
      .tc-section-title {
        display: flex; align-items: center; gap: 9px;
        font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 20px;
        text-transform: uppercase; letter-spacing: 0.03em; color: #0B1224;
      }
      .tc-section-icon {
        width: 28px; height: 28px; border-radius: 8px; background: #EAF2FF;
        display: inline-flex; align-items: center; justify-content: center;
        color: #2563FF; flex-shrink: 0;
      }
      .tc-section-meta {
        font-family: 'Inter', sans-serif; font-size: 12.5px; color: #64748B;
        margin-top: 3px; padding-left: 37px;
      }

      /* ───────────── BUTTONS ───────────── */
      .tc-pill-btn {
        background: linear-gradient(135deg, #2563FF, #5B3DF5); border: none;
        border-radius: 999px; color: #fff; padding: 8px 10px 8px 20px;
        font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
        cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
        box-shadow: 0 4px 14px rgba(37,99,255,0.25), inset 0 1px 0 rgba(255,255,255,0.14);
        flex-shrink: 0;
      }
      .tc-pill-btn-icon {
        width: 28px; height: 28px; border-radius: 50%;
        background: rgba(255,255,255,0.18); flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
      }
      .tc-btn-primary {
        background: linear-gradient(135deg, #2563FF, #5B3DF5); border: none;
        border-radius: 10px; color: #fff; padding: 9px 18px;
        font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
        cursor: pointer; display: inline-flex; align-items: center; gap: 7px;
        box-shadow: 0 4px 12px rgba(37,99,255,0.25);
      }
      .tc-btn-ghost {
        background: #FFFFFF; border: 1px solid #E5EAF3;
        border-radius: 10px; color: #475569; padding: 9px 18px;
        font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
        cursor: pointer; display: inline-flex; align-items: center; gap: 7px;
      }
      @media (hover: hover) and (pointer: fine) {
        .tc-btn-ghost:hover { border-color: #2563FF; color: #2563FF; }
      }

      /* ─────────── EMPTY STATES ─────────── */
      .tc-empty-card {
        background: #FFFFFF; border: 1px solid #E5EAF3; border-radius: 16px;
        padding: 32px 24px; text-align: center;
        box-shadow: 0 4px 20px rgba(15,23,42,0.04);
      }
      .tc-empty-title {
        font-family: 'Inter', sans-serif; font-weight: 700; font-size: 15px;
        color: #0B1224; margin-bottom: 6px;
      }
      .tc-empty-desc {
        font-family: 'Inter', sans-serif; font-size: 13px; color: #64748B; line-height: 1.55;
      }
      .tc-layered-icon {
        position: relative; width: 72px; height: 72px; margin: 0 auto 14px;
        display: flex; align-items: center; justify-content: center;
      }
      .tc-layered-ring {
        position: absolute; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
      }
      .tc-layered-ring--outer { width: 72px; height: 72px; }
      .tc-layered-ring--mid   { width: 54px; height: 54px; }
      .tc-layered-ring--inner { width: 38px; height: 38px; position: relative; }

      /* ─────────── DRILL ROWS ─────────── */
      .tc-drill-row {
        display: flex; align-items: flex-start; gap: 11px;
        padding: 11px 13px; background: #F8FAFD;
        border: 1px solid rgba(37,99,255,0.08);
        border-left: 3px solid rgba(37,99,255,0.25);
        border-radius: 10px;
        transition: background 0.18s cubic-bezier(0.23,1,0.32,1),
                    border-color 0.18s cubic-bezier(0.23,1,0.32,1),
                    box-shadow 0.18s cubic-bezier(0.23,1,0.32,1);
      }
      .tc-drill-row.is-done {
        border-color: rgba(22,163,74,0.2);
        border-left-color: rgba(22,163,74,0.5);
      }
      @media (hover: hover) and (pointer: fine) {
        .tc-drill-row:not(.is-done):hover {
          background: #EEF4FF;
          border-left-color: #2563FF;
          box-shadow: 0 2px 10px rgba(37,99,255,0.08);
        }
      }
      .tc-check {
        width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0; margin-top: 1px;
        background: transparent; border: 1.5px solid #D0DAE8; cursor: pointer;
        display: flex; align-items: center; justify-content: center; color: #fff;
        transition: background 0.18s ease, border-color 0.18s ease;
      }
      .tc-check.is-done { background: #16A34A; border-color: #16A34A; }
      .tc-drill-name {
        font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #0B1224;
      }
      .tc-drill-name.is-done { color: #94A3B8; text-decoration: line-through; }
      .tc-dur-chip {
        background: #F1F5F9; border: 1px solid #E5EAF3; color: #64748B;
        border-radius: 5px; padding: 1px 7px;
        font-family: 'Inter', sans-serif; font-size: 11px; font-variant-numeric: tabular-nums;
      }
      .tc-drill-desc {
        font-family: 'Inter', sans-serif; font-size: 12px; color: #94A3B8; line-height: 1.4;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .tc-done-badge {
        border: 1px solid rgba(22,163,74,0.4); color: #16A34A;
        border-radius: 8px; padding: 5px 12px;
        font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
        flex-shrink: 0; white-space: nowrap;
      }
      .tc-start-btn {
        background: linear-gradient(135deg, #2563FF, #5B3DF5); color: #fff; border: none;
        border-radius: 999px; padding: 6px 8px 6px 14px;
        font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
        cursor: pointer; flex-shrink: 0; white-space: nowrap;
        display: inline-flex; align-items: center; gap: 6px;
        box-shadow: 0 2px 8px rgba(37,99,255,0.22), inset 0 1px 0 rgba(255,255,255,0.12);
      }
      .tc-start-btn-icon {
        width: 22px; height: 22px; border-radius: 50%;
        background: rgba(255,255,255,0.18);
        display: flex; align-items: center; justify-content: center;
      }

      /* ─────────── STAT CARDS ─────────── */
      .tc-stat-card {
        background: #FFFFFF; border: 1px solid rgba(37,99,255,0.07);
        border-radius: 14px; padding: 16px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.9),
                    0 1px 3px rgba(15,23,42,0.04),
                    0 8px 24px rgba(15,23,42,0.05);
        transition: box-shadow 0.2s cubic-bezier(0.23,1,0.32,1);
      }
      @media (hover: hover) and (pointer: fine) {
        .tc-stat-card:hover {
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.9),
                      0 4px 14px rgba(37,99,255,0.1),
                      0 16px 40px rgba(37,99,255,0.07);
        }
      }
      .tc-stat-icon {
        width: 38px; height: 38px; border-radius: 11px; margin-bottom: 12px;
        display: flex; align-items: center; justify-content: center;
      }
      .tc-stat-label {
        font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 500;
        color: #64748B; margin-bottom: 6px; line-height: 1.3;
      }
      .tc-stat-foot {
        font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 9.5px;
        text-transform: uppercase; letter-spacing: 0.12em; color: #94A3B8; margin-top: 6px;
      }

      /* Quick-stats 2-col tile grid */
      .tc-stat-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .tc-stat-tile {
        display: flex; align-items: center; gap: 9px;
        padding: 11px 12px; border-radius: 11px; min-width: 0;
      }
      .tc-stat-tile-val {
        font-family: 'Inter', sans-serif; font-weight: 800; font-size: 15px;
        color: #0B1224; line-height: 1.1; font-variant-numeric: tabular-nums;
      }
      .tc-stat-tile-label {
        font-family: 'Inter', sans-serif; font-size: 10.5px; font-weight: 500;
        color: #64748B; margin-top: 2px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }

      /* ───────── THIS WEEK BARS ───────── */
      .tc-bars {
        display: grid; grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 6px; align-items: end;
      }
      .tc-bar-col { display: flex; flex-direction: column; align-items: center; gap: 7px; }
      .tc-bar-track {
        width: 100%; height: 88px; border-radius: 7px;
        background: #F1F5F9; display: flex; align-items: flex-end; overflow: hidden;
      }
      .tc-bar-fill {
        width: 100%; border-radius: 7px;
        background: linear-gradient(180deg, #5B3DF5, #2563FF);
      }
      .tc-bar-fill.is-today { background: linear-gradient(180deg, #EF3340, #F59E0B); }
      .tc-bar-label {
        font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 10.5px;
        text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8;
      }
      .tc-bar-label.is-today { color: #EF3340; }
      .tc-bars-empty {
        display: flex; flex-direction: column; align-items: center; gap: 8px;
        padding: 18px 8px; text-align: center;
        font-family: 'Inter', sans-serif; font-size: 12.5px; color: #94A3B8; line-height: 1.5;
      }

      /* ───────────── XP CARD ───────────── */
      .tc-xp-icon {
        width: 34px; height: 34px; background: #EAF2FF; border-radius: 10px;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .tc-xp-amount {
        font-family: 'Inter', sans-serif; font-weight: 800; font-size: 19px; color: #0B1224;
        font-variant-numeric: tabular-nums;
      }
      .tc-xp-sub { font-family: 'Inter', sans-serif; font-size: 12.5px; color: #64748B; }
      .tc-xp-meta { font-family: 'Inter', sans-serif; font-size: 11px; color: #64748B; }
      .tc-xp-meta--faint { color: #94A3B8; }
      .tc-xp-track { height: 6px; background: #E5EAF3; border-radius: 999px; overflow: hidden; }
      .tc-xp-fill {
        height: 100%; border-radius: 999px;
        background: linear-gradient(90deg, #2563FF, #5B3DF5);
      }

      /* ────────── RECENT MATCHES ────────── */
      .tc-recent-row {
        display: flex; align-items: center; gap: 10px;
        padding: 9px 11px; background: #F8FAFD;
        border: 1px solid #E5EAF3; border-radius: 10px;
      }
      .tc-recent-icon {
        width: 28px; height: 28px; border-radius: 8px; background: #EAF2FF;
        display: flex; align-items: center; justify-content: center;
        color: #2563FF; flex-shrink: 0;
      }
      .tc-recent-map {
        font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 600; color: #0B1224;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .tc-recent-meta {
        font-family: 'Inter', sans-serif; font-size: 11px; color: #64748B;
        font-variant-numeric: tabular-nums;
      }
      .tc-recent-time {
        font-family: 'Inter', sans-serif; font-size: 10.5px; color: #94A3B8;
        flex-shrink: 0; white-space: nowrap;
      }

      /* ───────────── TIP CARD ───────────── */
      .tc-tip-card {
        background: #FFFBEB; border: 1px solid rgba(245,158,11,0.22);
        border-radius: 16px; padding: 16px;
        display: flex; gap: 11px; align-items: flex-start;
        box-shadow: 0 4px 20px rgba(245,158,11,0.06);
      }
      .tc-tip-icon {
        width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
        background: rgba(245,158,11,0.14);
        display: flex; align-items: center; justify-content: center;
        animation: tc-pulse 2.6s cubic-bezier(0.23,1,0.32,1) infinite;
      }
      @keyframes tc-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.22); }
        50%      { box-shadow: 0 0 0 7px rgba(245,158,11,0); }
      }
      .tc-tip-label {
        font-family: 'Rajdhani', sans-serif; font-size: 10.5px; font-weight: 600;
        color: #F59E0B; text-transform: uppercase; letter-spacing: 0.14em; margin-bottom: 4px;
      }
      .tc-tip-text {
        font-family: 'Inter', sans-serif; font-size: 13px; color: #64748B; line-height: 1.6;
      }

      /* ───────── REDUCED MOTION ───────── */
      @media (prefers-reduced-motion: reduce) {
        .tc-tab-content { animation: none; }
        .tc-tip-icon { animation: none; }
      }

      /* ───────────── LAYOUT ───────────── */
      .tc-two-col { display: flex; gap: 20px; align-items: flex-start; }
      .tc-left { flex: 2; min-width: 0; }
      .tc-right { width: 340px; flex-shrink: 0; }
      @media (max-width: 960px) {
        /* align-items: flex-start (above) is correct in row mode — it
           lets .tc-left/.tc-right have independent heights. But once
           this switches to a column, the cross-axis becomes WIDTH, and
           flex-start means "size to content" instead of "fill the
           column" — so .tc-left's content (drill rows, weapon picker)
           renders at its natural, unconstrained width and overflows
           the screen. min-width: 0 alone can't fix this: it only lowers
           the shrink floor, it doesn't request shrinking in the first
           place. stretch is what forces both columns to the full
           mobile width. */
        .tc-two-col { flex-direction: column; align-items: stretch; }
        .tc-right { width: 100%; }
      }
      .match-logger-stats-row {
        display: grid;
        /* minmax(0, 1fr) — not plain 1fr — so a card's own content
           can never force its track wider than its equal share. */
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      @media (min-width: 480px) {
        .match-logger-stats-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
      @media (min-width: 768px) {
        .match-logger-stats-row { grid-template-columns: repeat(5, minmax(0, 1fr)); }
      }
      @media (max-width: 420px) {
        .tc-section-meta { padding-left: 0; }
      }
    `}</style>
  )
}
