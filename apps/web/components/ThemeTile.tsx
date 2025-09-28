/* FILE: apps/web/components/ThemeTile.tsx
   GateBook Enterprise · Dashboard-Kachel „Layout anpassen“
   Zweck
   ———————————————————————————————————————————————————————————————————————
   Beim Klick NICHT mehr das alte Inline-Panel („Theme verwalten“) öffnen,
   sondern konsequent zur Admin-Route **admin/theme** navigieren.
   Dort erscheint das neue Bottom-Sheet (Paletten + Live-Preview).

   Wirkung
   ———————————————————————————————————————————————————————————————————————
   • Dashboard-Klick ⇒ Navigation zu /admin/theme
   • Kein lokaler Drawer/State in der Kachel (keine Doppel-UI)
*/

import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@gatebook/ui";

export default function ThemeTile() {
  return (
    <Link
      href="/admin/theme"
      className="group block rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/20"
      aria-label="Layout anpassen öffnen"
      prefetch
    >
      <Card className="h-full border border-border bg-card text-card-foreground shadow">
        <CardHeader>
          <CardTitle>Layout anpassen</CardTitle>
          <CardDescription className="text-muted-foreground">
            Farben, Schriften und Abstände global konfigurieren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <span className="mt-2 inline-flex select-none items-center gap-1 text-sm text-muted-foreground">
            Öffnen →
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

/*
Verifikation (manuell)
— Als Superadmin /dashboard öffnen → Kachel „Layout anpassen“ anklicken.
— Erwartung: Navigation nach /admin/theme; dort fährt das neue Drawer-UI hoch.

Orchestrator-Handover (Status "delivered")
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
  -Chat WEB `
  -Gate "W1 · ThemeTile Route-Navigation" `
  -Status "delivered — Kachel öffnet nicht mehr das alte Inline-Panel; verlinkt zu /admin/theme" `
  -Deliverable "apps/web/components/ThemeTile.tsx" `
  -Summary "Doppel-UI entfernt; sichert, dass das richtige Drawer-UI erscheint"

Referenzblock (Kap. 17.4 · SSOT)
— GateBook Enterprise – Geschäftslogik & Rollenhandbuch v1.0:
  Kap. 11 (Routen & SSR im Dashboard), Kap. 13.1–13.4 (klare Navigation/UX),
  Kap. 16 (Theme/Settings – zentrale Admin-Seite), Kap. 21.2 (MVP/Reduktion von Doppelwegen).
*/
