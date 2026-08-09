import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Reveal from '../components/motion/Reveal.jsx'
import PageTransition from '../components/motion/PageTransition.jsx'

const LAST_UPDATED = 'June 2026'

const SECTIONS = [
  { id: 'collect',  title: '1. Information We Collect',
    body: 'We collect account information (email, username), gameplay data you log (training sessions, match stats, weapons used), and basic usage analytics that help us understand how the platform is used. We do not collect payment information as the platform is currently free.' },
  { id: 'use',      title: '2. How We Use Your Information',
    body: 'We use your data to provide and improve the training platform, calculate XP, levels, and streaks, generate Coach AI suggestions based on your own logged data, and communicate service updates that affect your account.' },
  { id: 'storage',  title: '3. Data Storage',
    body: 'Data is stored securely using Google Firebase (Firestore) with industry-standard security practices. We do not sell or share your personal data with third parties for marketing purposes.' },
  { id: 'rights',   title: '4. Your Rights',
    body: 'You can export your data anytime from your Profile page. You can request account deletion by contacting us through the Contact page or our Discord/Instagram links in the footer.' },
  { id: 'cookies',  title: '5. Cookies & Local Storage',
    body: 'We use browser local storage to keep you signed in and store preferences such as theme settings. No third-party tracking cookies are used.' },
  { id: 'children', title: "6. Children's Privacy",
    body: 'This service is not directed at children under 13. We do not knowingly collect data from children under 13. If you believe a child has provided us data, please contact us so we can remove it.' },
  { id: 'changes',  title: '7. Changes to This Policy',
    body: 'We may update this policy periodically. The "Last updated" date at the top of this page will reflect the most recent revision. Continued use of the platform after changes constitutes acceptance.' },
  { id: 'contact',  title: '8. Contact Us',
    contact: true },
]

export default function Privacy() {
  return (
    <PageTransition>
      <div style={{ background: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)' }}>
        <LegalTopBar />
        <LegalLayout
          title="Privacy Policy"
          subtitle={`Last updated: ${LAST_UPDATED}`}
          sections={SECTIONS}
        />
      </div>
    </PageTransition>
  )
}

/* ============================================================
   SHARED LEGAL LAYOUT (used by Privacy + Terms via inline copy)
   ============================================================ */

export function LegalLayout({ title, subtitle, sections }) {
  const [activeId, setActiveId] = useState(sections[0]?.id)
  const refsMap = useRef({})

  /* IntersectionObserver to track active section in viewport */
  useEffect(() => {
    const observers = []
    sections.forEach(s => {
      const el = refsMap.current[s.id]
      if (!el) return
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) setActiveId(s.id)
          })
        },
        { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach(o => o.disconnect())
  }, [sections])

  function jumpTo(id) {
    const el = refsMap.current[id]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main
      className="legal-grid"
      style={{
        maxWidth: 920,
        margin: '0 auto',
        padding: '60px 24px 80px',
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 40,
      }}
    >
      <div>
        <Reveal>
          <h1
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontWeight: 400,
              fontSize: 48,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 13,
              color: 'var(--text-subtle)',
              marginTop: 8,
              marginBottom: 40,
            }}
          >
            {subtitle}
          </p>
        </Reveal>

        {sections.map((section, index) => (
          <Reveal key={section.id} delay={Math.min(index * 0.05, 0.3)}>
            <section
              ref={(el) => { refsMap.current[section.id] = el }}
              id={section.id}
              style={{ marginBottom: 32, scrollMarginTop: 84 }}
            >
              <h2
                style={{
                  fontFamily: 'Bebas Neue, sans-serif',
                  fontWeight: 400,
                  fontSize: 24,
                  color: 'var(--text-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 12,
                }}
              >
                {section.title}
              </h2>
              {section.contact ? (
                <p
                  style={{
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 14,
                    color: 'var(--text-muted)',
                    lineHeight: 1.75,
                    margin: 0,
                  }}
                >
                  For questions, reach us via the{' '}
                  <InlineLink to="/contact">Contact page</InlineLink> or our
                  Discord and Instagram channels listed in the footer.
                </p>
              ) : (
                <p
                  style={{
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 14,
                    color: 'var(--text-muted)',
                    lineHeight: 1.75,
                    margin: 0,
                  }}
                >
                  {section.body}
                </p>
              )}
            </section>
          </Reveal>
        ))}
      </div>

      {/* TOC sidebar — desktop only */}
      <aside className="legal-toc">
        <nav
          style={{
            position: 'sticky',
            top: 84,
            paddingLeft: 12,
            borderLeft: '1px solid var(--border)',
          }}
        >
          <div className="label" style={{ marginBottom: 12 }}>On this page</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sections.map(s => {
              const active = s.id === activeId
              return (
                <li key={s.id}>
                  <button
                    onClick={() => jumpTo(s.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 0 4px 10px',
                      borderLeft: `2px solid ${active ? 'var(--red)' : 'transparent'}`,
                      marginLeft: -14,
                      color: active ? 'var(--text-primary)' : 'var(--text-subtle)',
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: 13,
                      textAlign: 'left',
                      lineHeight: 1.4,
                      transition: 'color 0.2s, border-color 0.2s',
                      width: '100%',
                    }}
                  >
                    {s.title}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      <style>{`
        @media (min-width: 900px) {
          .legal-grid {
            grid-template-columns: minmax(0, 680px) 200px !important;
          }
        }
        @media (max-width: 899px) {
          .legal-toc { display: none; }
        }
      `}</style>
    </main>
  )
}

export function LegalTopBar() {
  const [logoFailed, setLogoFailed] = useState(false)
  return (
    <header
      style={{
        height: 64,
        background: 'rgba(10,10,15,0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Link
        to="/"
        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
      >
        {!logoFailed && (
          <img
            src="/assets/logo.png"
            alt=""
            style={{ width: 24, height: 24, objectFit: 'contain' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; setLogoFailed(true) }}
          />
        )}
        <span
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontWeight: 400,
            fontSize: 16,
            color: 'var(--red)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Esports Elite
        </span>
      </Link>

      <Link
        to="/"
        style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-muted)', transition: 'color 0.15s' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        ← Back to home
      </Link>
    </header>
  )
}

export function InlineLink({ to, children }) {
  return (
    <Link
      to={to}
      style={{
        color: 'var(--text-primary)',
        textDecoration: 'underline',
        textDecorationColor: 'var(--text-subtle)',
        textUnderlineOffset: 2,
      }}
    >
      {children}
    </Link>
  )
}
