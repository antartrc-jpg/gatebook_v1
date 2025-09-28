// FILE: apps/web/lib/api.ts
// WO-WEB-4 · API Client (SSR + Client)
// - 410 → GoneError
// - Neutrale ApiError-Meldungen
// - Proxy-first über /api (Next-Rewrite); Direct-Mode via ENV
// - Server: Cookies werden an die API durchgereicht

import { cookies, headers } from "next/headers";

/* ============================== Fehlerklassen ============================== */

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string = "API_ERROR",
    public status: number = 500
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class GoneError extends ApiError {
  constructor(message = "Der Link ist nicht mehr gültig.", code = "TOKEN_GONE") {
    super(message, code, 410);
    this.name = "GoneError";
  }
}
export function isGoneError(err: unknown): err is GoneError {
  return err instanceof GoneError;
}

/* ============================== API-Basen ============================== */

function isDirect(): boolean {
  return (process.env.NEXT_PUBLIC_API_DIRECT ?? "").trim() === "1";
}

function directEnvBase(): string | null {
  const base =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "";
  const trimmed = base.trim().replace(/\/+$/, "");
  return trimmed.length ? trimmed : null;
}

/** Client-Basis (für `use client` Komponenten): Proxy → '/api', sonst absolute ENV. */
export function apiClientBase(): string {
  if (!isDirect()) return "/api";
  const base = directEnvBase();
  if (!base) throw new ApiError("API-Basis ist nicht konfiguriert.", "CONFIG", 500);
  return base;
}

/** Server-Basis: Direct-Mode → ENV, sonst absolute URL aus Forwarded-Headern + '/api'. */
export async function apiServerBase(): Promise<string> {
  if (isDirect()) {
    const base = directEnvBase();
    if (!base) throw new ApiError("API-Basis ist nicht konfiguriert.", "CONFIG", 500);
    return base;
  }
  const h = await headers(); // Next 15: async
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  return `${proto}://${host}/api`;
}

/* ============================== Helpers ============================== */

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try { return (await res.json()) as T; } catch { return null; }
  }
  return null;
}

function withJsonHeaders(h?: Record<string, string>): Headers {
  const out = new Headers(h);
  if (!out.has("accept")) out.set("accept", "application/json");
  if (!out.has("content-type")) out.set("content-type", "application/json");
  return out;
}

async function buildServerHeaders(extra?: Record<string, string>): Promise<Headers> {
  const hdrs = new Headers(withJsonHeaders(extra));
  try {
    const jar = await cookies();
    const cookie = jar.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    if (cookie) hdrs.set("cookie", cookie);
  } catch { /* noop */ }
  return hdrs;
}

/* ============================== Server-Fetch ============================== */

/** Response-basierter Server-Fetch (wirft NICHT bei !ok). Cookies werden durchgereicht. */
export async function serverApiFetch(
  path: string,
  init?: Omit<RequestInit, "headers"> & { headers?: Record<string, string> }
): Promise<Response> {
  const base = await apiServerBase();
  const url = joinUrl(base, path);
  return fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: await buildServerHeaders(init?.headers),
    redirect: "manual",
  });
}

/** JSON-basierter Server-Fetch mit standardisierten Fehlern (410/GoneError, !ok/ApiError). */
export async function serverApiJson<T>(
  path: string,
  init?: Omit<RequestInit, "headers"> & { headers?: Record<string, string> }
): Promise<T> {
  const res = await serverApiFetch(path, init);

  if (res.status === 204) return null as unknown as T;

  if (res.status === 410) {
    const body = await safeJson(res);
    throw new GoneError((body as any)?.message ?? "Der Link ist abgelaufen oder wurde bereits verwendet.");
  }

  if (!res.ok) {
    const body = await safeJson(res);
    const message =
      (body as any)?.message ??
      (res.status === 401 ? "Die angegebenen Daten sind nicht gültig." : "Es ist ein Fehler aufgetreten.");
    const code = (body as any)?.code ?? "API_ERROR";
    throw new ApiError(message, code, res.status);
  }

  return (await safeJson<T>(res)) as T;
}

/* ============================== Client-Fetch (JSON) ============================== */

export async function clientApiFetch<T>(
  path: string,
  init?: Omit<RequestInit, "headers"> & { headers?: Record<string, string> }
): Promise<T> {
  const base = apiClientBase();
  const url = joinUrl(base, path);

  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: withJsonHeaders(init?.headers),
    redirect: "manual",
  });

  if (res.status === 204) return null as unknown as T;

  if (res.status === 410) {
    const body = await safeJson(res);
    throw new GoneError((body as any)?.message ?? "Der Link ist abgelaufen oder wurde bereits verwendet.");
  }

  if (!res.ok) {
    const body = await safeJson(res);
    const message =
      (body as any)?.message ??
      (res.status === 401 ? "Die angegebenen Daten sind nicht gültig." : "Es ist ein Fehler aufgetreten.");
    const code = (body as any)?.code ?? "API_ERROR";
    throw new ApiError(message, code, res.status);
  }

  return (await safeJson<T>(res)) as T;
}

/* ============================== Isomorpher Wrapper (JSON) ============================== */

export async function apiFetch<T>(
  path: string,
  init?: Omit<RequestInit, "headers"> & { headers?: Record<string, string> }
): Promise<T> {
  if (typeof window === "undefined") {
    return serverApiJson<T>(path, init);
  }
  return clientApiFetch<T>(path, init);
}

/* ============================== Convenience ============================== */

export async function verifyEmailServer(token: string): Promise<"ok" | "gone" | "error"> {
  try {
    await serverApiJson<unknown>(`/auth/verify?token=${encodeURIComponent(token)}`, { method: "GET" });
    return "ok";
  } catch (e) {
    if (isGoneError(e)) return "gone";
    return "error";
  }
}

export async function loginServer(email: string, password: string): Promise<"ok" | "invalid" | "error"> {
  try {
    await serverApiJson<unknown>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return "ok";
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return "invalid";
    return "error";
  }
}

export async function registerServer(
  email: string,
  password: string,
  confirmPassword?: string
): Promise<"ok" | "error"> {
  try {
    await serverApiJson<unknown>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        confirmPassword: confirmPassword ?? password,
      }),
    });
    return "ok";
  } catch {
    return "error";
  }
}

/*
[Hinweise]
– Proxy-Mode (Default): next.config.js → rewrites:
    rewrites: () => [{ source: "/api/:path*", destination: "http://localhost:4000/:path*" }]
– Direct-Mode aktivieren: NEXT_PUBLIC_API_DIRECT=1 und eine ENV:
    API_BASE_URL / NEXT_PUBLIC_API_BASE_URL / NEXT_PUBLIC_API_URL
*/
