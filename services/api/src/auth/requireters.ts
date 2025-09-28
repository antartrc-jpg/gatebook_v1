// Kleine Guards für Admin/Superadmin + Helper, der den eingeloggten User holt.
// Fastify-first (keine express-Typen → keine ts(2307) mehr).
import type { FastifyRequest, FastifyReply } from "fastify";
import { createHash } from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "../db";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "gb_session";

type SessionUser = { id: string; email: string; role: Role } | null;

/** Holt den aktuellen User – bevorzugt aus bereits gesetztem `req.user`. */
export async function getCurrentUser(req: FastifyRequest): Promise<SessionUser> {
  const u = (req as any).user as SessionUser | undefined;
  if (u) return u;

  const cookie =
    (req.cookies?.[SESSION_COOKIE_NAME] ??
      req.cookies?.sid ??
      req.cookies?.session) as string | undefined;
  if (!cookie) return null;

  // 1) Versuch: Session per ID
  let session =
    (await prisma.session.findFirst({
      where: { id: cookie },
      include: { user: true },
    })) ?? null;

  // 2) Fallback: Session per tokenHash (sha256(cookie))
  if (!session) {
    const tokenHash = createHash("sha256").update(cookie).digest("hex");
    session =
      (await prisma.session.findFirst({
        where: { tokenHash },
        include: { user: true },
      })) ?? null;
  }

  return (session?.user as SessionUser) ?? null;
}

/** preHandler für Fastify-Routen: nur Superadmin. */
export function requireSuperAdmin() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const me = await getCurrentUser(req);
    if (!me || me.role !== "superadmin") {
      reply.code(403).send({ error: "forbidden" });
      return;
    }
    (req as any).me = me;
  };
}

/** preHandler für Fastify-Routen: Admin **oder** Superadmin. */
export function requireAdminOrSuper() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const me = await getCurrentUser(req);
    if (!me || (me.role !== "admin" && me.role !== "superadmin")) {
      reply.code(403).send({ error: "forbidden" });
      return;
    }
    (req as any).me = me;
  };
}

/* Optional: schlanke Express-Adapter, ohne express-Types zu importieren. */
export const expressRequireSuperAdmin = async (req: any, res: any, next: any) => {
  const me = await getCurrentUser(req as unknown as FastifyRequest);
  if (!me || me.role !== "superadmin") return res.status(403).json({ error: "forbidden" });
  req.me = me;
  next();
};
export const expressRequireAdminOrSuper = async (req: any, res: any, next: any) => {
  const me = await getCurrentUser(req as unknown as FastifyRequest);
  if (!me || (me.role !== "admin" && me.role !== "superadmin"))
    return res.status(403).json({ error: "forbidden" });
  req.me = me;
  next();
};
