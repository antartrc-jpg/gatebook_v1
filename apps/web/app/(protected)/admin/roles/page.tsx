// FILE: apps/web/app/(protected)/admin/roles/page.tsx
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import RolesClient from "./RolesClient";
import { roleSetFrom, isAdmin, isSuperAdmin } from "@/app/lib/rbac";

export const revalidate = 0;
export const dynamic = "force-dynamic";

/** Server-seitig absolute API-Base bauen (Proxy-/Port-sicher) */
async function apiBase(): Promise<string> {
  const env = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host  = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  return `${proto}://${host}/api`;
}

async function getMe(): Promise<unknown | null> {
  try {
    const base = await apiBase();
    const jar = await cookies();
    const cookie = jar.getAll().map(c => `${c.name}=${c.value}`).join("; ");

    const res = await fetch(`${base}/me`, {
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
      redirect: "manual",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function Page() {
  const me = await getMe();
  if (!me) redirect("/login");

  const roles = roleSetFrom(me);
  if (!(isAdmin(roles) || isSuperAdmin(roles))) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">User-Rollen vergeben</h1>
      <p className="text-sm text-muted-foreground">
        Rollen/Zugriffsrechte mandantenweit verwalten (MVP).
      </p>
      <div className="mt-6">
        <RolesClient />
      </div>
    </main>
  );
}
