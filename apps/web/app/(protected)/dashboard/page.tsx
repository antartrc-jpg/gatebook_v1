// FILE: apps/web/app/(protected)/dashboard/page.tsx
import Link from "next/link";
import { roleSetFrom, isSuperAdmin, isAdmin } from "../../lib/rbac";
import { headers, cookies } from "next/headers";

export const revalidate = 0;

type LicenseDto = { status?: "active" | "inactive" | "unknown"; validTo?: string | null };
type MeLike = Record<string, unknown>;

export default async function DashboardPage() {
  // absolute API-Base für Serverside-Fetch bauen + Cookies weiterreichen
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host  = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  const API_BASE = (process.env.NEXT_PUBLIC_API_URL?.trim() || `${proto}://${host}/api`).replace(/\/+$/, "");

  const jar = await cookies();
  const cookie = jar.getAll().map(c => `${c.name}=${c.value}`).join("; ");

  // Lizenzstatus holen (absolute URL + Cookie)
  const licRes = await fetch(`${API_BASE}/license/status`, {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });
  if (!licRes.ok) throw new Error(`license status ${licRes.status}`);
  const license = (await licRes.json()) as LicenseDto | null;

  // /me analog absolut holen
  const meRes = await fetch(`${API_BASE}/me`, {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });
  const me = (await meRes.json()) as MeLike | null;

  const roles = roleSetFrom(me ?? null);
  const superAdmin = isSuperAdmin(roles);
  const admin = isAdmin(roles);

  const tiles = superAdmin
    ? [
        { href: "/admin/theme",      title: "Layout anpassen",         desc: "Farben, Schriften, Abstände." },
        { href: "/admin/roles",      title: "User-Rollen vergeben",    desc: "Rollen/Zugriffsrechte." },
        { href: "/settings/profile", title: "Profil & Konto",          desc: "Name, Adresse, Avatar." },
      ]
    : admin
    ? [
        { href: "/admin/roles",      title: "User-Rollen vergeben",    desc: "Rollen/Zugriffsrechte." },
        { href: "/settings/profile", title: "Profil & Konto",          desc: "Name, Adresse, Avatar." },
      ]
    : [
        { href: "/settings/profile", title: "Profil & Konto",          desc: "Name, Adresse, Avatar." },
        { href: "/owner/onboarding", title: "Unternehmen registrieren",desc: "Onboarding starten." },
        { href: "/invitations",      title: "Einladungen",             desc: "Team einladen und verwalten." },
        { href: "/projects",         title: "Projekte",                desc: "Projekte und Gates." },
      ];

  return (
    <main className="min-h-[100dvh] bg-background p-6 text-foreground">
      <div className="mx-auto max-w-6xl space-y-6">
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Lizenzstatus: <strong>{license?.status ?? "unknown"}</strong>
            {license?.validTo ? <> · gültig bis {new Date(license.validTo).toLocaleDateString("de-DE")}</> : null}
          </p>
        </section>

        {((license?.status ?? "inactive") !== "active") && !superAdmin && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
            <strong>Hinweis:</strong> Ihre Organisation ist noch nicht freigeschaltet.
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t) => (
            <Link key={t.href} href={t.href} className="block focus:outline-none">
              <div className="transition hover:bg-accent/10 rounded-lg border">
                <div className="p-4">
                  <div className="text-base font-medium">{t.title}</div>
                  <div className="text-sm text-muted-foreground">{t.desc}</div>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
