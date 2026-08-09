import PageTransition from '../components/motion/PageTransition.jsx'
import { LegalLayout, LegalTopBar } from './Privacy.jsx'

const LAST_UPDATED = 'June 2026'

const SECTIONS = [
  { id: 'acceptance', title: '1. Acceptance of Terms',
    body: 'By creating an account and using Esports Elite, you agree to these terms. If you disagree with any part of these terms, do not use the platform.' },
  { id: 'service', title: '2. Service Description',
    body: 'Esports Elite is a training and analytics platform for BGMI (Battlegrounds Mobile India) players, offering drill tracking, match logging, weakness analysis, and AI-assisted coaching suggestions. We are an independent third-party tool and are not affiliated with, endorsed by, or sponsored by Krafton or PUBG Mobile / BGMI.' },
  { id: 'account', title: '3. Account Responsibilities',
    body: "You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. You must provide accurate information when creating an account and keep it up to date." },
  { id: 'trial', title: '4. Free Trial & Future Pricing',
    body: 'New accounts receive a 90-day free trial with full feature access. Paid plans may be introduced in the future; existing users will be notified in advance of any pricing changes affecting their account.' },
  { id: 'usage', title: '5. Acceptable Use',
    body: "You agree not to misuse the platform, attempt to access other users' data, reverse-engineer the application, or use it for any unlawful purpose. We reserve the right to investigate and take appropriate action against any violation." },
  { id: 'data', title: '6. Data You Provide',
    body: 'Match stats, drill logs, and performance data you enter are self-reported and used solely to power your personal dashboard and Coach AI suggestions. We do not verify the accuracy of self-reported gameplay data.' },
  { id: 'availability', title: '7. Service Availability',
    body: 'We aim for high uptime but do not guarantee uninterrupted service. Scheduled maintenance will be communicated where possible via the in-app maintenance banner.' },
  { id: 'liability', title: '8. Limitation of Liability',
    body: 'Esports Elite is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from use of the platform, including but not limited to in-game performance outcomes.' },
  { id: 'termination', title: '9. Termination',
    body: 'We reserve the right to suspend or terminate accounts that violate these terms or engage in abusive behaviour. You may also delete your account at any time by contacting us.' },
  { id: 'law', title: '10. Governing Law',
    body: 'These terms are governed by the laws of India. Any disputes will be subject to the exclusive jurisdiction of the courts of India.' },
  { id: 'contact', title: '11. Contact Us',
    contact: true },
]

export default function Terms() {
  return (
    <PageTransition>
      <div style={{ background: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)' }}>
        <LegalTopBar />
        <LegalLayout
          title="Terms of Service"
          subtitle={`Last updated: ${LAST_UPDATED}`}
          sections={SECTIONS}
        />
      </div>
    </PageTransition>
  )
}
