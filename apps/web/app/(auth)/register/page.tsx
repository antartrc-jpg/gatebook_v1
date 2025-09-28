'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { zRegister } from '@gatebook/shared/auth/zod-schemas';

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'http://localhost:4000').replace(/\/+$/, '');

type FieldKey = 'email' | 'password' | 'confirmPassword';
type FieldErrors = Partial<Record<FieldKey, string>>;

export default function RegisterPage() {
  const [form, setForm] = React.useState({ email: '', password: '', confirmPassword: '' });
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [errMsg, setErrMsg] = React.useState<string | null>(null);

  function onChange<K extends FieldKey>(k: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((s) => ({ ...s, [k]: e.target.value }));
      setErrors((p) => ({ ...p, [k]: undefined }));
      setErrMsg(null);
    };
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setErrors({});
    setErrMsg(null);

    const parsed = zRegister.safeParse(form);
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors as Record<FieldKey, string[] | undefined>;
      setErrors({
        email: f.email?.[0],
        password: f.password?.[0],
        confirmPassword: f.confirmPassword?.[0],
      });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsed.data),
      });

      // 202 = E-Mail versendet; 409 behandeln wir neutral (keine Enumeration)
      if (res.status === 202 || res.status === 409) {
        setSubmitted(true);
        return;
      }

      // Optional: 400-Detailfehler zurück auf Felder mappen
      try {
        const data = await res.json();
        const issues = (data?.errors || data?.issues) as Array<{ path?: string[]; message?: string }> | undefined;
        if (Array.isArray(issues)) {
          const fe: FieldErrors = {};
          for (const i of issues) {
            const key = i?.path?.[0] as FieldKey | undefined;
            if (key && i?.message && !fe[key]) fe[key] = i.message;
          }
          if (Object.keys(fe).length) {
            setErrors(fe);
            return;
          }
        }
      } catch {
        /* body parse egal */
      }

      setErrMsg('Es ist ein Fehler aufgetreten. Bitte später erneut versuchen.');
    } catch {
      setErrMsg('Netzwerkfehler. Bitte später erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-background text-foreground grid place-items-center p-4">
      <Card className="w-full max-w-md border border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>Konto erstellen</CardTitle>
          <CardDescription>
            Registrieren Sie sich mit Ihrer E-Mail. Anschließend erhalten Sie eine Verifikations-E-Mail.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {submitted ? (
            <div
              role="status"
              className="rounded-md border border-border/80 bg-muted/40 p-4 text-sm text-muted-foreground"
            >
              <div className="font-medium text-foreground mb-1">Bitte E-Mail prüfen</div>
              Öffnen Sie MailHog unter{' '}
              <a className="underline" href="http://localhost:8025" target="_blank" rel="noreferrer">
                http://localhost:8025
              </a>{' '}
              und klicken Sie auf den Bestätigungs-Link.
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="grid gap-4">
              {/* E-Mail */}
              <label className="grid gap-2">
                <span className="text-sm text-muted-foreground" id="label-email">E-Mail</span>
                <Input
                  aria-labelledby="label-email"
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={onChange('email')}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  disabled={submitting}
                  placeholder="name@firma.de"
                />
                {errors.email && (
                  <p id="email-error" className="text-sm text-destructive">{errors.email}</p>
                )}
              </label>

              {/* Passwort */}
              <label className="grid gap-2">
                <span className="text-sm text-muted-foreground" id="label-password">Passwort</span>
                <Input
                  aria-labelledby="label-password"
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={form.password}
                  onChange={onChange('password')}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  disabled={submitting}
                />
                {errors.password && (
                  <p id="password-error" className="text-sm text-destructive">{errors.password}</p>
                )}
              </label>

              {/* Passwort (Wiederholen) */}
              <label className="grid gap-2">
                <span className="text-sm text-muted-foreground" id="label-confirm">Passwort (Wiederholen)</span>
                <Input
                  aria-labelledby="label-confirm"
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={form.confirmPassword}
                  onChange={onChange('confirmPassword')}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                  disabled={submitting}
                />
                {errors.confirmPassword && (
                  <p id="confirmPassword-error" className="text-sm text-destructive">
                    {errors.confirmPassword}
                  </p>
                )}
              </label>

              {errMsg && <p className="text-sm text-destructive">{errMsg}</p>}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Wird gesendet…' : 'Registrieren'}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-between">
          <span className="text-sm text-muted-foreground">Bereits ein Konto?</span>
          <Link
            href="/login"
            className="inline-flex items-center rounded-md px-2 py-1 text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Zum Login
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
