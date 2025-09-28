// FILE: services/api/src/routes/_all.ts
import type { FastifyInstance } from "fastify";

// Wichtig: überall *ohne* .js importieren (CJS/ts-node/tsc-commonjs)
import authRoutes from "./auth";
import meRoutes from "./me";
import accountRoutes from "./account";
import profileRoutes from "./profile";
import profileStatusRoutes from "./profile-status";
import licenseRoutes from "./license";
import themeRoutes from "./theme";
import rolesRoutes from "./roles";
import debugRoutes from "./debug";

/**
 * Tolerante Feature-Flag-Auswertung:
 * akzeptiert "true", "1", "yes" (case-insensitive)
 */
function flagEnabled(v?: string): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

export default async function routes(app: FastifyInstance) {
  // 1) Auth zuerst (Sessions/Cookies), Grundlage für nachfolgende Guards
  await app.register(authRoutes);

  // 2) /me separat (leichter Session-/Health-Check)
  await app.register(meRoutes);

  // 3) Account-Routen (hier war der 404 – jetzt wirklich registriert)
  await app.register(accountRoutes);

  // 4) Kern-Profile
  await app.register(profileRoutes);
  await app.register(profileStatusRoutes);

  // 5) Optionale Module per Feature-Flag
  if (flagEnabled(process.env.FEATURE_LICENSE)) {
    await app.register(licenseRoutes);
  }
  if (flagEnabled(process.env.FEATURE_THEME)) {
    await app.register(themeRoutes);
  }

  // 6) Rollenverwaltung (Guards innerhalb der Route implementiert)
  await app.register(rolesRoutes);

  // 7) Debug zuletzt (minimiert Interferenzen)
  await app.register(debugRoutes);

  // Zum Sichttest (standardmäßig aktiv in DEV; in PROD nur bei PRINT_ROUTES=true)
  const shouldPrintRoutes =
    process.env.NODE_ENV !== "production" || flagEnabled(process.env.PRINT_ROUTES);
  if (shouldPrintRoutes) {
    app.ready(() => {
      app.log.info(app.printRoutes());
    });
  }
}

/*
  Hinweis für ESM/NodeNext:
  Falls ihr später auf ESM mit Dateiendungen wechselt, muss bei betroffenen Modulen
  (z. B. rolesRoutes) die Endung ".js" konsistent ergänzt werden. Diese Datei bleibt
  bewusst auf endungslose Imports ausgerichtet (CJS/ts-node/tsc-commonjs).
*/
