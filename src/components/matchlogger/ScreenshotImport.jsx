import { useMemo, useRef, useState } from 'react'
import { ImageIcon, Loader2, AlertTriangle, Check, X, RefreshCw } from 'lucide-react'
import { extractMatchScreenshot, fileToBase64 } from '../../utils/aiFunctions.js'

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
      const res = await extractMatchScreenshot({
        imageBase64: base64,
        mimeType,
        matchType,
        subMode,
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

  if (!open) {
    return (
      <div className="si-bar">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
          <ImageIcon size={14} /> Import from screenshot
        </button>
        <span className="si-hint">
          {matchType}
          {matchType === 'Classic' && subMode ? ` · ${SUBMODE_LABEL[subMode] || subMode}` : ''}
          {' '}— reads only the fields this mode needs. You review before saving.
        </span>
      </div>
    )
  }

  return (
    <div className="si-panel glass clip-corner-sm">
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
        .si-bar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:16px; }
        .si-hint { font-size:11px; color:var(--text-subtle); }
        .si-panel { padding:16px; margin-bottom:16px; }
        .si-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
        .si-title { display:flex; align-items:center; gap:7px; font-family:'DM Sans',sans-serif; font-weight:700; font-size:13px; color:var(--text-primary); }
        .si-body { display:flex; flex-direction:column; gap:12px; }
        .si-center { align-items:center; padding:20px 0; color:var(--text-muted); }
        .si-p { font-size:12px; color:var(--text-muted); line-height:1.6; margin:0; }
        .si-file { cursor:pointer; align-self:flex-start; }
        .si-spin { animation: si-spin 0.9s linear infinite; }
        @keyframes si-spin { to { transform: rotate(360deg); } }
        .si-error { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--red); background:var(--red-ghost); border:1px solid rgba(232,0,28,0.25); padding:8px 10px; border-radius:var(--radius-sm); }
        .si-review-note { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:600; color:var(--amber); background:var(--amber-tint); border:1px solid rgba(245,158,11,0.3); padding:8px 10px; border-radius:var(--radius-sm); }
        .si-warn { font-size:11.5px; color:var(--text-muted); background:var(--bg-elevated); border:1px solid var(--border); padding:6px 9px; border-radius:var(--radius-sm); }
        .si-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:10px; }
        .si-field label { display:block; font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-subtle); margin-bottom:4px; }
        .si-players { display:flex; flex-direction:column; gap:6px; }
        .si-players-head { font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-subtle); margin-top:4px; }
        .si-player { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:6px 8px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-elevated); }
        .si-player-unmatched { border-color:rgba(245,158,11,0.45); }
        .si-player-name { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-primary); flex:1; min-width:140px; }
        .si-player-src { color:var(--text-subtle); font-size:11px; }
        .si-player-kills { width:70px; padding:5px 8px; }
        .si-player-assign { flex:1; min-width:150px; padding:5px 8px; }
        .si-actions { display:flex; justify-content:space-between; gap:10px; margin-top:6px; }
      `}</style>
    </div>
  )
}
