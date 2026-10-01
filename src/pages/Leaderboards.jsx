import { motion } from 'framer-motion'
import { Award } from 'lucide-react'

export default function Leaderboards() {
  return (
    <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Standard Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: 'linear-gradient(135deg, #F7F9FD 0%, #EEF4FF 60%, #FFF0F2 100%)',
          borderRadius: 16, padding: 32, position: 'relative', overflow: 'hidden', marginBottom: 24,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(37,99,255,0.06) 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: -60, left: -60, width: 300, height: 300, background: 'radial-gradient(circle, rgba(37,99,255,0.1) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: -40, right: -40, width: 250, height: 250, background: 'radial-gradient(circle, rgba(239,51,64,0.07) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 11, color: '#2563FF', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Rankings</div>
          <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 48, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1, margin: 0 }}>Leaderboards</h1>
          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: 64, height: 3, background: 'linear-gradient(90deg,#2563FF,#EF3340)', transformOrigin: 'left', borderRadius: 2, marginTop: 12, marginBottom: 12 }}
          />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#64748B', margin: 0 }}>See where you stand among all players.</p>
        </div>
      </motion.div>

      {/* Coming soon */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 20, textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: '#EEF4FF',
          border: '1px solid #E5EAF3',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Award size={30} style={{ color: '#2563FF' }} />
        </div>
        <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: 26, color: '#0B1224', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Coming Soon</h2>
        <p style={{ fontFamily: 'Inter, sans-serif', color: '#475569', fontSize: 14, maxWidth: 360, margin: 0, lineHeight: 1.6 }}>
          Ranked leaderboards are coming soon. Your match data is already being tracked — standings will appear here once the feature launches.
        </p>
        <span style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Coming soon</span>
      </div>
    </div>
  )
}
