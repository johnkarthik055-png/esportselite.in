import { useState } from 'react'
import { ChevronDown, GripVertical, Crosshair } from 'lucide-react'
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

/**
 * Unified module card. Logic unchanged — only the header icon and
 * "N drills" badge restyled per fix-3 spec.
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

  const planned = !!todayPlan?.planned

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
        style={{
          ...moduleStyle,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          transition: `${moduleStyle.transition || ''} border-color 0.15s, transform 0.15s`,
          ...(isDragging ? { transform: 'scale(1.01)', zIndex: 10, position: 'relative' } : {}),
        }}
      >
        {/* Header */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            gap: 12,
          }}
        >
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            title="Drag to reorder module"
            aria-label="Drag to reorder module"
            style={{
              marginRight: 4,
              marginLeft: -6,
              padding: 6,
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-subtle)',
              cursor: 'grab',
              touchAction: 'none',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-subtle)'
            }}
          >
            <GripVertical size={16} />
          </button>

          <button
            onClick={() => setOpen(v => !v)}
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              padding: 0,
            }}
          >
            {/* Icon box — Crosshair on elevated/border */}
            <div
              style={{
                width: 36,
                height: 36,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Crosshair size={16} style={{ color: 'var(--text-muted)' }} />
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'Bebas Neue, sans-serif',
                  fontWeight: 700,
                  fontSize: 16,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {module.name}
                {!module.isDefault && (
                  <span className="badge" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Custom
                  </span>
                )}
              </div>
              {module.description && (
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {module.description}
                </div>
              )}
              {planned && todayPlan.duration > 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--gold)',
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  ⏱ {todayPlan.duration} mins planned
                </div>
              )}
            </div>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {planned && (
              <span className="badge" style={{ whiteSpace: 'nowrap' }}>
                Today's Plan
              </span>
            )}

            {/* Drills count badge — neutral muted style */}
            <span
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                padding: '3px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'DM Sans, sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
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
              style={{
                padding: 6,
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-elevated)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-muted)'
              }}
            >
              <ChevronDown
                size={18}
                style={{
                  transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s',
                }}
              />
            </button>
          </div>
        </div>

        {/* Body */}
        {open && (
          <div
            style={{
              borderTop: '1px solid var(--border)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
            className="animate-fade-in"
          >
            <WeaponPicker selected={guns} onChange={setGuns} />

            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div className="label">Drills</div>
                <button
                  onClick={() => setAddDrillOpen(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  + Add drill
                </button>
              </div>

              {module.drills.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '32px 16px',
                    border: '1px dashed var(--border)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div className="empty-state-title">No drills yet</div>
                  <div className="empty-state-desc">Add your first drill to start logging sessions.</div>
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
        )}
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
            Remove <strong style={{ color: 'var(--text-primary)' }}>"{deletingDrill?.name}"</strong> from this module.
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
