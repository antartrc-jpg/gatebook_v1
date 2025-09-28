// apps/web/app/owner/onboarding/page.tsx
// WO-WEB-7 · Owner Onboarding — Erreichbar; neutraler Leerzustand; UI via packages/ui
// Domain: WEB · W1 · SSOT: Owner-Onboarding (Kap. 4.1), UI-Mikrotexte (Kap. 14.1), MVP (Kap. 21.2)

import Link from "next/link";
// FIX (VS Code Zickzack): relative Tiefe zum lib-Ordner korrigiert (../../.. statt ../../)
import { requireAuth } from "../../../lib/auth";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Alert,
  AlertTitle,
  AlertDescription,
  Button,
} from "@gatebook/ui";

export default async function OwnerOnboardingPage() {
  // SSR-Guard (kein FOUC); die eigentliche Rollenprüfung bleibt neutral
  const session = await requireAuth();

  const isOwner = session.role === "owner";

  return (
    <main className="min-h-[100dvh] p-6">
      <div className="mx-auto max-w-3xl grid gap-6">
        {/* Kopfbereich */}
        <header className="grid gap-1">
          <h1 className="text-2xl font-semibold">Owner-Onboarding</h1>
          <p className="opacity-80 text-sm">Willkommen, {session.email}.</p>
        </header>

        {/* Rollenhinweis (neutral) */}
        {!isOwner && (
          <Alert role="status">
            <AlertTitle>Nicht verfügbar</AlertTitle>
            <AlertDescription>
              Diese Seite ist für Owner vorgesehen. Wenn Sie Zugriff benötigen, wenden Sie sich bitte an die
              Organisation.
            </AlertDescription>
          </Alert>
        )}

        {/* Neutraler Leerzustand */}
        <Card>
          <CardHeader>
            <CardTitle>Onboarding starten</CardTitle>
            <CardDescription>
              Starten Sie das Owner-Onboarding für Ihre Organisation.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm opacity-80">
              In diesem Schritt erfassen Sie grundlegende Angaben zu Ihrer Organisation. Der vollständige
              Antrag wird nach Freigabe verfügbar.
            </p>

            <ul className="list-disc pl-5 text-sm opacity-80 space-y-1">
              <li>Basisdaten der Organisation</li>
              <li>Kontaktangaben</li>
              <li>Verifizierungsunterlagen (Upload als PDF)</li>
            </ul>

            <Alert role="status">
              <AlertTitle>Hinweis</AlertTitle>
              <AlertDescription>
                Der vollständige Antrag ist in dieser Phase deaktiviert. Diese Seite dient als Platzhalter
                (Leerzustand) und wird in einem späteren Schritt freigeschaltet.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="justify-between">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Zurück zum Dashboard</Link>
            </Button>
            <Button disabled size="sm" title="In W1 deaktiviert">
              Formular öffnen
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}

/*
[Referenzblock – Kap. 17.4 · SSOT]
- Owner-Onboarding (A–F Felder, spätere Aktivierung): Kap. 4.1
- UI-Mikrotexte (wortgleich, neutral): Kap. 14.1
- MVP/Minimale UIs & Leerzustände: Kap. 21.2
- Prozess/Transparenz/SSR-Guards: Kap. 17, 11

[Änderung – Squiggle-Fix]
- Import von "../../lib/auth" → "../../../lib/auth" korrigiert (Verzeichnis-Tiefe: app/owner/onboarding → web/lib).

[Akzeptanz · WO-WEB-7]
- Seite ist erreichbar (SSR), nutzt ausschließlich packages/ui.
- Neutraler Leerzustand ohne aktive Form-Interaktion; Button ist deaktiviert.
- Rollenhinweis neutral; kein FOUC durch requireAuth().

[Orchestrator-Handover – Einzeiler]
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
  -Chat WEB `
  -Gate "Gate A" `
  -Status "delivered — WO-WEB-7 Importpfad korrigiert; Owner Onboarding ohne VSCode-Squiggles" `
  -Deliverable "apps/web/app/owner/onboarding/page.tsx" `
  -Summary "Relative Imports ../../../lib/* korrekt; Seite bleibt SSR-guarded und leerzustandskonform"
*/
