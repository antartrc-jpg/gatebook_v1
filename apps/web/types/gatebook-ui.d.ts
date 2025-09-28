// apps/web/types/gatebook-ui.d.ts
// TECHNIKER — Hotfix: Typdeklaration für Deep-Import aus @gatebook/ui
// Zweck: VS Code/TS-Squiggle bei `import { LicenseBanner } from "@gatebook/ui/src/LicenseBanner"` beseitigen,
//        bis der Barrel-Export im UI-Paket ergänzt ist (dann Import wieder auf '@gatebook/ui' umstellen).

declare module "@gatebook/ui/src/LicenseBanner" {
  import * as React from "react";

  export type Status = "active" | "inactive" | "unknown";

  export interface LicenseBannerProps extends React.HTMLAttributes<HTMLDivElement> {
    status: Status;
    /** ISO-String; optional (kann null bei inactive/unknown sein) */
    validTo?: string | null;
  }

  /**
   * SSR-tauglicher Banner zur Anzeige des Lizenzstatus.
   * Hinweis: Reine Anzeige-Komponente, keine Geschäftslogik.
   */
  export const LicenseBanner: React.FC<LicenseBannerProps>;
}

/*
================================================================================
[Referenzblock — Kap. 17.4]
Datei: apps/web/types/gatebook-ui.d.ts
Deliverable: Hotfix — Typdeklaration für Deep-Import LicenseBanner
Autor/Abteilung: TECHNIKER
Datum: 2025-09-19

Begründung:
- Der temporäre Deep-Import `@gatebook/ui/src/LicenseBanner` löst ts(2307) bzw. Pfadauflösungsprobleme aus,
  da der UI-Barrel `@gatebook/ui` den Export noch nicht enthält.
- Diese Ambient-Definition stellt die fehlenden Typen bereit, ohne die Runtime zu beeinflussen.
- Sobald `packages/ui/src/index.ts` den Export `export * from "./LicenseBanner"` enthält, sollte
  der Import in `apps/web/app/dashboard/page.tsx` zurück auf `from "@gatebook/ui"` gestellt und
  diese Datei entfernt werden.

Konformität (SSOT):
- Kap. 5.3 (Lizenzbanner-Inhalte neutral)
- Kap. 11 (SSR-Dashboards)
- Kap. 14.1 (UI-Mikrotexte neutral)
- Kap. 18 (Meta-Governance; dokumentierte Hotfixes)
- Kap. 28 (Change-Log & SemVer)

Orchestrator-Handover – Einzeiler:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
  -Chat WEB `
  -Gate "Welle 1" `
  -Status "delivered — TS Hotfix für Deep-Import LicenseBanner" `
  -Deliverable "apps/web/types/gatebook-ui.d.ts" `
  -Summary "Ambient-Modul @gatebook/ui/src/LicenseBanner; entfernen nach UI-Barrel-Export"
================================================================================
*/
