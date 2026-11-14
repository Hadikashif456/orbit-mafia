/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          900: '#070b19',
          800: '#0d1527',
          700: '#141f38',
        },
      },
    },
  },
  plugins: [],
}
