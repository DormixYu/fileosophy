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
          400: "#C49B51",
          500: "#B8860B",
          600: "#9B7428",
          700: "#7A5C20",
          800: "#5A4318",
          900: "#3D2E10",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          alt: "#F5F5F4",
          elevated: "#FFFFFF",
        },
        ink: {
          DEFAULT: "#1A1A1A",
          secondary: "#4A4A4A",
          tertiary: "#6B6B6B",
          muted: "#9CA3AF",
        },
      },
      fontFamily: {
        sans: ["PingFang SC", "SF Pro Text", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        serif: ["Cormorant Garamond", "serif"],
        mono: ["DM Mono", "monospace"],
      },
      fontSize: {
        headline: ["1.75rem", { lineHeight: "1.25", fontWeight: "600" }],
        title: ["1.25rem", { lineHeight: "1.35", fontWeight: "600" }],
        body: ["0.8125rem", { lineHeight: "1.6", fontWeight: "400" }],
        callout: ["0.75rem", { lineHeight: "1.5", fontWeight: "400" }],
        subhead: ["0.6875rem", { lineHeight: "1.5", fontWeight: "500" }],
        footnote: ["0.625rem", { lineHeight: "1.4", fontWeight: "400" }],
        caption: ["0.5625rem", { lineHeight: "1.4", fontWeight: "400" }],
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
        md: "0 2px 8px rgba(0, 0, 0, 0.08)",
        lg: "0 4px 16px rgba(0, 0, 0, 0.10)",
        xl: "0 8px 32px rgba(0, 0, 0, 0.12)",
        gold: "0 2px 12px rgba(184, 134, 11, 0.12)",
        "gold-lg": "0 4px 24px rgba(184, 134, 11, 0.18)",
      },
      animation: {
        "slide-up": "slide-up 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        "scale-in": "scale-in 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
        "fade-in": "fade-in 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "slide-up": {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
