import { Link } from 'react-router-dom'
import { Shield, ArrowRight } from 'lucide-react'

/**
 * Reusable "coming soon" page chrome used by /analytics and /progress.
 * Renders inside the Layout (sidebar + topbar stay visible).
 */
export default function ComingSoon({ title }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 page-transition">
      <div className="relative glass clip-corner p-8 sm:p-12 lg:p-16 max-w-xl w-full text-center overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-accent-primary opacity-[0.15] blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-accent-secondary opacity-[0.08] blur-[100px] pointer-events-none" />

        <div className="relative z-10">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-md bg-red-gradient flex items-center justify-center shadow-red-glow-lg">
              <Shield size={28} className="text-white" strokeWidth={2.5} />
            </div>
          </div>

          {title && (
            <p className="text-xs uppercase tracking-[0.25em] text-text-secondary heading mb-2">
              {title}
            </p>
          )}

          <h1
            className="text-gradient-red leading-none mb-5"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontWeight: 800,
              fontSize: 'clamp(40px, 8vw, 64px)',
              letterSpacing: '0.04em',
            }}
          >
            COMING SOON
          </h1>

          <p className="text-text-primary text-base sm:text-lg max-w-md mx-auto leading-relaxed">
            This feature is arriving in the next update.
          </p>
          <p className="text-text-secondary text-sm mt-2">
            Stay tuned. Keep grinding. <span className="text-gold">⚡</span>
          </p>

          <Link
            to="/dashboard"
            className="btn-red inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-md text-sm uppercase tracking-[0.1em]"
          >
            Back to Dashboard <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  )
}
