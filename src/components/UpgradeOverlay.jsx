import { Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const ADMIN_EMAILS = ['karthikreddyy2010@gmail.com', 'karthikreddyyy2010@gmail.com']

export default function UpgradeOverlay({ title, description, feature }) {
  const { user } = useAuth()
  if (ADMIN_EMAILS.includes(user?.email)) return null

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0,
      width: '100%', height: '100%', zIndex: 50,
      background: 'rgba(247,249,253,0.92)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 'inherit',
    }}>
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E5EAF3',
        borderRadius: 16,
        padding: 28,
        textAlign: 'center',
        maxWidth: 360,
        width: '90%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        boxShadow: '0 8px 32px rgba(37,99,255,0.08)',
      }}>
        <span style={{
          background: 'rgba(37,99,255,0.08)',
          color: '#2563FF',
          fontSize: 10,
          fontFamily: 'Rajdhani, sans-serif',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          borderRadius: 999,
          padding: '4px 12px',
          border: '1px solid rgba(37,99,255,0.15)',
        }}>
          ELITE FEATURE
        </span>
        <Lock size={32} color="#2563FF" />
        <div style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          fontWeight: 900,
          fontSize: 22,
          color: '#0B1224',
          lineHeight: 1.1,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}>
          {title}
        </div>
        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 400,
          fontSize: 13,
          color: '#64748B',
          lineHeight: 1.6,
          margin: 0,
        }}>
          {description}
        </p>
        <a
          href="/#/checkout"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'linear-gradient(135deg, #2563FF, #5B3DF5)',
            color: '#fff',
            borderRadius: 8,
            padding: '10px 24px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: 14,
            textDecoration: 'none',
            width: '100%',
            boxSizing: 'border-box',
            boxShadow: '0 4px 12px rgba(37,99,255,0.3)',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          Upgrade to Elite →
        </a>
        <a
          href="https://esportselite.in/pricing"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            color: '#94A3B8',
            textDecoration: 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#64748B' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#94A3B8' }}
        >
          View Pricing
        </a>
      </div>
    </div>
  )
}
