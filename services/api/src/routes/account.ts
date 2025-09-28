// FILE: services/api/src/routes/account.ts
import type { FastifyPluginCallback, FastifyRequest } from "fastify";
import { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";

/* ----------------------------- Prisma Singleton ---------------------------- */
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };
export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
if (process.env.NODE_ENV === "development") globalForPrisma.__prisma = prisma;

/* ------------------------------- Auth Helper -------------------------------- */
/** Resilient: liest User aus req.user, session.*, session.data.*, session.auth.*, session.get("user") */
function requireAuth(req: FastifyRequest) {
  const r: any = req as any;
  const s = r.session ?? {};
  const get = (o: any, k: string) => (o && typeof o === "object" ? o[k] : undefined);

  const direct = r.user;
  const fromSess =
    get(s, "user") ||
    get(get(s, "data"), "user") ||
    get(get(s, "auth"), "user") ||
    (typeof s.get === "function" ? s.get("user") : null);

  const u = direct || fromSess || null;

  const id = get(u, "id") ?? get(s, "userId") ?? get(get(s, "data"), "userId");
  const email = get(u, "email") ?? get(s, "email") ?? get(get(s, "data"), "email");

  if (!id) {
    const err: any = new Error("unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return { id: String(id), email: String(email ?? "") };
}

/* --------------------------------- Zod ------------------------------------- */
const zDateYYYYMMDD = z.preprocess(
  (v) => {
    if (v === "" || (typeof v === "string" && v.trim() === "")) return null;
    return v;
  },
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD")
    .optional()
    .nullable()
);

const zProfile = z.object({
  title: z.string().trim().max(120).optional().nullable(),
  firstName: z.string().trim().max(120).optional().nullable(),
  lastName: z.string().trim().max(120).optional().nullable(),
  street: z.string().trim().max(200).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  country: z
    .string()
    .trim()
    .max(2)
    .transform((s) => (s ? s.toUpperCase() : s))
    .optional()
    .nullable(),
  birthDate: zDateYYYYMMDD,
  gender: z.enum(["male", "female", "diverse", "unspecified"]).optional().nullable(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
});
type ZProfile = z.infer<typeof zProfile>;

/* -------------------------------- Helpers ---------------------------------- */
const toIso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

function statusFromErr(err: unknown, fallback = 500): number {
  // zod error => 400
  if (err && typeof err === "object" && "issues" in (err as any)) return 400;
  // fastify/own errors with statusCode
  // @ts-ignore
  if (err?.statusCode) return (err as any).statusCode as number;
  return fallback;
}

function setIfDefined<T extends object, K extends keyof any>(target: T, key: K, value: unknown) {
  if (value !== undefined) (target as any)[key] = value;
}

function parseBirthDate(s: string | null | undefined): Date | null | undefined {
  if (s === undefined) return undefined;
  if (s === null) return null;
  const t = s?.trim?.() ?? "";
  if (!t) return null;
  // lokalzeitfrei für <input type="date">
  return new Date(`${t}T00:00:00`);
}

/** Prisma.UserProfile → JSON-freundlich (Strings/Nulls) */
function serializeProfile(row: {
  title: string | null;
  firstName: string | null;
  lastName: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  gender: any | null;
  avatarUrl: string | null;
  birthDate: Date | null;
} | null) {
  if (!row) return null;
  return {
    title: row.title ?? null,
    firstName: row.firstName ?? null,
    lastName: row.lastName ?? null,
    street: row.street ?? null,
    postalCode: row.postalCode ?? null,
    city: row.city ?? null,
    country: row.country ?? "DE",
    birthDate: row.birthDate ? row.birthDate.toISOString().slice(0, 10) : null, // YYYY-MM-DD
    gender: (row.gender ?? "unspecified") as "male" | "female" | "diverse" | "unspecified",
    avatarUrl: row.avatarUrl ?? null,
  };
}

function buildProfileCreateData(userId: string, body: ZProfile): Prisma.UserProfileUncheckedCreateInput {
  const data: Prisma.UserProfileUncheckedCreateInput = { userId };
  setIfDefined(data, "title", body.title ?? null);
  setIfDefined(data, "firstName", body.firstName ?? null);
  setIfDefined(data, "lastName", body.lastName ?? null);
  setIfDefined(data, "street", body.street ?? null);
  setIfDefined(data, "postalCode", body.postalCode ?? null);
  setIfDefined(data, "city", body.city ?? null);
  if (body.country !== undefined) setIfDefined(data, "country", body.country);
  if (body.gender !== undefined) setIfDefined(data, "gender", body.gender ?? null);
  if (body.avatarUrl !== undefined) setIfDefined(data, "avatarUrl", body.avatarUrl ?? null);
  const birth = parseBirthDate(body.birthDate);
  if (birth !== undefined) setIfDefined(data, "birthDate", birth);
  return data;
}

function buildProfileUpdateData(body: ZProfile): Prisma.UserProfileUpdateInput {
  const data: Prisma.UserProfileUpdateInput = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.firstName !== undefined) data.firstName = body.firstName;
  if (body.lastName !== undefined) data.lastName = body.lastName;
  if (body.street !== undefined) data.street = body.street;
  if (body.postalCode !== undefined) data.postalCode = body.postalCode;
  if (body.city !== undefined) data.city = body.city;
  if (body.country !== undefined) data.country = body.country;
  if (body.gender !== undefined) data.gender = body.gender;
  if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;
  const birth = parseBirthDate(body.birthDate);
  if (birth !== undefined) data.birthDate = birth;
  return data;
}

/* ----------------------------- Fastify Plugin ------------------------------ */
const accountRoutes: FastifyPluginCallback = (app, _opts, done) => {
  /* GET /account/memberships */
  app.get("/account/memberships", async (req, reply) => {
    try {
      const u = requireAuth(req);
      const rows = await prisma.organizationMember.findMany({
        where: { userId: u.id },
        select: {
          createdAt: true,
          org: { select: { id: true, name: true, plan: true, status: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      reply.send({
        memberships: rows.map((m) => ({
          orgId: m.org.id,
          orgName: m.org.name,
          plan: String(m.org.plan),
          status: String(m.org.status),
          since: toIso(m.createdAt),
        })),
      });
    } catch (err: any) {
      const sc = statusFromErr(err);
      app.log.error({ err }, "memberships failed");
      reply.code(sc).send({ code: "SERVER_ERROR" });
    }
  });

  /* GET /account/invitations — offene, nicht angenommene */
  app.get("/account/invitations", async (req, reply) => {
    try {
      const u = requireAuth(req);
      const rows = await prisma.invitation.findMany({
        where: {
          email: u.email,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          token: true,
          role: true,
          expiresAt: true,
          createdAt: true,
          org: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      reply.send({
        invitations: rows.map((i) => ({
          id: i.id,
          token: i.token,
          role: String(i.role),
          expiresAt: toIso(i.expiresAt),
          orgId: i.org.id,
          orgName: i.org.name,
        })),
      });
    } catch (err: any) {
      const sc = statusFromErr(err);
      app.log.error({ err }, "invitations failed");
      reply.code(sc).send({ code: "SERVER_ERROR" });
    }
  });

  /* NEW: GET /account/profile — read-only, normalisiert (Alternative zu /profile) */
  app.get("/account/profile", async (req, reply) => {
    try {
      const u = requireAuth(req);
      const row = await prisma.userProfile.findUnique({
        where: { userId: u.id },
        select: {
          title: true,
          firstName: true,
          lastName: true,
          street: true,
          postalCode: true,
          city: true,
          country: true,
          gender: true,
          avatarUrl: true,
          birthDate: true,
        },
      });
      reply.send(serializeProfile(row));
    } catch (err: any) {
      const sc = statusFromErr(err);
      app.log.error({ err }, "profile get failed");
      reply.code(sc).send({ code: "SERVER_ERROR" });
    }
  });

  /* GET /account/overview — Profil + Mitgliedschaften + Einladungen */
  app.get("/account/overview", async (req, reply) => {
    try {
      const u = requireAuth(req);

      const [user, profileRow, memberships, invitations] = await Promise.all([
        prisma.user.findUnique({
          where: { id: u.id },
          select: { id: true, email: true, role: true },
        }),
        prisma.userProfile.findUnique({
          where: { userId: u.id },
          select: {
            title: true,
            firstName: true,
            lastName: true,
            street: true,
            postalCode: true,
            city: true,
            country: true,
            gender: true,
            avatarUrl: true,
            birthDate: true,
          },
        }),
        prisma.organizationMember.findMany({
          where: { userId: u.id },
          select: {
            org: { select: { id: true, name: true, plan: true, status: true } },
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.invitation.findMany({
          where: {
            email: u.email,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: {
            id: true,
            token: true,
            role: true,
            expiresAt: true,
            org: { select: { id: true, name: true } },
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      reply.send({
        user,
        profile: serializeProfile(profileRow), // null oder Objekt (nie {})
        memberships: memberships.map((m) => ({
          orgId: m.org.id,
          orgName: m.org.name,
          plan: String(m.org.plan),
          status: String(m.org.status),
          since: toIso(m.createdAt),
        })),
        invitations: invitations.map((i) => ({
          id: i.id,
          token: i.token,
          role: String(i.role),
          expiresAt: toIso(i.expiresAt),
          orgId: i.org.id,
          orgName: i.org.name,
        })),
      });
    } catch (err: any) {
      const sc = statusFromErr(err);
      app.log.error({ err }, "overview failed");
      reply.code(sc).send({ code: "SERVER_ERROR" });
    }
  });

  /* PUT /account/profile — Upsert */
  app.put("/account/profile", async (req, reply) => {
    try {
      const u = requireAuth(req);
      const body = zProfile.parse(req.body ?? {});
      const createData = buildProfileCreateData(u.id, body);
      const updateData = buildProfileUpdateData(body);
      const updated = await prisma.userProfile.upsert({
        where: { userId: u.id },
        create: createData,
        update: updateData,
        select: { userId: true },
      });
      reply.send({ ok: true, userId: updated.userId });
    } catch (err: any) {
      const sc = statusFromErr(err);
      app.log.error({ err }, "profile update failed");
      reply.code(sc).send({ code: "SERVER_ERROR" });
    }
  });

  /* POST /account/join { token } — Einladung annehmen */
  app.post("/account/join", async (req, reply) => {
    try {
      const u = requireAuth(req);
      const { token } = z.object({ token: z.string().min(10) }).parse(req.body ?? {});
      const invite = await prisma.invitation.findUnique({
        where: { token },
        select: {
          id: true,
          email: true,
          orgId: true,
          role: true,
          expiresAt: true,
          acceptedAt: true,
          org: { select: { id: true, name: true } },
        },
      });

      if (!invite || invite.expiresAt <= new Date() || invite.acceptedAt) {
        return reply.code(404).send({ code: "INVITE_NOT_FOUND" });
      }
      if (invite.email.toLowerCase() !== u.email.toLowerCase()) {
        return reply.code(403).send({ code: "INVITE_EMAIL_MISMATCH" });
      }

      const already = await prisma.organizationMember.findFirst({
        where: { orgId: invite.orgId, userId: u.id },
      });
      if (already) {
        await prisma.invitation.delete({ where: { id: invite.id } }).catch(() => {});
        return reply.code(409).send({ code: "ALREADY_MEMBER" });
      }

      await prisma.$transaction([
        prisma.organizationMember.create({ data: { orgId: invite.orgId, userId: u.id } }),
        prisma.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
      ]);

      reply.send({ ok: true, org: { id: invite.org.id, name: invite.org.name }, role: invite.role });
    } catch (err: any) {
      const sc = statusFromErr(err);
      app.log.error({ err }, "join failed");
      reply.code(sc).send({ code: "SERVER_ERROR" });
    }
  });

  done();
};

export default accountRoutes;
