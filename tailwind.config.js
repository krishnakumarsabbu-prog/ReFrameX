/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // SoftGlass Pro Design System Palette Tokens
        canvas: {
          DEFAULT: '#E9EAEC',
          secondary: '#F1F2F3',
          subtle: '#F6F7F8',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          card: '#FAFAFA',
          subtle: '#F1F2F3',
          elevated: '#FFFFFF',
          page: '#E9EAEC',
        },
        charcoal: {
          DEFAULT: '#202124',
          hover: '#333538',
          active: '#17181A',
          border: '#333538',
          text: '#FFFFFF',
          muted: '#777D83',
        },
        ink: {
          DEFAULT: '#202124',     // Primary typography
          primary: '#202124',
          secondary: '#777D83',   // Secondary typography
          muted: '#A0A4A8',       // Muted typography, overlines, hints
          soft: '#B5B9BD',
        },
        lime: {
          DEFAULT: '#C5F45A',     // Primary accent
          hover: '#B5E944',
          soft: '#F4FDE3',
          subtle: 'rgba(197, 244, 90, 0.2)',
          tint: 'rgba(197, 244, 90, 0.12)',
        },
        accent: {
          DEFAULT: '#C5F45A',     // SoftGlass Pro Lime Accent
          hover: '#B5E944',
          soft: '#F4FDE3',
          dark: '#202124',
          ring: 'rgba(197, 244, 90, 0.35)',
        },
        border: {
          DEFAULT: '#E3E5E7',
          subtle: '#E3E5E7',
          strong: '#CBD5E1',
          divider: '#E3E5E7',
        },
        line: {
          DEFAULT: '#E3E5E7',
          subtle: '#E3E5E7',
          strong: '#CBD5E1',
          divider: '#E3E5E7',
        },

        // Semantic: 4 Evidence Classifications (Restrained, subtle tints)
        ev: {
          verified: {
            text: '#166534',
            bg: '#F0FDF4',
            border: '#DCFCE7',
          },
          inferred: {
            text: '#374151',
            bg: '#F3F4F6',
            border: '#E5E7EB',
          },
          assumed: {
            text: '#92400E',
            bg: '#FEFCE8',
            border: '#FEF08A',
          },
          unknown: {
            text: '#5B21B6',
            bg: '#F5F3FF',
            border: '#DDD6FE',
          },
        },

        // Semantic: Decision Measures (Restrained)
        complexity: {
          low: '#777D83',
          med: '#D97706',
          high: '#DC2626',
        },
        readiness: {
          ready: {
            text: '#166534',
            bg: '#F0FDF4',
            border: '#DCFCE7',
          },
          partial: {
            text: '#92400E',
            bg: '#FEFCE8',
            border: '#FEF08A',
          },
          not: {
            text: '#991B1B',
            bg: '#FEF2F2',
            border: '#FECACA',
          },
        },

        // Backwards compatibility mappings for older token references
        obsidian: {
          DEFAULT: '#202124',
          hover: '#333538',
          active: '#17181A',
          border: '#E3E5E7',
          text: '#FFFFFF',
          muted: '#777D83',
        },
        porcelain: {
          canvas: '#E9EAEC',
          surface: '#FAFAFA',
          subtle: '#F1F2F3',
          divider: '#E3E5E7',
          border: '#E3E5E7',
          strong: '#CBD5E1',
        },
        indigo: {
          DEFAULT: '#202124',
          hover: '#333538',
          soft: '#F1F2F3',
          subtle: '#20212415',
        },
        teal: {
          DEFAULT: '#0F766E',
          hover: '#115E59',
          soft: '#F0FDFA',
        },
        bronze: {
          DEFAULT: '#92400E',
          hover: '#78350F',
          soft: '#FEFCE8',
        },
        navy: {
          DEFAULT: '#202124',
          soft: '#333538',
        },
        brand: {
          blue: '#202124',
          deep: '#17181A',
          light: '#F1F2F3',
          hover: '#333538',
        },
        success: {
          DEFAULT: '#166534',
          bg: '#F0FDF4',
          text: '#166534',
        },
        warning: {
          DEFAULT: '#92400E',
          bg: '#FEFCE8',
          text: '#92400E',
        },
        danger: {
          DEFAULT: '#991B1B',
          bg: '#FEF2F2',
          text: '#991B1B',
        },
        severity: {
          high: '#DC2626',
          medium: '#D97706',
          low: '#166534',
          info: '#4B5563',
        },
        evidence: {
          based: '#166534',
          inferred: '#374151',
          assumed: '#92400E',
          unknown: '#5B21B6',
        },
        solid: {
          bg: '#E9EAEC',
          panel: '#FAFAFA',
          border: '#E3E5E7',
        },
      },
      borderRadius: {
        bento: '18px',
        card: '18px',
        tile: '12px',
        workspace: '18px',
        control: '10px',
        pill: '9999px',
      },
      boxShadow: {
        card: '0 4px 16px rgba(25, 30, 35, 0.04)',
        elevated: '0 8px 24px rgba(25, 30, 35, 0.06)',
        float: '0 12px 32px rgba(25, 30, 35, 0.08)',
        micro: '0 1px 3px rgba(25, 30, 35, 0.04)',
        subtle: '0 2px 8px rgba(25, 30, 35, 0.04)',
        glass: '0 4px 16px rgba(25, 30, 35, 0.04)',
        ring: '0 0 0 1px #E3E5E7 inset',
        obsidian: '0 12px 32px rgba(25, 30, 35, 0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
      },
    },
  },
  plugins: [],
};
