import { Clock, Flag } from 'lucide-react'
import { formatDuration } from '../utils/helpers.js'

/**
 * Combined daily session banner.
 * Props: drillCount, matchCount, totalDuration, status, onEndSession
 */
export default function SessionBanner({
  drillCount = 0,
  matchCount = 0,
  totalDuration = 0,
  status = 'not_started',
  onEndSession,
}) {
  const hasActivity = drillCount > 0 || matchCount > 0
  const isCompleted = status === 'completed'
  if (!hasActivity && !isCompleted) return null

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        borderTop: '2px solid var(--green)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        position: 'relative',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <style>{`
        @keyframes ee-banner-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--green)',
            animation: 'ee-banner-pulse 1.6s ease-in-out infinite',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'DM Sans, sans-serif',
              fontWeight: 600,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--green)',
            }}
          >
            Session Active
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {drillCount} drill{drillCount === 1 ? '' : 's'} · {matchCount} match{matchCount === 1 ? '' : 'es'}
          </span>
        </div>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
          <Clock size={14} />
          <span
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--text-primary)',
            }}
          >
            {formatDuration(totalDuration)}
          </span>
        </div>

        {isCompleted ? (
          <span className="badge badge-green">Ended</span>
        ) : (
          <button onClick={onEndSession} className="btn btn-secondary btn-sm">
            <Flag size={13} />
            End Session
          </button>
        )}
      </div>
    </div>
  )
}
