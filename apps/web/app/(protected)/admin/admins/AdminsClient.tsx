// FILE: apps/web/app/(protect)/admin/admins/AdminsClient.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Falls du @gatebook/ui nutzt, kannst du diese einfachen Elemente
// später durch eure Komponenten ersetzen.
function Notice({ kind, children }: { kind: "info" | "success" | "warning" | "error"; children: React.ReactNode }) {
  const map = {
    info: "bg-blue-50 text-blue-900 border-blue-200",
    success: "bg-green-50 text-green-900 border-green-200",
    warning: "bg-yellow-50 text-yellow-900 border-yellow-200",
    error: "bg-red-50 text-red-900 border-red-200",
  } as const;
  return <div className={`border rounded px-3 py-2 text-sm ${map[kind]} mb-2`}>{children}</div>;
}

type AdminUser = {
  id: string;
  email: string;
  role: "admin" | "superadmin";
  createdAt: string;
  // neu:
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
};

type ListResponse = { items: AdminUser[] };
type OkResponse = { ok: true; already?: true };
type ErrResponse =
  | { code: "USER_NOT_FOUND" }
  | { code: "IMMUTABLE_SUPERADMIN" }
  | { code: "CANNOT_REVOKE_SUPERADMIN" }
  | { error: "forbidden" }
  | { code: "FORBIDDEN" };

function apiBase(): string {
  const a = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  return (a.length ? a : "http://localhost:4000").replace(/\/+$/, "");
}

async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; data: T | null }> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

export default function AdminsClient() {
  const [email, setEmail] = React.useState("");
  const [items, setItems] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: "info" | "success" | "warning" | "error"; text: string } | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    const { status, data } = await api<ListResponse>("/admin/admins");
    setLoading(false);
    if (status === 200 && data) {
      setItems(data.items);
    } else if (status === 403) {
      setMsg({ kind: "error", text: "Keine Berechtigung (nur Superadmins)." });
    } else {
      setMsg({ kind: "error", text: "Laden der Admin-Liste fehlgeschlagen." });
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  async function handleGrant() {
    const e = email.trim().toLowerCase();
    if (!e) return setMsg({ kind: "warning", text: "Bitte eine E-Mail eingeben." });

    setLoading(true);
    const { status, data } = await api<OkResponse | ErrResponse>("/admin/admins/grant", {
      method: "POST",
      body: JSON.stringify({ email: e }),
    });
    setLoading(false);

    if (status === 200 && data && (data as OkResponse).ok) {
      if ((data as OkResponse).already) {
        setMsg({ kind: "info", text: "Nichts geändert: Benutzer ist bereits Admin." });
      } else {
        setMsg({ kind: "success", text: "Admin-Rechte vergeben." });
        setEmail("");
        void reload();
      }
      return;
    }

    const err = data as ErrResponse | null;
    if (status === 404 && err && "code" in err && err.code === "USER_NOT_FOUND") {
      return setMsg({ kind: "warning", text: "Benutzer existiert nicht oder ist nicht verifiziert." });
    }
    if (status === 409 && err && "code" in err && err.code === "IMMUTABLE_SUPERADMIN") {
      return setMsg({ kind: "warning", text: "Superadmins können nicht verändert werden." });
    }
    if (status === 403 || (err && ("error" in err || ("code" in err && err.code === "FORBIDDEN")))) {
      return setMsg({ kind: "error", text: "Keine Berechtigung (Session/Superadmin fehlt)." });
    }
    setMsg({ kind: "error", text: "Unbekannter Fehler beim Ernennen." });
  }

  async function handleRevoke(targetEmail: string) {
    setLoading(true);
    const { status, data } = await api<OkResponse | ErrResponse>("/admin/admins/revoke", {
      method: "POST",
      body: JSON.stringify({ email: targetEmail }),
    });
    setLoading(false);

    if (status === 200 && data && (data as OkResponse).ok) {
      if ((data as OkResponse).already) {
        setMsg({ kind: "info", text: "Nichts geändert: Benutzer war kein Admin." });
      } else {
        setMsg({ kind: "success", text: "Admin-Rechte entzogen." });
        void reload();
      }
      return;
    }

    const err = data as ErrResponse | null;
    if (status === 409 && err && "code" in err && err.code === "CANNOT_REVOKE_SUPERADMIN") {
      return setMsg({ kind: "warning", text: "Superadmins können nicht verändert werden." });
    }
    if (status === 404 && err && "code" in err && err.code === "USER_NOT_FOUND") {
      return setMsg({ kind: "warning", text: "Benutzer existiert nicht." });
    }
    if (status === 403 || (err && ("error" in err || ("code" in err && err.code === "FORBIDDEN")))) {
      return setMsg({ kind: "error", text: "Keine Berechtigung (Session/Superadmin fehlt)." });
    }
    setMsg({ kind: "error", text: "Unbekannter Fehler beim Entziehen." });
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Übersicht</h1>

      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      <div className="border rounded p-4 space-y-3">
        <div className="font-medium">Admin hinzufügen</div>
        <div className="flex gap-2">
          <Input
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            placeholder="E-Mail"
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={handleGrant} className="h-10">Ernennen</Button>
        </div>
        <div className="text-xs text-gray-500">Nur verifizierte Benutzer können ernannt werden.</div>
      </div>

      <div className="border rounded p-4">
        <div className="font-medium mb-2">Aktuelle Admins</div>
        {loading && items.length === 0 ? <div>Laden…</div> : null}
        {items.length === 0 && !loading ? <div className="text-sm text-gray-500">Keine Admins gefunden.</div> : null}

        <ul className="divide-y divide-white/10">
          {items.map((u) => {
            const fullName = [u?.lastName, u?.firstName].filter(Boolean).join(", ") || "—";
            const fallback = "/img/avatar-default.png"; // identisch zum Onboarding
            return (
              <li key={u.id} className="py-3 flex items-center justify-between">
                {/* links: Avatar + Name + Mail */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u.avatarUrl || fallback}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover flex-none"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{fullName}</div>
                    <div className="text-xs text-gray-500 truncate">{u.email}</div>
                  </div>
                </div>

                {/* rechts: Rolle / Aktion */}
                <div className="flex items-center gap-3 flex-none">
                  <span className="text-xs uppercase tracking-wide text-gray-400">
                    {u.role}
                  </span>
                  {u.role === "superadmin" ? (
                    <span className="text-xs text-gray-400">schreibgeschützt</span>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={() => handleRevoke(u.email)}
                      className="h-9"
                    >
                      Entziehen
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
