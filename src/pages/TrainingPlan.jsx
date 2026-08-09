import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ClipboardList, Bot, Plus, Save, X, Sparkles } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useModules } from '../hooks/useModules.js'
import { STORAGE_KEYS } from '../utils/constants.js'
import { uid } from '../utils/helpers.js'
import PlanCard from '../components/PlanCard.jsx'
import AIPlanGenerator from '../components/AIPlanGenerator.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'

const PLANS_KEY = 'esportselite_training_plans'

const DAY_FULL = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

const TABS = [
  { id: 'my', label: 'My Plan',      icon: ClipboardList },
  { id: 'ai', label: 'AI Suggested', icon: Bot },
]

const DURATION_PRESETS = [7, 14, 30]

function buildEmptyDays() {
  return DAY_FULL.map((name, idx) => ({
    dayIndex: idx,
    dayName: name,
    isRestDay: false,
    sessions: [],
    matchPractice: false,
    notes: '',
    dailyTip: '',
  }))
}

function todayISODate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function TrainingPlan() {
  const [tab, setTab] = useState('my')
  const [plans, setPlans] = useLocalStorage(PLANS_KEY, [])
  const [dailySessions] = useLocalStorage(STORAGE_KEYS.DAILY_SESSIONS, {})
  const { modules } = useModules()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  function addPlan(plan) {
    setPlans(prev => {
      const isFirst = prev.length === 0
      const entry = { ...plan, isActive: plan.isActive || isFirst }
      const next = entry.isActive ? prev.map(p => ({ ...p, isActive: false })) : prev.slice()
      return [entry, ...next]
    })
  }

  function updatePlan(updated) {
    setPlans(prev => prev.map(p => (p.id === updated.id ? updated : p)))
  }

  function deletePlan(id) {
    setPlans(prev => prev.filter(p => p.id !== id))
  }

  function duplicatePlan(id) {
    setPlans(prev => {
      const orig = prev.find(p => p.id === id)
      if (!orig) return prev
      const copy = {
        ...orig,
        id: 'plan-' + uid(),
        name: orig.name.endsWith(' (Copy)') ? orig.name : orig.name + ' (Copy)',
        isActive: false,
        createdAt: Date.now(),
        days: (orig.days || []).map(d => ({
          ...d,
          sessions: (d.sessions || []).map(s => ({ ...s, id: 'sess-' + uid() })),
        })),
      }
      return [copy, ...prev]
    })
  }

  function setActivePlan(id) {
    setPlans(prev => prev.map(p => ({ ...p, isActive: p.id === id })))
  }

  function openCreate() {
    setEditingPlan(null)
    setModalOpen(true)
  }

  function openEdit(plan) {
    setEditingPlan(plan)
    setModalOpen(true)
  }

  function submitModal({ name, goal, duration, startDate }) {
    if (editingPlan) {
      updatePlan({ ...editingPlan, name, goal, duration, startDate })
    } else {
      addPlan({
        id: 'plan-' + uid(),
        name, goal, duration, startDate,
        isActive: false,
        isAiGenerated: false,
        createdAt: Date.now(),
        days: buildEmptyDays(),
        overallTip: '',
      })
    }
    setModalOpen(false)
    setEditingPlan(null)
  }

  const planToDelete = plans.find(p => p.id === confirmDeleteId)

  return (
    <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Tabs */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: 3,
          display: 'inline-flex',
          gap: 2,
          alignSelf: 'flex-start',
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
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'my' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <h3 className="section-heading" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClipboardList size={16} style={{ color: 'var(--text-subtle)' }} /> My training plan
              </h3>
              <div className="label" style={{ marginTop: 2 }}>Build your weekly routine</div>
            </div>
            <button onClick={openCreate} className="btn btn-primary btn-sm">
              <Plus size={13} /> Create plan
            </button>
          </div>

          {plans.length === 0 ? (
            <div className="card empty-state">
              <Sparkles size={28} className="empty-state-icon" />
              <div className="empty-state-title">No plans yet</div>
              <div className="empty-state-desc">
                Create a weekly training plan, or generate one with the AI coach.
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button onClick={openCreate} className="btn btn-primary btn-sm">
                  <Plus size={13} /> Create plan
                </button>
                <button onClick={() => setTab('ai')} className="btn btn-secondary btn-sm">
                  <Bot size={13} /> Try AI generator
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {plans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  dailySessions={dailySessions}
                  modules={modules}
                  onUpdate={updatePlan}
                  onDelete={id => setConfirmDeleteId(id)}
                  onDuplicate={duplicatePlan}
                  onSetActive={setActivePlan}
                  onEdit={openEdit}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <AIPlanGenerator onSavePlan={addPlan} />
      )}

      <PlanFormModal
        open={modalOpen}
        initial={editingPlan}
        onClose={() => { setModalOpen(false); setEditingPlan(null) }}
        onSubmit={submitModal}
      />

      <ConfirmModal
        open={!!confirmDeleteId}
        title="Delete plan?"
        message={
          planToDelete ? (
            <>Delete <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{planToDelete.name}</span>? This cannot be undone.</>
          ) : 'Delete this plan?'
        }
        confirmLabel="Delete"
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => { deletePlan(confirmDeleteId); setConfirmDeleteId(null) }}
      />
    </div>
  )
}

/* ============================================================
   PLAN FORM MODAL
   ============================================================ */
function PlanFormModal({ open, initial, onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [durationMode, setDurationMode] = useState(7)
  const [customDuration, setCustomDuration] = useState(7)
  const [startDate, setStartDate] = useState(todayISODate())
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(initial?.name || '')
      setGoal(initial?.goal || '')
      const dur = initial?.duration || 7
      if (DURATION_PRESETS.includes(dur)) setDurationMode(dur)
      else { setDurationMode('custom'); setCustomDuration(dur) }
      setStartDate(initial?.startDate ? new Date(initial.startDate).toISOString().slice(0, 10) : todayISODate())
      setError('')
    }
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Plan name is required.'); return }
    const duration = durationMode === 'custom'
      ? Math.max(1, Math.min(365, Number(customDuration) || 7))
      : durationMode
    onSubmit({
      name: trimmed,
      goal: goal.trim(),
      duration,
      startDate: new Date(startDate + 'T00:00:00').toISOString(),
    })
  }

  const modal = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34, height: 34,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ClipboardList size={16} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div>
              <h3
                style={{
                  fontFamily: 'Bebas Neue, sans-serif',
                  fontWeight: 700,
                  fontSize: 17,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                {initial ? 'Edit Plan' : 'Create New Plan'}
              </h3>
              <div className="label" style={{ marginTop: 2 }}>Weekly routine</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32,
              borderRadius: 'var(--radius-sm)',
              background: 'transparent', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label" style={{ display: 'block', marginBottom: 6 }}>Plan name</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="e.g. Week 1 — Aim Focus"
              className="input"
              autoFocus
              maxLength={60}
            />
          </div>

          <div>
            <label className="label" style={{ display: 'block', marginBottom: 6 }}>
              Goal <span style={{ textTransform: 'none', color: 'var(--text-subtle)' }}>(optional)</span>
            </label>
            <input
              type="text"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="e.g. Improve mid-range spray"
              className="input"
              maxLength={120}
            />
          </div>

          <div>
            <label className="label" style={{ display: 'block', marginBottom: 6 }}>Duration</label>
            <div className="seg">
              {DURATION_PRESETS.map(d => (
                <button
                  key={d}
                  onClick={() => setDurationMode(d)}
                  className={`seg-btn ${durationMode === d ? 'active' : ''}`}
                >
                  {d} days
                </button>
              ))}
              <button
                onClick={() => setDurationMode('custom')}
                className={`seg-btn ${durationMode === 'custom' ? 'active' : ''}`}
              >
                Custom
              </button>
            </div>
            {durationMode === 'custom' && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={customDuration}
                  onChange={e => setCustomDuration(e.target.value)}
                  className="input"
                  style={{ width: 110, textAlign: 'center' }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>days</span>
              </div>
            )}
          </div>

          <div>
            <label className="label" style={{ display: 'block', marginBottom: 6 }}>Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="input"
            />
          </div>

          {error && (
            <div
              style={{
                background: 'var(--red-ghost)',
                border: '1px solid rgba(232,0,28,0.2)',
                color: 'var(--red)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '14px 24px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={submit} className="btn btn-primary">
            <Save size={14} /> {initial ? 'Save changes' : 'Create plan'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
