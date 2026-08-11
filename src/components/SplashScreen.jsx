import { Shield } from 'lucide-react'

/**
 * v2 splash — flat obsidian background, no glows, gold progress bar.
 * Rendered by AuthContext while the auth session restores on boot.
 */
export default function SplashScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: 'var(--obsidian)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          animation: 'ee-splash-in 0.4s ease-out',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--gold)',
          }}
        >
          <Shield size={38} strokeWidth={2.2} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span
            style={{
              fontFamily: "'Oxanium', sans-serif",
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--ivory)',
            }}
          >
            Esports Elite
          </span>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              marginTop: 8,
            }}
          >
            Pro Training Platform
          </span>
        </div>

        <div
          style={{
            marginTop: 12,
            width: 180,
            height: 3,
            background: 'var(--border)',
            borderRadius: 999,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '-40%',
              height: '100%',
              width: '40%',
              background: 'var(--gold)',
              animation: 'ee-splash-bar 1.6s linear infinite',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes ee-splash-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ee-splash-bar {
          0%   { left: -40%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  )
}
