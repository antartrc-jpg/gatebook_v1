/* FILE: services/api/src/routes/license.ts
   GateBook Enterprise · API — License status (/license/status)
   DEV: liefert einen stabilen Default, bis echte Persistenz angeschlossen ist. */

import type { FastifyInstance, FastifyReply } from "fastify";

type LicenseStatus = "active" | "inactive";

function getDevStatus(): LicenseStatus {
  // Optionales ENV, sonst 'active'
  const raw = (process.env.DEV_LICENSE_STATUS || "active").toLowerCase();
  return raw === "inactive" ? "inactive" : "active";
}

export default async function licenseRoutes(app: FastifyInstance) {
  app.get("/license/status", async (_req, reply: FastifyReply) => {
    const status = getDevStatus();
    // Wenn du später ein Ablaufdatum hast, hier einsetzen
    const validTo: string | null = null;

    reply.header("Cache-Control", "no-store");
    return reply.send({ status, validTo });
  });
}
