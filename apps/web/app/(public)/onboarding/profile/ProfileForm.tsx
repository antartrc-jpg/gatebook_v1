// FILE: apps/web/app/(public)/onboarding/profile/ProfileForm.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Gender = "male" | "female" | "diverse" | "unspecified";
type DateStyle = "DMY" | "MDY" | "YMD";

// Feature-Flag: URL-Eingabefeld für Avatar ein-/ausblenden
const SHOW_URL_INPUT = false;

function apiBase(): string {
  const a = process.env.NEXT_PUBLIC_API_URL?.trim();
  const b = process.env.API_BASE_URL?.trim();
  return (b?.length ? b : a?.length ? a : "http://localhost:4000").replace(/\/+$/, "");
}

/* -------- Date localisation -------- */
function guessStyle(country: string): DateStyle {
  const c = (country || "DE").toUpperCase();
  if (c === "US") return "MDY";
  if (["CN", "JP", "KR"].includes(c)) return "YMD";
  return "DMY";
}
function hintFor(style: DateStyle) {
  return style === "MDY" ? "Format: MM/DD/YYYY"
       : style === "YMD" ? "Format: YYYY-MM-DD"
       : "Format: TT.MM.JJJJ";
}
function patternFor(style: DateStyle) {
  return style === "MDY" ? String.raw`^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}$`
       : style === "YMD" ? String.raw`^\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}$`
       : String.raw`^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}$`;
}
function toISO(input: string, style: DateStyle): string | null {
  const s = input.trim();
  let y = 0, m = 0, d = 0;
  if (style === "YMD") {
    const m1 = s.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
    if (!m1) return null;
    [y, m, d] = m1.slice(1).map(Number) as any;
  } else {
    const m1 = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (!m1) return null;
    if (style === "MDY") { m = +m1[1]; d = +m1[2]; y = +m1[3]; }
    else                 { d = +m1[1]; m = +m1[2]; y = +m1[3]; }
  }
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/* -------- Component -------- */
export default function ProfileForm({
  defaultCountry = "DE",
  defaultLocale = "de-DE",
}: {
  defaultCountry?: string;
  defaultLocale?: string;
}) {
  const r = useRouter();

  // Locale/Country
  const clientLocale =
    typeof navigator !== "undefined" ? navigator.language : defaultLocale;
  const [country, setCountry] = React.useState(
    (defaultCountry || "DE").toUpperCase().slice(0, 2)
  );
  const style = guessStyle(country);

  // State
  const [firstName, setFirstName]   = React.useState("");
  const [lastName, setLastName]     = React.useState("");
  const [title, setTitle]           = React.useState(""); // Akad. Titel (optional) — wird aktuell NICHT gesendet (API-Erweiterung nötig)
  const [birthText, setBirthText]   = React.useState(""); // lokale Eingabe
  const [street, setStreet]         = React.useState("");
  const [postalCode, setPostalCode] = React.useState("");
  const [city, setCity]             = React.useState("");
  const [gender, setGender]         = React.useState<Gender>("unspecified");

  // Avatar: Standardpfad aus /public/img
  const DEFAULT_AVATAR = "/img/avatar-default.png";
  const [avatarUrl, setAvatarUrl]   = React.useState<string>(DEFAULT_AVATAR);

  const [loading, setLoading]       = React.useState(false);
  const [error, setError]           = React.useState<string | null>(null);

  // Ref für versteckten File-Input
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Prefill aus API
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/profile`, { credentials: "include" });
        if (res.status === 401) {
          r.replace("/login");
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        const v = data?.profile ?? null;
        if (!v || cancelled) return;

        setFirstName(String(v.firstName ?? ""));
        setLastName(String(v.lastName ?? ""));
        // vorhandenes ISO-Datum -> in lokale Schreibweise umwandeln
        const iso = String(v.birthDate ?? "").slice(0, 10);
        if (iso) {
          const [y, m, d] = iso.split("-").map((n: string) => +n);
          const loc =
            style === "MDY" ? `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}` :
            style === "YMD" ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` :
                              `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
          setBirthText(loc);
        }
        setStreet(String(v.street ?? ""));
        setPostalCode(String(v.postalCode ?? ""));
        setCity(String(v.city ?? ""));
        const c = String(v.country ?? country).toUpperCase().slice(0, 2);
        setCountry(c);
        if (v.gender) setGender(v.gender as Gender);
        setAvatarUrl(String(v.avatarUrl || DEFAULT_AVATAR));
        // v.title könnte später hier vorbefüllt werden, wenn API erweitert ist
      } catch {
        // schlucken
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);

  // File -> DataURL Upload
  function onPickAvatar(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result || DEFAULT_AVATAR));
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const iso = toISO(birthText, style);
      if (!iso) throw new Error("bad_date");

      // Standardbild ⇒ leeren String senden (Server wandelt zu null)
      const avatarToSend = avatarUrl && avatarUrl !== DEFAULT_AVATAR ? avatarUrl : "";

      // WICHTIG: "title" aktuell NICHT mitsenden (API validiert strict additionalProperties:false)
      const res = await fetch(`${apiBase()}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName,
          lastName,
          birthDate: iso,
          street,
          postalCode,
          city,
          country,
          gender,          // optional
          avatarUrl: avatarToSend,
          locale: clientLocale, // optional
        }),
      });

      if (res.status === 401) {
        r.replace("/login");
        return;
      }
      if (!res.ok) throw new Error("save_failed");

      r.replace("/dashboard");
      r.refresh();
    } catch {
      setError("Speichern fehlgeschlagen. Bitte prüfe deine Eingaben.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl mx-auto space-y-6">
      {/* Avatar-Zeile */}
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt="Profilbild"
          className="h-16 w-16 rounded-full border border-[hsl(var(--border))] object-cover"
        />

        {/* Button triggert den unsichtbaren File-Input */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Profilbild auswählen"
          >
            Profilbild auswählen
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => onPickAvatar(e.target.files?.[0])}
            className="hidden"        // versteckt: kein Dateiname neben dem Button
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>

        {/* URL-Feld nur rendern, wenn Flag aktiv */}
        {SHOW_URL_INPUT && (
          <div className="flex-1">
            <label className="block text-sm mb-1">Bild-URL (optional)</label>
            <input
              type="url"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="https://…/mein-bild.png"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Standard: <code>{DEFAULT_AVATAR}</code>
            </p>
          </div>
        )}
      </div>

      {/* Name + Titel */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1">
          <label className="block text-sm mb-1">Titel (optional)</label>
          <input
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="z. B. Dr., Prof."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="honorific-prefix"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-sm mb-1">Vorname</label>
          <input
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-sm mb-1">Nachname</label>
          <input
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
          />
        </div>
      </div>

      {/* Geschlecht (unter den Namensfeldern, mit Erklärung) */}
      <div>
        <label className="block text-sm mb-1">Geschlecht (optional)</label>
        <p className="text-xs text-muted-foreground mb-1">
          Dient ausschließlich der korrekten Ansprache in der Kommunikation. Keine Auswirkung auf Funktionen.
        </p>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value as Gender)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Geschlecht auswählen"
        >
          <option value="unspecified">keine Angabe</option>
          <option value="female">weiblich</option>
          <option value="male">männlich</option>
          <option value="diverse">divers</option>
        </select>
      </div>

      {/* Adresse */}
      <div>
        <label className="block text-sm mb-1">Geburtsdatum</label>
        <p className="text-xs text-muted-foreground mb-1">{hintFor(style)}</p>
        <input
          type="text"
          inputMode="numeric"
          placeholder={style === "MDY" ? "MM/DD/YYYY" : style === "YMD" ? "YYYY-MM-DD" : "TT.MM.JJJJ"}
          pattern={patternFor(style)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          required
          value={birthText}
          onChange={(e) => setBirthText(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Straße &amp; Nr.</label>
        <input
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          required
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          autoComplete="address-line1"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1">PLZ</label>
          <input
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            inputMode="numeric"
            autoComplete="postal-code"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Ort</label>
          <input
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            autoComplete="address-level2"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm mb-1">Land (ISO-2)</label>
        <input
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          maxLength={2}
          required
          value={country}
          onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
          autoComplete="country"
        />
      </div>

      {error && <p className="text-sm text-[hsl(var(--destructive,var(--brand)))]">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? "Speichern…" : "Speichern & weiter"}
      </Button>
    </form>
  );
}
