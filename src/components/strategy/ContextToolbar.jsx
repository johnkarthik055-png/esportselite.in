import { useState } from 'react'
import { Bold, Undo2, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import {
  DRAW_COLORS, THICKNESS_PRESETS, PATH_TACTICAL_TYPES, POINT_TACTICAL_TYPES,
} from '../../utils/strategyDataSchema.js'
import {
  useStrategyStore, setDrawColor, setDrawThickness, setDrawOpacity,
  setDrawFill, setDrawFontSize, setDrawBold, setDrawArrowStyle, undo,
} from '../../utils/strategyDataSchema.js'

function Swatch({ color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={color}
      aria-label={color}
      className={`sct-swatch${active ? ' sct-swatch-active' : ''}`}
      style={{ background: color }}
    />
  )
}
function Field({ label, children }) {
  return (
    <div className="sct-field">
      <div className="sct-field-label">{label}</div>
      <div className="sct-field-control">{children}</div>
    </div>
  )
}

const SHAPE_TOOLS = ['rectangle', 'circle', 'polygon']
const LINEAR_TOOLS = ['pencil', 'line']

/* Session-scoped memo (NOT React state) so the collapsed/expanded
   choice survives the component unmounting — which it does every time
   the user switches to Select or Zone. Resets on a full page reload,
   which the spec explicitly allows. */
let collapsedMemo = false

/* Small floating toolbar near the top of the map, showing ONLY the
   controls relevant to the currently active tool — never a permanent
   panel, and nothing at all for Select (per spec). A chevron at the
   leading edge collapses it to a small handle; the active tool stays
   active and usable the whole time. */
export default function ContextToolbar() {
  const st = useStrategyStore()
  const tool = st.tool
  const [collapsed, setCollapsedRaw] = useState(collapsedMemo)
  const setCollapsed = (v) => { collapsedMemo = v; setCollapsedRaw(v) }

  if (tool === 'select') return null
  if (tool === 'zone') return null /* ZoneSelector owns this tool's UI */

  const isShape = SHAPE_TOOLS.includes(tool)
  const isLinear = LINEAR_TOOLS.includes(tool)
  const isArrow = tool === 'arrow'
  const isText = tool === 'text'
  const isPathTactical = PATH_TACTICAL_TYPES.includes(tool)
  const isPointTactical = POINT_TACTICAL_TYPES.includes(tool)

  if (!isShape && !isLinear && !isArrow && !isText && !isPathTactical && !isPointTactical) return null

  /* Collapsed: just a handle to bring the controls back. The tool is
     untouched — collapsing only hides the color/thickness/opacity UI. */
  if (collapsed) {
    return (
      <button
        type="button"
        className="sct-panel sct-collapsed"
        onClick={() => setCollapsed(false)}
        title="Show tool options"
        aria-label="Show tool options"
      >
        <SlidersHorizontal size={13} />
        <ChevronRight size={13} />
      </button>
    )
  }

  const collapseBtn = (
    <button
      type="button"
      className="sct-collapse-btn"
      onClick={() => setCollapsed(true)}
      title="Hide tool options"
      aria-label="Hide tool options"
    >
      <ChevronLeft size={13} />
    </button>
  )

  const colorField = (
    <Field label="Color">
      <div className="sct-swatch-row">
        {DRAW_COLORS.map(c => (
          <Swatch key={c.key} color={c.value} active={st.drawColor === c.value} onClick={() => setDrawColor(c.value)} />
        ))}
      </div>
    </Field>
  )
  const opacityField = (
    <Field label="Opacity">
      <input
        type="range" min={0.2} max={1} step={0.05}
        value={st.drawOpacity}
        onChange={(e) => setDrawOpacity(Number(e.target.value))}
        className="sct-slider"
      />
      <span className="sct-slider-value">{Math.round(st.drawOpacity * 100)}%</span>
    </Field>
  )
  const thicknessField = (
    <Field label={isShape ? 'Border' : 'Thickness'}>
      <div className="sct-preset-row">
        {THICKNESS_PRESETS.map(v => (
          <button key={v} className={`sct-preset-btn${st.drawThickness === v ? ' sct-preset-active' : ''}`}
            onClick={() => setDrawThickness(v)}>
            {v}
          </button>
        ))}
      </div>
    </Field>
  )

  return (
    <div className="sct-panel">
      {collapseBtn}

      {colorField}

      {(isLinear || isPathTactical) && (
        <>
          {thicknessField}
          {opacityField}
          <button className="btn btn-secondary btn-sm sct-undo-btn" onClick={undo} title="Undo (Ctrl+Z)">
            <Undo2 size={12} /> Undo
          </button>
        </>
      )}

      {isShape && (
        <>
          <Field label="Fill">
            <button
              className={`sct-toggle-btn${st.drawFill ? ' sct-toggle-active' : ''}`}
              onClick={() => setDrawFill(!st.drawFill)}
            >
              {st.drawFill ? 'On' : 'Off'}
            </button>
          </Field>
          {thicknessField}
          {opacityField}
        </>
      )}

      {isArrow && (
        <>
          {thicknessField}
          <Field label="Arrow Style">
            <div className="sct-preset-row">
              <button className={`sct-preset-btn${st.drawArrowStyle === 'solid' ? ' sct-preset-active' : ''}`} onClick={() => setDrawArrowStyle('solid')}>Solid</button>
              <button className={`sct-preset-btn${st.drawArrowStyle === 'dashed' ? ' sct-preset-active' : ''}`} onClick={() => setDrawArrowStyle('dashed')}>Dashed</button>
            </div>
          </Field>
        </>
      )}

      {isText && (
        <>
          <Field label="Font Size">
            <div className="sct-preset-row">
              {[12, 15, 20, 28].map(v => (
                <button key={v} className={`sct-preset-btn${st.drawFontSize === v ? ' sct-preset-active' : ''}`}
                  onClick={() => setDrawFontSize(v)}>
                  {v}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Bold">
            <button
              className={`sct-toggle-btn${st.drawBold ? ' sct-toggle-active' : ''}`}
              onClick={() => setDrawBold(!st.drawBold)}
              aria-label="Bold"
            >
              <Bold size={13} />
            </button>
          </Field>
        </>
      )}

      {isPointTactical && opacityField}
    </div>
  )
}
