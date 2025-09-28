// packages/ui/src/LicenseBanner.tsx
// SSR-taugliche Banner-Komponente für Lizenzstatus
// Source of Truth: WO-WEB-2 (SSR Dashboard – LicenseBanner-Integration)
// SSOT: Lizenz-/Zertifizierungszustände (Kap. 4.1.4, Kap. 5), neutrale Texte (Kap. 14.1)

import * as React from "react";

type Status = "active" | "inactive" | "unknown";

export interface LicenseBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  status: Status;
  /** ISO-String; optional (kann null bei inactive/unknown sein) */
  validTo?: string | null;
}

/**
 * LicenseBanner
 * - Zeigt neutral den aktuellen Lizenzstatus an.
 * - A11y: role="status", aria-live="polite".
 * - Keine Geschäftslogik/Navigation; reine Anzeige-Komponente.
 */
export function LicenseBanner({ status, validTo, className, ...rest }: LicenseBannerProps) {
  const cx = (...p: Array<string | false | undefined>) => p.filter(Boolean).join(" ");

  const isActive = status === "active";
  const isInactive = status === "inactive";
  const isUnknown = status === "unknown";

  // Datum formatieren (ohne Locale-Hardcode; Fallback auf ISO)
  let niceDate: string | null = null;
  if (validTo) {
    try {
      const d = new Date(validTo);
      // Kurzes, neutrales Format (YYYY-MM-DD)
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      niceDate = `${y}-${m}-${da}`;
    } catch {
      niceDate = validTo;
    }
  }

  const tone =
    isActive ? "border-green-600/30" :
    isInactive ? "border-amber-600/35" :
    "border-gray-400/40";

  return (
    <div
      role="status"
      aria-live="polite"
      {...rest}
      className={cx(
        "rounded-xl border p-3 bg-white",
        tone,
        className
      )}
    >
      <p className="font-semibold">
        {isActive && "Lizenz aktiv"}
        {isInactive && "Lizenz erforderlich"}
        {isUnknown && "Lizenzstatus nicht verfügbar"}
      </p>
      <p className="text-sm opacity-80">
        {isActive && (niceDate ? `Gültig bis ${niceDate}.` : "Gültig.")}
        {isInactive && "Bestimmte Funktionen sind gesperrt, bis ein aktives Deputy-Zertifikat vorliegt."}
        {isUnknown && "Der aktuelle Status konnte nicht ermittelt werden."}
      </p>
    </div>
  );
}

/*
[Referenzblock – Kap. 17.4]
- Lizenz-/Zertifizierungslogik (Zustände, Bannerhinweise): Kap. 4.1.4, Kap. 5
- Neutrale UI-Texte (keine Interna): Kap. 14.1
- MVP-Prinzip (reine Anzeige-Komponente, SSR-tauglich): Kap. 21.2

[Orchestrator-Handover – Einzeiler]
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
  -Chat WEB `
  -Gate "Gate B" `
  -Status "delivered — packages/ui/src/LicenseBanner.tsx erstellt (SSR, status/validTo)" `
  -Deliverable "packages/ui/src/LicenseBanner.tsx" `
  -Summary "Banner-Komponente bereit; Integration in Dashboard folgt"
*/
