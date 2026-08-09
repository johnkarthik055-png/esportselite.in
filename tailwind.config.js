/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* New design tokens (preferred) */
        base: '#0E0E12',
        surface: '#16161E',
        elevated: '#1E1E28',
        line: '#2A2A36',

        red: {
          DEFAULT: '#E8001C',
          hover: '#FF2D44',
          tint: '#2A0A0D',
          ghost: 'rgba(232,0,28,0.12)',
        },
        green: '#00C96E',
        amber: '#F59E0B',
        blue: '#4A9EFF',
        gold: '#FFD700',

        /* Back-compat token names referenced by legacy components.
           Mapped to the new palette so the old class strings render
           in the new look without code changes. */
        bg: {
          primary: '#0E0E12',
          surface: '#16161E',
          elevated: '#1E1E28',
        },
        accent: {
          primary: '#E8001C',
          secondary: '#E8001C',
        },
        text: {
          primary: '#E2E2EC',
          secondary: '#9898B0',
          muted: '#4A4A5A',
        },
        border: '#2A2A36',
        success: '#00C96E',
        warning: '#F59E0B',
      },
      fontFamily: {
        display: ['"Oxanium"', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
      },
      backgroundImage: {
        /* Kept as flat colour fallbacks — no gradients per design rules */
        'red-gradient': 'none',
        'red-gradient-soft': 'none',
      },
      boxShadow: {
        modal: '0 24px 48px rgba(0,0,0,0.5)',
        /* Legacy aliases neutralized */
        'red-glow': 'none',
        'red-glow-lg': 'none',
        'gold-glow': 'none',
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
