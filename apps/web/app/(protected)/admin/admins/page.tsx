// FILE: apps/web/app/(protected)/admin/admins/page.tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminsClient from "./AdminsClient";
import { roleSetFrom, isSuperAdmin } from "@/app/lib/rbac";
import SlidePage from "../_components/SlidePage";

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

type Me = unknown;

async function getMe(): Promise<Me | null> {
  try {
    const base = await apiBase();
    const h = await headers();
    const cookie = h.get("cookie") ?? undefined;

    const res = await fetch(`${base}/me`, {
      cache: "no-store",
      headers: { ...(cookie ? { cookie } : {}) },
    });

    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) return null;

    return (await res.json()) as Me;
  } catch {
    return null;
  }
}

export default async function Page() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (!isSuperAdmin(roleSetFrom(me))) redirect("/dashboard");

  return (
    <SlidePage title="Admins verwalten" top={20}>
      <AdminsClient />
    </SlidePage>
  );
}
