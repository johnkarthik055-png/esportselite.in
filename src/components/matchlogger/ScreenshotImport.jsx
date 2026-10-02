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
      <div style={{ position: 'relative', borderRadius: 8, minHeight: 320 }}>
        {/* Blurred preview — decorative background behind the overlay card */}
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
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) }
        }}
        className="si-dropzone"
        aria-label="Open AI screenshot import"
      >
        <div className="si-dz-icon">
          <ImageIcon size={22} />
        </div>
        <div className="si-dz-title">AI Screenshot Import</div>
        <div className="si-dz-sub">
          Drop in your end-of-match screenshot and the AI fills the form for you.
          <br />
          <span className="si-dz-mode">
            {matchType}{matchType === 'Classic' && subMode ? ` · ${SUBMODE_LABEL[subMode] || subMode}` : ''} — you review every value before saving.
          </span>
        </div>
        <span className="si-dz-btn">
          <ImageIcon size={14} /> Choose screenshot
        </span>

        <style>{`
          .si-dropzone {
            background: #F8FAFF;
            border: 2px dashed #C7D7FB;
            border-radius: 14px;
            padding: 28px 22px;
            margin-bottom: 16px;
            display: flex; flex-direction: column; align-items: center; text-align: center;
            cursor: pointer; outline: none;
            transition: border-color 0.2s cubic-bezier(0.22,1,0.36,1),
                        background 0.2s cubic-bezier(0.22,1,0.36,1),
                        box-shadow 0.2s cubic-bezier(0.22,1,0.36,1);
          }
          .si-dropzone:focus-visible {
            border-color: #2563FF;
            box-shadow: 0 0 0 4px rgba(37,99,255,0.14);
          }
          @media (hover: hover) and (pointer: fine) {
            .si-dropzone:hover {
              border-color: #2563FF;
              border-style: solid;
              background: #EEF4FF;
              box-shadow: 0 8px 30px rgba(37,99,255,0.08);
            }
            .si-dropzone:hover .si-dz-icon {
              background: #2563FF; color: #FFFFFF;
              transform: translateY(-2px);
            }
            .si-dropzone:hover .si-dz-btn { opacity: 0.9; }
          }
          .si-dz-icon {
            width: 48px; height: 48px; border-radius: 50%;
            background: #EAF2FF; color: #2563FF;
            display: flex; align-items: center; justify-content: center;
            margin-bottom: 14px;
            transition: background 0.2s cubic-bezier(0.22,1,0.36,1),
                        color 0.2s cubic-bezier(0.22,1,0.36,1),
                        transform 0.2s cubic-bezier(0.22,1,0.36,1);
          }
          .si-dz-title {
            font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 20px;
            text-transform: uppercase; letter-spacing: 0.03em; color: #0B1224;
          }
          .si-dz-sub {
            font-family: 'Inter', sans-serif; font-size: 13px; color: #64748B;
            line-height: 1.6; margin-top: 6px; max-width: 420px;
          }
          .si-dz-mode {
            font-family: 'Inter', sans-serif; font-size: 12px; color: #94A3B8;
          }
          .si-dz-btn {
            margin-top: 16px;
            background: linear-gradient(135deg, #2563FF, #5B3DF5); color: #FFFFFF;
            border-radius: 10px; padding: 9px 20px;
            font-family: 'Inter', sans-serif; font-weight: 600; font-size: 13px;
            display: inline-flex; align-items: center; gap: 7px;
            box-shadow: 0 4px 12px rgba(37,99,255,0.25);
            transition: opacity 0.18s ease;
          }
          @media (prefers-reduced-motion: reduce) {
            .si-dropzone:hover .si-dz-icon { transform: none; }
          }
        `}</style>
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
