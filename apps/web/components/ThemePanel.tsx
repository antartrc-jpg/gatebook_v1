"use client";

import * as React from "react";

type ThemeVars = {
  brand?: string;
  brandForeground?: string;
  bg?: string;
  fg?: string;
  card?: string;
  cardForeground?: string;
  muted?: string;
  mutedFg?: string;
  border?: string;
  fontSans?: string;
  radius?: string;
};

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_BASE_URL ??
    "http://localhost:4000"
  );
}

function applyThemeCss(css?: string) {
  if (!css) return;
  let el = document.getElementById("theme-overrides") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "theme-overrides";
    document.head.appendChild(el);
  }
  el.textContent = css;
}

export default function ThemePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [values, setValues] = React.useState<ThemeVars>({});
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const r = await fetch(`${apiBase()}/theme`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!r.ok) return;
        const j = (await r.json()) as { value?: ThemeVars; css?: string };
        setValues(j?.value ?? {});
        if (j?.css) applyThemeCss(j.css);
      } catch {}
    })();
  }, [open]);

  function set<K extends keyof ThemeVars>(k: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((s) => ({ ...s, [k]: e.target.value }));
  }

  async function onSave() {
    try {
      setBusy(true);
      const r = await fetch(`${apiBase()}/admin/theme`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!r.ok) return;
      const css = await fetch(`${apiBase()}/theme.css`, { cache: "no-store" })
        .then((x) => (x.ok ? x.text() : ""))
        .catch(() => "");
      if (css) applyThemeCss(css);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[60] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      {/* Bottom Sheet */}
      <div
        className={`absolute left-0 right-0 bottom-0 max-h-[95dvh] overflow-auto rounded-t-2xl
                    border border-border bg-card text-card-foreground shadow-2xl
                    transition-transform duration-300 ease-out
                    ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur">
          <h2 className="text-lg font-semibold">Theme verwalten</h2>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-border px-3 py-1.5 text-sm hover:bg-background"
            >
              Schließen
            </button>
            <button
              onClick={onSave}
              disabled={busy}
              className="rounded-xl bg-brand px-3 py-1.5 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              {busy ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-4">
          <p className="text-sm text-muted-foreground">
            HSL ohne <code>hsl(...)</code> (z. B. <code>221 83% 53%</code>). Font: CSS-Stack bzw. Variable.
          </p>

          {([
            ["brand", "Brand"],
            ["brandForeground", "Brand-Text"],
            ["bg", "Seiten-Hintergrund (bg)"],
            ["fg", "Seiten-Text (fg)"],
            ["card", "Card-Hintergrund"],
            ["cardForeground", "Card-Text"],
            ["muted", "Muted BG"],
            ["mutedFg", "Muted Text"],
            ["border", "Border"],
            ["fontSans", "Font-Stack (optional)"],
            ["radius", "Radius z. B. 16px"],
          ] as Array<[keyof ThemeVars, string]>).map(([k, label]) => (
            <label key={k} className="grid gap-1">
              <span className="text-sm text-muted-foreground">{label}</span>
              <input
                value={values[k] ?? ""}
                onChange={set(k)}
                placeholder="221 83% 53%"
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
