/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-ui)", "ui-sans-serif", "system-ui", "sans-serif"],
        content: ["var(--font-content)", "Georgia", "serif"],
      },
      colors: {
        canvas: "var(--color-canvas)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        line: "var(--color-line)",
        panel: "var(--color-panel)",
        stage: "var(--color-stage)",
        mist: "var(--color-mist)",
        page: "var(--color-page)",
        focus: "var(--color-focus-ring)",
      },
    },
  },
  plugins: [],
};
