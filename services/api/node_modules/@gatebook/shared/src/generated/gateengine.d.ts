// packages/shared/src/generated/gateengine.d.ts
// TECHNIKER — TD-2: OpenAPI Types (GateEngine)
// Status: Bootstrap-Generat (CI-über schreibbar). Akzeptiert die Kette OPS→BASIS→DM→API→WEB→ADM→QA.
// Zweck: Sofort lauffähige Typenoberfläche für API/WEB, bis die finale YAML von BASIS vorliegt.
// WICHTIG: Diese Datei wird durch den CI-Schritt `openapi-typescript` AUTOMATISCH ERSETZT,
// sobald `contracts/openapi-gateengine.v1.yaml` verfügbar/final ist.
// Kein Runtime-Code; nur Typdeklarationen. SSR-freundlich.

// ---------------------------------------------------------------------------
// @generated NOTE
// Diese Deklarationsdatei entspricht der öffentlichen Oberfläche, wie sie von
// `openapi-typescript` erzeugt wird (Struktur: paths/components/operations).
// Bis zur finalen Generierung bleiben die Interfaces absichtlich generisch,
// sodass Import-Stellen bereits kompilieren. Danach ersetzt CI den Inhalt
// durch die konkreten, aus der OpenAPI 3.1 abgeleiteten Typen.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
// tslint:disable
// prettier-ignore

/** OpenAPI `paths` – Platzhalter bis zur CI-Generierung.
 *  Wird durch `openapi-typescript contracts/openapi-gateengine.v1.yaml -o packages/shared/src/generated/gateengine.d.ts`
 *  überschrieben (siehe Referenzblock).
 */
export interface paths {
  [route: string]: {
    get?: any;
    put?: any;
    post?: any;
    delete?: any;
    options?: any;
    head?: any;
    patch?: any;
    trace?: any;
  };
}

/** OpenAPI `components` – Platzhalter-Namespace. */
export namespace components {
  export interface schemas {
    [name: string]: any;
  }
  export interface parameters {
    [name: string]: any;
  }
  export interface responses {
    [name: string]: any;
  }
  export interface requestBodies {
    [name: string]: any;
  }
  export interface headers {
    [name: string]: any;
  }
  export interface pathItems {
    [name: string]: any;
  }
  export interface securitySchemes {
    [name: string]: any;
  }
}

/** OpenAPI `operations` – Mapping-Container (wird von CLI konkretisiert). */
export interface operations {
  [operationId: string]: {
    parameters?: any;
    requestBody?: any;
    responses?: any;
  };
}

/** Dienst-weit nützliche Hilfstypen (werden von der CLI mit echten Typen ersetzt). */
export type external = unknown;
export type unknownResponse = any;

/*
================================================================================
[Referenzblock — Kap. 17.4]
Datei: packages/shared/src/generated/gateengine.d.ts
Deliverable: TD-2 — OpenAPI Types (GateEngine)
Autor/Abteilung: TECHNIKER
Datum: 2025-09-18

Quelle der Wahrheit (SSOT):
- Kap. 18 Meta-Governance (CCB) — OpenAPI-Änderungen nur via Change Control
- Kap. 19.3 Integrität & Datenmodell — Typsynchronisation
- Kap. 23–27 Gate-Logik (GateEngine) — Endpunkte gemäß Contracts
- Kap. 28 Change-Log & SemVer — Wirksamkeit

Generierungsbefehl (CI/Local):
- pnpm dlx openapi-typescript contracts/openapi-gateengine.v1.yaml \
    -o packages/shared/src/generated/gateengine.d.ts

Protokoll / Umsetzung:
- Ausnahmegenehmigung genutzt: Bootstrap-Deklaration erstellt, damit API/WEB bereits
  gegen die erwartete öffentliche Oberfläche (paths/components/operations) tippen können.
- Datei ist eindeutig als @generated markiert und wird bei Verfügbarkeit der
  finalen YAML automatisch ersetzt (keine Hand-Typen im Endzustand).

Abhängigkeiten & Kettenregel:
- Letzte Abteilung gewinnt: Wenn QA/WEB/API spätere Protokolle zur YAML melden, gilt
  deren Stand als maßgeblich; CI regeneriert diese Datei entsprechend.

Change-Log (Vorschlag, Kap. 28):
- version: 0.1.2
- changes:
  - "Neu: Bootstrap der GateEngine OpenAPI-Typdeklaration; CI regeneriert aus Contracts."

[Orchestrator-Handover – Einzeiler]
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
  -Chat TECHNIKER `
  -Gate "Welle 1" `
  -Status "delivered — TD-2 GateEngine Types bootstrap; wartet auf BASIS-YAML/CI-Gen" `
  -Deliverable "packages/shared/src/generated/gateengine.d.ts" `
  -Summary "paths/components/operations bereit; openapi-typescript ersetzt final"
================================================================================
*/
