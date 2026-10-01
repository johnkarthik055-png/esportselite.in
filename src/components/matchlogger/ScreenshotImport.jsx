import { useMemo, useRef, useState } from 'react'
import { ImageIcon, Loader2, AlertTriangle, Check, X, RefreshCw } from 'lucide-react'
import { extractMatchScreenshot, fileToBase64 } from '../../utils/aiFunctions.js'
import { auth, db } from '../../utils/firebase.js'
import { doc, getDoc } from 'firebase/firestore'
import { useSubscription } from '../../hooks/useSubscription.js'
import UpgradeOverlay from '../UpgradeOverlay.jsx'

/* ============================================================
   SCREENSHOT IMPORT  (Match Logger)
   ------------------------------------------------------------
   Upload a BGMI end-of-match screenshot → a Cloud Function reads
   only the fields relevant to the selected match type → the user
   REVIEWS every value (editable) → confirms → the values are
   pushed into the Match Logger form. Nothing is ever auto-saved.
   The image is sent as base64 and is not persisted anywhere.
   ============================================================ */

const FIELD_LABELS = {
  map: 'Map',
  position: 'Position',
  kills: 'Kills',
  teamPosition: 'Team position',
  teamKills: 'Team kills',
  individualKills: 'Individual kills',
}

const SUBMODE_LABEL = {
  Solo: 'Solo', Duo: 'Duo', Squad: 'Squad', solo_vs_squad: 'Solo vs Squad',
}

export default function ScreenshotImport({
  matchType,
  subMode = '',
  userIgns = [],
  rosterIgns = [],
  onApply,
  onApplyPlayers,
}) {
  const [phase, setPhase] = useState('idle') /* idle | loading | review | error */
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [fields, setFields] = useState({})       /* editable copy of result.fields */
  const [players, setPlayers] = useState([])     /* editable copy for Tournament */
  const [warnings, setWarnings] = useState([])
  const [open, setOpen] = useState(false)
  const fileRef = useRef(null)
  const { isActive } = useSubscription()

  const isTournament = matchType === 'Tournament'
  const rosterOptions = useMemo(
    () => rosterIgns
      .map(r => ({ uid: r.uid, label: (r.igns && r.igns[0]) || r.ign || r.uid }))
      .filter(o => o.label),
    [rosterIgns],
  )

  function reset() {
    setPhase('idle'); setError(''); setResult(null); setFields({}); setPlayers([]); setWarnings([])
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); setPhase('error'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Image is too large — use one under 5 MB.'); setPhase('error'); return }

    setPhase('loading'); setError('')
    try {
      const { base64, mimeType } = await fileToBase64(file)

      // Fetch user's IGNs from Firestore for accurate player row identification
      let playerIgns = [...(userIgns || [])]
      const uid = auth.currentUser?.uid
      if (uid) {
        try {
          const snap = await getDoc(doc(db, 'users', uid))
          if (snap.exists()) {
            const data = snap.data()
            const fetched = [
              ...(Array.isArray(data.igns) ? data.igns : []),
              ...(data.ign ? [String(data.ign).trim()] : []),
            ].map(s => String(s).trim()).filter(Boolean)
            playerIgns = [...new Set([...fetched, ...playerIgns])].slice(0, 3)
          }
        } catch {
          /* Firestore fetch failed — proceed with prop IGNs */
        }
      }

      const res = await extractMatchScreenshot({
        imageBase64: base64,
        mimeType,
        matchType,
        subMode,
        ...(playerIgns.length ? { playerIgns } : {}),
        userIgns,
        rosterIgns: isTournament ? rosterIgns : [],
      })
      setResult(res)
      setFields({ ...(res.fields || {}) })
      setPlayers(
        (res.players || []).map(p => ({
          name: p.name,
          kills: p.kills ?? '',
          matchedUid: p.matchedUid || '',
          matchedIgn: p.matchedIgn || '',
          unmatched: !!p.unmatched,
          decision: p.unmatched ? '' : 'assigned', /* '' | 'assigned' | 'skip' */
        })),
      )
      setWarnings(res.warnings || [])
      setPhase('review')
    } catch (err) {
      const code = err?.code || ''
      let msg = err?.message || 'Something went wrong reading that screenshot.'
      if (code === 'functions/unauthenticated') msg = 'Sign in first.'
      else if (code === 'functions/not-found' || code === 'functions/internal') {
        msg = 'AI screenshot import isn’t available yet on this build. Enter the match manually.'
      }
      setError(msg)
      setPhase('error')
    }
  }

  function applyToForm() {
    /* numbers stay as strings for the form inputs; blank -> '' */
    const cleanFields = {}
    for (const [k, v] of Object.entries(fields)) {
      cleanFields[k] = v === null || v === undefined ? '' : String(v)
    }
    onApply?.(cleanFields)

    if (isTournament && onApplyPlayers) {
      const resolved = players
        .filter(p => p.decision === 'assigned' && (p.matchedUid || p.name))
        .map(p => ({
          uid: p.matchedUid || null,
          name: p.matchedIgn || p.name,
          screenshotName: p.name,
          kills: p.kills === '' ? null : Number(p.kills),
          unmatched: !p.matchedUid,
        }))
      onApplyPlayers(resolved)
    }

    setOpen(false)
    reset()
  }

  const unresolvedCount = isTournament
    ? players.filter(p => p.decision === '').length
    : 0

  if (!isActive) {
    return (
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 8, height: 120 }}>
        {/* Blurred preview — just the collapsed bar so the overlay stays within this small area */}
        <div style={{ filter: 'blur(2px)', opacity: 0.45, pointerEvents: 'none', userSelect: 'none',
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled>
            <ImageIcon size={14} /> Import from screenshot
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
            {matchType} — reads only the fields this mode needs.
          </span>
        </div>
        <UpgradeOverlay
          title="AI Screenshot Import"
          description="Automatically extract your match stats from a screenshot. No manual entry needed."
          feature="match-logger-ai"
        />
      </div>
    )
  }

  if (!open) {
    return (
      <div style={{
        background: 'linear-gradient(135deg,#EEF4FF,#F0EEFF)',
        border: '1px solid #DCE5FA', borderRadius: 12,
        padding: '16px 18px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          background: 'rgba(37,99,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ImageIcon size={20} style={{ color: '#2563FF' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: '#0B1224' }}>
            AI Screenshot Import
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#64748B', marginTop: 2 }}>
            {matchType}{matchType === 'Classic' && subMode ? ` · ${SUBMODE_LABEL[subMode] || subMode}` : ''} — reads only the fields this mode needs. You review before saving.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            background: '#2563FF', color: '#FFFFFF', border: 'none',
            borderRadius: 8, padding: '8px 16px', flexShrink: 0,
            fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 2px 8px rgba(37,99,255,0.2)',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          <ImageIcon size={14} /> Import
        </button>
      </div>
    )
  }

  return (
    <div className="si-panel" style={{ background: '#FFFFFF', border: '1px solid #E5EAF3', borderRadius: 12 }}>
      <div className="si-head">
        <div className="si-title">
          <ImageIcon size={15} /> Import {matchType} from screenshot
          {matchType === 'Classic' && subMode ? ` · ${SUBMODE_LABEL[subMode] || subMode}` : ''}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); reset() }} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      {phase === 'idle' && (
        <div className="si-body">
          <p className="si-p">
            Upload the end-of-match result screen. The AI reads only{' '}
            {matchType === 'Classic'
              ? (subMode === 'Solo' || subMode === 'solo_vs_squad' ? 'map, position, your kills' : 'map, position, team kills')
              : matchType === 'Scrims'
                ? 'map, team position, team kills'
                : 'team position, team kills, and per-player kills'}
            {' '}— everything else on screen is ignored.
          </p>
          <label className="btn btn-red btn-sm si-file">
            <ImageIcon size={14} /> Choose screenshot
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} hidden />
          </label>
        </div>
      )}

      {phase === 'loading' && (
        <div className="si-body si-center">
          <Loader2 size={20} className="si-spin" />
          <span>Reading the screenshot…</span>
        </div>
      )}

      {phase === 'error' && (
        <div className="si-body">
          <div className="si-error"><AlertTriangle size={14} /> {error}</div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
            <RefreshCw size={13} /> Try another image
          </button>
        </div>
      )}

      {phase === 'review' && (
        <div className="si-body">
          <div className="si-review-note">
            <AlertTriangle size={13} /> These are AI-read values — check every one before using them.
          </div>

          {warnings.map((w, i) => (
            <div key={i} className="si-warn">{w}</div>
          ))}

          {/* editable scalar fields */}
          <div className="si-grid">
            {Object.keys(fields).map(key => (
              <div key={key} className="si-field">
                <label>{FIELD_LABELS[key] || key}</label>
                <input
                  className="input-field"
                  value={fields[key] ?? ''}
                  onChange={e => setFields(f => ({ ...f, [key]: e.target.value }))}
                  placeholder="—"
                />
              </div>
            ))}
          </div>

          {/* Tournament per-player list */}
          {isTournament && (
            <div className="si-players">
              <div className="si-players-head">Per-player kills ({players.length})</div>
              {players.length === 0 && <div className="si-warn">No player rows were read — add them manually below the form.</div>}
              {players.map((p, i) => (
                <div key={i} className={`si-player${p.unmatched ? ' si-player-unmatched' : ''}`}>
                  <div className="si-player-name">
                    {p.unmatched
                      ? <><AlertTriangle size={12} /> Unmatched: “{p.name}”</>
                      : <><Check size={12} /> {p.matchedIgn || p.name}</>}
                    {!p.unmatched && p.matchedIgn && p.matchedIgn !== p.name && (
                      <span className="si-player-src"> (screen: “{p.name}”)</span>
                    )}
                  </div>
                  <input
                    className="input-field si-player-kills"
                    value={p.kills}
                    onChange={e => setPlayers(list => list.map((x, xi) => xi === i ? { ...x, kills: e.target.value } : x))}
                    placeholder="kills"
                    inputMode="numeric"
                  />
                  {p.unmatched && (
                    <select
                      className="input-field si-player-assign"
                      value={p.decision === 'skip' ? 'skip' : (p.matchedUid || '')}
                      onChange={e => {
                        const v = e.target.value
                        setPlayers(list => list.map((x, xi) => {
                          if (xi !== i) return x
                          if (v === 'skip') return { ...x, decision: 'skip', matchedUid: '', matchedIgn: '' }
                          if (v === '') return { ...x, decision: '', matchedUid: '', matchedIgn: '' }
                          const opt = rosterOptions.find(o => o.uid === v)
                          return { ...x, decision: 'assigned', matchedUid: v, matchedIgn: opt?.label || '' }
                        }))
                      }}
                    >
                      <option value="">Assign to…</option>
                      {rosterOptions.map(o => <option key={o.uid} value={o.uid}>{o.label}</option>)}
                      <option value="skip">Skip this player</option>
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="si-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              <RefreshCw size={13} /> Re-upload
            </button>
            <button
              type="button"
              className="btn btn-red btn-sm"
              onClick={applyToForm}
              disabled={unresolvedCount > 0}
              title={unresolvedCount > 0 ? `Resolve ${unresolvedCount} unmatched player(s) first` : undefined}
            >
              <Check size={14} />
              {unresolvedCount > 0 ? `Resolve ${unresolvedCount} unmatched…` : 'Use these values'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .si-panel { padding:16px; margin-bottom:16px; }
        .si-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
        .si-title { display:flex; align-items:center; gap:7px; font-family:'Inter',sans-serif; font-weight:700; font-size:13px; color:#0B1224; }
        .si-body { display:flex; flex-direction:column; gap:12px; }
        .si-center { align-items:center; padding:20px 0; color:#64748B; }
        .si-p { font-size:12px; color:#64748B; line-height:1.6; margin:0; }
        .si-file { cursor:pointer; align-self:flex-start; }
        .si-spin { animation: si-spin 0.9s linear infinite; }
        @keyframes si-spin { to { transform: rotate(360deg); } }
        .si-error { display:flex; align-items:center; gap:8px; font-size:12px; color:#EF3340; background:rgba(239,51,64,0.06); border:1px solid rgba(239,51,64,0.2); padding:8px 10px; border-radius:8px; }
        .si-review-note { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:600; color:#F59E0B; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); padding:8px 10px; border-radius:8px; }
        .si-warn { font-size:11.5px; color:#64748B; background:#F8FAFD; border:1px solid #E5EAF3; padding:6px 9px; border-radius:8px; }
        .si-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:10px; }
        .si-field label { display:block; font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:#64748B; margin-bottom:4px; }
        .si-players { display:flex; flex-direction:column; gap:6px; }
        .si-players-head { font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:#64748B; margin-top:4px; }
        .si-player { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:6px 8px; border:1px solid #E5EAF3; border-radius:8px; background:#F8FAFD; }
        .si-player-unmatched { border-color:rgba(245,158,11,0.45); }
        .si-player-name { display:flex; align-items:center; gap:6px; font-size:12px; color:#0B1224; flex:1; min-width:140px; }
        .si-player-src { color:#64748B; font-size:11px; }
        .si-player-kills { width:70px; padding:5px 8px; }
        .si-player-assign { flex:1; min-width:150px; padding:5px 8px; }
        .si-actions { display:flex; justify-content:space-between; gap:10px; margin-top:6px; }
      `}</style>
    </div>
  )
}
