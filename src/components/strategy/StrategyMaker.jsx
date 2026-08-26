import { useEffect, useState } from 'react'
import { isLegacyStrategyDoc, migrateLegacyStrategy } from '../../utils/strategyDataSchema.js'
import {
  useStrategyStore, undo, redo, deleteSelected, setTool, setDrafting,
  toSaveableDoc, loadStrategyData, setStrategyDocId,
} from './strategyStore.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useConfirm } from '../../hooks/useConfirm.js'
import ConfirmModal from '../ConfirmModal.jsx'
import LayersPanel from './LayersPanel.jsx'
import AssistiveToolButton from './AssistiveToolButton.jsx'
import PhaseSelector from './PhaseSelector.jsx'
import SaveStrategyPanel from './SaveStrategyPanel.jsx'
import MeasureReadout from './MeasureReadout.jsx'

const SHORTCUT_TOOLS = {
  v: 'select', p: 'pencil', l: 'line', a: 'arrow',
  g: 'polygon', r: 'rectangle', c: 'circle', t: 'text', m: 'measure',
}

function useStrategyKeyboardShortcuts() {
  useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const key = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo(); else undo()
        return
      }
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault()
        deleteSelected()
        return
      }
      if (key === 'escape') {
        setDrafting(null)
        return
      }
      if (SHORTCUT_TOOLS[key]) {
        setTool(SHORTCUT_TOOLS[key])
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}

/* The caller (MapKnowledge.jsx) still wraps this in
   <FloatingToolsPanel title="Tools"> for Layers/Phase/Save — those
   remain a docked panel, unaffected by this change. Tool SELECTION
   (previously ToolPanel, docked inside that same panel) is now
   AssistiveToolButton: a draggable position:fixed button + popup that
   escapes the docked panel's box entirely (position:fixed's
   containing block is the viewport, not whatever DOM box it happens
   to render inside, as long as no ancestor sets a CSS transform —
   FloatingToolsPanel doesn't), so it renders correctly regardless of
   where in this tree it's mounted. This is what replaces the old
   ToolPanel.jsx, which repeatedly broke across desktop/mobile/
   orientation because its sizing and position were derived from
   viewport width and sidebar state — AssistiveToolButton has no such
   inputs to get out of sync in the first place. */
export default function StrategyMaker({ mapId, strategies, addStrategyDoc, updateStrategyDoc, deleteStrategyDoc }) {
  const st = useStrategyStore()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const { confirm, confirmModalProps } = useConfirm()

  useStrategyKeyboardShortcuts()

  async function handleSave() {
    if (!user?.uid) { alert('Sign in to save strategies.'); return }
    if (!st.name.trim()) { alert('Give this strategy a name first.'); return }
    setSaving(true)
    try {
      if (st.strategyDocId) {
        await updateStrategyDoc(mapId, st.strategyDocId, toSaveableDoc())
      } else {
        const ref = await addStrategyDoc(mapId, toSaveableDoc(), user.uid)
        if (ref?.id) setStrategyDocId(ref.id)
      }
      alert('Strategy saved.')
    } catch (e) {
      alert('Save failed: ' + (e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  function handleLoad(doc) {
    /* Strategies saved before this rebuild used a flat
       {pins, arrows, zones} shape — migrate on read so old saved
       work still loads instead of coming back empty or crashing. */
    if (isLegacyStrategyDoc(doc)) {
      loadStrategyData(migrateLegacyStrategy(doc))
    } else {
      loadStrategyData({ ...doc, strategyId: doc.id })
    }
  }

  async function handleDelete(doc) {
    if (!await confirm(`Delete strategy "${doc.name}"?`, { title: 'Delete strategy' })) return
    try { await deleteStrategyDoc(mapId, doc.id) }
    catch (e) { alert('Delete failed: ' + (e?.message || e)) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <LayersPanel mapId={mapId} />
      {st.tool === 'measure' && <MeasureReadout mapId={mapId} />}
      <PhaseSelector />
      <SaveStrategyPanel
        strategies={strategies}
        saving={saving}
        onSave={handleSave}
        onLoad={handleLoad}
        onDelete={handleDelete}
      />
      <ConfirmModal {...confirmModalProps} />

      {/* position:fixed — renders at a plain screen-pixel position
          independent of this panel's own box, see the comment above. */}
      <AssistiveToolButton />
    </div>
  )
}
