// FILE: services/api/src/plugins/session.ts
// DEV-Session (stateless, HMAC) mit Kompat-Schiene.
// - Cookie trägt { uid, exp } signiert per HMAC (base64url).
// - onRequest: Cookie prüfen → request.session = { uid } | null, request.user lazy laden.
// - Reply-API: reply.createSession / reply.destroySession / reply.refreshSession
// - Kompat: optional mehrere Cookie-Namen lesbar/schreibbar (z. B. "sid").
// - Export via fastify-plugin (Fastify 5).

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../db";

/* --------------------------------- Types ---------------------------------- */
type TokenPayload = { uid: string; exp: number }; // unix seconds
type CookieSameSite = "lax" | "strict" | "none";

declare module "fastify" {
  interface FastifyRequest {
    // Nur Helfer, keine Felder neu definieren -> keine Kollisionen
    getSession: () => { uid: string } | null;
    getUser: () => Promise<{ id: string; email: string | null; role: string | null } | null>;
  }
  interface FastifyReply {
    createSession: (payload: { uid: string }, ttlSeconds?: number) => void;
    destroySession: () => void;
    clearSession: () => void;
    refreshSession: (ttlSeconds?: number) => void;
  }
}

/* ------------------------------- b64url utils ------------------------------ */
const b64url = {
  enc(input: Buffer | string): string {
    const b = Buffer.isBuffer(input) ? input : Buffer.from(String(input), "utf8");
    return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  },
  dec(s: string): Buffer {
    const fixed = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = fixed.length % 4 === 0 ? "" : "=".repeat(4 - (fixed.length % 4));
    return Buffer.from(fixed + pad, "base64");
  },
};

const hmac = (secret: string, data: string) =>
  b64url.enc(createHmac("sha256", secret).update(data).digest());

const safeEq = (a: string, b: string) => {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
};

/* ------------------------------ token encode/dec --------------------------- */
function encode(secret: string, payload: TokenPayload): string {
  const p = b64url.enc(JSON.stringify(payload));
  const sig = hmac(secret, p);
  return `${p}.${sig}`;
}

function decode(secret: string, token: string): TokenPayload | null {
  // Nur HMAC-Token akzeptieren (p.sig). Legacy "sess_*" → ignorieren (kein Store vorhanden).
  const [p, sig] = token.split(".", 2);
  if (!p || !sig) return null;
  if (!safeEq(hmac(secret, p), sig)) return null;
  try {
    const obj = JSON.parse(b64url.dec(p).toString("utf8")) as TokenPayload;
    if (!obj || typeof obj.uid !== "string" || typeof obj.exp !== "number") return null;
    if (obj.exp <= Math.floor(Date.now() / 1000)) return null; // abgelaufen
    return obj;
  } catch {
    return null;
  }
}

/* -------------------------------- Plugin ---------------------------------- */
type Opts = {
  cookieName?: string;            // primärer Name (default aus app.gbConfig.sessionCookieName)
  ttlSeconds?: number;            // default 7 Tage
  compatCookieNames?: string[];   // zusätzliche (z. B. ["sid"]) – werden gelesen & (optional) gespiegelt
  mirrorCompatCookies?: boolean;  // true → beim Setzen alle Namen setzen (default: true)
};

const sessionPlugin: FastifyPluginAsync<Opts> = async (app, opts) => {
  const primaryCookie = String(
    opts.cookieName ?? app.gbConfig?.sessionCookieName ?? "gb_session"
  );

  const compatNames = Array.isArray(opts.compatCookieNames)
    ? opts.compatCookieNames.filter(Boolean)
    : ["sid"]; // sinnvolle Voreinstellung, da du bereits "sid" im Umlauf hattest

  const mirrorCompat = opts.mirrorCompatCookies !== false; // default: true

  const defaultTtl =
    Number.isFinite(opts.ttlSeconds) && Number(opts.ttlSeconds) > 0
      ? Number(opts.ttlSeconds)
      : 60 * 60 * 24 * 7; // 7 Tage

  const cookieOpts = (app.gbConfig?.sessionCookieOpts ?? {
    path: "/",
    httpOnly: true,
    sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as CookieSameSite,
    secure: process.env.NODE_ENV === "production",
  }) as {
    path?: string;
    httpOnly?: boolean;
    sameSite?: CookieSameSite;
    secure?: boolean;
    domain?: string;
    maxAge?: number;
    expires?: Date;
  };

  const secret =
    process.env.SESSION_SECRET ||
    process.env.JWT_SECRET ||
    "dev_session_secret_change_me"; // DEV fallback

  /* -------------------------- helpers: read/write token -------------------------- */
  function readFirstValidTokenFromCookies(req: FastifyRequest): TokenPayload | null {
    const jar = (req.cookies || {}) as Record<string, string>;
    const names = [primaryCookie, ...compatNames];
    for (const name of names) {
      const raw = jar[name];
      if (!raw) continue;
      const payload = decode(secret, raw);
      if (payload) return payload;
    }
    return null;
  }

  function setAllCookies(reply: FastifyReply, token: string, maxAge: number) {
    // immer primär
    reply.setCookie(primaryCookie, token, { ...cookieOpts, maxAge });
    if (mirrorCompat) {
      for (const name of compatNames) {
        reply.setCookie(name, token, { ...cookieOpts, maxAge });
      }
    }
  }

  function clearAllCookies(reply: FastifyReply) {
    const names = [primaryCookie, ...compatNames];
    for (const name of names) {
      reply.setCookie(name, "", { ...cookieOpts, maxAge: 0, expires: new Date(0) });
    }
  }

  function mintToken(uid: string, ttl?: number) {
    const ttlSeconds = Number.isFinite(ttl) && ttl! > 0 ? Number(ttl) : defaultTtl;
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    return { token: encode(secret, { uid, exp }), ttlSeconds };
  }

  /* ----------------------------- decorations ------------------------------ */
  app.decorateRequest("session", null);
  app.decorateRequest("user", null);

  app.decorateRequest("getSession", function (this: FastifyRequest) {
    const payload = readFirstValidTokenFromCookies(this);
    return payload ? { uid: payload.uid } : null;
  });

  app.decorateRequest("getUser", async function (this: FastifyRequest) {
    if ((this as any).user && (this as any).user?.id) return (this as any).user;
    const sess = this.getSession();
    if (!sess) return null;
    try {
      const u = await prisma.user.findUnique({
        where: { id: sess.uid },
        select: { id: true, email: true, role: true },
      });
      (this as any).user = u ? { id: u.id, email: u.email, role: u.role } : null;
      return (this as any).user;
    } catch {
      (this as any).user = null;
      return null;
    }
  });

  function createSessionImpl(this: FastifyReply, payload: { uid: string }, ttlSeconds?: number) {
    const { token, ttlSeconds: ttl } = mintToken(String(payload.uid), ttlSeconds);
    setAllCookies(this, token, ttl);

    // request-Objekt (gleiche Tick) vorbereiten
    try {
      const req: FastifyRequest | undefined = (this as any).request;
      if (req) {
        (req as any).session = { uid: String(payload.uid) };
        (req as any).user = null; // lazy via getUser()
      }
    } catch { /* ignore */ }
  }

  function destroySessionImpl(this: FastifyReply) {
    clearAllCookies(this);
    try {
      const req: FastifyRequest | undefined = (this as any).request;
      if (req) { (req as any).session = null; (req as any).user = null; }
    } catch { /* ignore */ }
  }

  function refreshSessionImpl(this: FastifyReply, ttlSeconds?: number) {
    // vorhandene UID ermitteln
    try {
      const req: FastifyRequest | undefined = (this as any).request;
      const sess = req?.getSession?.();
      if (!sess?.uid) return;
      const { token, ttlSeconds: ttl } = mintToken(String(sess.uid), ttlSeconds);
      setAllCookies(this, token, ttl);
    } catch { /* ignore */ }
  }

  app.decorateReply("createSession", createSessionImpl);
  app.decorateReply("destroySession", destroySessionImpl);
  app.decorateReply("clearSession", destroySessionImpl);
  app.decorateReply("refreshSession", refreshSessionImpl);

  /* ------------------------------- onRequest ------------------------------- */
  app.addHook("onRequest", async (req) => {
    const payload = readFirstValidTokenFromCookies(req);
    (req as any).session = payload ? { uid: payload.uid } : null;

    if (payload?.uid) {
      try {
        const u = await prisma.user.findUnique({
          where: { id: payload.uid },
          select: { id: true, email: true, role: true },
        });
        (req as any).user = u ? { id: u.id, email: u.email, role: u.role } : null;
      } catch {
        (req as any).user = null;
      }
    } else {
      (req as any).user = null;
    }
  });

  app.log.info(
    {
      module: "plugins/session",
      primaryCookie,
      compatNames,
      mirrorCompat,
      ttl: defaultTtl,
      secure: !!cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      domain: cookieOpts.domain ?? null,
      path: cookieOpts.path ?? "/",
    },
    "Session plugin ready",
  );
};

/* -------------------------------- export ---------------------------------- */
export default fp(sessionPlugin, {
  name: "gb-session",
  fastify: "5.x",
});
