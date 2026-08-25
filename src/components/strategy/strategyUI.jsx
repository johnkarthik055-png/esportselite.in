/* Small shared UI primitives for the Strategy Maker panels — kept
   local to this subsystem rather than exporting new helpers out of
   MapKnowledge.jsx, so this rebuild doesn't ripple edits through a
   file that also drives View Map / Dev Editor. */

export const inputStyle = {
  width: '100%',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontFamily: 'DM Sans, sans-serif',
  fontSize: 12,
  padding: '6px 9px',
}

export function SectionLabel({ children, small }) {
  return (
    <div style={{
      fontFamily: 'DM Sans, sans-serif',
      fontSize: small ? 10 : 11,
      fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.10em',
      color: 'var(--text-subtle)',
      marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

export function SwatchButton({ active, color, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: 20, height: 20, borderRadius: '50%',
        background: color,
        border: `2px solid ${active ? '#fff' : 'transparent'}`,
        cursor: 'pointer', flexShrink: 0,
      }}
    />
  )
}
