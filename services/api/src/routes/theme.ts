/* FILE: services/api/src/routes/theme.ts
   GateBook Enterprise · API — Theme-Routen (GET /theme, GET /theme.css, PUT /admin/theme)

   W1 Hotfix – 403 & Guard-Härtung
   • Robustere User-Erkennung aus verschiedenen Session-Pfaden (req.user, req.session.user, …).
   • DEV: Speichern erlaubt, wenn Session erkennbar (oder DEV_RELAX_THEME=1/true); PROD: strikt superadmin.
   • Verwendet bevorzugt app.prisma (keine Doppel-Clients); Fallback: lokaler PrismaClient mit Cleanup.
*/

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient , Role } from "@prisma/client";
import { z } from "zod";

const NODE_ENV = process.env.NODE_ENV || "development";
const DEV_RELAX =
  String(process.env.DEV_RELAX_THEME || "").toLowerCase() === "1" ||
  String(process.env.DEV_RELAX_THEME || "").toLowerCase() === "true";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "gb_session";

const ThemeSchema = z
  .object({
    brand: z.string().trim().min(1).optional(),
    brandForeground: z.string().trim().min(1).optional(),
    bg: z.string().trim().min(1).optional(),
    fg: z.string().trim().min(1).optional(),
    card: z.string().trim().min(1).optional(),
    cardForeground: z.string().trim().min(1).optional(),
    muted: z.string().trim().min(1).optional(),
    mutedFg: z.string().trim().min(1).optional(),
    border: z.string().trim().min(1).optional(),
    fontSans: z.string().trim().min(1).optional(),
    radius: z.string().trim().min(1).optional(),
  })
  .strict();

type ThemeVars = z.infer<typeof ThemeSchema>;

const THEME_KEY = "theme:global";

/* CSS aus Tokens erzeugen – plus Synonyme für shadcn/ui */
function cssFromTheme(v?: ThemeVars | null): string {
  if (!v) return "";
  const base: Record<string, string | undefined> = {
    brand: v.brand,
    "brand-foreground": v.brandForeground,
    bg: v.bg,
    fg: v.fg,
    card: v.card,
    "card-foreground": v.cardForeground,
    muted: v.muted,
    "muted-fg": v.mutedFg,
    border: v.border,
    "font-sans": v.fontSans,
    radius: v.radius,
  };
  const parts: string[] = [];

  const has = (k: string) => !!base[k]?.trim();
  for (const [k, val] of Object.entries(base)) {
    if (has(k)) parts.push(`--${k}: ${String(val)};`);
  }
  if (has("brand")) parts.push(`--primary: ${base["brand"]};`);
  if (has("brand-foreground")) parts.push(`--primary-foreground: ${base["brand-foreground"]};`);
  if (has("muted")) parts.push(`--muted: ${base["muted"]};`);
  if (has("muted-fg")) parts.push(`--muted-foreground: ${base["muted-fg"]};`);

  return parts.length ? `:root{${parts.join("")}}` : "";
}

function normalizeRole(r?: unknown) {
  return String(r ?? "").trim().toLowerCase();
}

/* User aus verschiedenen möglichen Pfaden extrahieren */
function extractUser(req: FastifyRequest): { id?: string; role?: string } | null {
  const anyReq = req as any;
  const candidates = [
    anyReq.user,
    anyReq.session?.user,
    anyReq.session?.data?.user,
    typeof anyReq.session?.get === "function" ? anyReq.session.get("user") : undefined,
    anyReq.session?.data, // manche libs hängen user direkt hier rein
  ].filter(Boolean);

  for (const c of candidates) {
    const role = normalizeRole(c?.role);
    const id = c?.id ?? c?.userId ?? c?.uid;
    if (role || id) return { id, role };
  }

  const hasSessionLike =
    !!anyReq.session ||
    !!anyReq.sessionId ||
    !!(anyReq.cookies && anyReq.cookies[SESSION_COOKIE_NAME]);
  return hasSessionLike ? { role: "" } : null;
}

function devAllows(user: { id?: string; role?: string } | null): boolean {
  if (NODE_ENV === "production") return false;
  if (DEV_RELAX) return true;
  return !!user; // irgendein Session-Hinweis reicht in DEV
}
function prodAllows(role?: string): boolean {
  return normalizeRole(role) === "superadmin";
}

export default async function themeRoutes(app: FastifyInstance) {
  // Prisma: bevorzugt die bereits dekorierte Instanz nutzen
  const db: PrismaClient =
    (app as any).prisma ??
    (() => {
      const client = new PrismaClient();
      app.addHook("onClose", async () => {
        await client.$disconnect().catch(() => {});
      });
      return client;
    })();

  // GET /theme
  app.get("/theme", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    const row = await db.setting.findUnique({ where: { key: THEME_KEY } }).catch(() => null as any);
    const value: ThemeVars = (row?.value as ThemeVars) ?? {};
    const css = cssFromTheme(value);
    return reply.send({ value, css });
  });

  // GET /theme.css
  app.get("/theme.css", async (_req, reply) => {
    const row = await db.setting.findUnique({ where: { key: THEME_KEY } }).catch(() => null as any);
    const value: ThemeVars = (row?.value as ThemeVars) ?? {};
    const css = cssFromTheme(value);
    reply
      .type("text/css; charset=utf-8")
      .header("Cache-Control", "public, max-age=2, must-revalidate")
      .send(css || ":root{}");
  });

  // PUT /admin/theme
  app.put("/admin/theme", async (req: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
    const user = extractUser(req);
    const role = normalizeRole(user?.role);

    const allowed =
      NODE_ENV !== "production"
        ? devAllows(user) || role === "admin" || role === "superadmin"
        : prodAllows(role);

    if (!allowed) {
      if (NODE_ENV !== "production") {
        try {
          app.log?.info?.(
            `[theme] DENY 403 — role="${role || "(leer)"}", cookie=${Boolean(
              (req as any).cookies?.[SESSION_COOKIE_NAME]
            )}, DEV_RELAX_THEME=${DEV_RELAX ? "1" : "0"}`
          );
        } catch {}
      }
      return reply.status(403).send({ ok: false, error: "forbidden" });
    }

    const parsed = ThemeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ ok: false, error: "invalid_body", issues: parsed.error.flatten() });
    }

    const value = parsed.data;

    const saved = await db.setting
      .upsert({
        where: { key: THEME_KEY },
        create: { key: THEME_KEY, value },
        update: { value },
      })
      .catch((err) => {
        app.log?.error?.(err);
        return null;
      });

    if (!saved) return reply.status(500).send({ ok: false, error: "persist_failed" });

    const css = cssFromTheme(value);
    reply.header("Cache-Control", "no-store");
    return reply.send({ ok: true, value, css });
  });
}
