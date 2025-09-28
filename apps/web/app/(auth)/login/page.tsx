// FILE: apps/web/app/(auth)/login/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Input, Label, Button, Alert, AlertTitle, AlertDescription,
} from "@gatebook/ui";

type FieldKey = "email" | "password";
type FieldErrors = Partial<Record<FieldKey, string>>;
type UiStatus = "idle" | "ok" | "invalid" | "error" | "timeout" | "notfound";

function apiBase(): string {
  const a = (process.env.NEXT_PUBLIC_API_URL || "").trim(); // wenn gesetzt: volle URL (https://api...)
  return a.length ? a.replace(/\/+$/, "") : "/api";         // sonst: über Next-Rewrite/Proxy
}

export default function LoginPage() {
  const router = useRouter();

  const [form, setForm] = React.useState({ email: "", password: "" });
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [status, setStatus] = React.useState<UiStatus>("idle");
  const [serverMsg, setServerMsg] = React.useState<string | null>(null);

  function onChange<K extends FieldKey>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((s) => ({ ...s, [key]: e.target.value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
      setStatus("idle");
      setServerMsg(null);
    };
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setErrors({});
    setServerMsg(null);
    setStatus("idle");

    // Basis-Validierung
    const fieldErr: FieldErrors = {};
    if (!form.email.trim()) fieldErr.email = "E-Mail ist erforderlich.";
    if (!form.password) fieldErr.password = "Passwort ist erforderlich.";
    if (fieldErr.email || fieldErr.password) {
      setErrors(fieldErr);
      return;
    }

    const url = `${apiBase()}/auth/login`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    try {
      setSubmitting(true);

      const res = await fetch(url, {
        method: "POST",
        credentials: "include", // Session-Cookies erlauben
        headers: { "content-type": "application/json", accept: "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });

      // Payload robust parsen
      const ct = res.headers.get("content-type") || "";
      let data: any = null;
      try {
        if (ct.includes("application/json")) data = await res.json();
        else if (res.status !== 204) data = await res.text();
      } catch { /* ignore */ }

      if (res.status === 401) {
        setStatus("invalid");
        setServerMsg(typeof data === "string" ? data : data?.message || null);
        return;
      }
      if (res.status === 404) {
        setStatus("notfound");
        setServerMsg("API-Route nicht gefunden (Proxy/Rewrite prüfen).");
        return;
      }
      if (res.status >= 500) {
        setStatus("error");
        setServerMsg(typeof data === "string" ? data : data?.message || "Serverfehler.");
        return;
      }

      // Erfolg: 200/201/204
      if (res.ok) {
        setStatus("ok");
        const target =
          (data && typeof data === "object" && typeof data.redirect === "string" && data.redirect) ||
          "/dashboard";

        // Mini-Delay: Cookie persistieren lassen, dann harter Wechsel
        setTimeout(() => {
          try { router.refresh(); } catch {}
          window.location.replace(target);
        }, 50);
        return;
      }

      // Fallback: alles andere
      setStatus("error");
      setServerMsg(typeof data === "string" ? data : data?.message || null);
    } catch (err: any) {
      setStatus(err?.name === "AbortError" ? "timeout" : "error");
      setServerMsg(err?.message || null);
    } finally {
      clearTimeout(timer);
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] grid place-items-center p-4">
      <Card
        className="w-full max-w-md !bg-card !text-card-foreground border border-border shadow"
        style={{ backgroundColor: "hsl(var(--card))", color: "hsl(var(--card-foreground))" }}
      >
        <CardHeader>
          <CardTitle className="text-foreground">Anmelden</CardTitle>
          <CardDescription className="text-muted-foreground">
            Melden Sie sich mit Ihrer E-Mail und Ihrem Passwort an.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-3">
          {status === "ok" && (
            <Alert role="status" aria-live="polite">
              <AlertTitle>Erfolgreich angemeldet</AlertTitle>
              <AlertDescription>Sie werden weitergeleitet…</AlertDescription>
            </Alert>
          )}
          {status === "invalid" && (
            <Alert role="status" aria-live="polite">
              <AlertTitle>Anmeldung fehlgeschlagen</AlertTitle>
              <AlertDescription>
                {serverMsg ?? "E-Mail oder Passwort ist nicht gültig."}
              </AlertDescription>
            </Alert>
          )}
          {status === "notfound" && (
            <Alert role="status" aria-live="polite">
              <AlertTitle>API nicht gefunden</AlertTitle>
              <AlertDescription>
                {serverMsg ?? "Bitte Proxy/Rewrite für /api/auth/login prüfen."}
              </AlertDescription>
            </Alert>
          )}
          {status === "timeout" && (
            <Alert role="status" aria-live="polite">
              <AlertTitle>Zeitüberschreitung</AlertTitle>
              <AlertDescription>Bitte erneut versuchen.</AlertDescription>
            </Alert>
          )}
          {status === "error" && (
            <Alert role="status" aria-live="polite">
              <AlertTitle>Derzeit nicht möglich</AlertTitle>
              <AlertDescription>
                {serverMsg ?? "Bitte versuchen Sie es später erneut."}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={onSubmit} noValidate className="grid gap-4 mt-2" aria-busy={submitting}>
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-foreground">E-Mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="email"
                required
                value={form.email}
                onChange={onChange("email")}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                disabled={submitting}
                placeholder="name@firma.de"
                className="!bg-background !text-foreground placeholder:text-muted-foreground border border-border"
              />
              {errors.email && <p id="email-error" className="text-sm text-red-600">{errors.email}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password" className="text-foreground">Passwort</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={onChange("password")}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                disabled={submitting}
                className="!bg-background !text-foreground placeholder:text-muted-foreground border border-border"
              />
              {errors.password && <p id="password-error" className="text-sm text-red-600">{errors.password}</p>}
            </div>

            <Button type="submit" disabled={submitting} className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
              {submitting ? "Wird geprüft…" : "Anmelden"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-between">
          <span className="text-sm text-muted-foreground">Noch kein Konto?</span>
          <Button asChild variant="ghost" size="sm" className="text-foreground">
            <Link href="/register">Zur Registrierung</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
