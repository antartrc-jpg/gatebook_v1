// packages/shared/src/index.ts
// GateBook Shared — Zentrale, wiederverwendbare Typen/Schemata für WEB (W1, Option A)

export * from "./auth/zod-schemas";

/*
[Referenzblock – Kap. 17.4]
- Geteilte Schemata/Typen (RBAC/Auth zentral halten): Kap. 12.5, 13.1–13.4
- UI/UX-Neutralität (Texte nicht leaken): Kap. 14.1
- MVP-Struktur (kleine, klare Exports): Kap. 21.2
- Prozess (atomare Schritte, Transparenz): Kap. 17, 28

[Orchestrator-Handover – Einzeiler]
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
  -Chat WEB `
  -Gate "Gate A" `
  -Status "delivered — Option A Schritt 3/?: packages/shared/src/index.ts exportiert" `
  -Deliverable "packages/shared/src/index.ts" `
  -Summary "Shared-Root-Export aktiv; @gatebook/shared kann Basis-Importe bedienen"
*/
