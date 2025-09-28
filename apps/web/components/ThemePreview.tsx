/* FILE: apps/web/components/ThemePreview.tsx
   GateBook Enterprise · ThemePreview (Live)
   ────────────────────────────────────────────────────────────────────────────
   Zweck
   • Kompakte, sofort verständliche Live-Vorschau für globale Theme-Tokens.
   • Reagiert automatisch auf Entwürfe, da sie via CSS-Variablen (z. B. #theme-overrides-draft)
     ins Dokument geschrieben werden. Keine Props nötig.
   • Kann in /app/admin/theme/page.tsx direkt unter den Feldern eingeblendet werden.

   Einbau
   ————————————————————————————————————————————————————————————————————————————
   import ThemePreview from "@/components/ThemePreview";
   …
   <ThemePreview />

   Hinweise
   • Nutzt ausschließlich Token-gebundene Klassen (bg-card, text-foreground, …).
   • Brand-/Border-Akzente greifen via var(--brand), var(--border).
*/

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ThemePreview() {
  return (
    <section
      aria-label="Live-Vorschau: Theme"
      className="mt-8 grid gap-6 md:grid-cols-2"
      data-preview
    >
      {/* Karte 1: Typografie & Kontraste */}
      <article className="rounded-2xl border bg-card text-card-foreground p-5">
        <header className="mb-3">
          <h3 className="text-lg font-semibold">Typografie &amp; Kontrast</h3>
          <p className="text-sm text-muted-foreground">
            Diese Vorschau reagiert live auf deine Entwürfe.
          </p>
        </header>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Überschrift H1</h1>
          <h2 className="text-xl font-semibold">Überschrift H2</h2>
          <p className="leading-relaxed">
            Fließtext auf <code>bg-card</code> mit{" "}
            <code>text-card-foreground</code>. Prüfe Lesbarkeit und Abstände.
          </p>
          <div
            className="rounded-md border p-3"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Akzentlinie
            </div>
            <div
              className="mt-1 h-1 rounded"
              style={{ backgroundColor: "hsl(var(--brand))" }}
            />
          </div>
        </div>
      </article>

      {/* Karte 2: Komponenten-Feeling (Buttons, Input, Chip) */}
      <article className="rounded-2xl border bg-card text-card-foreground p-5">
        <header className="mb-3">
          <h3 className="text-lg font-semibold">Komponenten</h3>
          <p className="text-sm text-muted-foreground">
            Buttons, Formularfeld &amp; Statuschip mit Token-Farben.
          </p>
        </header>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primär</Button>
            <Button variant="secondary">Sekundär</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-muted-foreground">E-Mail</label>
            <Input placeholder="name@example.com" />
          </div>

          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs"
              style={{
                borderColor: "hsl(var(--brand))",
                color: "hsl(var(--brand))",
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: "hsl(var(--brand))" }}
              />
              Brand
            </span>
            <span
              className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs text-muted-foreground"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              Border
            </span>
          </div>
        </div>
      </article>

      {/* Fläche: Seitenhintergrund vs. Text */}
      <article className="rounded-2xl border p-5 bg-background text-foreground md:col-span-2">
        <header className="mb-3">
          <h3 className="text-lg font-semibold">Seitenfläche (bg / fg)</h3>
          <p className="text-sm text-muted-foreground">
            Prüfe Kontrast auf dem globalen Hintergrund.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border p-4">
            <div className="text-sm text-muted-foreground">Fläche</div>
            <div className="mt-2 h-10 w-full rounded-md" />
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-sm text-muted-foreground">Abgrenzung</div>
            <div
              className="mt-2 h-10 w-full rounded-md"
              style={{ backgroundColor: "hsl(var(--muted))" }}
            />
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-sm text-muted-foreground">Akzent</div>
            <div
              className="mt-2 h-10 w-full rounded-md"
              style={{ backgroundColor: "hsl(var(--brand))" }}
            />
          </div>
        </div>
      </article>
    </section>
  );
}

/*
[Referenzblock – Kap. 17.4]
— GateBook Enterprise – Geschäftslogik & Rollenhandbuch v1.0:
  Kap. 5.2–5.3 (UI-Neutralität & Tokenisierung),
  Kap. 11 (SSR/Komponentenaufbau),
  Kap. 13.1–13.4 (UX-Prinzipien, Interaktion),
  Kap. 16 (Settings/Theme — globale Variablen),
  Kap. 28 (SemVer/Wirksamkeit – W1-Feinrelease).

Orchestrator-Handover (Append-only)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
  -Chat TECHNIKER `
  -Gate "W1 · Admin-Ordner-Bereinigung (Schritt 1/2)" `
  -Status "delivered — ThemePreview nach components/ verschoben (Inhalt unverändert)" `
  -Deliverable "apps/web/components/ThemePreview.tsx" `
  -Summary "Doppelung vermieden; nächster Schritt: Import-Fix in /app/admin/theme/page.tsx"
*/
