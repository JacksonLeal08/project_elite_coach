/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--color-primary)",
          dim: "var(--color-primary-dim)",
        },
        surface: {
          DEFAULT: "var(--color-surface)",
          container: "var(--color-surface-container)",
          high: "var(--color-surface-high)",
          highest: "var(--color-surface-highest)",
        }
      },
      fontFamily: {
        sans: ["var(--font-family-body)", "sans-serif"],
        title: ["var(--font-family-title)", "sans-serif"],
      }
    },
  },
  plugins: [],
}
