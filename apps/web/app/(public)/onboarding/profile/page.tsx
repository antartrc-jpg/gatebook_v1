// FILE: apps/web/app/(public)/onboarding/profile/page.tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ProfileForm from "./ProfileForm";

export const revalidate = 0;
export const dynamic = "force-dynamic";

function apiBase(): string {
  return "/api";
}

async function detectCountryFromAcceptLanguage(): Promise<{ country: string; locale: string }> {
  const hdrs = await headers(); // import { headers } from "next/headers";
  const accept = hdrs.get("accept-language") ?? "";
  const primary = accept.split(",")[0]?.trim() || "de-DE";
  const country = (primary.match(/-([A-Za-z]{2})/)?.[1] || "DE").toUpperCase();
  return { country, locale: primary };
}

async function getProfileStatus(): Promise<{ completed: boolean } | null> {
  const hdrs = await headers();                                   // ✅ await
  const cookie = hdrs.get("cookie") ?? undefined;

  const res = await fetch(`${apiBase()}/profile/status`, {
    headers: cookie ? { cookie } : {},
    cache: "no-store",
  });

  if (res.status === 401) return null;            // nicht eingeloggt
  if (!res.ok) return { completed: false };       // konservativ anzeigen
  return (await res.json()) as { completed: boolean };
}

export default async function Page() {
  const status = await getProfileStatus();

  // Nicht eingeloggt -> Login
  if (!status) redirect("/login");

  // Bereits abgeschlossen -> Dashboard
  if (status.completed) redirect("/dashboard");

  // Defaults aus Accept-Language
  const { country, locale } = await detectCountryFromAcceptLanguage();

  return (
    <main className="container mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-semibold">Profil vervollständigen</h1>
      {/* Falls ProfileForm diese Props (noch) nicht kennt: Signatur um defaultCountry/defaultLocale ergänzen. */}
      <ProfileForm defaultCountry={country} defaultLocale={locale} />
    </main>
  );
}




