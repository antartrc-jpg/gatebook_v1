// FILE: apps/web/app/(auth)/verify/[token]/page.tsx
// WEB · Verify (SSR) – nutzt Theme-Tokens, saubere Statusauswertung & Auto-Weiterleitung

import Link from "next/link";
import { headers } from "next/headers";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import AutoForward from "./AutoForward"; // ← Client-Komponente mit "use client"

export const revalidate = 0;
export const dynamic = "force-dynamic";

type VerifyState = "success" | "expired" | "invalid";

function apiBase(): string {
  const a = process.env.API_BASE_URL?.trim();
  const b = process.env.NEXT_PUBLIC_API_URL?.trim();
  return (a?.length ? a : b?.length ? b : "http://localhost:4000").replace(/\/+$/, "");
}

async function doVerify(token: string): Promise<VerifyState> {
  if (!token || token.length < 32) return "invalid";
  try {
    const res = await fetch(`${apiBase()}/auth/verify?token=${encodeURIComponent(token)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) return "success";
    if (res.status === 410) return "expired";
    return "invalid";
  } catch {
    return "invalid";
  }
}

export default async function VerifyPage({ params }: { params: { token: string } }) {
  // Reserve – falls du später Telemetrie über Headers brauchst
  void headers();

  const state = await doVerify(params?.token);

  // gemeinsame Button-Klassen (entsprechen deinem tokenisierten Button)
  const btn =
    "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  const btnPrimary =
    `${btn} border text-[hsl(var(--brand-foreground))] bg-[hsl(var(--brand))] ` +
    "border-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))]/90";
  const btnOutline =
    `${btn} border bg-transparent text-foreground border-[hsl(var(--border))] hover:bg-muted`;

  return (
    <main className="min-h-[100dvh] grid place-items-center p-6 bg-background text-foreground">
      <Card className="w-full max-w-lg bg-card text-card-foreground border-border">
        <CardHeader>
          <CardTitle>E-Mail bestätigen</CardTitle>
          <CardDescription>
            Verifikation gemäß Sicherheitsrichtlinien (24 h, einmalig).
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {state === "success" && (
            <>
              <Alert variant="default" className="border border-green-600/30">
                <AlertTitle>Verifikation erfolgreich</AlertTitle>
                <AlertDescription>
                  Deine E-Mail wurde bestätigt. Du kannst dich jetzt anmelden. Du wirst gleich automatisch weitergeleitet.
                </AlertDescription>
              </Alert>
              {/* Auto-Weiterleitung in 2 s → /login?verified=1 */}
              <AutoForward to="/login?verified=1" delay={2000} />
            </>
          )}

          {state === "expired" && (
            <Alert variant="default" className="border border-amber-600/30">
              <AlertTitle>Link nicht mehr gültig</AlertTitle>
              <AlertDescription>
                Der Bestätigungslink ist abgelaufen oder wurde bereits verwendet. Fordere einen neuen Link an.
              </AlertDescription>
            </Alert>
          )}

          {state === "invalid" && (
            <Alert variant="default" className="border border-border/60">
              <AlertTitle>Verifikation nicht möglich</AlertTitle>
              <AlertDescription>
                Dieser Link ist ungültig. Bitte fordere einen neuen Bestätigungslink an.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="justify-between gap-2">
          <Link href="/login" className={btnPrimary}>Zur Anmeldung</Link>
          <Link href="/register" className={btnOutline}>Neu registrieren</Link>
        </CardFooter>
      </Card>
    </main>
  );
}
