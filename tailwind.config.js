/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,js,html}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0a0e1a",
        panel: "rgba(18, 24, 38, 0.6)",
        accent: {
          cyan: "#00e5ff",
          violet: "#a855f7",
          amber: "#f59e0b",
          rose: "#fb7185",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', "ui-monospace", "monospace"],
        display: ['"Inter"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(0, 229, 255, 0.35)",
        "glow-violet": "0 0 24px -4px rgba(168, 85, 247, 0.4)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
