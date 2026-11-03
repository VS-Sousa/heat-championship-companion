/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        heat: {
          asphalt: '#0B0E14',
          carbon: '#151A24',
          steel: '#1E2636',
          red: '#E1221C',
          'red-hot': '#FF3B30',
          yellow: '#F5C518',
          cream: '#F7F1E3',
          chrome: '#C8D0DC',
          track: '#2A3344',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'Impact', 'sans-serif'],
        body: ['"Barlow Condensed"', 'Arial Narrow', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        dash: '0 0 0 1px rgba(245, 197, 24, 0.25), 0 12px 40px rgba(0,0,0,0.45)',
      },
      backgroundImage: {
        'checkered':
          'repeating-conic-gradient(#1a1a1a 0% 25%, #2a2a2a 0% 50%) 50% / 24px 24px',
        'speed-lines':
          'linear-gradient(105deg, transparent 40%, rgba(245,197,24,0.08) 50%, transparent 60%)',
      },
    },
  },
  plugins: [],
};
