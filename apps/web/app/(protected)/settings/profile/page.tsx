// FILE: apps/web/app/(protected)/settings/profile/page.tsx
import { redirect } from "next/navigation";
import ProfileOverviewClient from "./ProfileOverviewClient";
import { loadOverview } from "./OverviewLoader";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function Page() {
  // 1) Serverseitig alles laden (Overview hat Fallbacks auf Einzel-Endpunkte)
  const r = await loadOverview();

  // 2) Unauth → Login (Layout schützt zusätzlich, hier explizit)
  if (!r.ok && (r.status === 401 || r.status === 403)) {
    redirect("/login");
  }

  // 3) Robuste Defaults, damit der Client immer stabile Props bekommt
  const data = r.data ?? {
    user: null,
    profile: null,
    memberships: [],
    invitations: [],
  };

  // 4) An den Client übergeben (Slide steckt im Client – kein Doppel-Wrapper hier)
  return (
    <ProfileOverviewClient
      initial={{
        user: data.user ?? null,
        profile: data.profile ?? null,
        memberships: data.memberships ?? [],
        invitations: data.invitations ?? [],
        // Markiere ungewöhnliche Fehlerfälle (z.B. 5xx), ohne Redirect zu erzwingen:
        unauth: !r.ok && !(r.status === 401 || r.status === 403),
      }}
    />
  );
}
