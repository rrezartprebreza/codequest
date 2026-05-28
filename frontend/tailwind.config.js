/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
      },
      colors: {
        bg: {
          0: '#0A0C10',
          1: '#11141B',
          2: '#161A22',
          3: '#1C212B',
        },
        ink: {
          DEFAULT: '#EAEEF5',
          muted:   '#8B95A7',
          subtle:  '#5A6478',
        },
        accent:  '#12E8B0',
        success: '#12E8B0',
        warning: '#F5A623',
        danger:  '#FF5C72',
        info:    '#4FBEFF',
      },
    },
  },
  plugins: [],
};
