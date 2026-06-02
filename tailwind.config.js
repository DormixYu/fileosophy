/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        gold: {
          50: "#FFF8E7",
          100: "#FFF0CC",
          200: "#FFE4A3",
          300: "#D4A853",
          400: "#B8860B",
          500: "#B8860B",
          600: "#8B6508",
          700: "#876520",
          800: "#6A4E18",
          900: "#4D3810",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          alt: "#F6F5F2",
          elevated: "#FFFFFF",
          hover: "#F6F5F2",
        },
        ink: {
          DEFAULT: "#1C1917",
          secondary: "#44403C",
          tertiary: "#78716C",
          muted: "#A8A29E",
          ghost: "#D6D3D1",
        },
        success: {
          DEFAULT: "#16A34A",
          light: "rgba(22, 163, 74, 0.10)",
        },
        warning: {
          DEFAULT: "#D97706",
          light: "rgba(217, 119, 6, 0.10)",
        },
        danger: {
          DEFAULT: "#DC2626",
          light: "rgba(220, 38, 38, 0.10)",
          hover: "#B91C1C",
        },
        info: {
          DEFAULT: "#2563EB",
          light: "rgba(37, 99, 235, 0.10)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "PingFang SC",
          "SF Pro Text",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "DM Mono", "Menlo", "monospace"],
      },
      fontSize: {
        display: ["2rem", { lineHeight: "1.2", fontWeight: "700" }],
        headline: ["1.5rem", { lineHeight: "1.3", fontWeight: "600" }],
        title: ["1.25rem", { lineHeight: "1.4", fontWeight: "600" }],
        heading: ["1rem", { lineHeight: "1.5", fontWeight: "600" }],
        body: ["0.875rem", { lineHeight: "1.6", fontWeight: "400" }],
        callout: ["0.8125rem", { lineHeight: "1.5", fontWeight: "400" }],
        caption: ["0.75rem", { lineHeight: "1.5", fontWeight: "400" }],
        micro: ["0.6875rem", { lineHeight: "1.4", fontWeight: "500" }],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "20px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(0, 0, 0, 0.04)",
        sm: "0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
        md: "0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.03)",
        lg: "0 10px 15px rgba(0, 0, 0, 0.06), 0 4px 6px rgba(0, 0, 0, 0.03)",
        xl: "0 20px 25px rgba(0, 0, 0, 0.08), 0 8px 10px rgba(0, 0, 0, 0.03)",
        glow: "0 0 0 3px rgba(212, 168, 83, 0.12)",
        "glow-lg": "0 0 0 6px rgba(212, 168, 83, 0.08)",
      },
      spacing: {
        4.5: "1.125rem",
        13: "3.25rem",
        15: "3.75rem",
        18: "4.5rem",
      },
      animation: {
        "slide-up": "slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-down": "slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in": "fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 2s linear infinite",
        skeleton: "skeleton 1.5s ease-in-out infinite",
      },
      keyframes: {
        "slide-up": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          "0%": { transform: "translateY(-8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.98)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        skeleton: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};
