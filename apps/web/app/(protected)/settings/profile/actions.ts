// FILE: apps/web/app/(protected)/settings/profile/actions.ts
"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

/** Base-URL der API (serverseitig!) */
function apiBase(): string {
  const srv = process.env.API_BASE_URL?.trim();
  const pub = process.env.NEXT_PUBLIC_API_URL?.trim();
  return (srv?.length ? srv : (pub?.length ? pub : "http://localhost:4000")).replace(/\/+$/, "");
}

/** Payload-Typ, an deinen Form-Shape anpassen */
export type ProfilePayload = {
  title?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  birthDate?: string | null;   // "YYYY-MM-DD"
  gender?: "male" | "female" | "diverse" | "unspecified" | null;
  avatarUrl?: string | null;
};

/** Avatar-URL normalisieren: Host droppen, /images → /img */
function norm(u?: string | null) {
  const s = String(u ?? "").trim();
  if (!s) return null;
  try {
    const x = new URL(s, "http://x");
    const p = x.pathname || "";
    return p.replace(/^\/images\//, "/img/");
  } catch {
    return s.replace(/^\/images\//, "/img/");
  }
}

/** Server Action: Speichern ohne Client-CORS/401 */
export async function saveProfile(payload: ProfilePayload) {
  const hdrs = await headers();                // <- headers() awaiten
  const cookie = hdrs.get("cookie") ?? "";

  // Avatar-URL vor dem Senden bereinigen
  const normalized: ProfilePayload = {
    ...payload,
    avatarUrl: norm(payload.avatarUrl),
  };

  const res = await fetch(`${apiBase()}/account/profile`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify(normalized),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API /account/profile ${res.status}: ${text}`);
  }

  // Seite neuvalidieren, damit SSR-Lader sofort aktualisierte Daten anzeigt
  revalidatePath("/settings/profile");
  return res.json().catch(() => ({}));
}
