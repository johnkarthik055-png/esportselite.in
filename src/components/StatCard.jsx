export default function StatCard({
  icon,
  value,
  label,
  sub,
  accent,
  progress,
  monoValue,
  wrapperClass = '',
  wrapperStyle,
}) {
  const valueColor =
    accent === 'amber' ? 'var(--amber)' :
    accent === 'green' ? 'var(--green)' :
    accent === 'gold'  ? 'var(--gold)'  :
    'var(--text-primary)'

  return (
    <div
      className={`card ${wrapperClass}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...wrapperStyle,
      }}
    >
      <div
        style={{
          width: 34, height: 34,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
        }}
      >
        {icon}
      </div>

      <div
        className={`stat-number ${monoValue ? 'mono' : ''}`}
        style={{ color: valueColor }}
      >
        {value}
      </div>

      <div className="stat-label">{label}</div>

      {sub && (
        <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
          {sub}
        </div>
      )}

      {typeof progress === 'number' && (
        <div className="xp-bar-track" style={{ marginTop: 4 }}>
          <div
            className="xp-bar-fill"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  )
}
