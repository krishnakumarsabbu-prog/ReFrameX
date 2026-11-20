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
          DEFAULT: '#1B1B20',
          muted: '#5A5A64',
          soft: '#8A8A93',
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
        pill: '999px',
      },
      backdropBlur: {
        glass: '30px',
        dense: '40px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(60, 40, 20, 0.10), 0 2px 8px rgba(60, 40, 20, 0.06)',
        float: '0 12px 40px rgba(60, 40, 20, 0.14), 0 4px 12px rgba(60, 40, 20, 0.08)',
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
