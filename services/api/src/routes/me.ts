/* FILE: services/api/src/routes/me.ts
   GateBook Enterprise · API — Userinfo (/me)
   Robust: liest Rolle aus verschiedenen Session-Pfaden. */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

function normalizeRole(r?: unknown): string {
  return String(r ?? "").trim().toLowerCase();
}

function extractUser(req: FastifyRequest): { id?: string; role?: string } | null {
  const anyReq = req as any;
  const candList: any[] = [
    anyReq.user,
    anyReq.session?.user,
    anyReq.session?.data?.user,
    typeof anyReq.session?.get === "function" ? anyReq.session.get("user") : undefined,
    anyReq.session?.data,
  ].filter(Boolean);

  for (const cand of candList) {
    const role = normalizeRole(cand?.role);
    const id = cand?.id ?? cand?.userId ?? cand?.uid;
    if (role || id) return { id, role };
  }
  return null;
}

export default async function meRoutes(app: FastifyInstance) {
  app.get("/me", async (req: FastifyRequest, reply: FastifyReply) => {
    reply.header("Cache-Control", "no-store");

    const u = extractUser(req);
    if (!u) return reply.code(200).send({ authenticated: false });

    return reply.code(200).send({
      authenticated: true,
      user: { id: u.id ?? null, role: normalizeRole(u.role) || null },
    });
  });
}
