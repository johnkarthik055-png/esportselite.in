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
import ToolPanel from './ToolPanel.jsx'
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

/* Content of Strategy Maker's always-floating tools panel (see Issue
   2 in the commit this landed in) — the caller (MapKnowledge.jsx)
   wraps this in <FloatingToolsPanel> unconditionally, on desktop AND
   mobile, so there is exactly one layout path instead of a desktop
   side-column vs. mobile-floating-panel branch. */
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
      <ToolPanel />
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
    </div>
  )
}
