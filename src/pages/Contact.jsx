import { useState } from 'react'
import { Instagram, MessageCircle, Mail, ArrowRight, Loader2, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import Reveal from '../components/motion/Reveal.jsx'
import { StaggerGroup, StaggerItem } from '../components/motion/Stagger.jsx'
import PageTransition from '../components/motion/PageTransition.jsx'
import { LegalTopBar } from './Privacy.jsx'

const EASE = [0.16, 1, 0.3, 1]

const DISCORD_URL = 'https://discord.gg/cdyXRcxsb'
const INSTAGRAM_URL = 'https://www.instagram.com/esportselite.in?igsh=dGtodHF0NWhmbGJv'
const SUPPORT_EMAIL = 'support@esportselite.in'

export default function Contact() {
  return (
    <PageTransition>
      <div
        style={{
          background: 'var(--bg-base)',
          minHeight: '100vh',
          color: 'var(--text-primary)',
        }}
      >
        <LegalTopBar />

        <main
          style={{
            maxWidth: 880,
            margin: '0 auto',
            padding: '60px 24px 80px',
          }}
        >
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
              Contact Us
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
              We usually respond within 24-48 hours.
            </p>
          </Reveal>

          <div
            style={{
              display: 'grid',
              gap: 24,
              gridTemplateColumns: '1fr',
            }}
            className="contact-grid"
          >
            {/* Left — channels (stagger reveal) */}
            <StaggerGroup style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <StaggerItem>
                <ChannelCard
                  icon={<MessageCircle size={18} style={{ color: 'var(--text-muted)' }} />}
                  title="Join our Discord"
                  description="Fastest way to reach us — community support and updates."
                  buttonLabel="Open Discord"
                  href={DISCORD_URL}
                />
              </StaggerItem>
              <StaggerItem>
                <ChannelCard
                  icon={<Instagram size={18} style={{ color: 'var(--text-muted)' }} />}
                  title="Follow on Instagram"
                  description="DM us or check our latest updates."
                  buttonLabel="Open Instagram"
                  href={INSTAGRAM_URL}
                />
              </StaggerItem>
              <StaggerItem>
                <ChannelCard
                  icon={<Mail size={18} style={{ color: 'var(--text-muted)' }} />}
                  title="Email us"
                  description={SUPPORT_EMAIL}
                  buttonLabel="Send email"
                  href={`mailto:${SUPPORT_EMAIL}`}
                  isMailto
                />
              </StaggerItem>
            </StaggerGroup>

            {/* Right — contact form (reveal from left) */}
            <Reveal direction="left">
              <ContactForm />
            </Reveal>
          </div>
        </main>

        <style>{`
          @media (min-width: 768px) {
            .contact-grid { grid-template-columns: 1fr 1fr !important; }
          }
        `}</style>
      </div>
    </PageTransition>
  )
}

function ChannelCard({ icon, title, description, buttonLabel, href, isMailto }) {
  return (
    <motion.div
      className="card"
      whileHover={{ y: -2, transition: { duration: 0.2, ease: EASE } }}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'DM Sans, sans-serif',
              fontWeight: 600,
              fontSize: 15,
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {description}
          </div>
        </div>
      </div>

      <div>
        <a
          href={href}
          target={isMailto ? undefined : '_blank'}
          rel={isMailto ? undefined : 'noopener noreferrer'}
          className="btn btn-secondary btn-sm"
          style={{ textDecoration: 'none' }}
        >
          {buttonLabel} <ArrowRight size={13} />
        </a>
      </div>
    </motion.div>
  )
}

function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [state, setState] = useState('idle')  // 'idle' | 'loading' | 'success'

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    message.trim().length > 0 &&
    state === 'idle'

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setState('loading')
    /* Simulated submit — wire to a real endpoint later. */
    setTimeout(() => {
      setState('success')
      setName(''); setEmail(''); setMessage('')
      setTimeout(() => setState('idle'), 1500)
    }, 700)
  }

  let buttonContent, buttonBg
  if (state === 'loading') {
    buttonContent = <><Loader2 size={14} className="animate-spin" /> Sending...</>
    buttonBg = 'var(--red)'
  } else if (state === 'success') {
    buttonContent = <><Check size={14} /> Sent!</>
    buttonBg = 'var(--green)'
  } else {
    buttonContent = 'Send Message'
    buttonBg = 'var(--red)'
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div
        style={{
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: 600,
          fontSize: 15,
          color: 'var(--text-primary)',
        }}
      >
        Send us a message
      </div>

      <Field label="Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="input-field"
          maxLength={80}
          disabled={state !== 'idle'}
        />
      </Field>

      <Field label="Email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="input-field"
          maxLength={120}
          disabled={state !== 'idle'}
        />
      </Field>

      <Field label="Message">
        <textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What can we help with?"
          className="input-field"
          style={{ resize: 'vertical', minHeight: 96 }}
          maxLength={1000}
          disabled={state !== 'idle'}
        />
      </Field>

      <motion.button
        type="submit"
        disabled={!canSubmit && state !== 'success'}
        className="btn btn-primary"
        animate={{ backgroundColor: buttonBg, borderColor: buttonBg }}
        transition={{ duration: 0.3, ease: EASE }}
        style={{ width: '100%' }}
      >
        {buttonContent}
      </motion.button>

      <style>{`
        .animate-spin { animation: ee-spin 0.9s linear infinite; }
        @keyframes ee-spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label" style={{ display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
