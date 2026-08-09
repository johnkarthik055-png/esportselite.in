import { useMemo, useRef, useState } from 'react'
import { Camera, Shield } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { STORAGE_KEYS } from '../utils/constants.js'
import { useStats } from '../hooks/useStats.js'
import { useStreak } from '../hooks/useStreak.js'
import { useAvatar } from '../hooks/useAvatar.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getXP, getLevelFor } from '../utils/xp.js'
import { getInitials, formatPracticeTime } from '../utils/helpers.js'
import { getDisplayName } from '../utils/storage.js'

/** Shareable Esports Elite rank card — designed for 400×220 export. */
export default function RankCard() {
  const [user] = useLocalStorage(STORAGE_KEYS.USER, { username: 'Player' })
  const [matches] = useLocalStorage(STORAGE_KEYS.MATCHES, [])
  const { avatar } = useAvatar()
  const { user: authUser } = useAuth()
  const stats = useStats()
  const streak = useStreak()
  const cardRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const displayName = getDisplayName()

  const xp = getXP()
  const level = getLevelFor(xp)
  const pct = Math.round(level.progressInLevel * 100)

  const scrimAvg = useMemo(() => {
    const list = (Array.isArray(matches) ? matches : []).filter(
      m => m.type === 'Scrims' || m.type === 'Tournament'
    )
    if (!list.length) return '0.0'
    const total = list.reduce((s, m) => s + (Number(m.individualKills) || 0), 0)
    return (total / list.length).toFixed(1)
  }, [matches])

  const initials = getInitials(displayName)

  async function saveImage() {
    if (!cardRef.current) return
    setSaving(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        logging: false,
        useCORS: true,
      })
      const link = document.createElement('a')
      const slug = (displayName || 'player')
        .replace(/\s+/g, '_')
        .replace(/[^\w-]/g, '')
        .toLowerCase()
      link.download = `esports-elite-${slug}-rank.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[RankCard] export failed:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        ref={cardRef}
        className="relative rounded-xl overflow-hidden mx-auto"
        style={{
          width: '100%',
          maxWidth: 400,
          aspectRatio: '400 / 220',
          background:
            'linear-gradient(135deg, #0A0A0F 0%, #1A1A24 50%, #0A0A0F 100%)',
          border: '1px solid rgba(232,0,28,0.4)',
        }}
      >
        {/* Subtle red glow bottom-left + tiny gold top-right */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: -48,
            left: -48,
            width: 180,
            height: 180,
            background:
              'radial-gradient(circle, rgba(232,0,28,0.35) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: -40,
            right: -40,
            width: 130,
            height: 130,
            background:
              'radial-gradient(circle, rgba(255,215,0,0.15) 0%, transparent 70%)',
          }}
        />

        <div className="relative h-full flex flex-col p-4">
          {/* Top: logo + brand */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #E8001C, #FF2D44)',
                boxShadow: '0 0 16px rgba(232,0,28,0.6)',
              }}
            >
              <Shield size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <div
              className="text-white tracking-[0.15em]"
              style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 14 }}
            >
              ESPORTS ELITE
            </div>
          </div>

          <div className="border-t border-[rgba(255,255,255,0.1)] my-2.5" />

          {/* Identity */}
          <div className="flex items-center gap-3">
            {avatar ? (
              <img
                src={avatar}
                alt=""
                className="rounded-full object-cover"
                style={{
                  width: 56,
                  height: 56,
                  border: '2px solid #E8001C',
                  boxShadow: '0 0 12px rgba(232,0,28,0.5)',
                }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center text-white font-bold"
                style={{
                  width: 56,
                  height: 56,
                  background: 'linear-gradient(135deg, #E8001C, #FF2D44)',
                  fontFamily: "'Bebas Neue',sans-serif",
                  fontSize: 16,
                  boxShadow: '0 0 12px rgba(232,0,28,0.5)',
                }}
              >
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div
                className="text-white truncate"
                style={{
                  fontFamily: "'Bebas Neue',sans-serif",
                  fontSize: 17,
                  letterSpacing: '0.03em',
                  fontWeight: 700,
                }}
              >
                {displayName}
              </div>
              <div className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: '#FFD700' }}>
                ⚡ Level {level.level} —{' '}
                <span
                  className="tracking-[0.1em]"
                  style={{ fontFamily: "'Bebas Neue',sans-serif", fontWeight: 600 }}
                >
                  {level.name}
                </span>
              </div>
              {streak.current > 0 && (
                <div className="text-[11px] mt-0.5" style={{ color: '#FF2D44' }}>
                  🔥 {streak.current} Day Streak
                </div>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div
            className="grid grid-cols-2 gap-1 mt-2.5 text-[11px]"
            style={{ fontFamily: "'Bebas Neue',sans-serif" }}
          >
            <div className="text-[#F0F0F0]">
              ⏱{' '}
              <span className="mono" style={{ color: '#FF2D44' }}>
                {formatPracticeTime(stats.totalSeconds)}
              </span>
            </div>
            <div className="text-[#F0F0F0]">
              📊{' '}
              <span className="mono" style={{ color: '#FF2D44' }}>
                {stats.matchCount}
              </span>{' '}
              Matches
            </div>
            <div className="text-[#F0F0F0]">
              🎯{' '}
              <span className="mono" style={{ color: '#FF2D44' }}>
                {stats.totalSessions}
              </span>{' '}
              Drills
            </div>
            <div className="text-[#F0F0F0]">
              💀{' '}
              <span className="mono" style={{ color: '#FF2D44' }}>
                {scrimAvg}
              </span>{' '}
              Avg K
            </div>
          </div>

          {/* XP bar */}
          <div className="mt-auto">
            <div
              className="rounded-full overflow-hidden"
              style={{ height: 6, background: 'rgba(255,255,255,0.06)' }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, #E8001C, #FF2D44)',
                }}
              />
            </div>
            <div className="text-[10px] mono mt-1" style={{ color: '#9999AA' }}>
              {xp.toLocaleString()} / {(level.ceil || xp).toLocaleString()} XP
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={saveImage}
          disabled={saving}
          className="btn-red px-5 py-2.5 rounded-md text-xs uppercase tracking-[0.15em] flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Camera size={14} /> {saving ? 'Saving…' : 'Save as Image'}
        </button>
      </div>
    </div>
  )
}
