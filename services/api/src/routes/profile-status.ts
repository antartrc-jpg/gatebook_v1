// FILE: services/api/src/routes/profile-status.ts
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { FastifyPluginAsync } from "fastify";

// ———————————————————————————————————————————————
// Prisma: Singleton (verhindert Verbindungs-Leaks bei Hot Reload)
import { PrismaClient } from "@prisma/client";
const prisma: PrismaClient =
  (globalThis as any).__gb_prisma ?? new PrismaClient();
if (!(globalThis as any).__gb_prisma) {
  (globalThis as any).__gb_prisma = prisma;
}

// ———————————————————————————————————————————————
// Hilfen
function cookieSessionName(req: FastifyRequest): string {
  // ts-expect-error: fastify decoration (gbConfig) ist optional
  return req.server?.gbConfig?.sessionCookieName
    ?? process.env.SESSION_COOKIE_NAME
    ?? "gb_session";
}

function getBearer(req: FastifyRequest): string | null {
  const auth = String(req.headers.authorization ?? "").trim();
  if (!auth) return null;
  const lower = auth.toLowerCase();
  if (lower.startsWith("bearer ")) return auth.slice(7).trim() || null;
  return null;
}

async function getUserIdFromRequest(req: FastifyRequest): Promise<string | null> {
  const anyReq = req as any;

  // 1) Bereits authentifizierter User am Request
  const uidDirect = anyReq.user?.id ? String(anyReq.user.id) : null;
  if (uidDirect) return uidDirect;

  // 2) Cookies
  const cookies = anyReq.cookies as Record<string, string> | undefined;
  let sid: string | undefined =
    cookies?.[cookieSessionName(req)] || cookies?.sid || cookies?.session;

  // 2a) Signierte Cookies sicher entsignieren (falls @fastify/cookie aktiv ist)
  if (sid && typeof anyReq.unsignCookie === "function") {
    try {
      const u = anyReq.unsignCookie(String(sid));
      if (u?.valid && u.value) sid = u.value;
    } catch {
      // Ignorieren – wir versuchen Bearer als Fallback
    }
  }

  // 3) Fallback: Bearer-Token
  if (!sid) sid = getBearer(req) ?? undefined;
  if (!sid) return null;

  // 4) Session lookup: id ODER tokenHash
  const session = await prisma.session.findFirst({
    where: { OR: [{ id: String(sid) }, { tokenHash: String(sid) }] },
    select: { userId: true },
  });

  return session?.userId ? String(session.userId) : null;
}

// ———————————————————————————————————————————————
// Plugin
const profileStatusRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    "/profile/status",
    {
      schema: {
        summary: "Gibt zurück, ob das Benutzerprofil als 'completed' markiert ist.",
        response: {
          200: {
            type: "object",
            properties: {
              completed: { type: "boolean" },
            },
            required: ["completed"],
            additionalProperties: false,
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const uid = await getUserIdFromRequest(req);

        // Solange keine user_profile-Tabelle existiert:
        // - Kein User -> not completed
        if (!uid) return reply.code(200).send({ completed: false });

        // Persistente Flag-Quelle: settings.key = `profile:${uid}`
        // Existence-Check reicht (kein Payload nötig)
        const exists = await prisma.setting.findUnique({
          where: { key: `profile:${uid}` },
          select: { key: true },
        });

        return reply.code(200).send({ completed: Boolean(exists) });
      } catch {
        // Harten 500er vermeiden – konservativ "nicht komplett"
        return reply.code(200).send({ completed: false });
      }
    }
  );
};

export default profileStatusRoutes;
