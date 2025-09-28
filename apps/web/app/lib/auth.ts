// FILE: apps/web/app/lib/auth.ts
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/** Serverseitig IMMER die interne API priorisieren. */
function apiBase(): string {
  const a = process.env.API_BASE_URL?.trim();
  const b = process.env.NEXT_PUBLIC_API_URL?.trim();
  return (a?.length ? a : b?.length ? b : "http://localhost:4000").replace(/\/+$/, "");
}

/** Lies die Request-Cookies aus (Next: headers() MUSS awaited werden). */
export async function getRequestHeaders(): Promise<HeadersInit> {
  const h = await headers();
  const cookie = h.get("cookie") ?? undefined;
  return cookie ? { cookie } : {};
}

/** Hole den aktuellen User aus dem Session-Cookie; null = nicht eingeloggt. */
export async function getSessionFromCookie<T = unknown>(): Promise<T | null> {
  try {
    const hdrs = await getRequestHeaders();
    const res = await fetch(`${apiBase()}/me`, { headers: hdrs, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Erzwingt eine Session; sonst Redirect auf loginPath. */
export async function requireSession<T = unknown>(loginPath = "/login"): Promise<T | void> {
  const me = await getSessionFromCookie<T>();
  if (!me) redirect(loginPath);
  return me as T;
}

/** Alias, falls du alte Importe hast. */
export async function requireAuth(loginPath = "/login") {
  await requireSession(loginPath);
}
