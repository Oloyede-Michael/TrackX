/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        peach: { DEFAULT: '#FCEFB0', 50: '#FFFDF2', 100: '#FFF8D6', 200: '#FCEFB0', 300: '#F7E07E', 400: '#EBC93F' },
        brand: { DEFAULT: '#F5B800', dark: '#DBA300' },
        clay: { DEFAULT: '#8F6A00', dark: '#6B4F00', deep: '#3D2E00' },
        ink: '#17110E',
      },
      fontFamily: { sans: ['Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(61,46,0,.06), 0 8px 30px rgba(61,46,0,.07)' },
    },
  },
  plugins: [],
};
