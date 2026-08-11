/**
 * MaintenancePage.jsx
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
        background: '#0C0C12',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: '24px',
        zIndex: 9999,
        overflow: 'hidden',
        fontFamily: "'Bebas Neue', sans-serif",
        textAlign: 'center',
      }}
    >
      {/* Keyframes for the looping red bottom bar */}
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
          background: #E8001C;
          box-shadow: 0 0 12px rgba(232, 0, 28, 0.6);
          animation: maintenance-bar 2.4s linear infinite;
        }
        .maintenance-logo {
          width: 120px;
          height: auto;
          filter: drop-shadow(0 0 18px rgba(232, 0, 28, 0.55))
                  drop-shadow(0 0 36px rgba(232, 0, 28, 0.35));
        }
      `}</style>

      {/* Brand logo with red glow */}
      <img
        src="/assets/logo.png"
        alt="Esports Elite"
        className="maintenance-logo"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />

      {/* Maintenance icon */}
      <div
        style={{
          fontSize: '48px',
          lineHeight: 1,
          marginTop: '28px',
        }}
        aria-hidden="true"
      >
        🔧
      </div>

      {/* Heading */}
      <h1
        style={{
          marginTop: '20px',
          marginBottom: 0,
          fontFamily: "'Bebas Neue', sans-serif",
          fontWeight: 800,
          color: '#E8001C',
          fontSize: '28px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        Under Maintenance
      </h1>

      {/* Subtext */}
      <p
        style={{
          marginTop: '14px',
          marginBottom: 0,
          fontFamily: "'Bebas Neue', sans-serif",
          fontWeight: 400,
          color: '#E8E8F0',
          fontSize: '15px',
          maxWidth: '520px',
          lineHeight: 1.5,
        }}
      >
        We are upgrading Esports Elite to serve you better.
      </p>

      {/* Optional custom message from Firestore */}
      {message ? (
        <p
          style={{
            marginTop: '12px',
            marginBottom: 0,
            fontFamily: "'Bebas Neue', sans-serif",
            fontWeight: 400,
            color: '#7777AA',
            fontSize: '13px',
            maxWidth: '520px',
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
      ) : null}

      {/* Reassurance line */}
      <p
        style={{
          marginTop: '20px',
          marginBottom: 0,
          fontFamily: "'Bebas Neue', sans-serif",
          fontWeight: 600,
          color: '#E8E8F0',
          fontSize: '14px',
        }}
      >
        We will be back soon. Keep grinding! ⚡
      </p>

      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: "'Bebas Neue', sans-serif",
          fontWeight: 400,
          color: '#3E3E55',
          fontSize: '12px',
          letterSpacing: '0.05em',
        }}
      >
        © 2025 Esports Elite
      </div>

      {/* Animated red sliding bar at the bottom */}
      <div className="maintenance-bar" aria-hidden="true" />
    </div>
  )
}
