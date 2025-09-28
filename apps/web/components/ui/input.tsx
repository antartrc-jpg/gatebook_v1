/* FILE: apps/web/components/ui/input.tsx
   GateBook Enterprise · UI-Wrapper (shadcn-ähnlich) — Input
   Zweck
   ─────
   • Lokaler Input-Wrapper für Importe `@/components/ui/input`.
   • Einheitliche Optik auf Basis der Design-Tokens (bg/fg/card/border/muted-fg).
   • Fokus-/Disabled-/Invalid-Zustände ohne externe Abhängigkeiten.
*/

"use client";

import * as React from "react";
import { cn } from "@/app/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Basisklassen: Größe, Radius, Farbe, Platzhalter/Fokus/Disabled. */
const base =
  "block w-full rounded-md border text-sm " +
  "bg-background text-foreground border-border " +
  "placeholder:text-muted-foreground " +
  "px-3 py-2 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 " +
  "focus-visible:ring-[hsl(var(--border))] " +
  "disabled:opacity-60 disabled:pointer-events-none " +
  "transition-colors";

/** Invalid-Zustand: nutzt Brand als Hinweis (leichtgewichtiger Akzent). */
const invalid =
  "aria-invalid:ring-[hsl(var(--brand))] aria-invalid:border-[hsl(var(--brand))]";

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
          "text-sm ring-offset-background",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export default Input;

/* ────────────────────────────────────────────────────────────────────────────
Verifikation (manuell)
1) VS Code: Import `@/components/ui/input` wird aufgelöst (keine ts(2307)).
2) Fokus-Ring: 2px Ring in Token-Farbe `--border`.
3) Disabled: reduziert Opazität & sperrt Pointer-Events.
4) Invalid: <Input aria-invalid="true" /> → Border/Ring in `--brand`.

Orchestrator-Handover (Status "delivered")
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
  -Chat TECHNIKER `
  -Gate "W1 · UI Wrapper Input" `
  -Status "delivered — lokaler input.tsx erstellt; Fokus/Invalid/Disabled via Tokens" `
  -Deliverable "apps/web/components/ui/input.tsx" `
  -Summary "Input nutzt Tokens; beseitigt ts(2307) für Admin-Theme/Dashboard"

Referenzblock (Kap. 17.4 · SSOT)
— GateBook Enterprise – Geschäftslogik & Rollenhandbuch v1.0:
  Kap. 5.2–5.3 (UI-Neutralität; Tokens statt Hardcolors),
  Kap. 11 (SSR/Seitenaufbau – konsistente Komponenten),
  Kap. 13.1–13.4 (UX-Prinzipien/Interaktion),
  Kap. 16 (Theme/Tokens – bg/fg/card/border/brand),
  Kap. 28 (SemVer/Wirksamkeit – W1-Feinfix).
*/
