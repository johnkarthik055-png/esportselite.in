import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ChevronDown, GripVertical, Crosshair, Flame, Move, Car, Swords, Target,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DrillRow from './DrillRow.jsx'
import WeaponPicker from './WeaponPicker.jsx'
import ModuleManageMenu from './ModuleManageMenu.jsx'
import AddDrillModal from './AddDrillModal.jsx'
import CreateModuleModal from './CreateModuleModal.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import { uid } from '../utils/helpers.js'

const EASE = [0.22, 1, 0.36, 1]

/**
 * Per-module accent identity. Matched on the module name so custom
 * modules still land on a sensible colour instead of a default grey.
 * Each entry pairs a strip colour, an icon tint background, and an icon.
 */
const ACCENTS = [
  { match: ['ads', 'aim', 'scope', 'flick', 'precision'], color: '#2563FF', tint: '#EAF2FF', Icon: Crosshair },
  { match: ['spray', 'recoil', 'burst'],                  color: '#EF3340', tint: '#FFF0F2', Icon: Flame },
  { match: ['move', 'movement', 'strafe', 'jiggle'],      color: '#5B3DF5', tint: '#F0EEFF', Icon: Move },
  { match: ['car', 'vehicle', 'drive'],                   color: '#F59E0B', tint: '#FFFBEB', Icon: Car },
  { match: ['close', 'tdm', 'melee', 'knife', 'range'],   color: '#16A34A', tint: '#F0FDF4', Icon: Swords },
]

const FALLBACK_ACCENT = { color: '#2563FF', tint: '#EAF2FF', Icon: Target }

function accentFor(name = '') {
  const lower = String(name).toLowerCase()
  for (const a of ACCENTS) {
    if (a.match.some(token => lower.includes(token))) return a
  }
  return FALLBACK_ACCENT
}

/**
 * Unified module card — a collapsible "training block".
 * All logic (drag/drop, drills CRUD, modals) is unchanged; only the
 * presentation layer was rebuilt.
 */
export default function ModuleCard({
  module,
  defaultOpen = false,
  onUpdate,
  onDelete,
  onDuplicate,
  onReorderDrills,
  todayPlan,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [guns, setGuns] = useState([])
  const reduce = useReducedMotion()

  const planned = !!todayPlan?.planned
  const accent = accentFor(module.name)
  const AccentIcon = accent.Icon

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id })

  const moduleStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const drillSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDrillDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = module.drills.findIndex(d => d.id === active.id)
    const newIndex = module.drills.findIndex(d => d.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(module.drills, oldIndex, newIndex)
    if (onReorderDrills) onReorderDrills(module.id, next)
    else onUpdate({ ...module, drills: next })
  }

  const [renameOpen, setRenameOpen] = useState(false)
  const [addDrillOpen, setAddDrillOpen] = useState(false)
  const [editingDrill, setEditingDrill] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingDrill, setDeletingDrill] = useState(null)

  function handleRename({ name, description, icon }) {
    onUpdate({
      ...module,
      name: name.trim() || module.name,
      short: name.trim() || module.short,
      description: description.trim(),
      icon: icon || module.icon,
    })
    setRenameOpen(false)
  }

  function handleAddDrill({ name, description }) {
    onUpdate({
      ...module,
      drills: [
        ...module.drills,
        { id: 'drill-' + uid(), name: name.trim(), description: description.trim() },
      ],
    })
    setAddDrillOpen(false)
  }

  function handleEditDrill({ name, description }) {
    if (!editingDrill) return
    onUpdate({
      ...module,
      drills: module.drills.map(d =>
        d.id === editingDrill.id
          ? { ...d, name: name.trim(), description: description.trim() }
          : d
      ),
    })
    setEditingDrill(null)
  }

  function handleDuplicateDrill(drill) {
    onUpdate({
      ...module,
      drills: [
        ...module.drills,
        {
          id: 'drill-' + uid(),
          name: drill.name.endsWith(' (Copy)') ? drill.name : drill.name + ' (Copy)',
          description: drill.description || '',
        },
      ],
    })
  }

  function handleDeleteDrillConfirmed() {
    if (!deletingDrill) return
    onUpdate({
      ...module,
      drills: module.drills.filter(d => d.id !== deletingDrill.id),
    })
    setDeletingDrill(null)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        className={`mdc-card ${isDragging ? 'is-dragging' : ''} ${open ? 'is-open' : ''}`}
        style={{
          ...moduleStyle,
          transition: `${moduleStyle.transition || ''} border-color 0.18s ease, box-shadow 0.18s ease`,
          ...(isDragging ? { zIndex: 10, position: 'relative' } : {}),
        }}
      >
        {/* Per-type accent strip */}
        <span className="mdc-accent" style={{ background: accent.color }} aria-hidden />

        {/* ── Header ── */}
        <div className="mdc-head">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            title="Drag to reorder module"
            aria-label="Drag to reorder module"
            className="mdc-grip"
          >
            <GripVertical size={16} />
          </button>

          <button onClick={() => setOpen(v => !v)} className="mdc-head-main">
            {/* Icon box */}
            <span className="mdc-icon" style={{ background: accent.tint }}>
              <AccentIcon size={17} style={{ color: accent.color }} />
            </span>

            <span className="mdc-head-text">
              <span className="mdc-title">
                {module.name}
                {!module.isDefault && <span className="mdc-tag">Custom</span>}
              </span>
              {module.description && (
                <span className="mdc-desc">{module.description}</span>
              )}
              {planned && todayPlan.duration > 0 && (
                <span className="mdc-planned">⏱ {todayPlan.duration} mins planned</span>
              )}
            </span>
          </button>

          <div className="mdc-head-actions">
            {planned && <span className="mdc-today-chip">Today's Plan</span>}

            <span className="mdc-count">
              {module.drills.length} drill{module.drills.length === 1 ? '' : 's'}
            </span>

            <ModuleManageMenu
              onRename={() => setRenameOpen(true)}
              onAddDrill={() => setAddDrillOpen(true)}
              onDuplicate={() => onDuplicate?.()}
              onDelete={() => setDeleteOpen(true)}
            />

            <button
              onClick={() => setOpen(v => !v)}
              title={open ? 'Collapse' : 'Expand'}
              aria-expanded={open}
              className="mdc-chev"
            >
              <motion.span
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ duration: reduce ? 0 : 0.25, ease: EASE }}
                style={{ display: 'flex' }}
              >
                <ChevronDown size={18} />
              </motion.span>
            </button>
          </div>
        </div>

        {/* ── Body — spring height expand ── */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={reduce
                ? { duration: 0.15 }
                : {
                    height: { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 },
                    opacity: { duration: 0.22, ease: EASE },
                  }}
              style={{ overflow: 'hidden' }}
            >
              <div className="mdc-body">
                <WeaponPicker selected={guns} onChange={setGuns} />

                <div>
                  <div className="mdc-drills-head">
                    <span className="mdc-drills-label">Drills</span>
                    <button onClick={() => setAddDrillOpen(true)} className="mdc-add-drill">
                      + Add drill
                    </button>
                  </div>

                  {module.drills.length === 0 ? (
                    <div className="mdc-drills-empty">
                      <div className="mdc-drills-empty-title">No drills yet</div>
                      <div className="mdc-drills-empty-desc">
                        Add your first drill to start logging sessions.
                      </div>
                    </div>
                  ) : (
                    <DndContext
                      sensors={drillSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDrillDragEnd}
                    >
                      <SortableContext
                        items={module.drills.map(d => d.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {module.drills.map(drill => (
                            <DrillRow
                              key={drill.id}
                              drill={drill}
                              moduleId={module.id}
                              moduleName={module.short || module.name}
                              gunsSelected={guns}
                              isCustom={!module.isDefault}
                              onEditDrill={d => setEditingDrill(d)}
                              onDeleteDrill={d => setDeletingDrill(d)}
                              onDuplicateDrill={d => handleDuplicateDrill(d)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <style>{styles}</style>
      </div>

      {/* Modals */}
      <CreateModuleModal
        open={renameOpen}
        mode="edit"
        initial={{ name: module.name, description: module.description, icon: module.icon }}
        onClose={() => setRenameOpen(false)}
        onSubmit={handleRename}
      />

      <AddDrillModal
        open={addDrillOpen}
        mode="add"
        moduleName={module.name}
        onClose={() => setAddDrillOpen(false)}
        onSubmit={handleAddDrill}
      />

      <AddDrillModal
        open={!!editingDrill}
        mode="edit"
        moduleName={module.name}
        initial={editingDrill || undefined}
        onClose={() => setEditingDrill(null)}
        onSubmit={handleEditDrill}
      />

      <ConfirmModal
        open={deleteOpen}
        title={`Delete "${module.name}"?`}
        message={
          <>
            All drill history under this module will remain in your stats,
            but the module will be removed.
          </>
        }
        confirmLabel="Delete Module"
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => { setDeleteOpen(false); onDelete?.() }}
      />

      <ConfirmModal
        open={!!deletingDrill}
        title="Delete drill?"
        message={
          <>
            Remove <strong style={{ color: '#0B1224' }}>"{deletingDrill?.name}"</strong> from this module.
            Logged sessions for this drill will remain in your history.
          </>
        }
        confirmLabel="Delete Drill"
        onClose={() => setDeletingDrill(null)}
        onConfirm={handleDeleteDrillConfirmed}
      />
    </>
  )
}

const styles = `
  .mdc-card {
    position: relative; overflow: hidden;
    background: #FFFFFF; border: 1px solid #E5EAF3; border-radius: 16px;
    box-shadow: 0 4px 20px rgba(15,23,42,0.04);
  }
  .mdc-card.is-open { box-shadow: 0 8px 30px rgba(37,99,255,0.08); }
  .mdc-card.is-dragging { box-shadow: 0 14px 40px rgba(15,23,42,0.12); }
  @media (hover: hover) and (pointer: fine) {
    .mdc-card:hover { border-color: #C7D7FB; }
  }

  .mdc-accent {
    position: absolute; top: 0; left: 0; width: 4px; height: 100%;
    pointer-events: none;
  }

  /* ── Header ── */
  .mdc-head {
    width: 100%; display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 16px 20px 16px 22px;
  }
  .mdc-grip {
    margin: 0 2px 0 -6px; padding: 6px; border-radius: 8px;
    background: transparent; border: none; color: #94A3B8;
    cursor: grab; touch-action: none; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s ease, color 0.15s ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .mdc-grip:hover { background: #F1F5F9; color: #475569; }
  }

  .mdc-head-main {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: 13px;
    background: transparent; border: none; cursor: pointer; text-align: left; padding: 0;
  }
  .mdc-icon {
    width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .mdc-head-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .mdc-title {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 19px;
    text-transform: uppercase; letter-spacing: 0.03em; color: #0B1224;
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap; line-height: 1.15;
  }
  .mdc-tag {
    background: #F0EEFF; border: 1px solid rgba(91,61,245,0.2); color: #5B3DF5;
    border-radius: 999px; padding: 1px 8px;
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 9.5px;
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .mdc-desc {
    font-family: 'Inter', sans-serif; font-size: 13px; color: #64748B;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .mdc-planned {
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; color: #F59E0B;
    margin-top: 2px;
  }

  .mdc-head-actions {
    display: flex; align-items: center; gap: 8px; flex-shrink: 0;
  }
  .mdc-today-chip {
    background: #EAF2FF; border: 1px solid rgba(37,99,255,0.2); color: #2563FF;
    border-radius: 999px; padding: 3px 10px; white-space: nowrap;
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 9.5px;
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .mdc-count {
    background: #F8FAFD; border: 1px solid #E5EAF3; color: #64748B;
    border-radius: 999px; padding: 3px 10px; white-space: nowrap;
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .mdc-chev {
    padding: 6px; border-radius: 8px; background: transparent; border: none;
    color: #64748B; cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.15s ease, color 0.15s ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .mdc-chev:hover { background: #F1F5F9; color: #0B1224; }
  }

  /* ── Body ── */
  .mdc-body {
    border-top: 1px solid #E5EAF3; padding: 20px;
    display: flex; flex-direction: column; gap: 20px;
  }
  .mdc-drills-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px; flex-wrap: wrap; margin-bottom: 12px;
  }
  .mdc-drills-label {
    font-family: 'Rajdhani', sans-serif; font-weight: 600; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.14em; color: #64748B;
  }
  .mdc-add-drill {
    background: transparent; border: none; cursor: pointer; padding: 0;
    color: #2563FF; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
    display: inline-flex; align-items: center; gap: 4px;
    transition: opacity 0.15s ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .mdc-add-drill:hover { opacity: 0.75; }
  }
  .mdc-drills-empty {
    text-align: center; padding: 28px 16px;
    border: 1px dashed #C7D7FB; border-radius: 12px; background: #F8FAFD;
  }
  .mdc-drills-empty-title {
    font-family: 'Inter', sans-serif; font-weight: 700; font-size: 14px;
    color: #0B1224; margin-bottom: 4px;
  }
  .mdc-drills-empty-desc {
    font-family: 'Inter', sans-serif; font-size: 12.5px; color: #64748B;
  }

  @media (max-width: 560px) {
    .mdc-head { flex-wrap: wrap; }
    .mdc-desc { white-space: normal; }
  }
`
