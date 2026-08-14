/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* V2 space-navy design tokens */
        bg:           '#050816',
        sidebar:      '#08101F',
        'header-bg':  '#0B1224',
        card:         '#0D1528',
        card2:        '#101A30',
        border:       '#1B2A45',
        divider:      '#243553',
        blue:         '#3B82F6',
        'blue-bright':'#2563EB',
        cyan:         '#22D3EE',
        violet:       '#7C3AED',
        ivory:        '#F8FAFC',
        light:        '#CBD5E1',
        muted:        '#94A3B8',
        success:      '#22C55E',
        warning:      '#F59E0B',

        /* Legacy back-compat: old class names → new colours */
        red: {
          DEFAULT: '#3B82F6',
          hover:   '#2563EB',
          tint:    'rgba(59,130,246,0.10)',
          ghost:   'rgba(59,130,246,0.06)',
        },
        green:  '#22C55E',
        amber:  '#F59E0B',
        gold:   '#F59E0B',

        bg_primary:  '#050816',
        bg_surface:  '#0D1528',
        bg_elevated: '#101A30',

        /* Old token names still used in some components */
        base:    '#050816',
        surface: '#0D1528',
        elevated:'#101A30',
        line:    '#1B2A45',

        /* Text token aliases */
        text: {
          primary:   '#F8FAFC',
          secondary: '#CBD5E1',
          muted:     '#94A3B8',
        },

        /* accent aliases (used by some legacy components) */
        accent: {
          primary:   '#3B82F6',
          secondary: '#3B82F6',
        },
      },

      fontFamily: {
        heading: ['Oxanium', 'sans-serif'],
        display: ['Oxanium', 'sans-serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"Share Tech Mono"', 'monospace'],
      },

      borderRadius: {
        DEFAULT: '8px',
        md:  '10px',
        lg:  '12px',
        xl:  '16px',
      },

      backgroundImage: {
        'red-gradient':      'linear-gradient(135deg,#2563EB 0%,#3B82F6 100%)',
        'red-gradient-soft': 'linear-gradient(135deg,#2563EB 0%,#3B82F6 100%)',
      },

      boxShadow: {
        modal:        '0 24px 48px rgba(0,0,0,0.7)',
        'red-glow':   '0 0 20px rgba(59,130,246,0.3)',
        'red-glow-lg':'0 0 40px rgba(59,130,246,0.4)',
        'gold-glow':  '0 0 20px rgba(245,158,11,0.3)',
        'blue-glow':  '0 0 20px rgba(59,130,246,0.4)',
      },

      animation: {
        'fade-in':  'fadeIn 0.22s ease-out',
        'slide-in': 'slideIn 0.22s ease-out',
      },

      keyframes: {
        fadeIn:  { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideIn: {
          '0%':   { transform: 'translateY(8px)', opacity: 0 },
          '100%': { transform: 'translateY(0)',   opacity: 1 },
        },
      },
    },
  },
  plugins: [],
}
