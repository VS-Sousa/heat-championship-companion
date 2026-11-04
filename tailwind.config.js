/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        heat: {
          bg: 'rgb(var(--heat-bg) / <alpha-value>)',
          surface: 'rgb(var(--heat-surface) / <alpha-value>)',
          panel: 'rgb(var(--heat-panel) / <alpha-value>)',
          steel: 'rgb(var(--heat-steel) / <alpha-value>)',
          ink: 'rgb(var(--heat-ink) / <alpha-value>)',
          muted: 'rgb(var(--heat-muted) / <alpha-value>)',
          red: 'rgb(var(--heat-red) / <alpha-value>)',
          'red-hot': 'rgb(var(--heat-red-hot) / <alpha-value>)',
          yellow: 'rgb(var(--heat-yellow) / <alpha-value>)',
          orange: 'rgb(var(--heat-orange) / <alpha-value>)',
          navy: 'rgb(var(--heat-navy) / <alpha-value>)',
          border: 'rgb(var(--heat-border) / var(--heat-border-a))',
          // legacy aliases used across templates
          asphalt: 'rgb(var(--heat-bg) / <alpha-value>)',
          carbon: 'rgb(var(--heat-surface) / <alpha-value>)',
          cream: 'rgb(var(--heat-ink) / <alpha-value>)',
          chrome: 'rgb(var(--heat-muted) / <alpha-value>)',
          track: 'rgb(var(--heat-navy) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'Impact', 'sans-serif'],
        body: ['"Barlow Condensed"', 'Arial Narrow', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        dash: 'var(--heat-shadow)',
        tape: '0 2px 0 rgba(0,0,0,0.08), 0 10px 28px rgba(0,0,0,0.12)',
      },
      backgroundImage: {
        checkered:
          'repeating-conic-gradient(var(--heat-check-a) 0% 25%, var(--heat-check-b) 0% 50%) 50% / 22px 22px',
        'speed-lines':
          'linear-gradient(105deg, transparent 40%, var(--heat-speed) 50%, transparent 60%)',
      },
    },
  },
  plugins: [],
};
