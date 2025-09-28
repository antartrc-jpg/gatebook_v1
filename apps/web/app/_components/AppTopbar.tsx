'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import SignOutButton from './SignOutButton';

// Auf diesen Routen KEIN Topbar/Logout
const HIDE_ON = [
  /^\/login(?:\/|$)/,
  /^\/register(?:\/|$)/,
  /^\/verify(?:\/|$)/,
  /^\/reset(?:\/|$)/,
  /^\/auth(?:\/|$)/,
];

function normalizeAvatarUrl(u?: string | null): string | null {
  const s = String(u ?? '').trim();
  if (!s) return null;
  try {
    const x = new URL(s, 'http://x');
    const p = x.pathname || '';
    return p.startsWith('/images/') ? p.replace(/^\/images\//, '/img/') : p;
  } catch {
    return s.startsWith('/images/') ? s.replace(/^\/images\//, '/img/') : s;
  }
}

export default function AppTopbar() {
  const pathname = usePathname() || '/';
  if (HIDE_ON.some((re) => re.test(pathname))) return null;

  const [ready, setReady] = React.useState(false);
  const [displayName, setDisplayName] = React.useState<string>('Angemeldet');
  const [email, setEmail] = React.useState<string>('');
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let ok = true;

    async function load() {
      try {
        // 1) Session check
        const me = await fetch('/api/me', { credentials: 'include', cache: 'no-store' })
          .then(r => r.ok ? r.json() : null).catch(() => null);
        if (!ok || !me?.authenticated) { setReady(true); return; }

        // 2) Profil ziehen (zweiter Versuch /profile/me falls 404)
        let prof: any = await fetch('/api/profile', { credentials: 'include', cache: 'no-store' })
          .then(async r => r.ok ? r.json() : (r.status === 404 ? null : null))
          .catch(() => null);
        if (!prof) {
          prof = await fetch('/api/profile/me', { credentials: 'include', cache: 'no-store' })
            .then(r => r.ok ? r.json() : null).catch(() => null);
        }

        const em = prof?.email ?? me?.user?.email ?? '';
        const fn = prof?.firstName ?? prof?.givenName ?? '';
        const ln = prof?.lastName ?? prof?.familyName ?? '';
        const name =
          (ln || fn) ? [ln, fn].filter(Boolean).join(', ')
          : (prof?.name || (em ? em.split('@')[0] : 'Angemeldet'));

        const av =
          normalizeAvatarUrl(prof?.avatarUrl ?? prof?.avatar) ??
          '/img/avatar-default.png';

        if (!ok) return;
        setEmail(em);
        setDisplayName(name);
        setAvatarUrl(av);
      } finally {
        if (ok) setReady(true);
      }
    }

    load();
    return () => { ok = false; };
  }, []);

  if (!ready) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 border-b border-border bg-card/80 px-4 py-3 backdrop-blur">
      {/* links: Avatar + Name/E-Mail */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 overflow-hidden rounded-full border border-border bg-muted">
          <img src={avatarUrl ?? ''} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-medium">{displayName}</div>
          {email ? <div className="text-xs text-muted-foreground">{email}</div> : null}
        </div>
      </div>

      {/* rechts: Logout */}
      <SignOutButton />
    </div>
  );
}
