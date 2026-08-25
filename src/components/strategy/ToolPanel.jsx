import {
  MousePointer2, Pencil, Minus, ArrowUpRight, Hexagon, Square,
  Circle as CircleIcon, Type, Ruler, Undo2, Redo2, Trash2, Check, X as XIcon,
} from 'lucide-react'
import {
  DRAW_TOOLS, DRAW_COLORS, THICKNESS_PRESETS, OPACITY_PRESETS,
} from '../../utils/strategyDataSchema.js'
import {
  useStrategyStore, setTool, undo, redo, deleteSelected, clearAllObjects,
  setDrawColor, setDrawThickness, setDrawOpacity, finishPolygonDraft, setDrafting,
} from './strategyStore.js'
import { useConfirm } from '../../hooks/useConfirm.js'
import ConfirmModal from '../ConfirmModal.jsx'
import { SectionLabel, SwatchButton } from './strategyUI.jsx'

const TOOL_ICONS = {
  select: MousePointer2, pencil: Pencil, line: Minus, arrow: ArrowUpRight,
  polygon: Hexagon, rectangle: Square, circle: CircleIcon, text: Type, measure: Ruler,
}

const HINTS = {
  select:    'Click a shape to select it, then edit its color/thickness/opacity or delete it.',
  pencil:    'Click and drag (or touch and drag) to sketch a freehand line.',
  line:      'Click and drag from the start point to the end point.',
  arrow:     'Click and drag from the start point to the end point — an arrowhead is added at the end.',
  polygon:   'Click to place each vertex. Double-click, or press Finish, to close the shape.',
  rectangle: 'Click and drag to draw a rectangle.',
  circle:    'Click and drag from the center outward to set the radius.',
  text:      'Click a point on the map, then type your label and press Enter.',
  measure:   'Click two points on the map to measure distance.',
}

/* Contextual toolbar for Strategy Maker's drawing toolkit — tool
   selector, in-progress-polygon controls, the "current pen" color/
   thickness/opacity settings (which also apply retroactively to
   whatever's selected — see setDrawColor/Thickness/Opacity in
   strategyStore.js), and the always-available Undo/Redo/Delete/
   Clear actions. This is the one place all of that lives now,
   replacing the old BottomToolBar + ToolPanel + SelectedItemPanel +
   QuickActions split. */
export default function ToolPanel() {
  const st = useStrategyStore()
  const { confirm, confirmModalProps } = useConfirm()

  const selectedObj = st.selectedObjectId ? st.objects.find(o => o.id === st.selectedObjectId) : null
  const currentColor = selectedObj?.color ?? st.drawColor
  const currentThickness = selectedObj?.thickness ?? st.drawThickness
  const currentOpacity = selectedObj?.opacity ?? st.drawOpacity

  async function handleClearAll() {
    if (st.objects.length === 0) return
    if (!await confirm('Clear every drawing on this map? This cannot be undone once other actions follow.', { title: 'Clear all drawings' })) return
    clearAllObjects()
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <SectionLabel small>Tools</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DRAW_TOOLS.map(t => {
            const Icon = TOOL_ICONS[t.key]
            const active = st.tool === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTool(t.key)}
                title={t.label}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 10px', minWidth: 56,
                  background: active ? 'var(--blue)' : 'var(--bg-elevated)',
                  border: `1px solid ${active ? 'var(--blue)' : 'var(--border)'}`,
                  borderRadius: 8, cursor: 'pointer',
                  color: active ? '#fff' : 'var(--text-primary)',
                  fontFamily: 'DM Sans, sans-serif', fontSize: 10, fontWeight: 600,
                }}
              >
                <Icon size={15} />
                {t.label}
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 6 }}>
          {HINTS[st.tool] || HINTS.select}
        </div>
      </div>

      {st.tool === 'polygon' && st.drafting?.kind === 'polygon' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '6px 8px',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-subtle)', flex: 1 }}>
            {st.drafting.points.length} vertex/vertices placed
          </span>
          <button
            onClick={finishPolygonDraft}
            disabled={st.drafting.points.length < 3}
            className="btn btn-primary btn-sm"
            title="Finish polygon"
          >
            <Check size={12} /> Finish
          </button>
          <button onClick={() => setDrafting(null)} className="btn btn-secondary btn-sm" title="Cancel polygon">
            <XIcon size={12} />
          </button>
        </div>
      )}

      <div>
        <SectionLabel small>{selectedObj ? 'Selected Object' : 'Pen Settings'}</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginBottom: 4 }}>Color</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {DRAW_COLORS.map(c => (
                <SwatchButton
                  key={c.key} color={c.value} title={c.key}
                  active={currentColor === c.value}
                  onClick={() => setDrawColor(c.value)}
                />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginBottom: 4 }}>Thickness</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {THICKNESS_PRESETS.map(t => (
                <PresetButton key={t.key} active={currentThickness === t.value} onClick={() => setDrawThickness(t.value)}>
                  {t.label}
                </PresetButton>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginBottom: 4 }}>Opacity</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {OPACITY_PRESETS.map(o => (
                <PresetButton key={o.key} active={currentOpacity === o.value} onClick={() => setDrawOpacity(o.value)}>
                  {o.label}
                </PresetButton>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={undo} disabled={st.history.length === 0} className="btn btn-secondary btn-sm" style={{ flex: 1 }} title="Undo (Ctrl+Z)">
          <Undo2 size={12} /> Undo
        </button>
        <button onClick={redo} disabled={st.future.length === 0} className="btn btn-secondary btn-sm" style={{ flex: 1 }} title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={12} /> Redo
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={deleteSelected} disabled={!st.selectedObjectId} className="btn btn-secondary btn-sm" style={{ flex: 1 }} title="Delete selected (Del)">
          <Trash2 size={12} /> Delete
        </button>
        <button onClick={handleClearAll} className="btn btn-secondary btn-sm" style={{ flex: 1 }} title="Clear all drawings">
          Clear all
        </button>
      </div>

      <ConfirmModal {...confirmModalProps} />
    </div>
  )
}

function PresetButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="btn btn-sm"
      style={{
        flex: 1,
        background: active ? 'var(--blue)' : 'var(--bg-elevated)',
        border: `1px solid ${active ? 'var(--blue)' : 'var(--border)'}`,
        color: active ? '#fff' : 'var(--text-primary)',
        fontSize: 11, justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}
