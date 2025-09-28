"use client";

/* FILE: apps/web/app/admin/theme/page.tsx
   GateBook Enterprise · Superadmin — „Layout anpassen“ (Drawer, visuell)
   Status: delivered (A/B-Fortsetzung) — Klickbare Palettenpunkte, Farbwähler (HEX→HSL),
           klarer Header, robuste Draft/Save-Logik, Button/Sheet kompatibel.

   ✦ Was ist neu?
   • Paletten-Punkte sind jetzt ANKLICKBAR und setzen gezielt Tokens (bg/fg/card/brand/border).
   • Komfort-Farbwähler pro Token (native <input type="color">). Eingaben werden in HSL-Tripel
     („H S% L%“) umgewandelt, damit Tailwind/CSS-Variablen weiter funktionieren.
   • Header überarbeitet (kein X über Text; primärer Schließen-Button rechts, Status links).
   • SheetHeader ohne className (shadcn-kompatibel); Button aus "@/components/ui/button".

   Semantik (unverändert):
   – „Schließen“ → Draft verwerfen, Drawer zu (keine Persistenz)
   – „Speichern“ → PUT /admin/theme, Persistenz global (DEV: admin|superadmin, PROD: superadmin)
*/
import * as React from "react";
import { useRouter } from "next/navigation";

/* lokale UI-Wrapper (shadcn-kompatibel, bereits im Projekt vorhanden) */
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

/* Live-Vorschau nutzt nur Tokens – zieht automatisch Draft/Persisted */
import ThemePreview from "@/components/ThemePreview";

/* ────────────────────────────────────────────────────────────────────────────
   Types & Const
──────────────────────────────────────────────────────────────────────────── */

type ThemeVars = Partial<{
  brand: string;
  brandForeground: string;
  bg: string;
  fg: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedFg: string;
  border: string;
  fontSans: string;
  radius: string;
}>;

type TokenKey = keyof ThemeVars;

const PERSISTED_ID = "theme-overrides";
const DRAFT_ID = "theme-overrides-draft";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  "http://localhost:4000";

/* Paletten – typische Motive; HSL-Tripel ohne hsl() */
type Palette = {
  key: string;
  name: string;
  brand: string;
  brandForeground: string;
  bg: string;
  fg: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedFg: string;
  border: string;
};

const PALETTES: Palette[] = [
  {
    key: "light",
    name: "Light",
    bg: "0 0% 100%",
    fg: "222 47% 11%",
    card: "0 0% 100%",
    cardForeground: "222 47% 11%",
    muted: "210 40% 96%",
    mutedFg: "215 16% 47%",
    border: "214 32% 91%",
    brand: "221 83% 53%",
    brandForeground: "210 40% 98%",
  },
  {
    key: "dim",
    name: "Dim",
    bg: "215 22% 12%",
    fg: "210 40% 96%",
    card: "215 20% 16%",
    cardForeground: "210 40% 96%",
    muted: "215 16% 20%",
    mutedFg: "215 20% 75%",
    border: "215 16% 28%",
    brand: "217 90% 66%",
    brandForeground: "222 47% 11%",
  },
  {
    key: "slate",
    name: "Slate",
    bg: "210 20% 98%",
    fg: "222 47% 11%",
    card: "0 0% 100%",
    cardForeground: "222 47% 11%",
    muted: "210 30% 94%",
    mutedFg: "215 15% 45%",
    border: "214 20% 85%",
    brand: "215 90% 58%",
    brandForeground: "210 40% 98%",
  },
  {
    key: "emerald",
    name: "Emerald",
    bg: "210 20% 98%",
    fg: "222 47% 11%",
    card: "0 0% 100%",
    cardForeground: "222 47% 11%",
    muted: "210 30% 94%",
    mutedFg: "215 15% 45%",
    border: "214 20% 85%",
    brand: "152 70% 40%",
    brandForeground: "210 40% 98%",
  },
  {
    key: "rose",
    name: "Rose",
    bg: "0 0% 100%",
    fg: "222 47% 11%",
    card: "0 0% 100%",
    cardForeground: "222 47% 11%",
    muted: "10 40% 96%",
    mutedFg: "10 40% 45%",
    border: "10 30% 86%",
    brand: "350 85% 60%",
    brandForeground: "210 40% 98%",
  },
];

/* ────────────────────────────────────────────────────────────────────────────
   Utils
──────────────────────────────────────────────────────────────────────────── */

/* HSL-Tripel-String → CSS usable text (keine Prüfung auf Gültigkeit) */
function toCss(vars: ThemeVars) {
  const map: Record<string, string | undefined> = {
    brand: vars.brand,
    "brand-foreground": vars.brandForeground,
    bg: vars.bg,
    fg: vars.fg,
    card: vars.card,
    "card-foreground": vars.cardForeground,
    muted: vars.muted,
    "muted-fg": vars.mutedFg,
    border: vars.border,
    "font-sans": vars.fontSans,
    radius: vars.radius,
  };
  const parts = Object.entries(map)
    .filter(([, v]) => typeof v === "string" && v!.trim())
    .map(([k, v]) => `--${k}: ${String(v)};`);
  return parts.length ? `:root{${parts.join("")}}` : "";
}

/* draft style element handling */
function setStyleEl(id: string, css: string) {
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = css;
}
function removeStyleEl(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  try {
    el.remove(); // sicherer Shortcut
  } catch {
    try { el.parentNode?.removeChild(el); } catch {}
  }
}


/* tiefer Vergleich */
function deepEq(a: unknown, b: unknown) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/* :root Variablen lesen → Fallback für initiale Felder */
function readCssVar(name: string): string | undefined {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`);
  const t = v?.trim();
  return t ? t : undefined;
}

/* HEX (#rrggbb) → "H S% L%" (z. B. "221 83% 53%") */
function hexToHslTriplet(hex: string): string | null {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const num = parseInt(m[1], 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  const H = Math.round(h * 360);
  const S = Math.round(s * 100);
  const L = Math.round(l * 100);
  return `${H} ${S}% ${L}%`;
}

/* HSL-Tripel → HEX (#rrggbb) – für Anzeige im Farbwähler */
function hslTripletToHex(hsl: string | undefined): string {
  if (!hsl) return "#000000";
  const m = /^\s*([0-9]+)\s+([0-9]+)%\s+([0-9]+)%\s*$/.exec(hsl);
  if (!m) return "#000000";
  let [_, Hs, Ss, Ls] = m;
  let h = (parseInt(Hs, 10) % 360) / 360;
  let s = Math.max(0, Math.min(100, parseInt(Ss, 10))) / 100;
  let l = Math.max(0, Math.min(100, parseInt(Ls, 10))) / 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    const hex = (v << 16) | (v << 8) | v;
    return `#${hex.toString(16).padStart(6, "0")}`;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);
  const hex =
    ((Math.round(r * 255) << 16) |
      (Math.round(g * 255) << 8) |
      Math.round(b * 255)) >>>
    0;
  return `#${hex.toString(16).padStart(6, "0")}`;
}

/* ────────────────────────────────────────────────────────────────────────────
   Component
──────────────────────────────────────────────────────────────────────────── */

export default function AdminThemePage() {
  const router = useRouter();

  const [open, setOpen] = React.useState(true);
  const [base, setBase] = React.useState<ThemeVars>({});
  const [form, setForm] = React.useState<ThemeVars>({});
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  /* Preview-only Regler */
  const [headlineScale, setHeadlineScale] = React.useState(1.0);
  const [borderWidth, setBorderWidth] = React.useState(1);

  const unsaved = !deepEq(base, form);

  /* Initial: Theme laden, Draft leeren */
  React.useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/theme`, { cache: "no-store", credentials: "include" });
        if (!r.ok) return;
        const data = (await r.json()) as { value?: ThemeVars; css?: string };
        if (abort) return;

        const fallback: ThemeVars = {
          bg: readCssVar("bg"),
          fg: readCssVar("fg"),
          card: readCssVar("card"),
          cardForeground: readCssVar("card-foreground"),
          muted: readCssVar("muted"),
          mutedFg: readCssVar("muted-fg"),
          border: readCssVar("border"),
          brand: readCssVar("brand"),
          brandForeground: readCssVar("brand-foreground"),
          fontSans: readCssVar("font-sans"),
          radius: readCssVar("radius"),
        };
        const value = { ...(fallback || {}), ...(data?.value || {}) };
        setBase(value);
        setForm(value);
        if (data?.css && data.css.trim()) setStyleEl(PERSISTED_ID, data.css);
        removeStyleEl(DRAFT_ID);
      } catch {
        /* stiller Fallback */
      }
    })();
    return () => {
      abort = true;
    };
  }, []);

  /* Draft anwenden */
  const applyDraft = React.useCallback((next: ThemeVars) => {
    const css = toCss(next);
    if (css) setStyleEl(DRAFT_ID, css);
    else removeStyleEl(DRAFT_ID);
  }, []);

  function update(partial: Partial<ThemeVars>) {
    const next = { ...form, ...partial };
    setForm(next);
    applyDraft(next);
  }

  function resetDraft() {
    setForm(base);
    removeStyleEl(DRAFT_ID);
    setMsg("Entwurf verworfen.");
  }

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/admin/theme`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        setMsg(res.status === 403 ? "Keine Berechtigung (403)." : `Fehler (${res.status}).`);
        return;
      }
      const data = await res.json();
      const persistedCss = (data?.css && String(data.css)) || toCss(form);
      setStyleEl(PERSISTED_ID, persistedCss);
      removeStyleEl(DRAFT_ID);
      setBase(form);
      setOpen(false);
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setMsg("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    removeStyleEl(DRAFT_ID);
    setForm(base);
    setMsg(null);
    setOpen(false);
    router.replace("/dashboard");
    router.refresh();
  }

  /* ─────────────── UI-Bausteine ─────────────── */

  /* Eine kleine, klickbare Farbprobe */
  const Swatch = ({
    hsl,
    title,
    onPick,
  }: {
    hsl: string;
    title: string;
    onPick?: () => void;
  }) => (
    <button
      type="button"
      onClick={onPick}
      title={title}
      className="h-4 w-4 rounded border transition-transform hover:scale-110"
      style={{
        backgroundColor: `hsl(${hsl})`,
        borderColor: "hsl(var(--border))",
      }}
      aria-label={title}
    />
  );

  /* Palette-Karte – Punkte sind nun klickbar (setzen einzelne Tokens) */
  function PaletteCard({ p }: { p: Palette }) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">{p.name}</div>
          <div className="flex gap-1">
            {/* Reihenfolge: bg, fg, card, brand, border */}
            <Swatch hsl={p.bg} title="Seiten-Hintergrund (bg) übernehmen" onPick={() => update({ bg: p.bg })} />
            <Swatch hsl={p.fg} title="Seiten-Text (fg) übernehmen" onPick={() => update({ fg: p.fg })} />
            <Swatch hsl={p.card} title="Card-Hintergrund übernehmen" onPick={() => update({ card: p.card, cardForeground: p.cardForeground })} />
            <Swatch hsl={p.brand} title="Brand übernehmen" onPick={() => update({ brand: p.brand, brandForeground: p.brandForeground })} />
            <Swatch hsl={p.border} title="Rahmenfarbe übernehmen" onPick={() => update({ border: p.border })} />
          </div>
        </div>

        <div
          className="rounded-lg border p-2 text-sm"
          style={{
            backgroundColor: `hsl(${p.card})`,
            color: `hsl(${p.cardForeground})`,
            borderColor: `hsl(${p.border})`,
          }}
        >
          <div className="mb-1 font-semibold">Beispielkarte</div>
          <div className="text-xs text-muted-foreground">
            Oberfläche: bg {p.bg} · Text: fg {p.fg}
          </div>
        </div>

        <div className="mt-2 flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              update({
                bg: p.bg,
                fg: p.fg,
                card: p.card,
                cardForeground: p.cardForeground,
                muted: p.muted,
                mutedFg: p.mutedFg,
                border: p.border,
                brand: p.brand,
                brandForeground: p.brandForeground,
              });
              setMsg(`Palette „${p.name}“ angewendet (Entwurf).`);
            }}
          >
            Übernehmen (Entwurf)
          </Button>
        </div>
      </div>
    );
  }

  /* Kompaktfeld + nativer Farbwähler (HEX → HSL) */
  const ColorField = ({
  label,
  name,
  placeholder,
  helper,
}: {
  label: string;
  name: keyof ThemeVars;
  placeholder?: string;
  helper?: string;
}) => {
  const hex = hslTripletToHex((form[name] as string) || "");
  return (
    <label className="grid gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input
          aria-label={`${label} auswählen`}
          type="color"
          value={hex}
          onChange={(e) => {
            const hsl = hexToHslTriplet(e.target.value);
            if (hsl) update({ [name]: hsl });
          }}
          className="h-10 w-10 cursor-pointer appearance-none rounded border"
          style={{ borderColor: "hsl(var(--border))" }}
        />
        <Input
          value={(form[name] as string) || ""}
          onChange={(e) => update({ [name]: e.target.value })}
          placeholder={placeholder}
        />
      </div>
      {helper ? <span className="text-xs text-muted-foreground">{helper}</span> : null}
    </label>
  );
};

  /* Heuristik: Kontrastwarnung */
  const lowContrast =
    (form.bg?.trim()?.length ?? 0) > 0 &&
    (form.fg?.trim()?.length ?? 0) > 0 &&
    form.bg!.trim() === form.fg!.trim();

  /* ─────────────── Render ─────────────── */

  return (
    <Sheet
       open={open}
       onOpenChange={(v) => {
         if (!v) { handleClose(); } else { setOpen(true); }
       }}
    >
      <SheetContent side="bottom" className="max-h-[94vh] overflow-y-auto">
        <SheetHeader>
          <div className="mt-1 flex items-start justify-between gap-4 pb-1">
            <div className="grid gap-1">
              <SheetTitle className="pl-4">Layout anpassen (global)</SheetTitle>
              <SheetDescription className="pl-4">
                Klicke eine <strong>Palette</strong> oder passe Werte an. Änderungen wirken sofort als <em>Entwurf</em>.{" "}
                „<strong>Speichern</strong>“ übernimmt global.
              </SheetDescription>
              <div className="pl-4 text-xs text-muted-foreground">
                {unsaved ? "Entwurf (nicht gespeichert)" : "Keine Änderungen"}
              </div>
            </div>
            <div className="shrink-0">
              <Button variant="secondary" onClick={handleClose} aria-label="Schließen" title="Schließen">
                Schließen
              </Button>
            </div>
          </div>
        </SheetHeader>

        {lowContrast && (
          <div
            className="mt-2 rounded-md border p-2 text-xs"
            style={{ borderColor: "hsl(var(--brand))" }}
          >
            Hinweis: <strong>bg</strong> und <strong>fg</strong> sind identisch – Kontrast prüfen.
          </div>
        )}

        {/* Paletten-Galerie */}
        <section className="mt-4">
          <h3 className="pl-4 mb-2 text-sm font-semibold">Paletten</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PALETTES.map((p) => (
              <PaletteCard key={p.key} p={p} />
            ))}
          </div>
        </section>

        {/* Live-Preview */}
        <section className="mt-6" data-preview="">
          <ThemePreview />
        </section>

        {/* Kompakte Controls */}
        <section className="mt-6 grid grid-cols-1 gap-6">
          {/* Marke */}
          <div className="grid gap-3">
            <h4 className="text-sm font-semibold">Marke</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <ColorField label="Brand (Akzent)" name="brand" placeholder="221 83% 53%" />
              <ColorField label="Brand-Text" name="brandForeground" placeholder="210 40% 98%" />
            </div>
          </div>

          {/* Oberfläche */}
          <div className="grid gap-3">
            <h4 className="text-sm font-semibold">Oberfläche</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <ColorField label="Seiten-Hintergrund (bg)" name="bg" placeholder="0 0% 100%" />
              <ColorField label="Seiten-Text (fg)" name="fg" placeholder="222 47% 11%" />
            </div>
          </div>

          {/* Karten & Rahmen */}
          <div className="grid gap-3">
            <h4 className="text-sm font-semibold">Karten & Rahmen</h4>
            <div className="grid gap-4 md:grid-cols-3">
              <ColorField label="Card-Hintergrund" name="card" placeholder="0 0% 100%" />
              <ColorField label="Card-Text" name="cardForeground" placeholder="222 47% 11%" />
              <ColorField label="Rahmenfarbe (border)" name="border" placeholder="214 32% 91%" />
            </div>

            {/* Preview-only: Rahmenstärke */}
            <div className="grid items-center gap-2 md:grid-cols-3">
              <div className="text-sm text-muted-foreground">Rahmenstärke (Vorschau)</div>
             <input
                type="range"
                min={0}
                max={4}
                step={1}
                value={borderWidth}
                onChange={(e) => setBorderWidth(parseInt(e.target.value, 10))}
                className="col-span-2"
              />
              <style
                dangerouslySetInnerHTML={{
                  __html: `:root{ --gb-preview-border-w: ${borderWidth}px; }`,
                }}
              />
            </div>
          </div>

          {/* Typografie & Radius */}
          <div className="grid gap-3">
            <h4 className="text-sm font-semibold">Typografie & Radius</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm text-muted-foreground">Font Sans (Stack)</span>
                <Input
                  value={form.fontSans || ""}
                  onChange={(e) => update({ fontSans: e.target.value })}
                  placeholder='Inter, system-ui, -apple-system, "Segoe UI", Roboto'
                />
                <span className="text-xs text-muted-foreground">
                  Wird global als var(--font-sans) verwendet.
                </span>
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-muted-foreground">Radius</span>
                <Input
                  value={form.radius || ""}
                  onChange={(e) => update({ radius: e.target.value })}
                  placeholder="12px"
                />
              </label>
            </div>

            {/* Preview-only: Überschriften-Skalierung */}
            <div className="grid items-center gap-2 md:grid-cols-3">
              <div className="text-sm text-muted-foreground">Überschriftengröße (Vorschau)</div>
              <input
                type="range"
                min={0.85}
                max={1.25}
                step={0.01}
                value={headlineScale}
                onChange={(e) => setHeadlineScale(parseFloat(e.target.value))}
                className="col-span-2"
              />
              <style
                dangerouslySetInnerHTML={{
                  __html: `:root{ --gb-preview-h-scale:${headlineScale}; }`,
                }}
              />
            </div>
          </div>
        </section>

        <SheetFooter className="mt-6 flex gap-3">
          <Button type="button" variant="ghost" onClick={resetDraft} disabled={busy}>
            Entwurf verwerfen
          </Button>
          <div className="flex-1" />
          <Button type="button" variant="secondary" onClick={handleClose} disabled={busy}>
            Schließen
          </Button>
          <Button type="button" onClick={handleSave} disabled={busy}>
            {busy ? "Speichern…" : "Speichern"}
          </Button>
          {msg && <span className="ml-2 text-sm text-muted-foreground">{msg}</span>}
        </SheetFooter>

        {/* Preview-only Styles */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              [data-preview] .border { border-width: var(--gb-preview-border-w, 1px) !important; }
              [data-preview] h1, [data-preview] .h1 { font-size: calc(1.5rem * var(--gb-preview-h-scale, 1)); }
              [data-preview] h2, [data-preview] .h2 { font-size: calc(1.25rem * var(--gb-preview-h-scale, 1)); }
              [data-preview] h3, [data-preview] .h3 { font-size: calc(1.125rem * var(--gb-preview-h-scale, 1)); }
            `,
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

/*
──────────────────────────────────────────────────────────────────────────────
Verifikation (manuell)
— Paletten-Punkte anklicken → entsprechendes Token ändert sich sofort (Draft).
— HEX-Farbwahl ändert Live-Preview; Eingabefeld zeigt HSL-Tripel.
— „Schließen“ verwirft Draft; „Speichern“ persistiert (DEV: admin|superadmin).
— Buttons (Primär/Sekundär/Outline/Ghost) reagieren auf Brand/Muted/Border.

Orchestrator-Handover (Status "delivered")
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
  -Chat WEB `
  -Gate "W1 · Admin Theme UX 2" `
  -Status "delivered — Palette-Punkte klickbar, Farbwähler (HEX→HSL), aufgeräumter Header" `
  -Deliverable "apps/web/app/admin/theme/page.tsx" `
  -Summary "Visuelle Bearbeitung ist logisch & direkt; Speichern/Entwurf unverändert"

Referenzblock (Kap. 17.4 · SSOT)
— GateBook Enterprise – Geschäftslogik & Rollenhandbuch v1.0:
  Kap. 5.2–5.3 (UI-Tokenisierung),
  Kap. 11 (SSR/Komponentenaufbau),
  Kap. 13.1–13.4 (Interaktion/UX-Prinzipien),
  Kap. 16 (Settings/Theme – globale Variablen),
  Kap. 28 (SemVer/Wirksamkeit – W1-Feinrelease).
*/




