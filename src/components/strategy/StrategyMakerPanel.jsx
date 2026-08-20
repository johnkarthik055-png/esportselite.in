import { useEffect, useState } from 'react'
import { Undo2, Redo2, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  useStrategyStore, undo, redo, deleteSelected, clearAllObjects,
  toSaveableDoc, loadStrategyData, setStrategyDocId, setTool,
} from './strategyStore.js'
import { isLegacyStrategyDoc, migrateLegacyStrategy } from '../../utils/strategyDataSchema.js'
import CoachPlayerModeToggle from './CoachPlayerModeToggle.jsx'
import ToolPanel from './ToolPanel.jsx'
import LayersPanel from './LayersPanel.jsx'
import PhaseSelector from './PhaseSelector.jsx'
import QuickActions from './QuickActions.jsx'
import SaveStrategyPanel from './SaveStrategyPanel.jsx'
import MeasureReadout from './MeasureReadout.jsx'

const SHORTCUT_TOOLS = { v: 'select', m: 'marker', r: 'rotation', c: 'combat', u: 'utility', z: 'zone', f: 'formation' }

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
      if (SHORTCUT_TOOLS[key]) {
        setTool(SHORTCUT_TOOLS[key])
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}

export default function StrategyMakerPanel({ mapId, strategies, addStrategyDoc, updateStrategyDoc, deleteStrategyDoc }) {
  const st = useStrategyStore()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)

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
    if (!window.confirm(`Delete strategy "${doc.name}"?`)) return
    try { await deleteStrategyDoc(mapId, doc.id) }
    catch (e) { alert('Delete failed: ' + (e?.message || e)) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
      <CoachPlayerModeToggle />

      {st.viewMode === 'coach' && (
        <>
          <div className="card" style={{ display: 'flex', gap: 6 }}>
            <button onClick={undo} disabled={st.history.length === 0} className="btn btn-secondary btn-sm" style={{ flex: 1 }} title="Undo (Ctrl+Z)">
              <Undo2 size={12} /> Undo
            </button>
            <button onClick={redo} disabled={st.future.length === 0} className="btn btn-secondary btn-sm" style={{ flex: 1 }} title="Redo (Ctrl+Shift+Z)">
              <Redo2 size={12} /> Redo
            </button>
            <button
              onClick={() => { if (window.confirm('Clear every object in this phase\'s plan? This cannot be undone with Undo once other actions follow.')) clearAllObjects() }}
              className="btn btn-secondary btn-sm"
              title="Clear all"
            >
              <Trash2 size={12} />
            </button>
          </div>

          <ToolPanel />
          {st.tool === 'measure' && <MeasureReadout mapId={mapId} />}
          <LayersPanel mapId={mapId} />
          <PhaseSelector />
          <QuickActions />
          <SaveStrategyPanel
            strategies={strategies}
            saving={saving}
            onSave={handleSave}
            onLoad={handleLoad}
            onDelete={handleDelete}
          />
        </>
      )}
    </div>
  )
}
