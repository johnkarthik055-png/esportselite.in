/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ==============================================================
           V2 — Luxury Performance System
           Primary palette; every other token below is a back-compat
           alias so existing className strings keep rendering, just in
           the new gold theme.
           ============================================================== */
        obsidian:    '#0A0A0A',
        graphite:    '#121212',
        card:        '#18181B',
        border:      '#27272A',
        gold:        '#C9A227',
        'gold-soft': '#E5C76B',
        ivory:       '#FAFAF9',
        muted:       '#A1A1AA',
        success:     '#10B981',
        warning:     '#F59E0B',
        danger:      '#EF4444',

        /* Legacy structural tokens remapped onto the v2 palette. */
        base:     '#0A0A0A',
        surface:  '#121212',
        elevated: '#18181B',
        line:     '#27272A',

        /* "red" was the old primary brand. Point every red-* variant
           at gold so existing red-branded UI adopts the new theme
           without touching each className. True error red lives on
           the `danger` token. */
        red: {
          DEFAULT: '#C9A227',
          hover:   '#E5C76B',
          tint:    '#1F1808',
          ghost:   'rgba(201, 162, 39, 0.12)',
        },
        green: '#10B981',
        amber: '#F59E0B',
        blue:  '#3B82F6',

        bg: {
          primary:  '#0A0A0A',
          surface:  '#121212',
          elevated: '#18181B',
        },
        accent: {
          primary:   '#C9A227',
          secondary: '#C9A227',
        },
        text: {
          primary:   '#FAFAF9',
          secondary: '#A1A1AA',
          muted:     '#71717A',
        },
      },
      fontFamily: {
        /* Oxanium is the v2 heading face; Inter is the body face.
           Bebas Neue / DM Sans remain here as fallbacks so any
           un-migrated inline `fontFamily: 'Bebas Neue, …'` reference
           still resolves to a loaded font (see index.css @import). */
        display: ['"Oxanium"', '"Bebas Neue"', 'sans-serif'],
        body:    ['"Inter"',   '"DM Sans"',   'system-ui', 'sans-serif'],
        mono:    ['"Share Tech Mono"', 'monospace'],
      },
      borderRadius: {
        /* v2 shape rules: 8px cards, 6px inputs, 4px pills. */
        DEFAULT: '8px',
        sm:  '6px',
        md:  '8px',
        lg:  '10px',
        xl:  '12px',
      },
      backgroundImage: {
        /* v2: zero gradients on cards or backgrounds. Neutralised
           legacy aliases so accidental usages fall back to flat. */
        'red-gradient':      'none',
        'red-gradient-soft': 'none',
      },
      boxShadow: {
        modal: '0 24px 48px rgba(0, 0, 0, 0.6)',
        /* v2: zero glows anywhere. */
        'red-glow':    'none',
        'red-glow-lg': 'none',
        'gold-glow':   'none',
      },
      animation: {
        'fade-in':  'fadeIn 0.22s ease-out',
        'slide-in': 'slideIn 0.22s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideIn: {
          '0%':   { transform: 'translateY(8px)', opacity: 0 },
          '100%': { transform: 'translateY(0)',   opacity: 1 },
        },
      },
    },
  },
  plugins: [],
}
