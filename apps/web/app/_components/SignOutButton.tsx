'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

const API =
  (process.env.NEXT_PUBLIC_API_URL?.trim() ||
    process.env.API_BASE_URL?.trim() ||
    '/api' // ← lokal über Next-Proxy
  ).replace(/\/+$/, '');

export default function SignOutButton() {
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    let ok = true;
    (async () => {
      try {
        // WICHTIG: /me (nicht /session/me) und authenticated prüfen
        const r = await fetch(`${API}/me`, { credentials: 'include', cache: 'no-store' });
        const j = r.ok ? await r.json() : null;
        if (!ok) return;
        setShow(Boolean(j?.authenticated === true));
      } catch {
        setShow(false);
      }
    })();
    return () => { ok = false; };
  }, []);

  if (!show) return null;

  async function onSignOut() {
    try {
      setBusy(true);
      await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {}
    finally {
      setBusy(false);
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <button
      onClick={onSignOut}
      disabled={busy}
      className="rounded-full bg-foreground/90 px-4 py-2 text-sm font-medium text-background shadow hover:bg-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      aria-label="Abmelden"
    >
      {busy ? '…' : 'Abmelden'}
    </button>
  );
}
