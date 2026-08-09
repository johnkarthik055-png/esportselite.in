import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Menu, X, Target, BarChart2, Brain, Crosshair, Zap, Users,
  UserPlus, TrendingUp, ArrowRight, Star, Check, Gift,
  Instagram, MessageCircle,
} from 'lucide-react'
import {
  motion, AnimatePresence, useScroll, useInView,
} from 'framer-motion'
import {
  collection, collectionGroup, getCountFromServer,
  getDocs, query, where, addDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../utils/firebase.js'
import Reveal from '../components/motion/Reveal.jsx'
import { StaggerGroup, StaggerItem } from '../components/motion/Stagger.jsx'
import MagneticButton from '../components/motion/MagneticButton.jsx'
import PageTransition from '../components/motion/PageTransition.jsx'

const EASE = [0.16, 1, 0.3, 1]

const NAV_ITEMS = [
  { label: 'Features',     id: 'features' },
  { label: 'How it works', id: 'how-it-works' },
  { label: 'Pricing',      id: 'pricing' },
]

const FEATURES = [
  { icon: Target,    color: 'var(--blue)',  title: 'Practice Tracker', desc: 'Log every drill with timers. Track ADS, spray, close range across custom modules.' },
  { icon: BarChart2, color: 'var(--blue)',  title: 'Match Analytics',  desc: 'Log classic, scrims, and tournament matches. Track kills, positions, weaknesses.' },
  { icon: Brain,     color: 'var(--amber)', title: 'Coach AI',         desc: 'Smart suggestions based on your repeated weaknesses. Know what to practice next.' },
  { icon: Crosshair, color: 'var(--gold)',  title: 'Weakness Heatmap', desc: 'Visual skill bars show exactly where you need work. Color-coded, data-driven.' },
  { icon: Zap,       color: 'var(--green)', title: 'XP & Levels',      desc: 'Earn XP for every drill and match. Level up from Rookie to Elite across 7 tiers.' },
  { icon: Users,     color: 'var(--text-muted)', title: 'Squad Ready', desc: 'Team management, scrim scheduling, squad coordination — coming soon.' },
]

const STEPS = [
  { icon: UserPlus,   num: '01', title: 'Create account',    desc: 'Free 90-day access. No credit card required.' },
  { icon: Target,     num: '02', title: 'Start training',    desc: 'Pick a module, set your weapons, run the drill timer.' },
  { icon: TrendingUp, num: '03', title: 'Analyse & improve', desc: 'See your weaknesses, follow Coach AI tips, climb the ranks.' },
]

const TESTIMONIALS = [
  { quote: 'Finally a proper training tracker for BGMI. My spray control improved in 2 weeks.', name: 'ProSniper_X', tier: 'Competitive Player' },
  { quote: 'The weakness heatmap is insane. I never knew my close range was that weak.',       name: 'EliteGrinder99', tier: 'Solo Ranked' },
  { quote: 'Coach AI told me to focus on spray. My K/D went from 2.1 to 3.4.',                 name: 'BulletStorm_IN', tier: 'Squad Player' },
]

const PRICING_PERKS = [
  'All training modules',
  'Match logger',
  'Weakness heatmap',
  'Coach AI analysis',
  'XP & level system',
  'Cloud data sync',
]

function formatNum(n) {
  if (n >= 1000) {
    const k = n / 1000
    return (k >= 10 ? Math.round(k) : Math.round(k * 10) / 10) + 'K'
  }
  return String(Math.round(n))
}

function useCountUp(target, active, duration = 1500) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(eased * target)
      if (p < 1) raf = requestAnimationFrame(tick)
      else setVal(target)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, target, duration])
  return val
}

export default function Landing() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { scrollYProgress } = useScroll()

  const goLogin  = () => navigate('/login')
  const goSignup = () => navigate('/login', { state: { signup: true } })

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = useCallback((id) => {
    setMenuOpen(false)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <PageTransition>
      <div style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', overflowX: 'hidden' }}>
        {/* Scroll progress indicator */}
        <motion.div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0,
            height: 2,
            background: 'var(--red)',
            transformOrigin: '0%',
            scaleX: scrollYProgress,
            zIndex: 100,
          }}
        />

        <Navbar scrolled={scrolled} menuOpen={menuOpen} setMenuOpen={setMenuOpen} scrollTo={scrollTo} goLogin={goLogin} goSignup={goSignup} />
        <Hero goSignup={goSignup} scrollTo={scrollTo} />
        <StatsBar />
        <PartnersSection />
        <FeaturesSection />
        <HowItWorks />
        <Testimonials />
        <Pricing goSignup={goSignup} />
        <FinalCTA goSignup={goSignup} />
        <Footer scrollTo={scrollTo} goLogin={goLogin} goSignup={goSignup} />
      </div>
    </PageTransition>
  )
}

/* ============================================================
   NAVBAR — always visible, no reveal
   ============================================================ */
function Navbar({ scrolled, menuOpen, setMenuOpen, scrollTo, goLogin, goSignup }) {
  const [logoFailed, setLogoFailed] = useState(false)
  return (
    <nav
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: 64,
        background: scrolled ? 'rgba(10,10,15,0.90)' : 'rgba(10,10,15,0.5)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'background 0.25s, border-color 0.25s',
      }}
    >
      <div
        style={{
          maxWidth: 1200, margin: '0 auto', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px',
        }}
      >
        <button
          onClick={() => scrollTo('hero')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          {!logoFailed && (
            <img
              src="/assets/logo.png" alt=""
              style={{ width: 28, height: 28, objectFit: 'contain' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; setLogoFailed(true) }}
            />
          )}
          <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontWeight: 400, fontSize: 20, color: 'var(--text-primary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Esports Elite
          </span>
        </button>

        <div className="lg-flex" style={{ display: 'none', gap: 28, alignItems: 'center' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 13, fontWeight: 500,
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="lg-flex" style={{ display: 'none', gap: 10, alignItems: 'center' }}>
          <button onClick={goLogin} className="btn btn-secondary btn-sm">Login</button>
          <button onClick={goSignup} className="btn btn-primary btn-sm">Start Free</button>
        </div>

        <button
          onClick={() => setMenuOpen(v => !v)}
          className="mobile-menu-btn"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 8 }}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: EASE }}
            style={{
              background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', textAlign: 'left',
                  padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: 14,
                }}
              >
                {item.label}
              </button>
            ))}
            <button onClick={goLogin} className="btn btn-secondary" style={{ marginTop: 6 }}>Login</button>
            <button onClick={goSignup} className="btn btn-primary">Start Free</button>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (min-width: 768px) {
          .lg-flex { display: flex !important; }
          .mobile-menu-btn { display: none; }
          .mobile-menu { display: none; }
        }
      `}</style>
    </nav>
  )
}

/* ============================================================
   HERO — staggered entrance + cursor spotlight + magnetic CTA
   ============================================================ */
function Hero({ goSignup, scrollTo }) {
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50 })
  const heroRef = useRef(null)

  function handleMouseMove(e) {
    if (!heroRef.current) return
    const rect = heroRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setSpotlight({ x, y })
  }

  return (
    <section
      id="hero"
      ref={heroRef}
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        paddingTop: 80,
        paddingBottom: 60,
      }}
    >
      {/* Cursor spotlight (very subtle) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(600px circle at ${spotlight.x}% ${spotlight.y}%, rgba(232,0,28,0.06), transparent 70%)`,
          pointerEvents: 'none',
          transition: 'background 0.3s ease',
          zIndex: 0,
        }}
      />

      <StaggerGroup
        style={{
          position: 'relative', zIndex: 1, maxWidth: 1080, margin: '0 auto',
          padding: '0 20px', textAlign: 'center',
        }}
      >
        <StaggerItem>
          <span
            className="badge"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 22 }}
          >
            INDIA'S BGMI TRAINING PLATFORM
          </span>
        </StaggerItem>

        <StaggerItem>
          <h1
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontWeight: 400,
              fontSize: 'clamp(56px, 9vw, 96px)',
              lineHeight: 0.95,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Where Grind Becomes Greatness
          </h1>
        </StaggerItem>

        <StaggerItem>
          <p
            style={{
              fontFamily: 'DM Sans, sans-serif',
              fontWeight: 400,
              color: 'var(--text-muted)',
              fontSize: 17,
              lineHeight: 1.7,
              letterSpacing: '0.01em',
              maxWidth: 580,
              margin: '20px auto 0',
            }}
          >
            Stop grinding blind. Train with purpose. Track every drill, analyse every match, and improve like a professional BGMI team.
          </p>
        </StaggerItem>

        <StaggerItem>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
            <MagneticButton onClick={goSignup} className="btn btn-primary btn-lg">
              Start Free — 90 days <ArrowRight size={14} />
            </MagneticButton>
            <button onClick={() => scrollTo('how-it-works')} className="btn btn-secondary btn-lg">
              See how it works
            </button>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div
            style={{
              display: 'flex', gap: 18, justifyContent: 'center',
              marginTop: 22, fontSize: 12,
              color: 'var(--text-subtle)', flexWrap: 'wrap',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Check size={12} style={{ color: 'var(--green)' }} /> No credit card
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Check size={12} style={{ color: 'var(--green)' }} /> Free for 90 days
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Check size={12} style={{ color: 'var(--green)' }} /> Cancel anytime
            </span>
          </div>
        </StaggerItem>
      </StaggerGroup>
    </section>
  )
}

/* ============================================================
   STATS BAR
   ============================================================ */
const FALLBACK_STATS = { players: 500, drills: 10000, matches: 5000 }

function StatsBar() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px 0px' })
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function fetchCounts() {
      try {
        const [usersSnap, sessionsSnap, matchesSnap] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collectionGroup(db, 'sessions')),
          getCountFromServer(collectionGroup(db, 'matches')),
        ])
        if (cancelled) return
        setCounts({
          players: usersSnap.data().count,
          drills: sessionsSnap.data().count,
          matches: matchesSnap.data().count,
        })
      } catch {
        if (!cancelled) setCounts(FALLBACK_STATS)
      }
    }
    fetchCounts()
    return () => { cancelled = true }
  }, [])

  const ready = counts !== null
  const cells = [
    { value: counts?.drills ?? 0,  label: 'Sessions tracked' },
    { value: counts?.players ?? 0, label: 'Players' },
    { value: 90,                   label: 'Trial days', force: '90' },
    { value: 7,                    label: 'Levels',     force: '7'  },
  ]

  return (
    <Reveal direction="up">
      <section
        ref={ref}
        style={{
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          padding: '36px 20px',
        }}
      >
        <div
          style={{
            maxWidth: 1080, margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 24,
          }}
        >
          {cells.map(s => (
            <StatCell
              key={s.label}
              value={s.value}
              label={s.label}
              force={s.force}
              ready={ready}
              animate={inView && ready}
            />
          ))}
        </div>
      </section>
    </Reveal>
  )
}

function StatCell({ value, label, force, ready, animate }) {
  const animated = useCountUp(value, animate)
  const display = force ? force : ready ? formatNum(animate ? animated : value) : null
  return (
    <div style={{ textAlign: 'center' }}>
      {ready ? (
        <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontWeight: 400, fontSize: 36, letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
          {display}
        </span>
      ) : (
        <span className="skeleton" style={{ width: 80, height: 28, display: 'inline-block' }} />
      )}
      <div className="stat-label" style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{label}</div>
    </div>
  )
}

/* ============================================================
   PARTNERS & SPONSORS
   ============================================================ */
function PartnersSection() {
  return (
    <section
      id="partners"
      style={{
        padding: '72px 24px',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 48,
        }}
      >
        {/* Section heading */}
        <Reveal direction="up">
          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-subtle)',
                marginBottom: 12,
              }}
            >
              Partners &amp; Sponsors
            </p>
            <h2
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 'clamp(32px, 4vw, 48px)',
                fontWeight: 400,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--text-primary)',
                marginBottom: 12,
              }}
            >
              Trusted By The Best
            </h2>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                color: 'var(--text-muted)',
                maxWidth: 440,
                lineHeight: 1.6,
              }}
            >
              Esports Elite is proudly partnered with leading BGMI esports organisations.
            </p>
          </div>
        </Reveal>

        {/* Partners grid */}
        <Reveal direction="up" delay={0.15} style={{ width: '100%' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 20,
              width: '100%',
            }}
          >
            {/* Gods4Sun card */}
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 20,
                textAlign: 'center',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = 'var(--text-subtle)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = 'var(--border)')
              }
            >
              {/* Logo */}
              <div
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: 20,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  padding: 12,
                }}
              >
                <img
                  src="/assets/gods4sun-logo.png"
                  alt="Gods4Sun Esports"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>

              {/* Name + category */}
              <div>
                <p
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: 26,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--text-primary)',
                    marginBottom: 6,
                  }}
                >
                  Gods4Sun Esports
                </p>
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 999,
                    padding: '3px 10px',
                  }}
                >
                  Official Esports Partner
                </span>
              </div>

              {/* Quote */}
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  lineHeight: 1.65,
                  fontStyle: 'italic',
                  maxWidth: 260,
                }}
              >
                "The training structure Esports Elite provides is exactly what competitive BGMI players need."
              </p>

              {/* Attribution */}
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  color: 'var(--text-subtle)',
                }}
              >
                — Gods4Sun Esports Management
              </p>
            </div>

            {/* PLACEHOLDER card for future sponsors — always keep this */}
            <div
              style={{
                background: 'transparent',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                textAlign: 'center',
                minHeight: 280,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: 20,
                    color: 'var(--text-subtle)',
                  }}
                >
                  +
                </span>
              </div>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-subtle)',
                }}
              >
                Your Organisation Here
              </p>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  color: 'var(--text-subtle)',
                  maxWidth: 200,
                  lineHeight: 1.5,
                }}
              >
                Partner with Esports Elite to reach serious BGMI players
              </p>
              <a
                href="https://discord.gg/cdyXRcxsb"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textDecoration: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '6px 14px',
                  marginTop: 4,
                  display: 'inline-block',
                  transition: 'color 0.2s, border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)'
                  e.currentTarget.style.borderColor = 'var(--text-subtle)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                Get in touch →
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ============================================================
   FEATURES
   ============================================================ */
function FeaturesSection() {
  return (
    <section id="features" style={{ padding: '80px 20px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <Reveal>
          <h2
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontWeight: 400,
              fontSize: 'clamp(32px, 4vw, 52px)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              textAlign: 'center',
              marginBottom: 8,
              color: 'var(--text-primary)',
            }}
          >
            Everything you need to train like a pro
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, marginBottom: 40 }}>
            Six tools, one workflow, built for BGMI players.
          </p>
        </Reveal>

        <StaggerGroup
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {FEATURES.map(f => {
            const Icon = f.icon
            return (
              <StaggerItem key={f.title}>
                <FeatureCard f={f} Icon={Icon} />
              </StaggerItem>
            )
          })}
        </StaggerGroup>
      </div>
    </section>
  )
}

function FeatureCard({ f, Icon }) {
  return (
    <motion.article
      className="card"
      whileHover={{ y: -4, transition: { duration: 0.2, ease: EASE } }}
      style={{ height: '100%' }}
    >
      <div
        style={{
          width: 40, height: 40,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: f.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <Icon size={18} />
      </div>
      <h3
        style={{
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: 600,
          fontSize: 15,
          textTransform: 'none',
          letterSpacing: '0.01em',
          color: 'var(--text-primary)',
          marginBottom: 4,
        }}
      >
        {f.title}
      </h3>
      <p style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>{f.desc}</p>
    </motion.article>
  )
}

/* ============================================================
   HOW IT WORKS
   ============================================================ */
function HowItWorks() {
  return (
    <section
      id="how-it-works"
      style={{
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: '80px 20px',
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <Reveal>
          <h2
            style={{
              fontFamily: 'Bebas Neue, sans-serif', fontWeight: 400,
              fontSize: 'clamp(32px, 4vw, 52px)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              textAlign: 'center', marginBottom: 6,
              color: 'var(--text-primary)',
            }}
          >
            How it works
          </h2>
          <p style={{ fontFamily: 'DM Sans, sans-serif', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, marginBottom: 48 }}>
            Three steps. Then you're training like a pro.
          </p>
        </Reveal>

        <StaggerGroup
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 18,
          }}
        >
          {STEPS.map(step => {
            const Icon = step.icon
            return (
              <StaggerItem key={step.num}>
                <div className="card" style={{ height: '100%' }}>
                  <div
                    style={{
                      fontFamily: 'Bebas Neue, sans-serif',
                      fontWeight: 400,
                      fontSize: 64,
                      letterSpacing: '0.04em',
                      color: 'var(--border)',
                      marginBottom: 10,
                      lineHeight: 1,
                    }}
                  >
                    {step.num}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Icon size={16} style={{ color: 'var(--text-subtle)' }} />
                    <h3 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 16, textTransform: 'none', letterSpacing: '0.01em', color: 'var(--text-primary)' }}>
                      {step.title}
                    </h3>
                  </div>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>{step.desc}</p>
                </div>
              </StaggerItem>
            )
          })}
        </StaggerGroup>
      </div>
    </section>
  )
}

/* ============================================================
   TESTIMONIALS
   ============================================================ */
function Testimonials() {
  return (
    <section style={{ padding: '80px 20px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <Reveal>
          <h2
            style={{
              fontFamily: 'Bebas Neue, sans-serif', fontWeight: 400,
              fontSize: 'clamp(32px, 4vw, 52px)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              textAlign: 'center', marginBottom: 6,
              color: 'var(--text-primary)',
            }}
          >
            What players are saying
          </h2>
          <p style={{ fontFamily: 'DM Sans, sans-serif', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, marginBottom: 40 }}>
            Real results, from real BGMI grinders.
          </p>
        </Reveal>

        <StaggerGroup
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {TESTIMONIALS.map(t => (
            <StaggerItem key={t.name}>
              <div className="card" style={{ height: '100%' }}>
                <div style={{ display: 'flex', gap: 2, color: 'var(--gold)', marginBottom: 12 }}>
                  {[1,2,3,4,5].map(n => <Star key={n} size={14} fill="var(--gold)" />)}
                </div>
                <p style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
                  "{t.quote}"
                </p>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                  {t.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{t.tier}</div>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  )
}

/* ============================================================
   PRICING
   ============================================================ */
function Pricing({ goSignup }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null)
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  async function notifyMe() {
    const clean = email.trim().toLowerCase()
    if (!EMAIL_RE.test(clean)) { setStatus('error'); return }
    setStatus('loading')
    try {
      const existing = await getDocs(query(collection(db, 'waitlist'), where('email', '==', clean)))
      if (!existing.empty) { setStatus('dup'); return }
      await addDoc(collection(db, 'waitlist'), { email: clean, timestamp: serverTimestamp() })
      setStatus('success')
      setEmail('')
    } catch { setStatus('error') }
  }

  return (
    <section
      id="pricing"
      style={{
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: '80px 20px',
      }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <Reveal>
          <h2
            style={{
              fontFamily: 'Bebas Neue, sans-serif', fontWeight: 400,
              fontSize: 'clamp(32px, 4vw, 52px)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              textAlign: 'center', marginBottom: 6,
              color: 'var(--text-primary)',
            }}
          >
            Pricing
          </h2>
          <p style={{ fontFamily: 'DM Sans, sans-serif', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, marginBottom: 40 }}>
            Simple. Start free today.
          </p>
        </Reveal>

        <Reveal direction="up" duration={0.7}>
          <div
            style={{
              maxWidth: 400,
              margin: '0 auto',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderTop: '2px solid var(--red)',
              borderRadius: 'var(--radius-lg)',
              padding: 28,
            }}
          >
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 11,
                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
              }}
            >
              <Gift size={14} /> Free trial
            </div>
            <div
              style={{
                fontFamily: 'Bebas Neue, sans-serif', fontWeight: 400,
                fontSize: 52, letterSpacing: '0.04em',
                marginTop: 12, color: 'var(--text-primary)',
                lineHeight: 1,
              }}
            >
              ₹0
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              90 days. No credit card. Cancel anytime.
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PRICING_PERKS.map(p => (
                <li key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)' }}>
                  <Check size={14} style={{ color: 'var(--green)' }} /> {p}
                </li>
              ))}
            </ul>

            <MagneticButton onClick={goSignup} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              Start Free
            </MagneticButton>
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-subtle)', marginTop: 10 }}>
              ₹99/mo premium plan coming soon
            </div>
          </div>
        </Reveal>

        {/* Waitlist */}
        <Reveal>
          <div style={{ maxWidth: 480, margin: '40px auto 0', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
              Premium plans coming soon
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginBottom: 14 }}>
              Be the first to know.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (status) setStatus(null) }}
                placeholder="your@email.com"
                className="input"
                style={{ flex: 1, minWidth: 200 }}
              />
              <button onClick={notifyMe} disabled={status === 'loading'} className="btn btn-primary">
                {status === 'loading' ? 'Adding…' : 'Join'}
              </button>
            </div>
            {status === 'success' && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                <span className="badge badge-green">You're on the list</span>
              </div>
            )}
            {status === 'dup' && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                <span className="badge badge-amber">Already on the list</span>
              </div>
            )}
            {status === 'error' && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--red)' }}>
                Couldn't save your email. Try again.
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ============================================================
   FINAL CTA
   ============================================================ */
function FinalCTA({ goSignup }) {
  return (
    <Reveal>
      <section style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h2
          style={{
            fontFamily: 'Bebas Neue, sans-serif', fontWeight: 400,
            fontSize: 'clamp(32px, 4vw, 52px)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: 12,
            color: 'var(--text-primary)',
          }}
        >
          Ready to train like a pro?
        </h2>
        <p style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
          Free for 90 days. No credit card.
        </p>
        {/* Plain button — magnetic budget (2) already spent on hero + pricing CTAs. */}
        <button onClick={goSignup} className="btn btn-primary btn-lg">
          Start free — 90 days <ArrowRight size={14} />
        </button>
      </section>
    </Reveal>
  )
}

/* ============================================================
   FOOTER
   ============================================================ */
function Footer({ scrollTo, goLogin, goSignup }) {
  const [logoFailed, setLogoFailed] = useState(false)
  return (
    <Reveal direction="up" distance={16}>
      <footer
        style={{
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          padding: '40px 20px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 1080, margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 32,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!logoFailed && (
                <img
                  src="/assets/logo.png" alt=""
                  style={{ width: 20, height: 20, objectFit: 'contain' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; setLogoFailed(true) }}
                />
              )}
              <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontWeight: 400, fontSize: 16, color: 'var(--text-primary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Esports Elite
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 12, maxWidth: 240, lineHeight: 1.5 }}>
              Pro training platform for BGMI players. Train smart. Climb ranks.
            </p>
          </div>

          <FooterCol title="Product">
            <FooterBtn onClick={() => scrollTo('features')}>Features</FooterBtn>
            <FooterBtn onClick={() => scrollTo('how-it-works')}>How it works</FooterBtn>
            <FooterBtn onClick={() => scrollTo('pricing')}>Pricing</FooterBtn>
            <FooterBtn onClick={goLogin}>Login</FooterBtn>
            <FooterBtn onClick={goSignup}>Sign up</FooterBtn>
          </FooterCol>

          <FooterCol title="Support">
            <FooterLink href="/contact" internal>Contact us</FooterLink>
            <FooterLink href="/terms" internal>Terms of Service</FooterLink>
            <FooterLink href="/privacy" internal>Privacy Policy</FooterLink>
          </FooterCol>

          <FooterCol title="Connect">
            <FooterLink
              href="https://www.instagram.com/esportselite.in?igsh=dGtodHF0NWhmbGJv"
              external
            >
              <Instagram size={12} /> Instagram
            </FooterLink>
            <FooterLink
              href="https://discord.gg/cdyXRcxsb"
              external
            >
              <MessageCircle size={12} /> Discord
            </FooterLink>
          </FooterCol>
        </div>

        <div
          style={{
            maxWidth: 1080, margin: '32px auto 0',
            paddingTop: 18,
            borderTop: '1px solid var(--border)',
            textAlign: 'center',
            color: 'var(--text-subtle)',
            fontSize: 12,
          }}
        >
          © {new Date().getFullYear()} Esports Elite. All rights reserved.
        </div>
      </footer>
    </Reveal>
  )
}

function FooterCol({ title, children }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 12, color: 'var(--text-subtle)' }}>{title}</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </ul>
    </div>
  )
}

function FooterBtn({ onClick, children }) {
  return (
    <li>
      <button
        onClick={onClick}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 13, padding: 0,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        {children}
      </button>
    </li>
  )
}

function FooterLink({ href, external, internal, children }) {
  const linkStyle = {
    color: 'var(--text-muted)', fontSize: 13,
    display: 'inline-flex', alignItems: 'center', gap: 6,
    transition: 'color 0.15s',
  }
  const onEnter = (e) => (e.currentTarget.style.color = 'var(--text-primary)')
  const onLeave = (e) => (e.currentTarget.style.color = 'var(--text-muted)')

  if (internal) {
    return (
      <li>
        <Link
          to={href}
          style={linkStyle}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
        >
          {children}
        </Link>
      </li>
    )
  }

  return (
    <li>
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        style={linkStyle}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {children}
      </a>
    </li>
  )
}
