import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#22d3ee", // cyan-400 — sole accent color per the plan
          muted: "#0e7490",
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [typography],
};
