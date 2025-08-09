import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    screens: {
      'xs': '480px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Professional Brand Identity System for Adult Content Platform
        brand: {
          primary: '#E2E8F0',      // slate-200 - Sophisticated main brand text
          secondary: '#F59E0B',    // amber-500 - Premium accent color (VERY different from blue)
          accent: '#7C3AED',       // violet-600 - DRAMATICALLY different from blue
        },
        // Surface Hierarchy for Dark Theme
        surface: {
          primary: '#18181B',      // zinc-900 - Main application background
          secondary: '#27272A',    // zinc-800 - Cards, panels, elevated content
          tertiary: '#3F3F46',     // zinc-700 - Buttons, inputs, interactive surfaces
          border: '#52525B',       // zinc-600 - Subtle separations
        },
        // Content Typography Hierarchy
        content: {
          primary: '#F4F4F5',     // zinc-100 - Main content, headlines
          secondary: '#D4D4D8',   // zinc-300 - Supporting text, descriptions
          tertiary: '#A1A1AA',    // zinc-400 - Metadata, timestamps, hints
          disabled: '#71717A',    // zinc-500 - Inactive elements
        },
      },
      // Premium gradients for sophisticated UI elements
      backgroundImage: {
        'gradient-premium': 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
        'gradient-surface': 'linear-gradient(135deg, #27272A 0%, #18181B 100%)',
        'gradient-brand': 'linear-gradient(135deg, #3F3F46 0%, #27272A 50%, #18181B 100%)',
      },
      // Enhanced shadows for premium feel
      boxShadow: {
        'premium': '0 10px 25px -5px rgba(245, 158, 11, 0.1), 0 0 0 1px rgba(245, 158, 11, 0.05)',
        'elevated': '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
        'surface': '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
        'glow': '0 0 15px rgba(245, 158, 11, 0.15)',
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "shimmer": {
          "0%": {
            transform: "translateX(-100%)",
          },
          "100%": {
            transform: "translateX(100%)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "shimmer": "shimmer 2s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
