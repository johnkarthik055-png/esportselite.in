import { Shield } from 'lucide-react'

/**
 * Brand-styled loading screen shown while the auth session is being
 * restored on app boot.
 */
export default function SplashScreen() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg-primary relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
      <div className="absolute inset-0 bg-radial-red pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-accent-primary opacity-[0.08] blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-6 animate-fade-in">
        <div className="w-20 h-20 rounded-md bg-red-gradient flex items-center justify-center shadow-red-glow-lg logo-anim">
          <Shield size={42} className="text-white" strokeWidth={2.5} />
        </div>

        <div className="flex flex-col items-center">
          <span className="brand text-3xl text-white tracking-wider">ESPORTS ELITE</span>
          <span className="text-xs text-text-secondary uppercase tracking-[0.25em] mt-2">
            Pro Training Platform
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.18em] heading text-text-secondary">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-secondary animate-pulse-red" />
          Loading
        </div>
      </div>
    </div>
  )
}
