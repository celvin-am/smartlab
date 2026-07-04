/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#1e3a8a',
        'primary-light': '#3b82f6',
        'primary-dark': '#1e40af',
      }
    },
  },
  plugins: [],
}
