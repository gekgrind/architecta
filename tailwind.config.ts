import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      /* =========================================================
         CORE THEME TOKENS (existing – do not remove)
      ========================================================= */
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",

        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",

        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",

        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",

        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",

        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",

        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",

        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        /* =========================================================
           ARCHITECTA BLUEPRINT TOKENS (NEW)
        ========================================================= */
        blueprint: {
          /* Base surfaces */
          navy: "#122942",        // main dark background
          navyDark: "#0a1929",    // vignette / depth
          panel: "#0d1f35",       // cards / panels

          /* Grid lines */
          gridMajorDark: "#4a9eff",
          gridMinorDark: "#2563eb",

          gridMajorLight: "#cbd5e1",
          gridMinorLight: "#e2e8f0",

          /* Accent */
          cyan: "#22d3ee",
        },
      },

      /* =========================================================
         RADII
      ========================================================= */
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      /* =========================================================
         SHADOWS
      ========================================================= */
      boxShadow: {
        glow: "0 0 40px rgba(0, 255, 209, 0.25)",
        card: "0 10px 40px rgba(0,0,0,0.35)",
        blueprint: "0 0 30px rgba(34, 211, 238, 0.35)",
      },

      /* =========================================================
         BACKGROUND IMAGES (OPTIONAL BUT NICE)
      ========================================================= */
      backgroundImage: {
        "blueprint-radial":
          "radial-gradient(circle at center, transparent 0%, rgba(10,25,41,0.6) 100%)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
 
