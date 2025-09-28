// apps/web/app/invitations/page.tsx
// WO-WEB-8 · Invitations List — Erreichbar; neutraler Leerzustand; UI via packages/ui

import Link from "next/link";
import { requireSession } from "../../lib/auth"; // ← statt requireAuth
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Alert,
  AlertTitle,
  AlertDescription,
} from "@gatebook/ui";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  // SSR-Guard (kein FOUC)
  await requireSession("/login");

  // W1: API-Integration folgt später → neutraler Leerzustand
  const invitations: Array<{ id: string; email: string; role: string; createdAt: string }> = [];

  return (
    <main className="min-h-[100dvh] p-6">
      <div className="mx-auto max-w-4xl grid gap-6">
        <header className="grid gap-1">
          <h1 className="text-2xl font-semibold">Einladungen</h1>
          <p className="opacity-80 text-sm">Verwalten Sie Team-Einladungen Ihrer Organisation.</p>
        </header>

        {invitations.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Keine Einladungen vorhanden</CardTitle>
              <CardDescription>Es liegen aktuell keine ausstehenden Einladungen vor.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Alert>
                <AlertTitle>Hinweis</AlertTitle>
                <AlertDescription>
                  In dieser Phase wird nur ein neutraler Leerzustand dargestellt. Die Einladungsverwaltung wird später
                  freigeschaltet.
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="justify-between">
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">Zurück zum Dashboard</Link>
              </Button>
              <Button disabled size="sm" title="In W1 deaktiviert">
                Einladung erstellen
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <section className="grid gap-3">
            {invitations.map((inv) => (
              <Card key={inv.id}>
                <CardHeader>
                  <CardTitle>{inv.email}</CardTitle>
                  <CardDescription>Rolle: {inv.role}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
