/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Accent: warm coral-orange
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb))',
          soft: 'rgb(var(--accent-rgb) / 0.16)',
          ring: 'rgb(var(--accent-rgb) / 0.35)',
        },
        // Severity / evidence classes
        severity: {
          high: '#E04A3A',
          medium: '#E0A23A',
          low: '#3AAE6B',
          info: '#3A8AE0',
        },
        evidence: {
          based: '#3AAE6B',
          inferred: '#E0A23A',
          assumed: '#B084D6',
          unknown: '#9A9AA0',
        },
        // Ink / text
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
          soft: 'var(--ink-soft)',
        },
        // Glass surfaces
        glass: {
          bg: 'rgb(255 255 255 / var(--glass-opacity))',
          border: 'rgb(255 255 255 / var(--glass-border-opacity))',
          hover: 'rgb(255 255 255 / calc(var(--glass-opacity) + 0.06))',
        },
        // Solid surfaces (reduce-transparency mode + dense views)
        solid: {
          bg: '#F4F1EE',
          panel: '#FFFFFF',
          border: '#E2DED8',
        },
      },
      borderRadius: {
        bento: '28px',
        tile: '20px',
        workspace: '44px',
        pill: '999px',
      },
      backdropBlur: {
        glass: '44px',
        dense: '40px',
      },
      boxShadow: {
        glass: '0 20px 50px rgba(40, 25, 10, 0.18), inset 0 1px 0 rgba(255,255,255,0.45)',
        float: '0 24px 60px rgba(40, 25, 10, 0.22), inset 0 1px 0 rgba(255,255,255,0.55)',
        ring: '0 0 0 1px rgb(255 255 255 / 0.6) inset',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      transitionDuration: {
        '200': '200ms',
      },
    },
  },
  plugins: [],
};
