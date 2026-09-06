import type { Config } from "tailwindcss";

/**
 * Theme tokens recovered from the pre-nuke "elegant" design system: a warm
 * off-white / warm-dark palette with a purple primary. Values live as HSL CSS
 * variables in src/index.css so light and dark share one class vocabulary.
 */
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1200px" },
    },
    extend: {
      fontFamily: {
        sans: ["Comfortaa Variable", "Comfortaa", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "blobbi-idle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4%)" },
        },
        "blobbi-sleep": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.02)" },
        },
        "blobbi-shadow": {
          "0%, 100%": { transform: "scaleX(1)", opacity: "0.35" },
          "50%": { transform: "scaleX(0.88)", opacity: "0.25" },
        },
        "blobbi-happy": {
          "0%": { transform: "translateY(0) scale(1)" },
          "30%": { transform: "translateY(-10%) scale(1.04)" },
          "60%": { transform: "translateY(0) scale(0.98)" },
          "100%": { transform: "translateY(0) scale(1)" },
        },
        "float-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "20%": { opacity: "1" },
          "100%": { opacity: "0", transform: "translateY(-48px)" },
        },
        sparkle: {
          "0%, 100%": { opacity: "0.2", transform: "scale(0.7)" },
          "50%": { opacity: "0.9", transform: "scale(1.1)" },
        },
      },
      animation: {
        "blobbi-idle": "blobbi-idle 2.4s ease-in-out infinite",
        "blobbi-sleep": "blobbi-sleep 4s ease-in-out infinite",
        "blobbi-shadow": "blobbi-shadow 2.4s ease-in-out infinite",
        "blobbi-happy": "blobbi-happy 700ms ease-out 1",
        "float-up": "float-up 1400ms ease-out forwards",
        sparkle: "sparkle 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
