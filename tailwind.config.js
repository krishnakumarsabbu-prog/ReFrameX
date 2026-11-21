/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Accent: technical teal-blue
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
          bg: '#F2F6F9',
          panel: '#FFFFFF',
          border: '#D9E3EB',
        },
      },
      borderRadius: {
        bento: '24px',
        tile: '16px',
        workspace: '28px',
        pill: '999px',
      },
      backdropBlur: {
        glass: '18px',
        dense: '24px',
      },
      boxShadow: {
        glass: '0 14px 36px rgba(24, 52, 72, 0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
        float: '0 24px 60px rgba(24, 52, 72, 0.16), inset 0 1px 0 rgba(255,255,255,0.85)',
        ring: '0 0 0 1px rgb(255 255 255 / 0.6) inset',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
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
