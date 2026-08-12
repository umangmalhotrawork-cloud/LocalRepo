import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        heading: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "liberation mono", "courier new", "monospace"],
      },
      colors: {
        background: "#050505",
        surface: "#0a0a0a",
        "surface-border": "#1f1f1f",
        "surface-hover": "#141414",
        cyan: {
          glow: "#22d3ee",
          dim: "#083344",
        },
        violet: {
          glow: "#8b5cf6",
          dim: "#2e1065",
        },
      },
      borderRadius: {
        "24": "24px",
      },
      boxShadow: {
        "cyan-glow": "0 0 25px -5px rgba(34, 211, 238, 0.3), 0 0 10px -5px rgba(34, 211, 238, 0.2)",
        "cyan-glow-lg": "0 0 50px -10px rgba(34, 211, 238, 0.4), 0 0 20px -5px rgba(34, 211, 238, 0.3)",
        "violet-glow": "0 0 25px -5px rgba(139, 92, 246, 0.3), 0 0 10px -5px rgba(139, 92, 246, 0.2)",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-cyan": "glowCyan 3s ease-in-out infinite alternate",
        "float": "float 6s ease-in-out infinite",
        "grid-drift": "gridDrift 20s linear infinite",
      },
      keyframes: {
        glowCyan: {
          "0%": { boxShadow: "0 0 15px -5px rgba(34, 211, 238, 0.2)" },
          "100%": { boxShadow: "0 0 35px 5px rgba(34, 211, 238, 0.5)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        gridDrift: {
          "0%": { backgroundPosition: "0px 0px" },
          "100%": { backgroundPosition: "48px 48px" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
