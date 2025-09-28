// FILE: services/api/src/routes/roles.ts
import type { FastifyPluginCallback } from "fastify";
import { PrismaClient, $Enums, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdminSuperOrOwner } from "../auth/rbac";

/* -------------------------------------------------------------------------- */
/* Prisma (DEV-reload-sicher)                                                 */
/* -------------------------------------------------------------------------- */
const prisma: PrismaClient =
  (globalThis as any).__gb_prisma ?? new PrismaClient();
if (!(globalThis as any).__gb_prisma) (globalThis as any).__gb_prisma = prisma;

/* -------------------------------------------------------------------------- */
/* Utils                                                                      */
/* -------------------------------------------------------------------------- */
const norm = (v: unknown) => String(v ?? "").toLowerCase();

/** Case-insensitive contains helper (Vorgabe) */
function containsCI(s: string) {
  return { contains: s, mode: "insensitive" as const };
}

/** Freitext-Suche (email/first/last, 1:1-Relation korrekt über `is`). */
function buildSearchWhere(q?: string): Prisma.UserWhereInput | undefined {
  if (!q) return undefined;
  const s = q.trim();
  if (!s) return undefined;
  // ursprüngliche Variante + Vorgabe-Helper
  return {
    OR: [
      { email: containsCI(s) },
      { profile: { is: { firstName: containsCI(s) } } },
      { profile: { is: { lastName: containsCI(s) } } },
    ],
  };
}

/** Optionaler Rollen-Filter aus Query in Enum umsetzen. */
function parseRoleFilter(roleParam?: string): $Enums.Role | undefined {
  const r = norm(roleParam);
  if (!r) return undefined;
  if (r === "user") return $Enums.Role.user;
  if (r === "viewer") return $Enums.Role.viewer;
  if (r === "deputy") return $Enums.Role.deputy;
  if (r === "owner") return $Enums.Role.owner;
  if (r === "admin") return $Enums.Role.admin;
  if (r === "superadmin") return $Enums.Role.superadmin;
  return undefined;
}

/**
 * Sichtbarkeit: 
 *  - superadmin = alle
 *  - admin = ohne superadmins
 *  - owner = nur eigene Mitglieder UND ohne superadmins (Vorgabe ergänzt)
 * 
 * ACHTUNG: Nutzt, wenn vorhanden, die Relation `orgMemberships` → { org: { ownerId } }.
 * Wenn dein Schema (noch) die Join-Tabelle ohne Relation nutzt, bleibt der alte Fallback in try/catch erhalten.
 */
async function buildVisibilityWhere(actorRole: string, actorId: string): Promise<Prisma.UserWhereInput | undefined> {
  if (actorRole === "superadmin") return undefined;
  if (actorRole === "admin") {
    return { role: { not: $Enums.Role.superadmin } };
  }

  if (actorRole === "owner") {
    // Primärweg: Relation `orgMemberships` (Vorgabe)
    const viaMembershipRelation: Prisma.UserWhereInput = {
      AND: [
        { role: { not: $Enums.Role.superadmin } }, // Vorgabe: Owner sieht keine Superadmins
        { orgMemberships: { some: { org: { ownerId: actorId } } } },
      ],
    };

    // Fallback auf Join-Tabelle, falls `orgMemberships` (noch) nicht existiert
    try {
      // Verifizieren, dass die Owner überhaupt Orgs hat; wenn nicht, gib leere Menge zurück
      const orgs = await prisma.organization.findMany({
        where: { ownerId: actorId },
        select: { id: true },
      });
      if (orgs.length === 0) {
        return { id: { in: [] } };
      }

      // Versuche via `orgMemberships` zu arbeiten (falls Relation existiert → this just works)
      return viaMembershipRelation;
    } catch {
      // Fallback: klassische Join-Tabelle `organizationMember` aus altem Code
      try {
        const orgs = await prisma.organization.findMany({
          where: { ownerId: actorId },
          select: { id: true },
        });
        if (orgs.length === 0) return { id: { in: [] } };

        const orgIds = orgs.map(o => o.id);
        const members = await prisma.organizationMember.findMany({
          where: { orgId: { in: orgIds } },
          select: { userId: true },
        });
        const memberIds = members.map(m => m.userId);
        if (memberIds.length === 0) return { id: { in: [] } };

        return {
          AND: [
            { role: { not: $Enums.Role.superadmin } }, // Vorgabe: Owner sieht keine Superadmins
            { id: { in: memberIds } },
          ],
        };
      } catch {
        // Falls Join-Tabelle (noch) nicht existiert → sicher nichts anzeigen.
        return { id: { in: [] } };
      }
    }
  }

  return { id: { in: [] } };
}

/** Darf Actor diesen Target-Roletyp bearbeiten (ohne Membership)? */
function canEditTarget(actor: string, target: string): boolean {
  if (actor === "superadmin") return true;
  if (actor === "admin") return !(target === "admin" || target === "superadmin");
  if (actor === "owner") return target === "user" || target === "viewer" || target === "deputy";
  return false;
}

/* Mindestens ein Superadmin muss bleiben – Vorgabe als Helper (Alias-Code bleibt kompatibel) */
async function assertAtLeastOneSuperadmin(targetUserId: string, wanted: $Enums.Role) {
  if (wanted === $Enums.Role.superadmin) return; // Promote → kein Risiko

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true } });
  if (!target || target.role !== $Enums.Role.superadmin) return;

  const others = await prisma.user.count({
    where: { role: $Enums.Role.superadmin, NOT: { id: targetUserId } },
  });

  if (others === 0) {
    const err: any = new Error("LAST_SUPERADMIN");
    // Vorgabe nutzt "CANNOT_DOWNGRADE_LAST_SUPERADMIN" — wir liefern beide Aliase im Response
    err._code = "LAST_SUPERADMIN";
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* Plugin                                                                     */
/* -------------------------------------------------------------------------- */
const rolesRoutes: FastifyPluginCallback = (app, _opts, done) => {
  // Alter Guard mit Owner-Unterstützung beibehalten (wichtige Kompatregel)
  const guard = requireAdminSuperOrOwner;

  // GET: /admin/roles/users?query=...&role=...&all=1 — Sichtbarkeit + Suche + Rollenfilter
  app.get("/admin/roles/users", { preHandler: guard }, async (req, reply) => {
    const qAll = (req.query as any) ?? {};
    const q = (qAll.query ?? qAll.q ?? "").toString();
    const roleParam = String(qAll.role ?? "");
    const all = String(qAll.all ?? "").toLowerCase() === "1";

    const actorRole = norm((req as any).user?.role);
    const actorId = String((req as any).user?.id ?? "");

    const [searchWhere, visibilityWhere] = await Promise.all([
      Promise.resolve(buildSearchWhere(q || undefined)),
      buildVisibilityWhere(actorRole, actorId),
    ]);

    const roleFilter = parseRoleFilter(roleParam);

    // „all=1“ ohne Such-/Role-Filter → nur Sichtbarkeit anwenden
    let where: Prisma.UserWhereInput | undefined;
    if (all && !q && !roleFilter) {
      where = visibilityWhere ?? undefined;
    } else {
      const parts: Prisma.UserWhereInput[] = [];
      if (visibilityWhere) parts.push(visibilityWhere);
      if (searchWhere) parts.push(searchWhere);
      if (roleFilter) parts.push({ role: roleFilter });
      if (parts.length === 1) where = parts[0];
      else if (parts.length > 1) where = { AND: parts };
      else where = undefined;
    }

    const users = await prisma.user.findMany({
      ...(where ? { where } : {}),
      // Vorgabe: mehr Felder (Profil & orgMemberships) – zusätzlich zu deinem bisherigen Select
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
            // Erweiterte Felder (Vorgabe)
            street: true,
            postalCode: true,
            city: true,
            country: true,
            birthDate: true,
          },
        },
        // Falls Schema vorhanden: orgMemberships → Org-Daten
        orgMemberships: {
          select: { org: { select: { id: true, name: true, logoUrl: true } } },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    });

    reply.send({ items: users });
  });

  // (Kompat) GET: /admin/roles/search?q=... — alte Route, gleiche Logik (ohne role/all)
  app.get("/admin/roles/search", { preHandler: guard }, async (req, reply) => {
    const q = (req.query as any)?.q as string | undefined;

    const actorRole = norm((req as any).user?.role);
    const actorId = String((req as any).user?.id ?? "");

    const [searchWhere, visibilityWhere] = await Promise.all([
      Promise.resolve(buildSearchWhere(q)),
      buildVisibilityWhere(actorRole, actorId),
    ]);

    const where =
      searchWhere || visibilityWhere
        ? ({ AND: [visibilityWhere ?? {}, searchWhere ?? {}] } as Prisma.UserWhereInput)
        : undefined;

    const items = await prisma.user.findMany({
      ...(where ? { where } : {}),
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    });

    reply.send({ items });
  });

  // GET: /admin/roles/organizations — Scope: owner nur eigene Orgs, sonst alle
  // Vorgabe: zusätzlich `query`-Filter & erweiterte Felder
  app.get("/admin/roles/organizations", { preHandler: guard }, async (req, reply) => {
    const actorRole = norm((req as any).user?.role);
    const actorId = String((req as any).user?.id ?? "");

    const q = typeof (req.query as any)?.query === "string"
      ? String((req.query as any).query).trim()
      : "";

    const and: Prisma.OrganizationWhereInput[] = [];
    if (q) and.push({ name: containsCI(q) });
    if (actorRole === "owner") and.push({ ownerId: actorId });

    const where: Prisma.OrganizationWhereInput | undefined = and.length ? { AND: and } : undefined;

    const orgs = await prisma.organization.findMany({
      ...(where ? { where } : {}),
      select: {
        id: true,
        name: true,
        logoUrl: true,     // Vorgabe
        status: true,      // Vorgabe (falls im Schema vorhanden)
        plan: true,        // Vorgabe (falls im Schema vorhanden)
        owner: { select: { id: true, email: true, role: true } },
        _count: {          // Vorgabe: members; alte Felder können bei Bedarf ergänzt werden
          select: {
            members: true,   // falls nicht vorhanden, bitte Bescheid geben → ich passe an
            // licenses: true,
            // invites: true,
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    reply.send({ items: orgs });
  });

  // POST: /admin/roles/set-role — akzeptiert userId ODER email
  app.post("/admin/roles/set-role", { preHandler: guard }, async (req, reply) => {
    const body = z
      .object({
        userId: z.string().min(1).optional(),
        email: z.string().email().trim().optional(),
        role: z.nativeEnum($Enums.Role), // user | viewer | deputy | owner | admin | superadmin
      })
      .refine(v => Boolean(v.userId || v.email), { message: "userId_or_email_required" })
      .parse(req.body ?? {});

    const actorRole = norm((req as any).user?.role);
    const actorId = String((req as any).user?.id ?? "");

    // Ziel laden (by id oder email)
    const target = body.userId
      ? await prisma.user.findUnique({ where: { id: body.userId } })
      : await prisma.user.findFirst({
          where: { email: { equals: String(body.email), mode: "insensitive" } },
        });

    if (!target) return reply.code(404).send({ code: "USER_NOT_FOUND", error: "user_not_found" });

    const targetRole = norm(target.role);
    const wantedRole = norm(body.role);

    // Superadmin nur von Superadmin veränderbar UND nie den letzten entfernen (Vorgabe + kompatible Codes)
    if (targetRole === "superadmin" && wantedRole !== "superadmin") {
      if (actorRole !== "superadmin") {
        return reply.code(403).send({ code: "CANNOT_DOWNGRADE_SUPERADMIN", error: "cannot_downgrade_superadmin" });
      }
      try {
        await assertAtLeastOneSuperadmin(target.id, body.role);
      } catch (e: any) {
        if (e?._code === "LAST_SUPERADMIN") {
          return reply.code(409).send({ code: "LAST_SUPERADMIN", error: "cannot_downgrade_last_superadmin" });
        }
        throw e;
      }
    }

    // Actor → Target (ohne Membership)
    if (!canEditTarget(actorRole, targetRole)) {
      return reply.code(403).send({ code: "FORBIDDEN_TARGET", error: "forbidden_target" });
    }

    // Owner: nur eigene Mitglieder verwalten (direkter Membership-Check)
    if (actorRole === "owner") {
      const isMember = await prisma.organizationMember.count({
        where: { userId: target.id, org: { ownerId: actorId } },
      });
      if (isMember === 0) {
        return reply.code(403).send({ code: "FORBIDDEN_NOT_MEMBER_OF_OWNER_ORG", error: "not_member" });
      }
    }

    // Darf Actor die gewünschte Rolle setzen?
    if (actorRole === "admin" && (wantedRole === "admin" || wantedRole === "superadmin")) {
      return reply.code(403).send({ code: "FORBIDDEN_ESCALATION", error: "forbidden_escalation" });
    }
    if (actorRole === "owner" && !["user", "viewer", "deputy"].includes(wantedRole)) {
      return reply.code(403).send({ code: "FORBIDDEN_ESCALATION", error: "forbidden_escalation" });
    }

    // No-Op
    if (targetRole === wantedRole) {
      return reply.send({
        ok: true,
        user: { id: target.id, email: target.email, role: target.role, createdAt: target.createdAt },
      });
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { role: body.role },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    reply.send({ ok: true, user: updated });
  });

  done();
};

export default rolesRoutes;
