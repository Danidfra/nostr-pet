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
        "blobbi-shadow": {
          "0%, 100%": { transform: "scaleX(1)", opacity: "0.35" },
          "50%": { transform: "scaleX(0.88)", opacity: "0.25" },
        },
      },
      animation: {
        "blobbi-idle": "blobbi-idle 2.4s ease-in-out infinite",
        "blobbi-shadow": "blobbi-shadow 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
