/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        vendly: {
          deep: '#173F2B',
          cream: '#F7F0D8',
          green: '#386B4B',
          light: '#FFFDF5',
          ink: '#243329',
          muted: '#5C6B60',
          border: '#DFE3D2',
          tint: '#EEF1E4',
        },
        // Compatibility tokens kept so existing component code resolves to the
        // approved palette while the interface is migrated to `vendly-*`.
        spark: {
          void: '#F7F0D8',
          dark: '#FFFDF5',
          surface: '#FFFDF5',
          elevated: '#EEF1E4',
          border: '#DFE3D2',
          'border-light': '#C9D2BC',
          primary: '#173F2B',
          'primary-light': '#386B4B',
          'primary-glow': 'rgba(23, 63, 43, 0.16)',
          electric: '#386B4B',
          'electric-light': '#5C6B60',
          success: '#173F2B',
          error: '#243329',
          warning: '#5C6B60',
          'text-primary': '#243329',
          'text-secondary': '#5C6B60',
          'text-muted': '#5C6B60',
        },
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-xl': ['4rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'display-sm': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
      },
      boxShadow: {
        card: '0 2px 0 rgba(36, 51, 41, 0.04)',
        'card-lg': '0 18px 48px rgba(23, 63, 43, 0.10)',
        glass: '0 8px 32px rgba(23, 63, 43, 0.08)',
        'glass-lg': '0 16px 48px rgba(23, 63, 43, 0.14)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
    },
  },
  plugins: [],
};
