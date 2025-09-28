// services/api/src/start.ts
// TECHNIKER — Start-Bootstrap für die API (CJS-stabil, kein Doppelstart, ohne import.meta)
// Ziel dieser Version (Option CJS):
//  • .env wird **explizit** und **robust** geladen – zuerst service-lokal (services/api/.env),
//    danach (falls noch Werte fehlen) aus dem Repo-Root (../../.. from /src).
//  • Verhindert „Environment variable not found: DATABASE_URL“ bei Start aus services/api/.
// Nutzung (DEV):
//   pnpm -C services/api dev
// Erwartung: Terminal zeigt "GateBook API configured … listening …", anschließend /health → { ok: true }

import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

type StartLike = () => Promise<void> | void;

// ---- Dotenv robust laden (Service-ENV bevorzugt, Root-ENV als Fallback) ----------------------
// CJS: __dirname ist vorhanden – kein import.meta nötig.
declare const __dirname: string;

// services/api/.env  (bevorzugt)
const serviceEnvPath = resolve(__dirname, "../..", ".env");
// repo-root/.env     (Fallback; überschreibt NICHT bereits gesetzte Variablen)
const rootEnvPath = resolve(__dirname, "../../../.env");

// 1) Service-ENV laden (falls vorhanden)
dotenvConfig({ path: serviceEnvPath, override: false });
// 2) Root-ENV nachladen (nur fehlende Keys auffüllen)
dotenvConfig({ path: rootEnvPath, override: false });

// Optionales, dezentes Logging (nur in DEV hilfreich)
if (process.env.NODE_ENV !== "production") {
  const seen = [
    ["DATABASE_URL", !!process.env.DATABASE_URL],
    ["WEB_ORIGIN", !!process.env.WEB_ORIGIN],
    ["WEB_APP_URL", !!process.env.WEB_APP_URL],
    ["PORT", !!process.env.PORT],
  ]
    .map(([k, ok]) => `${k}=${ok ? "✓" : "∅"}`)
    .join(" ");
  // eslint-disable-next-line no-console
  console.log(`[dotenv] loaded (${seen})`);
}

// ---- Unhandled-Rejections/Exceptions sichtbar machen (DEV) -----------------------------------
process.on("unhandledRejection", (err) => {
  // eslint-disable-next-line no-console
  console.error("[unhandledRejection]", err);
  process.exitCode = 1;
});
process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("[uncaughtException]", err);
  process.exit(1);
});

// Sanfter Shutdown bei SIGINT/SIGTERM
function setupGracefulShutdown() {
  const shutdown = (signal: NodeJS.Signals) => {
    // eslint-disable-next-line no-console
    console.log(`[${signal}] stopping…`);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

/**
 * ESM/CJS-robuste Auflösung der Start-Funktion:
 * Unterstützt:
 *  - named export:    export async function start(){…}
 *  - default export:  export default async function(){…}
 *  - nested default:  export default { start(){…} }
 */
function resolveStart(mod: any): StartLike | null {
  if (mod && typeof mod.start === "function") return mod.start as StartLike;
  if (mod && typeof mod.default === "function") return mod.default as StartLike;
  if (mod && mod.default && typeof mod.default.start === "function") return mod.default.start as StartLike;
  return null;
}

(async () => {
  setupGracefulShutdown();

  // CJS-kompatibel laden (funktioniert stabil mit ts-node/tsx)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const loaded = require("./server");
  const startFn = resolveStart(loaded);

  if (!startFn) {
    // eslint-disable-next-line no-console
    console.error("[start] Konnte keine Start-Funktion finden.");
    // eslint-disable-next-line no-console
    console.error("[start] Export-Keys:", Object.keys(loaded || {}));
    if (loaded?.default && typeof loaded.default === "object") {
      // eslint-disable-next-line no-console
      console.error("[start] default-Keys:", Object.keys(loaded.default));
    }
    process.exit(1);
  }

  try {
    await startFn();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[start] API konnte nicht gestartet werden:", err);
    process.exit(1);
  }
})();

/*
--------------------------------------------------------------------------------
Referenzblock (Kap. 17.4 · SSOT & Artefakte)
- SSOT: Kap. 13.1–13.4 (Bootstrap/ENV-Ladereihenfolge, Ports), Kap. 4.1 (Onboarding/Verify),
        Kap. 6 (Prisma/Schema-ENV), Kap. 7 (Fehlercodes), Kap. 28 (Change-Log).
- Artefakte/Logs:
  • EADDRINUSE :4000 beim Parallelstart (zeigt laufende Instanz), danach Health ok.
  • Prisma-Initfehler „Environment variable not found: DATABASE_URL“ bei Register.
--------------------------------------------------------------------------------
*/
