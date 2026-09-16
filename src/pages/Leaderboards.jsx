import { Award } from 'lucide-react'

export default function Leaderboards() {
  return (
    <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 20, textAlign: 'center' }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Award size={30} style={{ color: 'var(--text-muted)' }} />
      </div>
      <h2 className="heading" style={{ fontSize: 26, margin: 0 }}>Leaderboards</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 360, margin: 0, lineHeight: 1.6 }}>
        Ranked leaderboards are coming soon. Your match data is already being tracked — standings will appear here once the feature launches.
      </p>
      <span className="badge badge-amber">Coming soon</span>
    </div>
  )
}
