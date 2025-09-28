// FILE: apps/web/app/layout.tsx
import "./globals.css";
import * as React from "react";
import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import AppTopbar from "./_components/AppTopbar";   // ⬅️ NEU

export const revalidate = 0;
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "GateBook",
  description: "Login & Dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Direkt gegen die API (ENV); in DEV Fallback auf 4000
const API_BASE =
  (process.env.API_BASE_URL ?? "").replace(/\/+$/, "") ||
  (process.env.NODE_ENV !== "production" ? "http://localhost:4000" : ""); // prod ohne Fallback

const api = (p: string) => {
  if (!API_BASE) throw new Error("API_BASE_URL fehlt");
  return `${API_BASE}${p}`;
};

type MeDto =
  | {
      authenticated?: boolean;
      user?: { id: string; email: string; role: string; profileCompleted?: boolean };
    }
  | null;

type ProfileStatus = { completed: boolean };
type CookieKV = { name: string; value: string };

async function getIncomingCookieHeader(): Promise<string | undefined> {
  // 1) Aus Request-Cookies bauen
  try {
    const bag = await cookies();
    const list = bag.getAll() as unknown as CookieKV[];
    if (list?.length) {
      return list.map(({ name, value }) => `${name}=${encodeURIComponent(value)}`).join("; ");
    }
  } catch {}
  // 2) Fallback: rohen Header lesen
  try {
    const h = await headers();
    const raw = h.get("cookie");
    if (raw) return raw;
  } catch {}
  return undefined;
}

async function fetchJson<T>(
  url: string,
  cookie?: string
): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json", ...(cookie ? { cookie } : {}) },
      redirect: "manual",
    });

    if (res.status === 204) return { ok: true, status: 204, data: null };

    let data: any = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        data = (await res.json()) as T;
      } catch {}
    }
    return { ok: res.ok, status: res.status, data: (data as T) ?? null };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieHeader = await getIncomingCookieHeader();

  // 1) Auth prüfen (nur wenn nicht auf freien Routen)
  // Hinweis: Wenn du komplett ohne Guard im Root arbeiten willst, verlagere diesen Block nach (protected)/layout.tsx.
  const meRes = await fetchJson<MeDto>(api("/me"), cookieHeader);
  if (meRes.status === 401 || !meRes.ok) {
    // Freie Routen wie /login, /verify etc. dürfen nicht in eine Schleife laufen.
    // Falls nötig, hier vorab den aktuellen Pfad lesen und whitelisten.
    redirect("/login");
  }

  // 2) Onboarding (wenn Route fehlt → nicht blockieren)
  const psRes = await fetchJson<ProfileStatus>(api("/profile/status"), cookieHeader);
  if (psRes.ok && psRes.data && psRes.data.completed === false) {
    redirect("/onboarding/profile");
  }

  // 3) Inhalt rendern
  return (
    <html lang="de">
      <body className="min-h-dvh bg-background text-foreground">
        <AppTopbar />                  {/* ⬅️ NEU: überall sichtbar, außer HIDE_ON */}
        <div className="pt-14">{children}</div> {/* ⬅️ NEU: Abstand unter fixer Topbar */}
      </body>
    </html>
  );
}
