// FILE: apps/web/app/(protected)/admin/roles/RolesClient.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

/* ---------------------------- types & helpers ---------------------------- */

type Role = "user" | "viewer" | "deputy" | "owner" | "admin" | "superadmin";
type MeDto = unknown;

type ProfileDto = {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  street?: string | null;
  postalCode?: string | null; // Vorgabe-konform
  city?: string | null;
  country?: string | null;
  birthDate?: string | null; // ISO string
};

type UserItem = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  profile?: ProfileDto | null;
  orgMemberships?: Array<{ org: { id: string; name: string; logoUrl?: string | null } }>;
};

type UsersList = { items: UserItem[] };

type OrgItem = {
  id: string;
  name: string;
  logoUrl?: string | null;
  status: string;
  plan: string;
  owner: { id: string; email: string };
  _count: { members: number };
  createdAt: string;
};
type OrgsList = { items: OrgItem[] };

type Scope = "users" | "orgs";

function apiBase(): string {
  const a =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:4000";
  return a.trim().replace(/\/+$/, "");
}

async function api<T>(
  path: string,
  init?: RequestInit
): Promise<{ status: number; data: T | null }> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data: (data as T) ?? null };
}

function fmtDateISO(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(+d) ? "—" : d.toLocaleDateString("de-DE");
}

function fullName(p?: ProfileDto | null) {
  const ln = p?.lastName ?? "";
  const fn = p?.firstName ?? "";
  const n = [ln, fn].filter(Boolean).join(", ");
  return n || "—";
}

function shortAddress(p?: ProfileDto | null) {
  if (!p) return "—";
  const line1 = p.street || "";
  const line2 = [p.postalCode, p.city].filter(Boolean).join(" ");
  const line3 = p.country || "";
  const out = [line1, line2, line3].filter(Boolean).join(" · ");
  return out || "—";
}

const norm = (v: unknown): Role | null => {
  const s = String(v ?? "").toLowerCase();
  return (["user", "viewer", "deputy", "owner", "admin", "superadmin"] as const).includes(
    s as Role
  )
    ? (s as Role)
    : null;
};

const extractRoleFromMe = (me: MeDto) => {
  const any = me as any;
  return (
    norm(any?.role) ||
    norm(any?.user?.role) ||
    norm(any?.me?.role) ||
    (Array.isArray(any?.roles) ? norm(any.roles[0]) : null)
  );
};

// Vorgabe: Owner nur viewer/deputy; Admin keine (super)admin; Superadmin alles
const allowedToAssign = (actor: Role): ReadonlyArray<Role> =>
  actor === "superadmin"
    ? ["user", "viewer", "deputy", "owner", "admin", "superadmin"]
    : actor === "admin"
    ? ["user", "viewer", "deputy", "owner"]
    : actor === "owner"
    ? ["viewer", "deputy"]
    : [];

// Admin/Owner dürfen Ziele mit serverRole ∈ {admin, superadmin} NICHT bearbeiten
function isProtectedTargetFor(actor: Role | null, targetServerRole: Role): boolean {
  return !!actor && actor !== "superadmin" && (targetServerRole === "admin" || targetServerRole === "superadmin");
}

/* --------------------------------- UI ----------------------------------- */

// Lokaler Zeilentyp mit Snapshot des zuletzt bestätigten Serverwerts
type UserRow = UserItem & { _serverRole: Role };

export default function RolesClient() {
  const [open, setOpen] = React.useState(true);
  const router = useRouter(); // ✅ für Redirect beim Schließen

  // Rechte-Kontext
  const [actor, setActor] = React.useState<Role | null>(null);
  const [assignable, setAssignable] = React.useState<ReadonlyArray<Role>>([]);

  React.useEffect(() => {
    (async () => {
      const { status, data } = await api<MeDto>("/me");
      const r = status === 200 && data ? extractRoleFromMe(data) : null;
      const effective = r ?? "admin";
      setActor(effective);
      setAssignable(allowedToAssign(effective));
    })();
  }, []);

  // Suche & Filter
  const [scope, setScope] = React.useState<Scope>("users");
  const [roleFilter, setRoleFilter] = React.useState<"all" | Role>("all");
  const [q, setQ] = React.useState("");

  // Daten
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [orgs, setOrgs] = React.useState<OrgItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null); // row-scope busy

  const readyButNoRights = actor && assignable.length === 0;

  const close = React.useCallback(() => {
    setOpen(false);
    router.replace("/dashboard");   // ✅ zurück zum Dashboard
    router.refresh();               // ✅ Daten neu laden
  }, [router]);

  async function load() {
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      if (scope === "users") {
        const qs = new URLSearchParams();
        if (q.trim()) qs.set("query", q.trim());
        if (roleFilter !== "all") qs.set("role", roleFilter);
        const { status, data } = await api<UsersList>(
          `/admin/roles/users${qs.toString() ? `?${qs}` : ""}`
        );
        if (status === 200 && data) {
          const mapped: UserRow[] = data.items.map((u) => ({
            ...u,
            _serverRole: u.role,
          }));
          setUsers(mapped);
        } else {
          setErr("Nutzerliste konnte nicht geladen werden.");
          setUsers([]);
        }
        setOrgs([]);
      } else {
        const qs = new URLSearchParams();
        if (q.trim()) qs.set("query", q.trim());
        const { status, data } = await api<OrgsList>(
          `/admin/roles/organizations${qs.toString() ? `?${qs}` : ""}`
        );
        if (status === 200 && data) setOrgs(data.items);
        else setErr("Unternehmensliste konnte nicht geladen werden.");
        setUsers([]);
      }
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, roleFilter]);

  // Nur lokale Auswahl ändern (wir rendern ohnehin nur erlaubte Optionen)
  function selectLocal(u: UserRow, r: Role) {
    if (u.role === r) return;
    setUsers((xs) => xs.map((x) => (x.id === u.id ? { ...x, role: r } : x)));
  }

  // Speichern mit Revert bei Fehlschlag + Schutz von Admin/Superadmin-Zielen
  async function save(u: UserRow) {
    if (!actor) return;

    const protectedTarget = isProtectedTargetFor(actor, u._serverRole);
    const chosen = u.role;
    const previous = u._serverRole;

    // Geschützte Ziele: sofortiger Revert + Meldung
    if (protectedTarget) {
      setErr("Nur Superadmins dürfen Admins/Superadmins ändern.");
      setUsers((xs) => xs.map((x) => (x.id === u.id ? { ...x, role: previous } : x)));
      return;
    }

    // Vorab-Client-Check: Rolle liegt außerhalb der zuweisbaren Menge → Revert
    if (!assignable.includes(chosen)) {
      setErr("Diese Rolle darfst du nicht vergeben.");
      setUsers((xs) => xs.map((x) => (x.id === u.id ? { ...x, role: previous } : x)));
      return;
    }

    setBusy(u.id);
    setErr(null);
    setMsg(null);

    const { status } = await api(`/admin/roles/set-role`, {
      method: "POST",
      body: JSON.stringify({ userId: u.id, role: chosen }),
    });

    setBusy(null);

    if (status === 200) {
      // Erfolg → Snapshot aktualisieren
      setUsers((xs) =>
        xs.map((x) => (x.id === u.id ? { ...x, _serverRole: chosen } : x))
      );
      setMsg("Rolle aktualisiert.");
      return;
    }

    // Fehlschlag → HARTE Rücknahme auf Server-Snapshot
    setUsers((xs) => xs.map((x) => (x.id === u.id ? { ...x, role: previous } : x)));

    if (status === 409)
      return setErr(
        "Superadmins können nicht heruntergestuft werden (mindestens einer muss bestehen)."
      );
    if (status === 403) return setErr("Keine Berechtigung / Ziel nicht erlaubt.");
    if (status === 404) return setErr("Benutzer nicht gefunden.");
    setErr(`Fehler beim Aktualisieren (Status ${status || "Netzwerk"})`);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <SheetContent side="bottom" className="max-h-[94vh] overflow-y-auto">
        <SheetHeader>
          <div className="mt-1 flex items-start justify-between gap-4 pb-1">
            <div className="grid gap-1">
              <SheetTitle className="pl-4">User-Rollen vergeben</SheetTitle>
              <SheetDescription className="pl-4">
                Rollen/Zugriffsrechte mandantenweit verwalten (MVP).
              </SheetDescription>
            </div>
            <div className="shrink-0">
              <Button variant="secondary" onClick={close}>
                Schließen
              </Button>
            </div>
          </div>
        </SheetHeader>

        {(err || msg || readyButNoRights) && (
          <div className="mx-4 mt-3 space-y-2">
            {(err || msg) && (
              <div
                className={`rounded border px-3 py-2 text-xs ${
                  err
                    ? "bg-red-50 text-red-900 border-red-200"
                    : "bg-green-50 text-green-900 border-green-200"
                }`}
              >
                {err ?? msg}
              </div>
            )}
            {readyButNoRights && (
              <div className="rounded border px-3 py-2 text-xs bg-yellow-50 text-yellow-900 border-yellow-200">
                Du darfst keine Rollen vergeben.
              </div>
            )}
          </div>
        )}

        {/* Suche + Kategorie */}
        <section className="mt-4">
          <div className="rounded-xl border bg-card p-4 text-card-foreground">
            <div className="mb-2 text-sm font-medium">Nutzer suchen</div>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="E-Mail oder Name"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void load();
                }}
                className="min-w-[260px] max-w-lg"
                disabled={loading}
              />

              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={scope === "orgs" ? "orgs" : roleFilter}
                onChange={(e) => {
                  const v = e.target.value as any;
                  if (v === "orgs") {
                    setScope("orgs");
                    return;
                  }
                  setScope("users");
                  setRoleFilter(v);
                }}
                disabled={loading}
                aria-label="Kategorie"
              >
                <option value="all">Alle Nutzer</option>
                <option value="user">Nur User</option>
                <option value="viewer">Nur Viewer</option>
                <option value="deputy">Nur Deputy</option>
                <option value="owner">Nur Owner</option>
                <option value="admin">Nur Admins</option>
                <option value="superadmin">Nur Superadmins</option>
                <option value="orgs">Alle Unternehmen</option>
              </select>

              <Button type="button" onClick={() => void load()} disabled={loading}>
                {loading ? "Sucht…" : "Suchen"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setQ("");
                  void load();
                }}
                disabled={loading}
              >
                Alle
              </Button>
            </div>
          </div>
        </section>

        {/* Nutzerliste */}
        {scope === "users" && (
          <section className="mt-6 grid gap-4">
            {users.length === 0 && !loading && (
              <div className="p-4 text-sm text-muted-foreground">Keine Treffer.</div>
            )}
            {users.map((u) => {
              const name = fullName(u.profile);
              const avatar = u.profile?.avatarUrl || "/img/avatar-default.png";
              const addr = shortAddress(u.profile);
              const bd = fmtDateISO(u.profile?.birthDate || null);

              // Regeln: geschützte Ziele → read-only; sonst nur erlaubte Rollen anzeigen
              const protectedTarget = isProtectedTargetFor(actor, u._serverRole);
              const visibleRoles = protectedTarget ? [] : assignable;

              return (
                <Card key={u.id} className="text-sm">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatar}
                        alt=""
                        className="h-9 w-9 rounded-full border object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <div className="truncate">{name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {u.email}
                        </div>
                      </div>
                      <div className="ml-auto text-[11px] text-muted-foreground">
                        seit {new Date(u.createdAt).toLocaleDateString("de-DE")}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2 pb-4">
                    <div className="text-xs text-muted-foreground">
                      <span className="mr-2 opacity-70">Adresse:</span>
                      {addr}
                      <span className="mx-2">•</span>
                      <span className="mr-2 opacity-70">Geburt:</span>
                      {bd}
                    </div>

                    {protectedTarget ? (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Dieser Account hat die Rolle <b>{u._serverRole}</b> und kann nur von einem
                        <b> Superadmin</b> geändert werden.
                      </div>
                    ) : (
                      <>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {visibleRoles.map((r) => {
                            const checked = u.role === r;
                            return (
                              <label
                                key={r}
                                className="inline-flex items-center gap-2 rounded border px-3 py-1 cursor-pointer"
                                title={checked ? "Rolle ausgewählt" : "Rolle auswählen"}
                              >
                                <input
                                  type="radio"
                                  name={`role-${u.id}`}
                                  checked={checked}
                                  disabled={busy === u.id}
                                  onChange={() => selectLocal(u, r)}
                                />
                                <span className="capitalize">{r}</span>
                              </label>
                            );
                          })}
                        </div>

                        <div>
                          <Button onClick={() => void save(u)} disabled={busy === u.id || u.role === u._serverRole}>
                            {busy === u.id ? "Speichert…" : "Speichern"}
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}

        {/* Unternehmensliste */}
        {scope === "orgs" && (
          <section className="mt-6 grid gap-3">
            {orgs.length === 0 && !loading && (
              <div className="p-4 text-sm text-muted-foreground">
                Keine Organisationen gefunden.
              </div>
            )}
            {orgs.map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-3 rounded-md border p-3 text-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={o.logoUrl || "/img/avatar-default.png"}
                  alt=""
                  className="h-9 w-9 rounded border bg-background object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <div className="font-medium truncate">{o.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    Owner: {o.owner?.email ?? "—"} • Mitglieder: {o._count?.members ?? 0}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground">
                    {o.plan?.toUpperCase?.() || "PLAN —"} •{" "}
                    {o.status?.toUpperCase?.() || "STATUS —"}
                  </span>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    seit {new Date(o.createdAt).toLocaleDateString("de-DE")}
                  </span>
                </div>
              </div>
            ))}
          </section>
        )}

        <SheetFooter className="mt-6">
          <div className="flex-1" />
          <Button variant="secondary" onClick={close}>
            Schließen
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
