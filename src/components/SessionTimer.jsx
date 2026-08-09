import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { STORAGE_KEYS } from '../utils/constants.js'
import { todayKey, dateKey, normalizeSessions } from '../utils/helpers.js'

const START_KEY = 'esportselite_active_session_start'

function formatHMS(secs) {
  const s = Math.max(0, Math.floor(secs))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

/**
 * Live training-session timer shown in TopBar (left of the bell) whenever
 * at least one drill has been logged today and the session hasn't been
 * ended. Persists across navigation via localStorage start timestamp.
 */
export default function SessionTimer() {
  const [sessionsRaw] = useLocalStorage(STORAGE_KEYS.SESSIONS, [])
  const [daily] = useLocalStorage(STORAGE_KEYS.DAILY_SESSIONS, {})
  const [startISO, setStartISO] = useLocalStorage(START_KEY, '')
  const [now, setNow] = useState(Date.now())

  const today = todayKey()

  const todaysSessions = useMemo(() => {
    const all = normalizeSessions(sessionsRaw)
    return all.filter(s => dateKey(s.timestamp) === today)
  }, [sessionsRaw, today])

  const todayEntry = daily[today]
  const isCompleted = todayEntry?.status === 'completed'
  const hasActivity = todaysSessions.length > 0
  const inProgress = hasActivity && !isCompleted

  /* Maintain the persisted start timestamp. */
  useEffect(() => {
    if (inProgress && !startISO && todaysSessions.length > 0) {
      const earliest = Math.min(...todaysSessions.map(s => s.timestamp))
      setStartISO(new Date(earliest).toISOString())
    }
    if (!inProgress && startISO) {
      setStartISO('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgress, startISO, todaysSessions.length])

  /* Tick every second while active. */
  useEffect(() => {
    if (!inProgress) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [inProgress])

  if (!inProgress || !startISO) return null

  const elapsed = Math.floor((now - new Date(startISO).getTime()) / 1000)

  return (
    <div
      className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-md mr-1"
      style={{
        background: 'rgba(232,0,28,0.08)',
        border: '1px solid rgba(232,0,28,0.3)',
      }}
      title="Active training session"
    >
      <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse-red" />
      <span className="mono text-sm text-accent-secondary">{formatHMS(elapsed)}</span>
    </div>
  )
}
