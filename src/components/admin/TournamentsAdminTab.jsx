import { useEffect, useMemo, useState } from 'react'
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy,
  query, serverTimestamp, setDoc, updateDoc, getDocs,
} from 'firebase/firestore'
import {
  Trophy, Plus, Edit, Trash2, Star, X, Save, Loader2,
  ArrowDown, ChevronRight,
} from 'lucide-react'
import { db } from '../../utils/firebase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useConfirm } from '../../hooks/useConfirm.js'
import ConfirmModal from '../ConfirmModal.jsx'

const MAPS = ['Erangel', 'Miramar', 'Rondo']
const TYPES = [
  { key: 'community', label: 'Community' },
  { key: 'official',  label: 'Official' },
]
const STATUSES = [
  { key: 'upcoming',  label: 'Upcoming' },
  { key: 'ongoing',   label: 'Ongoing' },
  { key: 'completed', label: 'Completed' },
]
const MATCH_STATUSES = [
  { key: 'upcoming',  label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
]

const EMPTY_FORM = {
  name: '',
  type: 'community',
  organizer: 'Esports Elite',
  prizePool: '',
  startDate: '',
  endDate: '',
  maps: [],
  format: 'Battle Royale',
  description: '',
  featured: false,
  status: 'upcoming',
}

export default function TournamentsAdminTab() {
  const { confirm, confirmModalProps } = useConfirm()
  const { user } = useAuth()
  const [list, setList] = useState([])
  const [matchCounts, setMatchCounts] = useState({})
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [matchModal, setMatchModal] = useState(null)   /* {tournament, match?} */

  /* Live tournaments list */
  useEffect(() => {
    const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setList(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  /* Live match count per tournament so admin sees updates without
     opening each row. Collection-group would need an index — a
     per-tournament count read keeps the rules simple. */
  useEffect(() => {
    const unsubs = list.map(t =>
      onSnapshot(collection(db, 'tournaments', t.id, 'matches'), (snap) => {
        setMatchCounts(prev => ({ ...prev, [t.id]: snap.size }))
      })
    )
    return () => unsubs.forEach(u => u && u())
  }, [list.length])   // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMap(m) {
    setForm(f => {
      const has = f.maps.includes(m)
      return { ...f, maps: has ? f.maps.filter(x => x !== m) : [...f.maps, m] }
    })
  }

  async function submitForm() {
    if (!form.name.trim())   { alert('Tournament name is required.'); return }
    if (!form.organizer.trim()) { alert('Organizer is required.'); return }
    if (!form.startDate)     { alert('Start date is required.'); return }
    if (!form.endDate)       { alert('End date is required.'); return }
    setSaving(true)
    try {
      const payload = {
        name:        form.name.trim(),
        type:        form.type,
        organizer:   form.organizer.trim(),
        prizePool:   form.prizePool.trim(),
        startDate:   form.startDate,
        endDate:     form.endDate,
        maps:        form.maps,
        format:      form.format.trim(),
        description: form.description.trim(),
        featured:    !!form.featured,
        status:      form.status,
        updatedAt:   serverTimestamp(),
      }
      if (editingId) {
        await updateDoc(doc(db, 'tournaments', editingId), payload)
      } else {
        await addDoc(collection(db, 'tournaments'), {
          ...payload,
          totalMatches: 0,
          createdBy:    user?.uid || 'unknown',
          createdAt:    serverTimestamp(),
        })
      }
      setForm(EMPTY_FORM)
      setEditingId(null)
    } catch (e) { alert('Save failed: ' + (e?.message || e)) }
    finally    { setSaving(false) }
  }

  function editTournament(t) {
    setEditingId(t.id)
    setForm({
      name:        t.name || '',
      type:        t.type || 'community',
      organizer:   t.organizer || '',
      prizePool:   t.prizePool || '',
      startDate:   t.startDate || '',
      endDate:     t.endDate || '',
      maps:        Array.isArray(t.maps) ? t.maps : [],
      format:      t.format || 'Battle Royale',
      description: t.description || '',
      featured:    !!t.featured,
      status:      t.status || 'upcoming',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function removeTournament(t) {
    if (!await confirm(
      `Delete "${t.name}" and all its matches?\n\nThis cannot be undone.`
    )) return
    try {
      /* Nuke child matches first so no orphan docs are left behind. */
      const mSnap = await getDocs(collection(db, 'tournaments', t.id, 'matches'))
      for (const m of mSnap.docs) await deleteDoc(m.ref)
      await deleteDoc(doc(db, 'tournaments', t.id))
    } catch (e) { alert('Delete failed: ' + (e?.message || e)) }
  }

  async function toggleFeatured(t) {
    try {
      await updateDoc(doc(db, 'tournaments', t.id), {
        featured: !t.featured,
        updatedAt: serverTimestamp(),
      })
    } catch (e) { alert('Update failed: ' + (e?.message || e)) }
  }

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={15} style={{ color: 'var(--text-subtle)' }} />
            {editingId ? 'Edit Tournament' : 'Create Tournament'}
          </div>
          {editingId && (
            <button onClick={cancelEdit} className="btn btn-secondary btn-sm">
              <X size={12} /> Cancel edit
            </button>
          )}
        </div>

        <TournamentForm
          form={form}
          onChange={setForm}
          onToggleMap={toggleMap}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={submitForm} disabled={saving} className="btn btn-primary btn-sm">
            {saving ? <><Loader2 size={12} className="animate-spin" /> Saving</> : editingId
              ? <><Save size={12} /> Save changes</>
              : <><Plus size={12} /> Create tournament</>}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">All Tournaments</div>
          <div className="label">{list.length} total</div>
        </div>
        {list.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No tournaments yet</div>
            <div className="empty-state-desc">Create one above to get started.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th className="mono">Matches</th>
                  <th style={{ minWidth: 240 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t.featured && <Star size={12} style={{ color: 'var(--gold)', fill: 'var(--gold)' }} />}
                        {t.name || '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                        {t.organizer || '—'}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${t.type === 'official' ? 'badge-amber' : 'badge-blue'}`}>
                        {t.type || '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${t.status === 'ongoing' ? 'badge-green' : ''}`}>
                        {t.status || '—'}
                      </span>
                    </td>
                    <td className="mono">{matchCounts[t.id] ?? 0}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        <button
                          onClick={() => setMatchModal({ tournament: t, match: null })}
                          className="btn btn-primary btn-sm"
                        >
                          <Plus size={12} /> Match
                        </button>
                        <button onClick={() => editTournament(t)} className="btn btn-secondary btn-sm">
                          <Edit size={12} />
                        </button>
                        <button onClick={() => toggleFeatured(t)} className="btn btn-secondary btn-sm">
                          <Star size={12} style={t.featured ? { fill: 'var(--gold)', color: 'var(--gold)' } : undefined} />
                        </button>
                        <button onClick={() => removeTournament(t)} className="btn btn-secondary btn-sm">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {list.map(t => (
        <MatchesPanel
          key={t.id}
          tournament={t}
          onAddMatch={() => setMatchModal({ tournament: t, match: null })}
          onEditMatch={(m) => setMatchModal({ tournament: t, match: m })}
        />
      ))}

      {matchModal && (
        <MatchModal
          tournament={matchModal.tournament}
          match={matchModal.match}
          onClose={() => setMatchModal(null)}
          uid={user?.uid}
        />
      )}
    </div>
    <ConfirmModal {...confirmModalProps} />
    </>
  )
}

/* ============================================================
   TOURNAMENT FORM
   ============================================================ */
function TournamentForm({ form, onChange, onToggleMap }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <Row>
        <Field label="Tournament name *">
          <input
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="e.g. BGMI Elite Cup 2026"
            className="input"
          />
        </Field>
        <Field label="Type *">
          <select
            value={form.type}
            onChange={(e) => onChange({
              ...form,
              type: e.target.value,
              organizer: e.target.value === 'community' && !form.organizer.trim()
                ? 'Esports Elite'
                : form.organizer,
            })}
            className="input"
          >
            {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Field>
      </Row>

      <Row>
        <Field label="Organizer *">
          <input
            value={form.organizer}
            onChange={(e) => onChange({ ...form, organizer: e.target.value })}
            placeholder="e.g. Krafton"
            className="input"
          />
        </Field>
        <Field label="Prize pool">
          <input
            value={form.prizePool}
            onChange={(e) => onChange({ ...form, prizePool: e.target.value })}
            placeholder="₹50,000"
            className="input"
          />
        </Field>
      </Row>

      <Row>
        <Field label="Start date *">
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => onChange({ ...form, startDate: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="End date *">
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => onChange({ ...form, endDate: e.target.value })}
            className="input"
          />
        </Field>
      </Row>

      <Row>
        <Field label="Format">
          <input
            value={form.format}
            onChange={(e) => onChange({ ...form, format: e.target.value })}
            placeholder="Battle Royale"
            className="input"
          />
        </Field>
        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => onChange({ ...form, status: e.target.value })}
            className="input"
          >
            {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
      </Row>

      <Field label="Maps">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {MAPS.map(m => (
            <label key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.maps.includes(m)}
                onChange={() => onToggleMap(m)}
                style={{ accentColor: 'var(--red)' }}
              />
              {m}
            </label>
          ))}
        </div>
      </Field>

      <Field label="Description">
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          placeholder="Optional short summary shown on the detail page."
          className="input"
          style={{ resize: 'vertical' }}
        />
      </Field>

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={!!form.featured}
          onChange={(e) => onChange({ ...form, featured: e.target.checked })}
          style={{ accentColor: 'var(--red)' }}
        />
        Show as featured tournament
      </label>
    </div>
  )
}

function Row({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--text-subtle)',
      }}>
        {label}
      </span>
      {children}
    </label>
  )
}

/* ============================================================
   MATCHES PANEL (per tournament, admin list)
   ============================================================ */
function MatchesPanel({ tournament, onAddMatch, onEditMatch }) {
  const { confirm, confirmModalProps } = useConfirm()
  const [matches, setMatches] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'tournaments', tournament.id, 'matches'),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => (Number(a.matchNumber) || 0) - (Number(b.matchNumber) || 0))
        setMatches(list)
      },
    )
    return unsub
  }, [tournament.id])

  async function removeMatch(m) {
    if (!await confirm(`Delete "${m.round || 'match'}" from "${tournament.name}"?`)) return
    try { await deleteDoc(doc(db, 'tournaments', tournament.id, 'matches', m.id)) }
    catch (e) { alert('Delete failed: ' + (e?.message || e)) }
  }

  return (
    <>
    <div className="card">
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'transparent', border: 'none',
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', padding: 0, color: 'var(--text-primary)',
          fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600,
        }}
      >
        <span>
          {tournament.name}
          <span style={{ color: 'var(--text-subtle)', fontWeight: 400, marginLeft: 8 }}>
            ({matches.length} match{matches.length === 1 ? '' : 'es'})
          </span>
        </span>
        <ChevronRight
          size={14}
          style={{ color: 'var(--text-subtle)', transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }}
        />
      </button>

      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {matches.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>No matches yet.</div>
          ) : (
            matches.map(m => (
              <div key={m.id} style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '8px 10px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                    {m.round || `Match ${m.matchNumber || ''}`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                    {m.map || '—'} · {m.date || 'no date'} · {(m.standings || []).length} team{(m.standings || []).length === 1 ? '' : 's'}
                  </div>
                </div>
                <span className={`badge ${m.status === 'completed' ? 'badge-green' : ''}`}>{m.status || '—'}</span>
                <button onClick={() => onEditMatch(m)} className="btn btn-secondary btn-sm"><Edit size={12} /></button>
                <button onClick={() => removeMatch(m)} className="btn btn-secondary btn-sm"><Trash2 size={12} /></button>
              </div>
            ))
          )}
          <button onClick={onAddMatch} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            <Plus size={12} /> Add match
          </button>
        </div>
      )}
    </div>
    <ConfirmModal {...confirmModalProps} />
    </>
  )
}

/* ============================================================
   ADD / EDIT MATCH MODAL
   ============================================================ */
function MatchModal({ tournament, match, onClose, uid }) {
  const isEdit = !!match
  const [round, setRound]         = useState(match?.round || '')
  const [matchNumber, setMatchNumber] = useState(match?.matchNumber ?? '')
  const [date, setDate]           = useState(match?.date || '')
  const [map, setMap]             = useState(match?.map || (tournament.maps?.[0] || 'Erangel'))
  const [status, setStatus]       = useState(match?.status || 'completed')
  const [rows, setRows]           = useState(() =>
    (Array.isArray(match?.standings) ? match.standings : []).map(normaliseRow)
  )
  const [saving, setSaving]       = useState(false)

  const availableMaps = useMemo(() => {
    const tm = Array.isArray(tournament.maps) && tournament.maps.length
      ? tournament.maps : MAPS
    return tm
  }, [tournament.maps])

  function addRow() {
    setRows(prev => [
      ...prev,
      { rank: prev.length + 1, teamName: '', kills: 0, placementPoints: 0, totalPoints: 0, wwcPoints: 0, chickenDinner: false, notes: '', overrideTotal: false },
    ])
  }

  function updateRow(i, patch) {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      const merged = { ...r, ...patch }
      /* Auto-calc totalPoints unless the user typed a manual value.
         Editing kills / placementPoints refreshes it; typing directly
         into totalPoints sets overrideTotal so subsequent edits to
         kills/placement don't clobber the manual number. */
      if ('totalPoints' in patch) {
        merged.overrideTotal = true
      } else if (('kills' in patch || 'placementPoints' in patch) && !merged.overrideTotal) {
        merged.totalPoints = (Number(merged.kills) || 0) + (Number(merged.placementPoints) || 0)
      }
      return merged
    }))
  }

  function removeRow(i) {
    setRows(prev => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, rank: idx + 1 })))
  }

  function sortByTotal() {
    setRows(prev => prev
      .slice()
      .sort((a, b) => (Number(b.totalPoints) || 0) - (Number(a.totalPoints) || 0))
      .map((r, i) => ({ ...r, rank: i + 1 }))
    )
  }

  async function save() {
    if (!round.trim()) { alert('Round label is required.'); return }
    if (!date)         { alert('Date is required.'); return }
    if (!map)          { alert('Map is required.'); return }
    if (rows.some(r => !r.teamName.trim())) {
      alert('Every row needs a team name (or delete the empty rows).')
      return
    }
    setSaving(true)
    try {
      const standings = rows.map(r => {
        const out = {
          rank:             Number(r.rank) || 0,
          teamName:         r.teamName.trim(),
          kills:            Number(r.kills)            || 0,
          placementPoints:  Number(r.placementPoints)  || 0,
          totalPoints:      Number(r.totalPoints)      || 0,
        }
        if (r.wwcPoints !== '' && r.wwcPoints != null) out.wwcPoints = Number(r.wwcPoints) || 0
        if (r.chickenDinner) out.chickenDinners = 1
        if (r.notes && r.notes.trim()) out.notes = r.notes.trim()
        return out
      })

      const nextNumber = matchNumber === '' || matchNumber == null
        ? undefined
        : Number(matchNumber) || 0

      const payload = {
        round:     round.trim(),
        date,
        map,
        status,
        standings,
        ...(nextNumber != null ? { matchNumber: nextNumber } : {}),
      }

      if (isEdit) {
        await setDoc(
          doc(db, 'tournaments', tournament.id, 'matches', match.id),
          { ...payload, updatedAt: serverTimestamp() },
          { merge: true },
        )
      } else {
        const matchesCol = collection(db, 'tournaments', tournament.id, 'matches')
        const guessedNumber = nextNumber != null ? nextNumber : await guessNextMatchNumber(matchesCol)
        await addDoc(matchesCol, {
          ...payload,
          matchNumber: guessedNumber,
          createdBy:   uid || 'unknown',
          createdAt:   serverTimestamp(),
        })
        /* Keep tournament.totalMatches in sync so the list card
           doesn't lie. Runs after the write so the count includes
           the new match. */
        try {
          const snap = await getDocs(matchesCol)
          await updateDoc(doc(db, 'tournaments', tournament.id), {
            totalMatches: snap.size,
            updatedAt:    serverTimestamp(),
          })
        } catch { /* non-fatal */ }
      }
      onClose()
    } catch (e) { alert('Save failed: ' + (e?.message || e)) }
    finally    { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal tm-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 760, width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div className="card-header">
          <div className="card-title">
            {isEdit ? 'Edit match' : 'Add match'}
            <span style={{ color: 'var(--text-subtle)', fontWeight: 400, marginLeft: 8 }}>
              — {tournament.name}
            </span>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            <X size={13} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <Field label="Round / label *">
            <input value={round} onChange={(e) => setRound(e.target.value)} placeholder="Day 1 Match 3" className="input" />
          </Field>
          <Field label="Date *">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </Field>
          <Field label="Map *">
            <select value={map} onChange={(e) => setMap(e.target.value)} className="input">
              {availableMaps.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
              {MATCH_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Match number (optional)">
            <input
              type="number"
              min={1}
              value={matchNumber}
              onChange={(e) => setMatchNumber(e.target.value)}
              placeholder="Auto"
              className="input"
            />
          </Field>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: 'var(--text-subtle)',
            }}>
              Standings
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={sortByTotal} className="btn btn-secondary btn-sm">
                <ArrowDown size={11} /> Sort by total pts
              </button>
              <button onClick={addRow} className="btn btn-primary btn-sm">
                <Plus size={11} /> Add team
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Team</th>
                  <th className="mono" style={{ width: 70 }}>Kills</th>
                  <th className="mono" style={{ width: 90 }}>Placement</th>
                  <th className="mono" style={{ width: 80 }}>Total</th>
                  <th className="mono" style={{ width: 70 }}>WWC</th>
                  <th style={{ width: 60 }}>🐔</th>
                  <th>Notes</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-subtle)', padding: 20 }}>
                      No teams yet. Add one to get started.
                    </td>
                  </tr>
                ) : rows.map((r, i) => (
                  <tr key={i}>
                    <td className="mono">{r.rank}</td>
                    <td>
                      <input
                        value={r.teamName}
                        onChange={(e) => updateRow(i, { teamName: e.target.value })}
                        className="input"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        placeholder="Team name"
                      />
                    </td>
                    <td><NumInput value={r.kills} onChange={(v) => updateRow(i, { kills: v })} /></td>
                    <td><NumInput value={r.placementPoints} onChange={(v) => updateRow(i, { placementPoints: v })} /></td>
                    <td><NumInput value={r.totalPoints} onChange={(v) => updateRow(i, { totalPoints: v })} /></td>
                    <td><NumInput value={r.wwcPoints} onChange={(v) => updateRow(i, { wwcPoints: v })} /></td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={!!r.chickenDinner}
                        onChange={(e) => updateRow(i, { chickenDinner: e.target.checked })}
                        style={{ accentColor: 'var(--gold)' }}
                      />
                    </td>
                    <td>
                      <input
                        value={r.notes}
                        onChange={(e) => updateRow(i, { notes: e.target.value })}
                        className="input"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        placeholder="—"
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => removeRow(i)}
                        style={{
                          background: 'transparent', border: '1px solid var(--border)',
                          borderRadius: 4, color: 'var(--text-muted)',
                          padding: 2, cursor: 'pointer', display: 'inline-flex',
                        }}
                      >
                        <X size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="btn btn-primary btn-sm">
            {saving ? <><Loader2 size={12} className="animate-spin" /> Saving</> : <><Save size={12} /> Save match</>}
          </button>
        </div>

        <MatchModalStyles />
      </div>
    </div>
  )
}

function NumInput({ value, onChange }) {
  return (
    <input
      type="number"
      value={value ?? 0}
      onChange={(e) => {
        const v = e.target.value
        onChange(v === '' ? 0 : Number(v))
      }}
      className="input mono"
      style={{ padding: '4px 6px', fontSize: 12, textAlign: 'right' }}
    />
  )
}

function normaliseRow(s) {
  return {
    rank:             Number(s.rank) || 0,
    teamName:         s.teamName || '',
    kills:            Number(s.kills)            || 0,
    placementPoints:  Number(s.placementPoints)  || 0,
    totalPoints:      Number(s.totalPoints)      || 0,
    wwcPoints:        s.wwcPoints ?? '',
    chickenDinner:    (Number(s.chickenDinners) || 0) > 0 || Number(s.rank) === 1,
    notes:            s.notes || '',
    /* Assume manual override on load so re-editing doesn't nuke
       the admin's stored totals. */
    overrideTotal:    true,
  }
}

async function guessNextMatchNumber(matchesCol) {
  try {
    const snap = await getDocs(matchesCol)
    let max = 0
    snap.forEach(d => {
      const n = Number(d.data()?.matchNumber) || 0
      if (n > max) max = n
    })
    return max + 1
  } catch {
    return 1
  }
}

function MatchModalStyles() {
  return (
    <style>{`
      .tm-modal .table th, .tm-modal .table td { padding: 6px 8px; }
      .tm-modal .input { width: 100%; box-sizing: border-box; }
      @media (max-width: 767px) {
        .tm-modal {
          max-width: 100% !important;
          border-radius: 0 !important;
          min-height: 100vh;
        }
      }
    `}</style>
  )
}
