// FILE: apps/web/app/(protected)/layout.tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";

/** Avatar-URL bereinigen: Host entfernen, /images → /img */
function normalizeAvatarUrl(u?: string | null): string | null {
  const s = String(u ?? "").trim();
  if (!s) return null;
  try {
    const x = new URL(s, "http://x"); // verträgt absolute & relative
    const p = x.pathname || "";
    return p.startsWith("/images/") ? p.replace(/^\/images\//, "/img/") : p;
  } catch {
    return s.startsWith("/images/") ? s.replace(/^\/images\//, "/img/") : s;
  }
}

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  // --- API absolut + Cookies mitschicken (wie im Patch) ---
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host  = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  const API_BASE = (process.env.NEXT_PUBLIC_API_URL?.trim() || `${proto}://${host}/api`).replace(/\/+$/, "");

  const jar    = await cookies();
  const cookie = jar.getAll().map(c => `${c.name}=${encodeURIComponent(c.value)}`).join("; ");

  // --- Minimal-Guard (exakt nach Patch) ---
  const meRes = await fetch(`${API_BASE}/me`, {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });
  if (!meRes.ok) redirect("/login");
  const me = await meRes.json();
  if (!me?.authenticated) redirect("/login");

  // --- Helper für JSON-Fetch (no-store + Cookies, akzeptiert nur JSON) ---
  async function getJson<T = any>(path: string): Promise<T | null> {
    try {
      const r = await fetch(`${API_BASE}${path}`, {
        cache: "no-store",
        headers: cookie ? { cookie, accept: "application/json" } : { accept: "application/json" },
        redirect: "manual",
      });
      if (!r.ok) return null;
      const ct = r.headers.get("content-type") || "";
      if (!ct.includes("application/json")) return null;
      return (await r.json()) as T;
    } catch {
      return null;
    }
  }

  // --- Profildaten laden (robust mit Fallbacks) ---
  type ProfileDto = {
    email?: string | null;
    name?: string | null;
    firstName?: string | null;
    givenName?: string | null;
    lastName?: string | null;
    familyName?: string | null;
    avatarUrl?: string | null;
    avatar?: string | null;
  };

  let profile: ProfileDto | null = await getJson<ProfileDto>("/profile");
  if (!profile) profile = await getJson<ProfileDto>("/profile/me");

  if (!profile) {
    const account = (await getJson<any>("/account")) ?? (await getJson<any>("/account/me"));
    if (account) {
      profile = {
        email: account.email ?? me?.user?.email ?? null,
        firstName: account.firstName ?? null,
        lastName: account.lastName ?? null,
        avatarUrl: account.avatarUrl ?? null,
      };
    }
  }

  // --- Daten robust zusammensetzen ---
  const email =
    profile?.email ??
    me?.user?.email ??
    "";

  const firstName =
    profile?.firstName ??
    profile?.givenName ??
    "";

  const lastName =
    profile?.lastName ??
    profile?.familyName ??
    "";

  // Anzeigename: "Nachname, Vorname" → sonst Profilname → sonst Localpart → sonst "Angemeldet"
  const displayName =
    (lastName || firstName)
      ? [lastName, firstName].filter(Boolean).join(", ")
      : (profile?.name || (email ? email.split("@")[0] : "Angemeldet"));

  // Avatar-URL bereinigen: Host abschneiden, /images → /img
  const avatarUrl =
    normalizeAvatarUrl(profile?.avatarUrl ?? profile?.avatar) ??
    "/img/avatar-default.png";

  const initials = (() => {
    const a = (lastName?.[0] || "").toUpperCase();
    const b = (firstName?.[0] || "").toUpperCase();
    if (a || b) return (a + b) || "U";
    if (email) return (email.split("@")[0].slice(0, 2).toUpperCase() || "U");
    return "U";
  })();

  // --- Render: Eigener Header (kein Logout/Topbar hier drin) ---
  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-card/60 backdrop-blur">
        {/* Links: Profil */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center text-xs font-medium">
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              : <span>{initials}</span>}
          </div>
          <div className="leading-tight">
            <div className="font-medium text-sm">{displayName}</div>
            {email ? <div className="text-xs text-muted-foreground">{email}</div> : null}
          </div>
        </div>

        {/* Rechts: Platzhalter – kein Logout hier */}
        <div className="w-9 h-9" />
      </header>

      <div>{children}</div>
    </>
  );
}
