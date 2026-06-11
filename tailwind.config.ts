import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      fontFamily: {
        sans: ['Comfortaa Variable', 'Comfortaa', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border, 38 29% 84%))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
    }
  },
  plugins: [],
} satisfies Config;
