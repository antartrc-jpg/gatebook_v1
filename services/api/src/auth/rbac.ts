// FILE: services/api/src/auth/rbac.ts
import type { preHandlerHookHandler, FastifyRequest } from "fastify";
import { prisma } from "../db";

/** Cookie-Name aus server.ts lesen, mit Fallback */
function cookieName(req: FastifyRequest): string {
  // ts-expect-error optional decoration
  return req.server?.gbConfig?.sessionCookieName ?? process.env.SESSION_COOKIE_NAME ?? "gb_session";
}

/** User robust aus Cookie/Bearer → Session → DB laden */
async function loadUserFromRequest(req: FastifyRequest) {
  const anyReq = req as any;

  let sid: string | undefined =
    anyReq.cookies?.[cookieName(req)] || anyReq.cookies?.sid || anyReq.cookies?.session;

  // signierte Cookies entsignieren
  if (sid && typeof anyReq.unsignCookie === "function") {
    try {
      const u = anyReq.unsignCookie(String(sid));
      if (u?.valid && u.value) sid = u.value;
    } catch {
      /* ignore */
    }
  }

  // Fallback: Bearer
  if (!sid) {
    const auth = String(req.headers.authorization ?? "").trim().toLowerCase();
    if (auth.startsWith("bearer ")) sid = auth.slice(7).trim();
  }
  if (!sid) return null;

  const session = await prisma.session.findFirst({
    where: { OR: [{ id: sid }, { tokenHash: sid }] },
    select: { userId: true },
  });
  const userId = session?.userId;
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
}

/** Admin ODER Superadmin erlaubt (Bestands-Guard) */
export const requireAdminOrSuperAdmin: preHandlerHookHandler = async (req, reply) => {
  const anyReq = req as any;
  let role: string | undefined = anyReq.user?.role ? String(anyReq.user.role) : undefined;

  if (!role) {
    const user = await loadUserFromRequest(req);
    if (user) {
      anyReq.user = { ...(anyReq.user || {}), ...user };
      role = String(user.role);
    }
  }

  const r = String(role ?? "").toLowerCase();
  if (r === "admin" || r === "superadmin") return;
  return reply.code(403).send({ code: "FORBIDDEN" });
};

/** Admin ODER Superadmin ODER Owner erlaubt (neu für Rollen/Memberships) */
export const requireAdminSuperOrOwner: preHandlerHookHandler = async (req, reply) => {
  const anyReq = req as any;
  let role: string | undefined = anyReq.user?.role ? String(anyReq.user.role) : undefined;

  if (!role) {
    const user = await loadUserFromRequest(req);
    if (user) {
      anyReq.user = { ...(anyReq.user || {}), ...user };
      role = String(user.role);
    }
  }

  const r = String(role ?? "").toLowerCase();
  if (r === "admin" || r === "superadmin" || r === "owner") return;
  return reply.code(403).send({ code: "FORBIDDEN" });
};

/** Nur Superadmin erlaubt (optional, weiterhin verfügbar) */
export const requireSuperAdmin: preHandlerHookHandler = async (req, reply) => {
  const anyReq = req as any;
  let role: string | undefined = anyReq.user?.role ? String(anyReq.user.role) : undefined;

  if (!role) {
    const user = await loadUserFromRequest(req);
    if (user) {
      anyReq.user = { ...(anyReq.user || {}), ...user };
      role = String(user.role);
    }
  }

  if (String(role ?? "").toLowerCase() === "superadmin") return;
  return reply.code(403).send({ code: "FORBIDDEN" });
};

/** Backcompat-Alias (vorheriger Name) */
export const requireAdminOrSuper = requireAdminOrSuperAdmin;
