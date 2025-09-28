"use strict";
// packages/shared/src/index.ts
// GateBook Shared — Zentrale, wiederverwendbare Typen/Schemata für WEB (W1, Option A)
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./auth/zod-schemas"), exports);
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
//# sourceMappingURL=index.js.map