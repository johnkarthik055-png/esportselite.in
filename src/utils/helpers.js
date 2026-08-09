/* ============================================================
   TIME / DURATION FORMATTING
   ============================================================ */

/** MM:SS or HH:MM:SS — used by the live drill timer display. */
export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** Compact "1h 24m" / "8m" — used in recent activity & history rows. */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** Padded "12m 30s" — used in practice history session rows. */
export function formatMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
}

/** HH:MM legacy formatter (kept for compatibility). */
export function formatHM(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Dashboard "Total Practice Time" formatter.
 * - 0 seconds                        → "0m"
 * - 1 .. 59 minutes                  → "Xm"
 * - 60+ minutes                      → "Xh Ym"
 */
export function formatPracticeTime(totalSeconds) {
  const total = Math.max(0, Math.floor(totalSeconds || 0))
  if (total === 0) return '0m'
  const totalMinutes = Math.floor(total / 60)
  if (totalMinutes === 0) return '0m'
  if (totalMinutes < 60) return `${totalMinutes}m`
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h ${m}m`
}

/** Time-of-day "18:42". */
export function formatHHMM(ts) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/* ============================================================
   DATE HELPERS
   ============================================================ */

export function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dateKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysBetween(a, b) {
  const ms = 1000 * 60 * 60 * 24
  const da = new Date(a)
  const db = new Date(b)
  da.setHours(0, 0, 0, 0)
  db.setHours(0, 0, 0, 0)
  return Math.round((db - da) / ms)
}

export function startOfWeek(d = new Date()) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

/** Returns 00:00 of the day that is N days before today (inclusive). */
export function startOfRollingWindow(daysBack) {
  const d = new Date()
  d.setDate(d.getDate() - (daysBack - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

export function monthName(d = new Date()) {
  return d.toLocaleString('en-US', { month: 'long' })
}

export function formatRelative(ts) {
  const now = Date.now()
  const diff = Math.floor((now - ts) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(ts).toLocaleDateString()
}

export function formatDateShort(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "24 May 2026" — used for Practice History date headers. */
export function formatDateLong(dateOrKey) {
  let d
  if (typeof dateOrKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOrKey)) {
    const [y, m, day] = dateOrKey.split('-').map(Number)
    d = new Date(y, m - 1, day)
  } else {
    d = new Date(dateOrKey)
  }
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ============================================================
   MISC
   ============================================================ */

export function getInitials(name) {
  if (!name) return 'EE'
  const parts = String(name).trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

/* ============================================================
   SESSION DATA MIGRATION
   Older sessions stored a single `gunSelected` string.
   Newer sessions store `gunsSelected` array (max 2).
   This normalizes on read so the UI only deals with the array.
   ============================================================ */
export function normalizeSession(session) {
  if (!session || typeof session !== 'object') return session
  if (Array.isArray(session.gunsSelected)) return session
  if (session.gunSelected) {
    return { ...session, gunsSelected: [session.gunSelected] }
  }
  return { ...session, gunsSelected: [] }
}

export function normalizeSessions(sessions) {
  if (!Array.isArray(sessions)) return []
  return sessions.map(normalizeSession)
}

/* ============================================================
   DAILY STATUS LOGIC (for calendar / banners)
   ============================================================ */

/**
 * Compute a day's status given:
 *  - dateKeyStr: 'YYYY-MM-DD'
 *  - hasActivity: boolean — true if any session/match was logged that day
 *  - dailyEntry:  the daily_sessions[date] OR daily_matches[date] record (or null)
 *
 * Returns one of:
 *   'completed' | 'incomplete' | 'not_completed' | 'in_progress' | 'not_started' | 'future'
 */
export function computeDayStatus(dateKeyStr, hasActivity, dailyEntry) {
  const today = todayKey()
  if (dateKeyStr > today) return 'future'
  const isCompleted = dailyEntry?.status === 'completed'

  if (dateKeyStr === today) {
    if (isCompleted) return 'completed'
    if (hasActivity) return 'in_progress'
    return 'not_started'
  }

  // Past day
  if (isCompleted) return 'completed'
  if (hasActivity) return 'incomplete'
  return 'not_completed'
}

/* ============================================================
   CALENDAR GRID BUILDING
   ============================================================ */

/**
 * Build the cells for a month-view calendar.
 * Returns an array of length 42 (6 rows × 7 cols).
 * Each cell is { date: 'YYYY-MM-DD', day: number, inMonth: boolean } or null padding.
 */
export function getMonthCells(year, month /* 0-11 */) {
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const startDow = firstDayOfMonth.getDay() // 0 = Sun
  const daysInMonth = lastDayOfMonth.getDate()

  const cells = []

  // Padding from previous month
  const prevMonthLast = new Date(year, month, 0).getDate()
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLast - i)
    cells.push({
      date: dateKey(d),
      day: d.getDate(),
      inMonth: false,
    })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    cells.push({
      date: dateKey(date),
      day: d,
      inMonth: true,
    })
  }

  // Trailing padding to fill out to 42 cells
  let trailing = 1
  while (cells.length < 42) {
    const d = new Date(year, month + 1, trailing++)
    cells.push({
      date: dateKey(d),
      day: d.getDate(),
      inMonth: false,
    })
  }

  return cells
}

export function monthYearLabel(date) {
  return new Date(date).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

/* ============================================================
   IMAGE CENTER-CROP TO SQUARE → base64
   ============================================================ */

/**
 * Read a File, center-crop to a square, and return a base64 JPEG data URL.
 * - Max output size is `maxSize` × `maxSize` (smaller if the source is smaller).
 * - Output quality 0.85 keeps things compact enough for localStorage.
 */
export function cropImageToSquareBase64(file, maxSize = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        try {
          const size = Math.min(img.width, img.height)
          const sx = (img.width - size) / 2
          const sy = (img.height - size) / 2
          const target = Math.min(size, maxSize)

          const canvas = document.createElement('canvas')
          canvas.width = target
          canvas.height = target
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, sx, sy, size, size, 0, 0, target, target)
          resolve(canvas.toDataURL('image/jpeg', 0.85))
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = () => reject(new Error('Could not load image'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

/** "Saturday, 24 May 2026" */
export function formatDateFull(dateOrKey) {
  let d
  if (typeof dateOrKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOrKey)) {
    const [y, m, day] = dateOrKey.split('-').map(Number)
    d = new Date(y, m - 1, day)
  } else {
    d = new Date(dateOrKey)
  }
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
