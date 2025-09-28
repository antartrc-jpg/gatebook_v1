// FILE: apps/web/tailwind.config.js
// GateBook Enterprise · WEB — Tailwind-Konfiguration (Token-Bridge aktiv)
// Zweck
// • Mappt Tailwind-Farbnamen direkt auf unsere CSS-Variablen (HSL-Tripel).
// • Stellt sicher: Buttons/Inputs/Karten reagieren auf gespeicherte Theme-Werte.
// • Kompatibel mit Server-Overrides (#theme-overrides) & Draft (#theme-overrides-draft).

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    // Falls Shadcn-Kompositionen im Monorepo:
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Oberflächen & Text
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        // Karten
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",

        // Gedämpft
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",

        // Rahmen
        border: "hsl(var(--border))",

        // Marke als Primary (Bridge auf --brand)
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
      },

      // Einheitlicher Radius aus Token
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

/*
[Referenzblock – Kap. 17.4 · SSOT]
— GateBook Enterprise – Geschäftslogik & Rollenhandbuch v1.0:
   Kap. 5.2–5.3 (UI-Tokenisierung & neutrale Klassen),
   Kap. 11 (WEB-Build/Next – Tailwind-Integration),
   Kap. 16 (Settings/Theme — Variablen, Bridge auf primary/*),
   Kap. 21.2 (MVP-Robustheit).

Orchestrator-Handover (Einzeiler)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
  -Chat WEB `
  -Gate "Gate A" `
  -Status "delivered — Tailwind-Config mapped: background/foreground/card/primary → CSS-Variablen" `
  -Deliverable "apps/web/tailwind.config.js" `
  -Summary "Stellt sicher, dass UI-Klassen auf Tokens reagieren; kompatibel mit /theme & Draft"
*/
