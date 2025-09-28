// FILE: services/api/src/routes/auth.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { randomBytes } from "node:crypto";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { z } from "zod";
import { zRegister, zLogin } from "@gatebook/shared/auth/zod-schemas"; // SSOT
import { createTransport, sendMail } from "../mail/mailer";

// ───────────────── Prisma (Singleton gegen Dev-Reload-Leaks) ─────────────────
const prisma: PrismaClient =
  (globalThis as any).__gb_prisma ?? new PrismaClient();
if (!(globalThis as any).__gb_prisma) {
  (globalThis as any).__gb_prisma = prisma;
}

// ─────────────────────────── Config ───────────────────────────
const VERIFY_TTL_SEC = parseInt(process.env.VERIFY_TTL_SEC ?? `${60 * 60 * 24}`, 10); // 24h
const WEB_APP_URL = process.env.WEB_APP_URL ?? "http://localhost:3000";

// ─────────────────────────── utils ───────────────────────────
function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function randomToken(bytes = 32): string {
  return b64url(randomBytes(bytes));
}
async function hashPassword(pw: string): Promise<string> {
  return argon2.hash(pw, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}
async function verifyPassword(hash: string | null | undefined, pw: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await argon2.verify(hash, pw);
  } catch {
    return false;
  }
}
async function readTemplateSafe(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
}
async function renderVerifyMail(email: string, link: string) {
  const templateDir = path.join(__dirname, "..", "mail", "templates");
  const htmlTpl =
    (await readTemplateSafe(path.join(templateDir, "verify-email.html"))) ||
    `<p>Hallo,</p><p>bitte bestätige deine E-Mail-Adresse für {{EMAIL}}:</p><p><a href="{{LINK}}">{{LINK}}</a></p>`;
  const txtTpl =
    (await readTemplateSafe(path.join(templateDir, "verify-email.txt"))) ||
    `Hallo,\n\nbitte bestätige deine E-Mail-Adresse für {{EMAIL}}:\n{{LINK}}\n`;
  return {
    html: htmlTpl.replaceAll("{{EMAIL}}", email).replaceAll("{{LINK}}", link),
    text: txtTpl.replaceAll("{{EMAIL}}", email).replaceAll("{{LINK}}", link),
  };
}
async function sendVerifyEmail(to: string, link: string) {
  const t = createTransport();
  const { html, text } = await renderVerifyMail(to, link);
  await sendMail(t, { to, subject: "Bitte E-Mail-Adresse bestätigen", html, text });
}

// Standard-Avatar: env > relativer Pfad > Fallback
function resolveDefaultAvatar(): string {
  const envUrl = process.env.DEFAULT_AVATAR_URL?.trim();
  if (envUrl?.startsWith("http")) return envUrl;
  const base = (process.env.WEB_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const pathPart = envUrl && envUrl.startsWith("/") ? envUrl : (envUrl ?? "/images/avatar-default.png");
  return `${base}${pathPart}`;
}

// Zod + Helper
const zVerifyQuery = z.object({ token: z.string().min(32) });
function parseOr400<T extends z.ZodTypeAny>(schema: T, input: unknown, reply: FastifyReply): z.infer<T> | undefined {
  const r = schema.safeParse(input);
  if (!r.success) {
    reply.status(400).send({ code: "BAD_REQUEST", message: "Eingaben prüfen." });
    return undefined;
  }
  return r.data;
}

// ─────────────────────────── plugin ───────────────────────────
export default async function authRoutes(app: FastifyInstance) {
  const log = (level: "debug" | "info" | "warn" | "error", obj: Record<string, unknown>, msg: string) =>
    (app.log as any)[level]?.(obj, msg);

  // POST /auth/register
  app.post("/auth/register", async (req: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
    const body = parseOr400(zRegister, req.body, reply);
    if (!body) return;

    const email = body.email.trim().toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) {
      return reply.status(409).send({ code: "CONFLICT", message: "Registrierung derzeit nicht möglich." });
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({ data: { email, passwordHash } });

    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + VERIFY_TTL_SEC * 1000);
    await prisma.verificationToken.create({ data: { userId: user.id, token, expiresAt } });

    const verifyLink = `${WEB_APP_URL}/verify/${token}`;
    await sendVerifyEmail(email, verifyLink).catch((e) => {
      log("warn", { e }, "sendVerifyEmail failed");
    });

    return reply.status(202).send({ accepted: true });
  });

  // GET /auth/verify?token=...
  app.get("/auth/verify", async (req: FastifyRequest<{ Querystring: { token?: string } }>, reply: FastifyReply) => {
    const q = parseOr400(zVerifyQuery, req.query, reply);
    if (!q) return;

    const vt = await prisma.verificationToken.findUnique({ where: { token: q.token } });
    if (!vt || (vt.expiresAt && vt.expiresAt.getTime() < Date.now())) {
      return reply.status(410).send({ code: "TOKEN_EXPIRED", message: "Token ungültig oder abgelaufen." });
    }
    if (vt.consumedAt) {
      return reply.status(410).send({ code: "TOKEN_CONSUMED", message: "Token bereits verwendet." });
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: vt.userId }, data: { emailVerifiedAt: new Date() } }),
      prisma.verificationToken.update({ where: { token: q.token }, data: { consumedAt: new Date() } }),
    ]);

    return reply.send({ verified: true });
  });

  // GET /auth/verify/:token (deprecated)
  app.get("/auth/verify/:token", async (req: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
    const { token } = req.params;
    const vt = await prisma.verificationToken.findUnique({ where: { token } });
    if (!vt || (vt.expiresAt && vt.expiresAt.getTime() < Date.now())) {
      return reply.status(410).send({ code: "TOKEN_EXPIRED", message: "Token ungültig oder abgelaufen." });
    }
    if (vt.consumedAt) {
      return reply.status(410).send({ code: "TOKEN_CONSUMED", message: "Token bereits verwendet." });
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: vt.userId }, data: { emailVerifiedAt: new Date() } }),
      prisma.verificationToken.update({ where: { token }, data: { consumedAt: new Date() } }),
    ]);

    return reply.send({ verified: true });
  });

  // POST /auth/login  — stateless Session (HMAC) via Plugin
  app.post("/auth/login", async (req: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
    try {
      const body = parseOr400(zLogin, req.body, reply);
      if (!body) return;

      const email = body.email.trim().toLowerCase();

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, role: true, emailVerifiedAt: true, passwordHash: true }
      });

      if (!user) {
        return reply.status(401).send({ code: "UNAUTHORIZED", message: "Anmeldung fehlgeschlagen." });
      }
      if (!user.emailVerifiedAt) {
        return reply.status(401).send({ code: "EMAIL_NOT_VERIFIED", message: "Anmeldung nicht möglich." });
      }

      const ok = await verifyPassword(user.passwordHash, body.password);
      if (!ok) {
        return reply.status(401).send({ code: "UNAUTHORIZED", message: "Anmeldung fehlgeschlagen." });
      }

      // ─────────────── HMAC-Session über Plugin ───────────────
      // setzt gültiges HMAC-Token in alle Session-Cookies (stateless)
      // Keine eigenen Cookies, kein sid, kein save()/regenerate()
      // @ts-ignore – Typen via Plugin augmentiert
      reply.createSession({ uid: user.id });

      return reply.code(204).send();
    } catch (err: any) {
      (app.log as any).error?.({ err }, "auth/login failed");
      return reply.code(500).send({ code: "SERVER_ERROR", message: "Internal Server Error" });
    }
  });

  // POST /auth/logout
  app.post("/auth/logout", async (req: FastifyRequest, reply: FastifyReply) => {
    // Wenn dein Plugin auch ein clear-Äquivalent bereitstellt, kannst du es hier nutzen.
    // Anderenfalls Cookies clearing/invalidierung hier beibehalten/ergänzen.
    try {
      // @ts-ignore – optional, falls vorhanden
      if (typeof reply.clearSession === "function") {
        // stateless: setzt leeres/abgelaufenes Token
        reply.clearSession();
        return reply.send({ ok: true });
      }
    } catch { /* ignore */ }
    return reply.send({ ok: true });
  });

  // GET /me  (für SSR-Guard)  — Backcompat: /session/me
  async function meHandler(req: FastifyRequest, reply: FastifyReply) {
    try {
      // bevorzugt: Plugin-Session lesen
      // @ts-ignore – Typen via Plugin augmentiert
      if (typeof req.getSession === "function") {
        // stateless payload z. B. { uid, iat, exp, ... }
        const s = req.getSession();
        const uid = s?.uid ? String(s.uid) : null;
        if (!uid) return reply.status(401).send({ code: "UNAUTHORIZED", message: "Keine Session." });

        const [user, profile] = await Promise.all([
          prisma.user.findUnique({ where: { id: uid } }),
          (prisma as any).userProfile?.findUnique?.({
            where: { userId: uid },
            select: { avatarUrl: true },
          }).catch(() => null)
        ]);

        if (!user) {
          return reply.status(401).send({ code: "UNAUTHORIZED", message: "Session ungültig." });
        }

        const avatarUrl = profile?.avatarUrl ?? resolveDefaultAvatar();

        return reply.send({
          authenticated: true,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            emailVerified: Boolean(user.emailVerifiedAt),
            // profileCompleted kann clientseitig via /profile-status o.ä. abgefragt werden
            avatarUrl,
          },
        });
      }
    } catch { /* ignore */ }

    // Fallback (sollte mit HMAC-Plugin i. d. R. nicht mehr nötig sein)
    return reply.status(401).send({ code: "UNAUTHORIZED", message: "Keine Session." });
  }
}
