// FILE: services/api/src/routes/admins.ts
import type { FastifyPluginCallback } from "fastify";
import { z } from "zod";
import { PrismaClient, $Enums } from "@prisma/client";
import { requireSuperAdmin } from "../auth/rbac";
import crypto from "node:crypto";

const prisma = new PrismaClient();

// Gemeinsames Schema: E-Mail säubern + normalisieren
const zEmailBody = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
});

const adminsRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const guard = requireSuperAdmin;

  // Liste aller Admin-Accounts (inkl. Superadmins; Superadmins sind schreibgeschützt)
  app.get("/admin/admins", { preHandler: guard }, async (_req, reply) => {
    const users = await prisma.user.findMany({
      where: { role: { in: [$Enums.Role.admin, $Enums.Role.superadmin] } },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        profile: { select: { firstName: true, lastName: true, avatarUrl: true } }, // Profilfelder
      },
      orderBy: { createdAt: "desc" },
    });

    // Gravatar-Fallback nur, wenn kein avatarUrl gesetzt ist
    const items = users.map((u) => {
      const gravatar = `https://www.gravatar.com/avatar/${
        crypto.createHash("md5").update(u.email.trim().toLowerCase()).digest("hex")
      }?d=identicon&s=64`;

      return {
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        firstName: u.profile?.firstName ?? "",
        lastName: u.profile?.lastName ?? "",
        avatarUrl: u.profile?.avatarUrl || gravatar,
      };
    });

    reply.send({ items });
  });

  // Admin ernennen (nur Superadmin)
  app.post("/admin/admins/grant", { preHandler: guard }, async (req, reply) => {
    const { email } = zEmailBody.parse(req.body ?? {});
    // robust gegen Groß-/Kleinschreibung
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (!user) return reply.code(404).send({ code: "USER_NOT_FOUND" });

    if (user.role === $Enums.Role.superadmin) {
      return reply.code(409).send({ code: "IMMUTABLE_SUPERADMIN" });
    }
    if (user.role === $Enums.Role.admin) {
      return reply.code(200).send({ ok: true, already: true });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: $Enums.Role.admin },
    });
    return reply.send({ ok: true });
  });

  // Admin entziehen (nur Superadmin; Superadmins bleiben unangetastet)
  app.post("/admin/admins/revoke", { preHandler: guard }, async (req, reply) => {
    const { email } = zEmailBody.parse(req.body ?? {});
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (!user) return reply.code(404).send({ code: "USER_NOT_FOUND" });

    if (user.role === $Enums.Role.superadmin) {
      return reply.code(409).send({ code: "CANNOT_REVOKE_SUPERADMIN" });
    }
    if (user.role !== $Enums.Role.admin) {
      return reply.code(200).send({ ok: true, already: true });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: $Enums.Role.user },
    });
    return reply.send({ ok: true });
  });

  done();
};

export default adminsRoutes;
