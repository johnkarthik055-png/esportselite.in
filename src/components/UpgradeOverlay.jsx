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
      background: 'rgba(5,8,22,0.85)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 'inherit',
    }}>
      <div style={{
        background: '#0A0F1C',
        border: '1px solid #3B82F6',
        borderRadius: 16,
        padding: 32,
        textAlign: 'center',
        maxWidth: 380,
        width: '90%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        boxShadow: '0 0 40px rgba(59,130,246,0.15)',
      }}>
        <span style={{
          background: 'rgba(59,130,246,0.12)',
          color: '#3B82F6',
          fontSize: 10,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          borderRadius: 999,
          padding: '4px 12px',
          border: '1px solid rgba(59,130,246,0.3)',
        }}>
          ELITE FEATURE
        </span>
        <Lock size={36} color="#3B82F6" />
        <div style={{
          fontFamily: 'Oxanium, sans-serif',
          fontWeight: 700,
          fontSize: 24,
          color: '#F8FAFC',
          lineHeight: 1.1,
        }}>
          {title}
        </div>
        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 400,
          fontSize: 14,
          color: '#94A3B8',
          lineHeight: 1.6,
          margin: 0,
        }}>
          {description}
        </p>
        <a
          href="/#/checkout"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: '#3B82F6',
            color: '#fff',
            borderRadius: 8,
            padding: '12px 24px',
            fontFamily: 'Oxanium, sans-serif',
            fontWeight: 600,
            fontSize: 14,
            textDecoration: 'none',
            letterSpacing: '0.03em',
            width: '100%',
            boxSizing: 'border-box',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#2563EB' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#3B82F6' }}
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
            color: '#64748B',
            textDecoration: 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#94A3B8' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#64748B' }}
        >
          View Pricing
        </a>
      </div>
    </div>
  )
}
