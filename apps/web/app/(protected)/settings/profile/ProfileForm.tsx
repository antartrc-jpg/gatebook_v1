"use client";

import * as React from "react";
import { useTransition } from "react";
import { saveProfile, type ProfilePayload } from "./actions";

type Props = { initial: Partial<ProfilePayload> | null | undefined };

/** Avatar-URL normalisieren: Host entfernen, /images -> /img, leer => null */
function normalizeAvatarInput(v?: string | null): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s, "http://x");      // erlaubt absolute + relative Eingaben
    const p = u.pathname || "";
    return p.startsWith("/images/") ? p.replace(/^\/images\//, "/img/") : p;
  } catch {
    return s.startsWith("/images/") ? s.replace(/^\/images\//, "/img/") : s;
  }
}

export default function ProfileForm({ initial }: Props) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);

  // Initialwerte mit Avatar-Normalisierung
  const [form, setForm] = React.useState<ProfilePayload>({
    title:      initial?.title      ?? null,
    firstName:  initial?.firstName  ?? null,
    lastName:   initial?.lastName   ?? null,
    street:     initial?.street     ?? null,
    postalCode: initial?.postalCode ?? null,
    city:       initial?.city       ?? null,
    country:    (initial?.country ?? "DE") as string,
    birthDate:  initial?.birthDate  ?? null,
    gender:     (initial?.gender ?? "unspecified") as ProfilePayload["gender"],
    avatarUrl:  normalizeAvatarInput(initial?.avatarUrl),   // ⬅️ wichtig
  });

  function set<K extends keyof ProfilePayload>(k: K, v: string) {
    // Avatar-URL immer normieren, sonst plain
    if (k === "avatarUrl") {
      const norm = normalizeAvatarInput(v);
      setForm((f) => ({ ...f, avatarUrl: norm }));
    } else {
      setForm((f) => ({ ...f, [k]: v === "" ? null : (v as any) }));
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      try {
        const payload: ProfilePayload = {
          ...form,
          // doppelt absichern vor dem Persistieren
          avatarUrl: normalizeAvatarInput(form.avatarUrl),
        };
        await saveProfile(payload); // SERVER ACTION
        setMsg("Gespeichert.");
      } catch (err: any) {
        setMsg(err?.message || "Speichern fehlgeschlagen.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Titel"        name="title"       value={form.title ?? ""}       onChange={(e) => set("title", e.target.value)} />
        <Input label="Avatar-URL"   name="avatarUrl"   value={form.avatarUrl ?? ""}   onChange={(e) => set("avatarUrl", e.target.value)} />
        <Input label="Vorname"      name="firstName"   value={form.firstName ?? ""}   onChange={(e) => set("firstName", e.target.value)} />
        <Input label="Nachname"     name="lastName"    value={form.lastName ?? ""}    onChange={(e) => set("lastName", e.target.value)} />
        <Input label="Straße & Nr." name="street"      value={form.street ?? ""}      onChange={(e) => set("street", e.target.value)} />
        <Input label="PLZ"          name="postalCode"  value={form.postalCode ?? ""}  onChange={(e) => set("postalCode", e.target.value)} />
        <Input label="Ort"          name="city"        value={form.city ?? ""}        onChange={(e) => set("city", e.target.value)} />
        <Input label="Land (ISO-2)" name="country"     value={form.country ?? "DE"}   onChange={(e) => set("country", e.target.value.toUpperCase())} />
        <Input label="Geburtsdatum" type="date" name="birthDate" value={form.birthDate ?? ""} onChange={(e) => set("birthDate", e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm">Geschlecht</label>
          <select
            name="gender"
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={form.gender ?? "unspecified"}
            onChange={(e) => set("gender", e.target.value)}
          >
            <option value="unspecified">—</option>
            <option value="male">männlich</option>
            <option value="female">weiblich</option>
            <option value="diverse">divers</option>
          </select>
        </div>
      </div>

      <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
        {pending ? "Speichert…" : "Speichern"}
      </button>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </form>
  );
}

/* kleine Hilfskomponente */
function Input({
  label,
  name,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        className="rounded-md border bg-background px-3 py-2 text-sm"
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
