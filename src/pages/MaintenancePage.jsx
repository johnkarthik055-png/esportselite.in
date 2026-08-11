/**
 * MaintenancePage.jsx — v2 luxury gold theme.
 *
 * Full-screen lockout shown when Firestore's
 *   app_config/maintenance { isActive: true }
 * flag is on. App.jsx subscribes to that document via onSnapshot and
 * swaps the entire router for this page in real time — no rebuild,
 * no client refresh required.
 *
 * The optional `message` prop is the custom string admins can set
 * from the Firebase Console alongside the boolean.
 */

export default function MaintenancePage({ message = '' }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0A0A0A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: '24px',
        zIndex: 9999,
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
        textAlign: 'center',
      }}
    >
      {/* Gold sliding bar at the bottom — replaces the old red bar,
          zero glow per v2 rules. */}
      <style>{`
        @keyframes maintenance-bar {
          0%   { left: -40%; }
          100% { left: 100%; }
        }
        .maintenance-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          height: 3px;
          width: 40%;
          background: #C9A227;
          animation: maintenance-bar 2.4s linear infinite;
        }
        .maintenance-logo {
          width: 120px;
          height: auto;
        }
      `}</style>

      <img
        src="/assets/logo.png"
        alt="Esports Elite"
        className="maintenance-logo"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />

      <div
        style={{
          fontSize: '48px',
          lineHeight: 1,
          marginTop: '28px',
          color: '#C9A227',
        }}
        aria-hidden="true"
      >
        🔧
      </div>

      <h1
        style={{
          marginTop: '20px',
          marginBottom: 0,
          fontFamily: "'Oxanium', sans-serif",
          fontWeight: 700,
          color: '#C9A227',
          fontSize: '28px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        Under Maintenance
      </h1>

      <p
        style={{
          marginTop: '14px',
          marginBottom: 0,
          fontFamily: "'Inter', sans-serif",
          fontWeight: 400,
          color: '#FAFAF9',
          fontSize: '15px',
          maxWidth: '520px',
          lineHeight: 1.55,
        }}
      >
        We are upgrading Esports Elite to serve you better.
      </p>

      {message ? (
        <p
          style={{
            marginTop: '12px',
            marginBottom: 0,
            fontFamily: "'Inter', sans-serif",
            fontWeight: 400,
            color: '#A1A1AA',
            fontSize: '13px',
            maxWidth: '520px',
            lineHeight: 1.55,
          }}
        >
          {message}
        </p>
      ) : null}

      <p
        style={{
          marginTop: '20px',
          marginBottom: 0,
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          color: '#FAFAF9',
          fontSize: '14px',
        }}
      >
        We will be back soon. Keep grinding.
      </p>

      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 400,
          color: '#71717A',
          fontSize: '11px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        © 2026 Esports Elite
      </div>

      <div className="maintenance-bar" aria-hidden="true" />
    </div>
  )
}
