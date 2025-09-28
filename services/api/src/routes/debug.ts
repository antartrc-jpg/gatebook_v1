// FILE: services/api/src/routes/debug.ts
import type { FastifyPluginCallback } from "fastify";

const debugRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get("/__health", async (_req, reply) => {
    reply.type("application/json").send({ ok: true, ts: Date.now() });
  });

  // Minimal-/me zum Gegencheck (ohne Cookies/DB)
  app.get("/__me", async (_req, reply) => {
    reply.code(401).send({ code: "UNAUTHORIZED", note: "minimal handler" });
  });

  done();
};

export default debugRoutes;
