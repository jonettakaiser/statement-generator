import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#faf9f6",
        ink: "#1c1a17",
        accent: {
          DEFAULT: "#2f5d50",
          light: "#e7efe9",
        },
        rust: "#b5542a",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,26,23,0.06), 0 1px 12px rgba(28,26,23,0.05)",
      },
    },
  },
  plugins: [],
}

export default config
