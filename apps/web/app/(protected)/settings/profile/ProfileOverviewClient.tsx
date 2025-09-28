// FILE: apps/web/app/(protected)/settings/profile/ProfileOverviewClient.tsx
"use client";

import * as React from "react";
import ProfileForm from "./ProfileForm";
import Memberships from "./Memberships";
import SlidePage from "../../admin/_components/SlidePage";
import type { ProfilePayload } from "./actions";

type Membership = { orgId: string; orgName: string; plan?: string | null; status?: string | null };
type Invite = { id: string; orgId: string; orgName: string; role: string; token: string; expiresAt: string };

type Initial = {
  user?: { email?: string } | null;
  profile?: Partial<ProfilePayload> | null;
  memberships?: Membership[];
  invitations?: Invite[];
  unauth?: boolean; // nur Info, kein Redirect
};

const GENDERS = new Set<NonNullable<ProfilePayload["gender"]>>([
  "male",
  "female",
  "diverse",
  "unspecified",
]);

function pick<T>(...vals: T[]): T | null {
  for (const v of vals) if (v !== undefined && v !== null && String(v).length) return v;
  return null;
}
function normGender(x: unknown): ProfilePayload["gender"] {
  const s = String(x ?? "").toLowerCase().trim() as ProfilePayload["gender"];
  return GENDERS.has(s as any) ? s : "unspecified";
}
function normProfile(p?: unknown): ProfilePayload {
  const o = (p && typeof p === "object" ? (p as any) : {}) as Record<string, unknown>;
  const birth = pick(o.birthDate as string | null | undefined, o["birth_date"] as any);
  return {
    title:      pick(o.title as any,       o["title"]),
    firstName:  pick(o.firstName as any,   o["first_name"]),
    lastName:   pick(o.lastName as any,    o["last_name"]),
    street:     pick(o.street as any,      o["street"]),
    postalCode: pick(o.postalCode as any,  o["postal_code"]),
    city:       pick(o.city as any,        o["city"]),
    country:    pick(o.country as any,     o["country"]) ?? "DE",
    birthDate:  birth ? String(birth).slice(0, 10) : null,
    gender:     normGender(o.gender ?? o["gender"]),
    avatarUrl:  pick(o.avatarUrl as any,   o["avatar_url"]),
  };
}
function displayName(p: ProfilePayload, u?: { email?: string } | null): string {
  const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
  return name || u?.email || "";
}

export default function ProfileOverviewClient({ initial }: { initial: Initial }) {
  // keine Client-Requests mehr → 401 weg
  const profile = React.useMemo(() => normProfile(initial?.profile ?? {}), [initial?.profile]);
  const memberships = initial?.memberships ?? [];
  const invitations = initial?.invitations ?? [];
  const name = displayName(profile, initial?.user);

  return (
    <SlidePage title="Profil & Mitgliedschaften" top={64}>
      <div className="mb-4 text-sm text-muted-foreground">
        Angemeldet als <span className="font-medium">{name || "—"}</span>
      </div>

      <ProfileForm initial={profile} />

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Meine Organisationen</h2>
        <Memberships initialMemberships={memberships} initialInvites={invitations} />
      </section>
    </SlidePage>
  );
}
