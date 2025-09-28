import type { Config } from "tailwindcss";

export default {
  content: [
    "./apps/web/app/**/*.{ts,tsx}",
    "./apps/web/components/**/*.{ts,tsx}",
    "./packages/ui/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
      },
      borderRadius: {
        xl: "var(--radius)",
        "2xl": "calc(var(--radius) + 4px)",
      },
    },
  },
  plugins: [],
} satisfies Config;
