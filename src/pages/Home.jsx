import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Menu,
  X,
  Target,
  BarChart3,
  Brain,
  Flame,
  TrendingUp,
  Users,
  Trophy,
  Zap,
  Shield,
  Lock,
  ArrowRight,
  Play,
  CheckCircle2,
  MessageCircle,
  Youtube,
  Instagram,
  Twitter,
} from 'lucide-react'

/* ============================================================
   ESPORTS ELITE — PUBLIC LANDING PAGE
   Route: /  (public, no auth). Logged-in users are bounced to
   /dashboard by the PublicRoute wrapper in App.jsx.
   ============================================================ */

const NAV_LINKS = [
  { label: 'HOME', id: 'hero' },
  { label: 'FEATURES', id: 'features' },
  { label: 'TOURNAMENTS', id: 'tournaments' },
  { label: 'LEADERBOARD', id: 'stats' },
  { label: 'ABOUT', id: 'how' },
]

const FEATURES = [
  {
    icon: Target,
    title: 'Practice Tracker',
    desc: 'Track every drill with timers, weapon selection, and performance history.',
  },
  {
    icon: BarChart3,
    title: 'Match Analytics',
    desc: 'Log Classic, Scrims and Tournament matches. Spot patterns in your gameplay.',
  },
  {
    icon: Brain,
    title: 'Coach AI',
    desc: 'Get personalised training suggestions based on your real match data.',
  },
  {
    icon: Flame,
    title: 'XP & Levels',
    desc: 'Earn XP for every session. Level up from Rookie to Elite rank.',
  },
  {
    icon: TrendingUp,
    title: 'Weakness Heatmap',
    desc: 'Visual breakdown of your skill gaps. Know exactly what to work on.',
  },
  {
    icon: Users,
    title: 'Squad Ready',
    desc: 'Track team performance, manage scrims and tournament data together.',
  },
]

const STEPS = [
  {
    icon: Lock,
    num: '1',
    title: 'Create Your Account',
    desc: 'Sign up free in 30 seconds. No credit card needed.',
  },
  {
    icon: Target,
    num: '2',
    title: 'Train & Log Matches',
    desc: 'Complete drills, log your matches every day.',
  },
  {
    icon: TrendingUp,
    num: '3',
    title: 'Analyse & Improve',
    desc: 'See your weaknesses, track progress, level up.',
  },
]

const TOURNAMENTS = [
  {
    name: 'ELITE SHOWDOWN',
    mode: 'Solo · TPP',
    date: 'Coming Soon',
    prize: '₹50,000',
    featured: false,
  },
  {
    name: 'WEEKEND BATTLES',
    mode: 'Squad · TPP',
    date: 'Coming Soon',
    prize: '₹1,00,000',
    featured: true,
  },
  {
    name: 'RISING WARRIORS',
    mode: 'Squad · FPP',
    date: 'Coming Soon',
    prize: '₹75,000',
    featured: false,
  },
]

const STATS = [
  { icon: Trophy, value: 2500, suffix: 'K+', display: '2.5K+', label: 'Drills Logged' },
  { icon: Users, value: 10000, suffix: 'K+', display: '10K+', label: 'Active Players' },
  { icon: BarChart3, value: 50000, suffix: 'K+', display: '50K+', label: 'Matches Tracked' },
  { icon: Zap, value: 500, suffix: '+', display: '500+', label: 'Teams Training' },
]

/* ============================================================
   COUNT-UP HOOK — animates to a display string when visible
   ============================================================ */
function useCountUp(target, display, active, duration = 1600) {
  const [text, setText] = useState('0')
  useEffect(() => {
    if (!active) return
    let raf
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      const current = Math.floor(eased * target)
      if (p >= 1) {
        setText(display)
      } else {
        // Render an in-progress number that roughly matches the final scale.
        if (display.includes('K')) {
          setText((current / 1000).toFixed(1) + 'K')
        } else {
          setText(String(current))
        }
        raf = requestAnimationFrame(tick)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, target, display, duration])
  return text
}

/* ============================================================
   INTERSECTION HOOK — fires once when element scrolls into view
   ============================================================ */
function useInView(options = { threshold: 0.2 }) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true)
        obs.unobserve(el)
      }
    }, options)
    obs.observe(el)
    return () => obs.disconnect()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])
  return [ref, inView]
}

/* ============================================================
   TOAST
   ============================================================ */
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="toast-container">
      <div className="toast-item flex items-center gap-2">
        <Zap size={16} /> {message}
      </div>
    </div>
  )
}

/* ============================================================
   FLOATING STAT CARD (hero)
   ============================================================ */
function FloatCard({ children, className = '', delay = '0s' }) {
  return (
    <div
      className={`glass-strong rounded-xl px-4 py-3 text-sm font-semibold shadow-red-glow ${className}`}
      style={{ animation: 'eeFloat 3s ease-in-out infinite', animationDelay: delay }}
    >
      {children}
    </div>
  )
}

/* ============================================================
   SOLDIER + SHIELD VISUAL (inline SVG fallback)
   ============================================================ */
function HeroVisual() {
  return (
    <div className="relative w-full h-full flex items-center justify-center min-h-[420px]">
      {/* Pulsing shield glow behind soldier */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ animation: 'eePulseGlow 3s ease-in-out infinite' }}
      >
        <Shield size={300} className="text-accent-primary/20" strokeWidth={1} />
      </div>

      {/* EE wordmark inside shield */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[58%] text-7xl font-extrabold text-accent-primary/30 brand select-none">
        EE
      </div>

      {/* Soldier silhouette */}
      <svg
        viewBox="0 0 240 360"
        className="relative z-10 h-[380px] w-auto drop-shadow-[0_0_40px_rgba(232,0,28,0.35)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="soldier" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2A2A38" />
            <stop offset="100%" stopColor="#0A0A0F" />
          </linearGradient>
        </defs>
        <g fill="url(#soldier)" stroke="#E8001C" strokeOpacity="0.35" strokeWidth="1.5">
          {/* Helmet */}
          <path d="M88 40 q32 -26 64 0 q6 18 -6 30 l-52 0 q-12 -12 -6 -30 Z" />
          {/* Visor */}
          <rect x="96" y="58" width="48" height="14" rx="4" fill="#E8001C" fillOpacity="0.25" />
          {/* Neck */}
          <rect x="108" y="80" width="24" height="16" />
          {/* Torso / vest */}
          <path d="M78 96 q42 -14 84 0 l8 96 q-50 16 -100 0 Z" />
          {/* Chest plate detail */}
          <rect x="104" y="118" width="32" height="44" rx="4" fill="#0A0A0F" />
          {/* Left arm */}
          <path d="M78 100 q-22 8 -26 60 l18 6 q10 -40 22 -54 Z" />
          {/* Right arm holding weapon */}
          <path d="M162 100 q22 8 26 56 l-18 8 q-10 -38 -22 -52 Z" />
          {/* Legs */}
          <path d="M92 192 q14 6 28 0 l-2 110 -24 0 Z" />
          <path d="M148 192 q-14 6 -28 0 l2 110 24 0 Z" />
          {/* Boots */}
          <rect x="90" y="300" width="30" height="20" rx="3" />
          <rect x="120" y="300" width="30" height="20" rx="3" />
        </g>
        {/* Weapon */}
        <g stroke="#E8001C" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round">
          <line x1="150" y1="150" x2="220" y2="135" />
          <line x1="170" y1="146" x2="172" y2="166" />
        </g>
      </svg>
    </div>
  )
}

/* ============================================================
   RED PARTICLES (CSS only)
   ============================================================ */
function Particles({ count = 20 }) {
  const dots = Array.from({ length: count }, (_, i) => {
    const left = Math.random() * 100
    const size = 2 + Math.random() * 4
    const dur = 6 + Math.random() * 8
    const delay = Math.random() * 8
    return (
      <span
        key={i}
        className="absolute rounded-full bg-accent-primary/60"
        style={{
          left: `${left}%`,
          bottom: '-10px',
          width: `${size}px`,
          height: `${size}px`,
          animation: `eeParticle ${dur}s linear infinite`,
          animationDelay: `${delay}s`,
        }}
      />
    )
  })
  return <div className="absolute inset-0 overflow-hidden pointer-events-none">{dots}</div>
}

/* ============================================================
   MAIN
   ============================================================ */
export default function Home() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('hero')
  const [toast, setToast] = useState(null)

  const goLogin = () => navigate('/login')
  const goSignup = () => navigate('/login', { state: { signup: true } })

  /* Navbar blur on scroll + active-section tracking */
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20)
      const ids = NAV_LINKS.map((l) => l.id)
      let current = 'hero'
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= 120) current = id
      }
      setActiveSection(current)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = useCallback((id) => {
    setMenuOpen(false)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const comingSoon = () => setToast('Coming soon! Tournaments launching in Phase 4.')

  /* Section reveal refs */
  const [statsRef, statsInView] = useInView()
  const [featRef, featInView] = useInView({ threshold: 0.1 })

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary overflow-x-hidden">
      {/* ============ KEYFRAMES (scoped) ============ */}
      <style>{`
        @keyframes eeFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes eePulseGlow {
          0%, 100% { filter: drop-shadow(0 0 30px rgba(232,0,28,0.35)); opacity: 0.9; }
          50% { filter: drop-shadow(0 0 70px rgba(232,0,28,0.7)); opacity: 1; }
        }
        @keyframes eeParticle {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0.8; }
          100% { transform: translateY(-110vh) scale(0.4); opacity: 0; }
        }
        @keyframes eeFadeUp {
          0% { opacity: 0; transform: translateY(24px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes eeFadeRight {
          0% { opacity: 0; transform: translateX(40px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .ee-fade-up { opacity: 0; animation: eeFadeUp 0.6s ease-out forwards; }
        .ee-fade-right { opacity: 0; animation: eeFadeRight 0.8s ease-out 0.2s forwards; }
        .ee-reveal { opacity: 0; }
        .ee-reveal.in { animation: eeFadeUp 0.6s ease-out forwards; }
      `}</style>

      {/* ============================================================
          NAVBAR
          ============================================================ */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 h-16 border-b transition-all duration-300 ${
          scrolled
            ? 'bg-bg-primary/80 backdrop-blur-sm border-border'
            : 'bg-bg-primary border-border/60'
        }`}
      >
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          {/* Logo */}
          <button onClick={() => scrollTo('hero')} className="flex items-center shrink-0">
            <img
              src="/assets/logo.png"
              alt="Esports Elite"
              className="w-[120px] h-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextSibling.style.display = 'inline'
              }}
            />
            <span className="hidden brand text-xl font-extrabold tracking-wide">
              ESPORTS <span className="text-accent-primary">ELITE</span>
            </span>
          </button>

          {/* Center nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className={`px-3 py-2 text-sm font-semibold tracking-wide transition-colors ${
                  activeSection === link.id
                    ? 'text-accent-secondary nav-active'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Right buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button onClick={goLogin} className="btn-outline px-5 py-2 rounded-md text-sm">
              Login
            </button>
            <button onClick={goSignup} className="btn-red px-5 py-2 rounded-md text-sm">
              Sign Up
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-text-primary p-2"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-bg-surface border-b border-border dropdown-in">
            <div className="px-4 py-4 flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className={`text-left px-3 py-3 rounded-md text-sm font-semibold tracking-wide ${
                    activeSection === link.id
                      ? 'text-accent-secondary bg-accent-primary/10'
                      : 'text-text-secondary hover:bg-bg-elevated'
                  }`}
                >
                  {link.label}
                </button>
              ))}
              <div className="flex gap-3 mt-3">
                <button onClick={goLogin} className="btn-outline flex-1 py-2.5 rounded-md text-sm">
                  Login
                </button>
                <button onClick={goSignup} className="btn-red flex-1 py-2.5 rounded-md text-sm">
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ============================================================
          HERO
          ============================================================ */}
      <section
        id="hero"
        className="relative min-h-screen flex items-center bg-radial-red bg-scanlines pt-16"
      >
        <div className="bg-radial-red-tr absolute inset-0" />
        <div className="relative max-w-7xl mx-auto w-full px-4 sm:px-6 py-12 grid lg:grid-cols-2 gap-12 items-center z-10">
          {/* Left content */}
          <div>
            <div
              className="pill pill-red ee-fade-up inline-flex"
              style={{ animationDelay: '0s' }}
            >
              <Zap size={14} /> INDIA'S #1 BGMI TRAINING PLATFORM
            </div>

            <h1
              className="mt-6 brand font-extrabold leading-[0.95] text-5xl sm:text-6xl ee-fade-up"
              style={{ animationDelay: '0.12s' }}
            >
              COMPETE.
              <br />
              CONQUER.
              <br />
              BE <span className="text-accent-primary">ELITE.</span>
            </h1>

            <p
              className="mt-6 text-base text-text-secondary max-w-md ee-fade-up"
              style={{ animationDelay: '0.24s' }}
            >
              Join the elite community of BGMI players. Train smarter, track your
              progress, and become a legend.
            </p>

            <div
              className="mt-8 flex flex-col sm:flex-row gap-4 ee-fade-up"
              style={{ animationDelay: '0.36s' }}
            >
              <button
                onClick={goSignup}
                className="btn-red px-7 py-3.5 rounded-md text-base flex items-center justify-center gap-2"
              >
                Get Started Free <ArrowRight size={18} />
              </button>
              <button
                onClick={() => scrollTo('how')}
                className="btn-outline px-7 py-3.5 rounded-md text-base flex items-center justify-center gap-2 !text-text-primary !border-border hover:!border-accent-primary"
              >
                <Play size={18} /> Watch How It Works
              </button>
            </div>

            <div
              className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary ee-fade-up"
              style={{ animationDelay: '0.48s' }}
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-success" /> Free 90-day trial
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-success" /> No credit card needed
              </span>
            </div>
          </div>

          {/* Right visual */}
          <div className="relative ee-fade-right">
            <HeroVisual />

            {/* Floating stat cards */}
            <FloatCard className="absolute top-4 right-0 sm:right-6" delay="0s">
              <span className="text-accent-secondary">🔥</span> 12 Day Streak
            </FloatCard>
            <FloatCard className="absolute bottom-16 left-0 sm:left-2" delay="1s">
              <span className="text-gold">🎯</span> Level 4 — Veteran
            </FloatCard>
            <FloatCard className="absolute bottom-2 right-2 sm:right-10" delay="2s">
              <span className="text-success">📊</span> 85% Consistency
            </FloatCard>
          </div>
        </div>
      </section>

      {/* ============================================================
          STATS BAR
          ============================================================ */}
      <section id="stats" ref={statsRef} className="bg-bg-surface border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
            {STATS.map((stat, i) => (
              <StatItem key={stat.label} stat={stat} active={statsInView} />
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          FEATURES
          ============================================================ */}
      <section id="features" ref={featRef} className="bg-bg-primary py-24 bg-grid">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="brand text-4xl font-extrabold">
              WHY CHOOSE <span className="text-accent-primary">ESPORTS ELITE?</span>
            </h2>
            <p className="mt-4 text-text-secondary">
              Everything a competitive BGMI player needs in one platform.
            </p>
          </div>

          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className={`group bg-bg-surface border border-border rounded-xl p-6 border-l-2 hover:border-l-accent-primary hover:-translate-y-1 transition-all duration-200 ${
                    featInView ? 'ee-reveal in' : 'ee-reveal'
                  }`}
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="w-12 h-12 rounded-lg bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center text-accent-primary">
                    <Icon size={24} />
                  </div>
                  <h3 className="mt-5 text-lg font-bold">{f.title}</h3>
                  <p className="mt-2 text-sm text-text-secondary leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============================================================
          HOW IT WORKS
          ============================================================ */}
      <section id="how" className="bg-bg-surface py-24 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center">
            <h2 className="brand text-4xl font-extrabold">HOW IT WORKS</h2>
          </div>

          <div className="mt-16 relative grid md:grid-cols-3 gap-12 md:gap-6">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-9 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-accent-primary/60 via-accent-primary/30 to-accent-primary/60" />

            {STEPS.map((step) => {
              const Icon = step.icon
              return (
                <div key={step.num} className="relative text-center flex flex-col items-center">
                  {/* Number circle */}
                  <div className="relative z-10 w-[72px] h-[72px] rounded-full bg-bg-primary border-2 border-accent-primary flex items-center justify-center shadow-red-glow">
                    <span className="brand text-2xl font-extrabold text-accent-primary">
                      {step.num}
                    </span>
                  </div>
                  <div className="mt-6 w-12 h-12 rounded-lg bg-accent-primary/10 flex items-center justify-center text-accent-secondary">
                    <Icon size={24} />
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm text-text-secondary max-w-[240px]">{step.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============================================================
          TOURNAMENTS
          ============================================================ */}
      <section id="tournaments" className="bg-bg-primary py-24 bg-radial-red">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="brand text-4xl font-extrabold">
              UPCOMING <span className="text-accent-primary">TOURNAMENTS</span>
            </h2>
            <p className="mt-4 text-text-secondary">Compete with the best. Win prizes.</p>
          </div>

          <div className="mt-14 grid md:grid-cols-3 gap-6 items-stretch">
            {TOURNAMENTS.map((t) => (
              <div
                key={t.name}
                className={`relative rounded-xl border overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 ${
                  t.featured
                    ? 'border-accent-primary/60 shadow-red-glow md:-mt-4 md:mb-4'
                    : 'border-border'
                }`}
                style={{
                  background: t.featured
                    ? 'linear-gradient(160deg, #1A0008, #111118 60%)'
                    : 'linear-gradient(160deg, #15151d, #0A0A0F 70%)',
                }}
              >
                {/* Coming soon badge */}
                <span className="absolute top-4 right-4 pill pill-red text-xs">Coming Soon</span>

                <div className="p-7 flex flex-col flex-1">
                  {t.featured && (
                    <span className="inline-flex w-fit items-center gap-1 text-xs font-bold text-gold mb-3">
                      <Trophy size={14} /> FEATURED
                    </span>
                  )}
                  <h3 className="brand text-2xl font-extrabold pr-24">{t.name}</h3>
                  <div className="mt-4 space-y-2 text-sm text-text-secondary">
                    <p>
                      Mode: <span className="text-text-primary font-semibold">{t.mode}</span>
                    </p>
                    <p>
                      Date: <span className="text-text-primary font-semibold">{t.date}</span>
                    </p>
                  </div>
                  <div className="mt-6">
                    <p className="text-xs text-text-secondary uppercase tracking-wider">
                      Prize Pool
                    </p>
                    <p className="brand text-3xl font-extrabold text-accent-primary mt-1">
                      {t.prize}
                    </p>
                  </div>
                  <button
                    onClick={comingSoon}
                    className="btn-red mt-7 w-full py-3 rounded-md text-sm opacity-70 cursor-not-allowed"
                  >
                    Register Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          CTA BANNER
          ============================================================ */}
      <section
        className="relative overflow-hidden py-20"
        style={{ background: 'linear-gradient(135deg, #1A0005, #2D0008)' }}
      >
        <Particles count={20} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 items-center z-10">
          <div>
            <h2 className="brand text-5xl sm:text-6xl font-extrabold leading-[0.95]">
              THINK YOU HAVE
              <br />
              WHAT IT TAKES?
            </h2>
            <p className="mt-5 text-lg text-text-secondary max-w-md">
              Join thousands of warriors and become the next champion!
            </p>
            <button
              onClick={goSignup}
              className="btn-red mt-8 px-8 py-4 rounded-md text-base inline-flex items-center gap-2"
            >
              Join The Elite <ArrowRight size={18} />
            </button>
          </div>

          {/* Trophy + soldier illustration */}
          <div className="hidden lg:flex justify-center items-center relative min-h-[260px]">
            <Trophy
              size={200}
              className="text-gold drop-shadow-[0_0_40px_rgba(255,215,0,0.4)]"
              strokeWidth={1.2}
              style={{ animation: 'eeFloat 4s ease-in-out infinite' }}
            />
            <Shield
              size={120}
              className="absolute right-10 bottom-6 text-accent-primary/40"
              strokeWidth={1.2}
            />
          </div>
        </div>
      </section>

      {/* ============================================================
          FOOTER
          ============================================================ */}
      <footer className="bg-bg-primary border-t border-border pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <img
                src="/assets/logo.png"
                alt="Esports Elite"
                className="w-[130px] h-auto"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.nextSibling.style.display = 'inline'
                }}
              />
              <span className="hidden brand text-lg font-extrabold">
                ESPORTS <span className="text-accent-primary">ELITE</span>
              </span>
              <p className="mt-4 text-sm text-text-secondary max-w-xs">
                India's #1 BGMI Training Platform.
              </p>
              <div className="flex gap-3 mt-5">
                {[MessageCircle, Youtube, Instagram, Twitter].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    className="w-9 h-9 rounded-lg bg-bg-surface border border-border flex items-center justify-center text-text-secondary hover:text-accent-secondary hover:border-accent-primary transition-colors"
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            </div>

            {/* Company */}
            <FooterCol
              title="Company"
              links={['About Us', 'Careers', 'Contact Us']}
            />
            {/* Community */}
            <FooterCol title="Community" links={['Discord', 'YouTube', 'Instagram']} />
            {/* Support */}
            <FooterCol
              title="Support"
              links={['Help Center', 'Terms of Service', 'Privacy Policy']}
            />
          </div>

          <div className="mt-14 pt-6 border-t border-border text-center">
            <p className="text-sm text-text-secondary">
              © 2025 Esports Elite. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}

/* ============================================================
   SUB-COMPONENTS
   ============================================================ */
function StatItem({ stat, active }) {
  const Icon = stat.icon
  const text = useCountUp(stat.value, stat.display, active)
  return (
    <div className="flex flex-col items-center text-center px-4">
      <Icon size={28} className="text-accent-primary" />
      <span className="brand text-3xl font-extrabold mt-3">{text}</span>
      <span className="text-xs text-text-secondary uppercase tracking-wider mt-1">
        {stat.label}
      </span>
    </div>
  )
}

function FooterCol({ title, links }) {
  return (
    <div>
      <h4 className="text-sm font-bold uppercase tracking-wider text-text-primary">{title}</h4>
      <ul className="mt-4 space-y-3">
        {links.map((l) => (
          <li key={l}>
            <a
              href="#"
              className="text-sm text-text-secondary hover:text-accent-secondary link-underline"
            >
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
