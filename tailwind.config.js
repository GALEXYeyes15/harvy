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
        sidebar: "var(--color-sidebar)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        accent: "var(--color-accent)",
        // A plain `var()` can't take Tailwind's opacity modifier: `border-line/20` etc. generated
        // nothing and fell back to Tailwind's default gray border / blue ring. Mix instead.
        line: ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-line)"
            : `color-mix(in srgb, var(--color-line) calc(${opacityValue} * 100%), transparent)`,
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
