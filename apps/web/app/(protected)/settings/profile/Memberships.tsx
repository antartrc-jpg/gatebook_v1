// FILE: apps/web/app/(protected)/settings/profile/Memberships.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");

type Membership = { orgId: string; orgName: string; plan?: string | null; status?: string | null };
type Invite = { id: string; orgId: string; orgName: string; role: string; token: string; expiresAt: string };

export default function Memberships({
  initialMemberships,
  initialInvites,
}: {
  initialMemberships: Membership[];
  initialInvites: Invite[];
}) {
  const [memberships, setMemberships] = React.useState<Membership[]>(initialMemberships);
  const [invites, setInvites] = React.useState<Invite[]>(initialInvites);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function join(token: string) {
    setBusy(true); setMsg(null); setErr(null);
    try {
      const res = await fetch(`${API}/account/join`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!mounted.current) return;
      setBusy(false);

      if (!res.ok) {
        const text =
          res.status === 404 ? "Einladung nicht gefunden/abgelaufen."
          : res.status === 409 ? "Bereits Mitglied."
          : `Beitritt fehlgeschlagen (${res.status}).`;
        setErr(text);
        return;
      }

      const data = (await res.json()) as { org: { id: string; name: string } };
      setMemberships((m) => [...m, { orgId: data.org.id, orgName: data.org.name }]);
      setInvites((v) => v.filter((i) => i.token !== token));
      setCode("");
      setMsg(`Beigetreten: ${data.org.name}`);
    } catch (e: any) {
      if (!mounted.current) return;
      setBusy(false);
      setErr("Netzwerkfehler. Bitte später erneut versuchen.");
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      {(msg || err) && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded border px-3 py-2 text-sm ${
            err ? "bg-red-50 text-red-900 border-red-200" : "bg-green-50 text-green-900 border-green-200"
          }`}
        >
          {err ?? msg}
        </div>
      )}

      <div>
        <div className="mb-2 text-sm font-medium">Mitgliedschaften</div>
        {memberships.length === 0 ? (
          <div className="text-sm text-muted-foreground">Keine Organisationen.</div>
        ) : (
          <ul className="space-y-2">
            {memberships.map((m) => (
              <li key={m.orgId} className="flex items-center justify-between rounded border px-3 py-2">
                <div className="text-sm">
                  <div className="font-medium">{m.orgName}</div>
                  {(m.plan || m.status) && (
                    <div className="text-xs text-muted-foreground">
                      {m.plan ? `Plan: ${m.plan}` : ""}{m.plan && m.status ? " · " : ""}{m.status ? `Status: ${m.status}` : ""}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">Einladungen</div>
        {invites.length === 0 ? (
          <div className="text-sm text-muted-foreground">Keine offenen Einladungen.</div>
        ) : (
          <ul className="space-y-2">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2">
                <div className="text-sm">
                  <div className="font-medium">{i.orgName}</div>
                  <div className="text-xs text-muted-foreground">
                    Rolle: {i.role} · gültig bis {new Date(i.expiresAt).toLocaleString("de-DE")}
                  </div>
                </div>
                <Button size="sm" onClick={() => join(i.token)} disabled={busy}>Annehmen</Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">Beitreten mit Code</div>
        <div className="flex gap-2">
          <Input
            placeholder="Einladungscode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && code.trim() && !busy) join(code.trim()); }}
          />
          <Button onClick={() => code.trim() && join(code.trim())} disabled={busy || !code.trim()}>
            Beitreten
          </Button>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">Du kannst Codes aus E-Mails hier einfügen.</div>
      </div>
    </div>
  );
}
