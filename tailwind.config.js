/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base:    '#07080f',
          raised:  '#0d0f1a',
          overlay: '#131629',
          border:  '#1e2333',
          subtle:  '#1a1d2e',
        },
        brand: {
          DEFAULT: '#6366f1',
          light:   '#818cf8',
          dark:    '#4f46e5',
          glow:    'rgba(99,102,241,0.18)',
        },
        success: {
          DEFAULT: '#10b981',
          light:   '#34d399',
          bg:      'rgba(16,185,129,0.12)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          light:   '#fbbf24',
          bg:      'rgba(245,158,11,0.12)',
        },
        danger: {
          DEFAULT: '#ef4444',
          light:   '#f87171',
          bg:      'rgba(239,68,68,0.12)',
        },
        c2c: {
          confirmed: '#10b981',
          likely:    '#6366f1',
          unclear:   '#f59e0b',
          w2only:    '#ef4444',
        },
      },
      boxShadow: {
        card:    '0 1px 3px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.3)',
        raised:  '0 4px 16px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.4)',
        glow:    '0 0 0 1px rgba(99,102,241,0.3), 0 0 24px rgba(99,102,241,0.18)',
        'glow-success': '0 0 0 1px rgba(16,185,129,0.3), 0 0 16px rgba(16,185,129,0.15)',
      },
      animation: {
        'slide-up':    'slideUp 0.2s ease-out',
        'fade-in':     'fadeIn 0.15s ease-out',
        'pulse-glow':  'pulseGlow 2s ease-in-out infinite',
        'shimmer':     'shimmer 1.5s infinite',
      },
      keyframes: {
        slideUp:    { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        fadeIn:     { from: { opacity: '0' }, to: { opacity: '1' } },
        pulseGlow:  { '0%,100%': { boxShadow: '0 0 0 1px rgba(99,102,241,0.2)' }, '50%': { boxShadow: '0 0 0 3px rgba(99,102,241,0.4)' } },
        shimmer:    { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
