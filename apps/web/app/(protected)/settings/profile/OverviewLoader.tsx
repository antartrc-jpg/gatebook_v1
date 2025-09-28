// FILE: apps/web/app/(protected)/settings/profile/OverviewLoader.tsx
"use server";

import { headers } from "next/headers";

export type Overview = {
  user?: { id: string; email: string; role: string } | null;
  profile?: any | null;
  memberships?: any[] | null;
  invitations?: any[] | null;
};

export type SavePayload = {
  title?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  birthDate?: string | null; // YYYY-MM-DD
  gender?: string | null;
  avatarUrl?: string | null;
};

// ---- Helper: absolute API-Base + Cookie-Header (Next 15: headers() ist async)
async function resolveApiBaseAndCookie(): Promise<{ base: string; hdrs: HeadersInit | undefined }> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host  = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  const base  = (process.env.NEXT_PUBLIC_API_URL?.trim() || `${proto}://${host}/api`).replace(/\/+$/, "");

  const cookie = h.get("cookie") ?? "";
  const hdrs: HeadersInit | undefined = cookie ? { cookie } : undefined;

  return { base, hdrs };
}

export async function loadOverview(): Promise<{
  ok: boolean;
  status: number;
  data: Overview | null;
  text: string;
}> {
  try {
    const { base, hdrs } = await resolveApiBaseAndCookie();

    const r = await fetch(`${base}/account/overview`, {
      headers: hdrs,
      cache: "no-store",
    });

    let txt = "";
    if (r.ok) {
      const data: any = await r.json().catch(() => ({}));

      // Fallback-Profil nachladen, falls leer
      if (!data?.profile || (typeof data.profile === "object" && Object.keys(data.profile).length === 0)) {
        const p1 = await fetch(`${base}/account/profile`, { headers: hdrs, cache: "no-store" });
        if (p1.ok) {
          data.profile = await p1.json().catch(() => null);
        } else {
          const p2 = await fetch(`${base}/profile`, { headers: hdrs, cache: "no-store" });
          if (p2.ok) data.profile = await p2.json().catch(() => null);
        }
      }

      return {
        ok: true,
        status: r.status,
        data: {
          user:        data?.user ?? null,
          profile:     data?.profile ?? null,
          memberships: data?.memberships ?? [],
          invitations: data?.invitations ?? [],
        },
        text: "",
      };
    }

    try { txt = await r.text(); } catch { /* ignore */ }

    // Fallback: Endpunkte einzeln laden und mergen
    const [p, m, i] = await Promise.all([
      fetch(`${base}/account/profile`,     { headers: hdrs, cache: "no-store" }),
      fetch(`${base}/account/memberships`, { headers: hdrs, cache: "no-store" }),
      fetch(`${base}/account/invitations`, { headers: hdrs, cache: "no-store" }),
    ]);

    const merged: Overview = {
      user: null,
      profile: p.ok ? await p.json().catch(() => null) : null,
      memberships: m.ok
        ? await m.json().catch(() => ([] as any)).then((x: any) => x?.memberships ?? x ?? [])
        : [],
      invitations: i.ok
        ? await i.json().catch(() => ([] as any)).then((x: any) => x?.invitations ?? x ?? [])
        : [],
    };

    if (merged.profile || (merged.memberships?.length ?? 0) || (merged.invitations?.length ?? 0)) {
      return { ok: true, status: 200, data: merged, text: "" };
    }

    return { ok: false, status: r.status, data: null, text: txt || "SERVER_ERROR" };
  } catch (e: any) {
    return { ok: false, status: 500, data: null, text: String(e?.message || "Serverfehler") };
  }
}

export async function saveProfile(
  payload: SavePayload
): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const { base, hdrs } = await resolveApiBaseAndCookie();

    const r = await fetch(`${base}/account/profile`, {
      method: "PUT",
      headers: { ...(hdrs ?? {}), "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (r.ok) return { ok: true, status: r.status, text: "" };

    let txt = "";
    try { txt = await r.text(); } catch { /* ignore */ }
    return { ok: false, status: r.status, text: txt || "SAVE_FAILED" };
  } catch (e: any) {
    return { ok: false, status: 500, text: String(e?.message || "Serverfehler") };
  }
}
