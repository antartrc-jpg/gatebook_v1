// FILE: services/api/src/routes/profile.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

// ———————————————————————————————————————————————
// Prisma: Singleton gegen Dev-Reload-Leaks (NodeNext/ESM sicher)
import { PrismaClient, $Enums } from "@prisma/client";
const prisma: PrismaClient =
  (globalThis as any).__gb_prisma ?? new PrismaClient();
if (!(globalThis as any).__gb_prisma) {
  (globalThis as any).__gb_prisma = prisma;
}

// ———————————————————————————————————————————————
// Helpers – kompatibel zur Session-Logik
function cookieSessionName(req: FastifyRequest): string {
  // ts-expect-error fastify decoration optional
  return req.server?.gbConfig?.sessionCookieName
    ?? process.env.SESSION_COOKIE_NAME
    ?? "gb_session";
}

function getBearer(req: FastifyRequest): string | null {
  const auth = String(req.headers.authorization ?? "").trim();
  if (!auth) return null;
  const lower = auth.toLowerCase();
  return lower.startsWith("bearer ") ? (auth.slice(7).trim() || null) : null;
}

async function getUserIdFromRequestLocal(req: FastifyRequest): Promise<string | null> {
  const anyReq = req as any;

  const uidDirect = anyReq.user?.id ? String(anyReq.user.id) : null;
  if (uidDirect) return uidDirect;

  const cookies = anyReq.cookies as Record<string, string> | undefined;
  let sid: string | undefined =
    cookies?.[cookieSessionName(req)] || cookies?.sid || cookies?.session;

  if (sid && typeof anyReq.unsignCookie === "function") {
    try {
      const u = anyReq.unsignCookie(String(sid));
      if (u?.valid && u.value) sid = u.value;
    } catch { /* ignore */ }
  }

  if (!sid) sid = getBearer(req) ?? undefined;
  if (!sid) return null;

  const session = await prisma.session.findFirst({
    where: { OR: [{ id: String(sid) }, { tokenHash: String(sid) }] },
    select: { userId: true },
  });

  return session?.userId ? String(session.userId) : null;
}

async function resolveUserId(app: FastifyInstance, req: FastifyRequest): Promise<string | null> {
  const anyApp = app as any;
  if (typeof anyApp.getUserIdFromRequest === "function") {
    try {
      const v = await anyApp.getUserIdFromRequest(req);
      if (v) return String(v);
    } catch { /* fallback */ }
  }
  const anyReq = req as any;
  if (anyReq.user?.id) return String(anyReq.user.id);
  return getUserIdFromRequestLocal(req);
}

// Lokaler Auth-Guard (Fallback, wenn globaler requireAuth fehlt)
function makeRequireAuth(app: FastifyInstance) {
  return async function requireAuthLocal(req: FastifyRequest, reply: FastifyReply) {
    const uid = await resolveUserId(app, req);
    if (!uid) return reply.code(401).send({ code: "UNAUTHORIZED" });
    (req as any).user = { id: uid };
  };
}

// ———————————————————————————————————————————————
// Default-Avatar ermitteln (env > relativ > Fallback)
function resolveDefaultAvatar(): string {
  const envUrl = process.env.DEFAULT_AVATAR_URL?.trim();
  if (envUrl?.startsWith("http")) return envUrl;
  const base = (process.env.WEB_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const path = envUrl && envUrl.startsWith("/") ? envUrl : (envUrl ?? "/images/avatar-default.png");
  return `${base}${path}`;
}

// Avatar-Validierung: http/https ODER data:image;base64
const isHttpUrl = (s: string) => /^https?:\/\//i.test(s);
const isDataImage = (s: string) =>
  /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(s);

// Zod – Request/Response (ISO-Only für birthDate)
const zProfile = z.object({
  title: z.string().max(64).optional(), // optional
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO: YYYY-MM-DD
  street: z.string().min(1),
  postalCode: z.string().min(1),
  city: z.string().min(1),
  country: z.string().length(2),
  gender: z.enum(["male", "female", "diverse", "unspecified"]).optional(),
  // Leerstring -> undefined; ansonsten http(s) ODER data:image erlauben
  avatarUrl: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().refine((s) => isHttpUrl(s) || isDataImage(s), {
      message: "avatarUrl must be http(s) or data:image;base64",
    })
  ).optional(),
  // neu: optional, wird aktuell nicht persistiert
  locale: z.string().max(32).optional(),
});

type ProfileInput = z.infer<typeof zProfile>;
type GenderEnum = $Enums.Gender;

// Pflichtfelder-Check zentral
function computeMissing(p: {
  firstName?: string | null;
  lastName?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
} | null | undefined) {
  const missing = [
    !p?.firstName && "firstName",
    !p?.lastName && "lastName",
    !p?.street && "street",
    !p?.postalCode && "postalCode",
    !p?.city && "city",
    !p?.country && "country",
  ].filter(Boolean) as string[];
  return { completed: missing.length === 0, missing };
}

// ———————————————————————————————————————————————
// Plugin
const profileRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Versuche, globalen Guard zu verwenden; sonst lokaler Fallback
  let requireAuth: any;
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    requireAuth = (app as any).requireAuth ?? null;
  } catch {
    requireAuth = null;
  }
  const authPre = [requireAuth || makeRequireAuth(app)];

  // POST /profile — erstellt/aktualisiert Profil
  app.post(
    "/profile",
    {
      preHandler: authPre,
      bodyLimit: 2 * 1024 * 1024, // 2 MB, für Base64-Data-URLs
      schema: {
        summary: "Erstellt/aktualisiert das Profil des eingeloggten Nutzers.",
        body: {
          type: "object",
          required: ["firstName","lastName","birthDate","street","postalCode","city","country"],
          additionalProperties: false,
          properties: {
            title: { type: "string", maxLength: 64 },
            firstName: { type: "string" },
            lastName: { type: "string" },
            birthDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            street: { type: "string" },
            postalCode: { type: "string" },
            city: { type: "string" },
            country: { type: "string", minLength: 2, maxLength: 2 },
            gender: { type: "string", enum: ["male","female","diverse","unspecified"] },
            avatarUrl: { type: "string" }, // http(s) oder data:image (Zod prüft)
            locale: { type: "string" },    // erlaubt, wird ignoriert
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              ok: { type: "boolean" },
              completed: { type: "boolean" },
              missing: { type: "array", items: { type: "string" } },
            },
            required: ["ok","completed","missing"],
            additionalProperties: false
          },
          400: {
            type: "object",
            properties: {
              code: { type: "string", enum: ["BAD_REQUEST"] },
              field: { type: "string" },
              message: { type: "string" },
            },
            required: ["code"],
            additionalProperties: true
          },
          401: { type: "object", properties: { code: { type: "string", enum: ["UNAUTHORIZED"] } }, required: ["code"] },
        },
      },
    },
    async (req: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const uid = (req as any).user?.id as string | undefined;
      if (!uid) return reply.code(401).send({ code: "UNAUTHORIZED" });

      const parsed = zProfile.safeParse(req.body);
      if (!parsed.success) {
        const issue = parsed.error.issues?.[0];
        return reply.code(400).send({
          code: "BAD_REQUEST",
          field: issue?.path?.join("."),
          message: issue?.message,
        });
      }

      const d = parsed.data as ProfileInput;
      // Default nur setzen, wenn kein Bild übergeben wurde
      const avatarUrl = (d.avatarUrl && d.avatarUrl.trim().length > 0)
        ? d.avatarUrl
        : resolveDefaultAvatar();

      await prisma.userProfile.upsert({
        where: { userId: uid },
        create: {
          userId: uid,
          title: d.title ?? null,
          firstName: d.firstName,
          lastName: d.lastName,
          birthDate: new Date(`${d.birthDate}T00:00:00Z`),
          street: d.street,
          postalCode: d.postalCode,
          city: d.city,
          country: d.country.toUpperCase(),
          gender: ((d.gender ?? "unspecified") as GenderEnum),
          avatarUrl,
        },
        update: {
          title: d.title ?? null,
          firstName: d.firstName,
          lastName: d.lastName,
          birthDate: new Date(`${d.birthDate}T00:00:00Z`),
          street: d.street,
          postalCode: d.postalCode,
          city: d.city,
          country: d.country.toUpperCase(),
          gender: ((d.gender ?? "unspecified") as GenderEnum),
          avatarUrl,
        },
      });

      // Nach dem Upsert erneut laden, Status berechnen
      const p = await prisma.userProfile.findUnique({
        where: { userId: uid },
        select: { firstName: true, lastName: true, street: true, postalCode: true, city: true, country: true },
      });
      const { completed, missing } = computeMissing(p);

      // Best-effort: Flag am User speichern (Spalte optional)
      try {
        await prisma.user.update({
          where: { id: uid },
          data: { profileCompleted: completed as any },
        });
      } catch { /* noop */ }

      return reply.send({ ok: true, completed, missing });
    }
  );

  // GET /profile — vollständiges Profil holen (immer mit Avatar)
  app.get(
    "/profile",
    {
      preHandler: authPre,
      schema: {
        summary: "Liest das Profil des eingeloggten Nutzers.",
        response: {
          200: {
            type: "object",
            properties: { profile: { type: "object", additionalProperties: true } },
            required: ["profile"],
          },
          401: { type: "object", properties: { code: { type: "string", enum: ["UNAUTHORIZED"] } }, required: ["code"] },
        },
      },
    },
    async (req, reply) => {
      const uid = (req as any).user?.id as string | undefined;
      if (!uid) return reply.code(401).send({ code: "UNAUTHORIZED" });

      try {
        const p = await (prisma as any).userProfile?.findUnique?.({ where: { userId: uid } });
        const avatarUrl = p?.avatarUrl ?? resolveDefaultAvatar();
        return reply.send({ profile: p ? { ...p, avatarUrl } : { avatarUrl } });
      } catch {
        // Wenn Tabelle fehlt o.ä.: wenigstens Default-Avatar liefern
        return reply.send({ profile: { avatarUrl: resolveDefaultAvatar() } });
      }
    }
  );

  // GET /profile/status — vollständig, wenn Pflichtfelder vorhanden
  app.get(
    "/profile/status",
    {
      preHandler: authPre,
      schema: {
        summary: "Gibt zurück, ob das Benutzerprofil als 'completed' gilt.",
        response: {
          200: {
            type: "object",
            properties: {
              completed: { type: "boolean" },
              missing: { type: "array", items: { type: "string" } },
            },
            required: ["completed","missing"],
            additionalProperties: false,
          },
          401: { type: "object", properties: { code: { type: "string", enum: ["UNAUTHORIZED"] } }, required: ["code"] },
        },
      },
    },
    async (req, reply) => {
      const uid = (req as any).user?.id as string | undefined;
      if (!uid) return reply.code(401).send({ code: "UNAUTHORIZED" });

      try {
        const p = await prisma.userProfile.findUnique({
          where: { userId: uid },
          select: { firstName: true, lastName: true, street: true, postalCode: true, city: true, country: true },
        });

        const { completed, missing } = computeMissing(p);

        // Best-effort: User-Flag aktualisieren
        try {
          await prisma.user.update({
            where: { id: uid },
            data: { profileCompleted: completed as any },
          });
        } catch { /* noop */ }

        return reply.send({ completed, missing });
      } catch {
        const { completed, missing } = computeMissing(null);
        return reply.send({ completed, missing });
      }
    }
  );
};

export default profileRoutes;
