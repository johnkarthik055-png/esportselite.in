import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  useStrategyStore, undo, redo, deleteSelected, setDrafting,
  toSaveableDoc, loadStrategyData, setStrategyDocId, setName, setDescription,
  markSaved, closeSaveModal, resolveUnsavedPrompt,
} from '../../utils/strategyDataSchema.js'
import FloatingToolbar from './FloatingToolbar.jsx'
import ContextToolbar from './ContextToolbar.jsx'
import MapControls from './MapControls.jsx'
import ZoneSelector from './ZoneSelector.jsx'
import LayersPanel from './LayersPanel.jsx'
import SaveStrategyModal, { UnsavedChangesModal } from './SaveStrategyModal.jsx'

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
      if (key === 'delete' || key === 'backspace') { e.preventDefault(); deleteSelected(); return }
      if (key === 'escape') { setDrafting(null); return }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}

/* Warn on an actual browser tab close / refresh / external navigation
   while dirty — this is the one case where a fully custom in-app
   modal is technically impossible (the browser owns that dialog), so
   the native beforeunload prompt is a deliberate, unavoidable
   exception to "never a native browser confirm". Every in-app leave
   path (switching map/mode within Map Knowledge) instead goes through
   requestLeaveWithUnsavedCheck() -> UnsavedChangesModal below, which
   IS the app's own modal. */
function useBeforeUnloadGuard(dirty) {
  useEffect(() => {
    function onBeforeUnload(e) {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])
}

/* Floating overlay stack for Strategy Maker — FloatingToolbar (left),
   ContextToolbar (top, tool-dependent), MapControls (right),
   ZoneSelector (top, zone-mode-only), plus the Save modal and the
   unsaved-changes-on-leave prompt. Mounted as a sibling of
   <DrawingCanvas> (which lives inside <MapContainer>, owned by
   MapKnowledge.jsx's MapPanel) rather than a parent of it — see the
   comment in strategyDataSchema.js about why this is a plain module
   store instead of React Context. */
export default function StrategyMaker({ mapId, strategies, addStrategyDoc, updateStrategyDoc, user }) {
  const st = useStrategyStore()
  const [saving, setSaving] = useState(false)
  const loadedForMapRef = useRef(null)

  useStrategyKeyboardShortcuts()
  useBeforeUnloadGuard(st.dirty)

  /* Auto-load the current user's existing strategy for this map (if
     any) the first time it becomes available — this is what makes a
     saved strategy "fully reloadable", without a separate load-picker
     UI that wasn't part of this rebuild's spec. Picks the most
     recently created entry if more than one exists. */
  useEffect(() => {
    if (loadedForMapRef.current === mapId) return
    if (!Array.isArray(strategies)) return
    if (strategies.length === 0) { loadedForMapRef.current = mapId; return }
    const latest = [...strategies].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))[0]
    loadStrategyData({ ...latest, strategyId: latest.id })
    loadedForMapRef.current = mapId
  }, [strategies, mapId])

  async function handleSave() {
    if (!user?.uid) { alert('Sign in to save strategies.'); return }
    if (!st.name.trim()) return
    setSaving(true)
    try {
      if (st.strategyDocId) {
        await updateStrategyDoc(mapId, st.strategyDocId, toSaveableDoc())
      } else {
        const ref = await addStrategyDoc(mapId, toSaveableDoc(), user.uid)
        if (ref?.id) setStrategyDocId(ref.id)
      }
      markSaved()
      closeSaveModal()
    } catch (e) {
      alert('Save failed: ' + (e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveFromUnsavedPrompt() {
    if (!st.name.trim()) {
      /* No name yet — fall back to the full Save modal instead of
         silently failing the save. */
      resolveUnsavedPrompt('cancel')
      return
    }
    await handleSave()
    resolveUnsavedPrompt('discard') /* run the pending navigation now that it's saved */
  }

  return (
    <>
      {/* Floating tool UI — stays inside MapPanel's .mk-canvas so it
          positions over the map and is clipped to the map area. */}
      <FloatingToolbar />
      <ContextToolbar />
      <MapControls />
      <ZoneSelector />
      <LayersPanel />

      {/* Modals are portalled to <body>: .mk-canvas is a z-index:0
          stacking context (see MapKnowledge.jsx), so a modal rendered
          in-place here would be trapped BEHIND the app sidebar/nav
          (z-index 50+). document.body escapes that entirely. */}
      {createPortal(
        <>
          <SaveStrategyModal
            open={st.saveModalOpen}
            name={st.name}
            description={st.description}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onSave={handleSave}
            onClose={closeSaveModal}
            saving={saving}
          />
          <UnsavedChangesModal
            open={st.unsavedPromptOpen}
            onSave={handleSaveFromUnsavedPrompt}
            onDiscard={() => resolveUnsavedPrompt('discard')}
            onCancel={() => resolveUnsavedPrompt('cancel')}
          />
        </>,
        document.body,
      )}
    </>
  )
}
