import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Zap } from 'lucide-react'
import { LEVEL_EVENT } from '../utils/xp.js'

/**
 * Global host that listens for the LEVEL_EVENT custom event and renders
 * the full-screen level-up moment. Mount once (e.g. in Layout).
 *
 * Timeline:
 *   0.0s overlay fades in + particles burst
 *   0.0s card scales 0.5 → 1.0 (level-card-in keyframe)
 *   2.5s card scales out (level-card-out keyframe)
 *   3.0s gone
 */
export default function LevelUpModal() {
  const [data, setData] = useState(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    function onLevelUp(e) {
      setData(e.detail)
      setClosing(false)
    }
    window.addEventListener(LEVEL_EVENT, onLevelUp)
    return () => window.removeEventListener(LEVEL_EVENT, onLevelUp)
  }, [])

  useEffect(() => {
    if (!data) return
    const closeT = setTimeout(() => setClosing(true), 2500)
    const gone = setTimeout(() => {
      setData(null)
      setClosing(false)
    }, 3000)
    return () => {
      clearTimeout(closeT)
      clearTimeout(gone)
    }
  }, [data])

  const particles = useMemo(() => {
    const out = []
    const count = 18
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3
      const dist = 140 + Math.random() * 90
      const colors = ['#E8001C', '#FF2D44', '#FFD700', '#FFFFFF']
      out.push({
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist,
        color: colors[i % colors.length],
        delay: 100 + Math.floor(Math.random() * 200),
      })
    }
    return out
  }, [data?.level?.level])

  if (!data || typeof document === 'undefined') return null

  const { level, amount } = data

  return createPortal(
    <div
      className="fixed inset-0 z-[100] animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.85)', pointerEvents: 'auto' }}
      aria-hidden="true"
    >
      {/* Particle burst */}
      <div className="absolute" style={{ top: '50%', left: '50%' }}>
        {particles.map((p, i) => (
          <span
            key={i}
            className="level-particle"
            style={{
              background: p.color,
              '--lx': `${p.tx}px`,
              '--ly': `${p.ty}px`,
              animationDelay: `${p.delay}ms`,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        className={`absolute glass-strong border-2 border-[rgba(232,0,28,0.6)] shadow-red-glow-lg p-7 sm:p-8 rounded-xl w-[92%] max-w-md ${
          closing ? 'level-card-out' : 'level-card-in'
        }`}
        style={{ top: '50%', left: '50%' }}
      >
        <div className="text-center">
          <Zap size={52} className="text-gold mx-auto mb-3" strokeWidth={2.5} />
          <h2 className="heading text-3xl text-white tracking-[0.2em]">LEVEL UP!</h2>
          <p className="mt-4 text-text-secondary text-sm">You are now</p>
          <p className="heading text-2xl text-gradient-red mt-1">Level {level.level}</p>
          <p className="heading text-lg text-gold tracking-[0.15em] mt-1">{level.name}</p>

          <div className="mt-5">
            <div className="h-2 w-full bg-bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-red-gradient shadow-red-glow"
                style={{ width: '100%' }}
              />
            </div>
            <p className="text-[10px] mono text-text-muted mt-1">100%</p>
          </div>

          <p className="mt-4 text-sm">
            <span className="text-success heading">+{amount || 0} XP</span>{' '}
            <span className="text-text-secondary">earned this action</span>
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
