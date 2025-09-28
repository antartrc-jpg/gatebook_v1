// FILE: services/api/src/server.ts
import Fastify, {
  type FastifyInstance,
  type FastifyPluginOptions,
  type FastifyError,
} from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";

/* --------------------------------- ENV ------------------------------------ */
type Env = {
  API_PORT?: string; PORT?: string; HOST?: string;
  WEB_ORIGIN?: string; CORS_ORIGINS?: string;
  SESSION_SECRET?: string; SESSION_COOKIE_NAME?: string; COOKIE_DOMAIN?: string;
  COOKIE_SAMESITE?: "lax" | "strict" | "none";
  API_STRIP_PREFIX?: string; // ← optionales Präfix, das wir vor dem Routing abstreifen
  NODE_ENV?: string;
};

const {
  API_PORT,
  PORT = "4000",
  HOST = "0.0.0.0",
  WEB_ORIGIN = "http://localhost:3001",
  CORS_ORIGINS = "",
  SESSION_SECRET = "dev_session_secret_change_me",
  SESSION_COOKIE_NAME = "gb_session",
  COOKIE_DOMAIN,
  COOKIE_SAMESITE,
  API_STRIP_PREFIX = "", // z. B. "/api" setzen, wenn Proxy NICHT strippt
  NODE_ENV = "development",
} = process.env as Env;

const IS_PROD = NODE_ENV === "production";

/* --------------------------- Helpers / Normalizer -------------------------- */
function parseOrigins(base: string, extraCsv: string): string[] {
  const extras = extraCsv.split(",").map((s) => s.trim()).filter(Boolean);
  const set = new Set<string>([base, ...extras, "http://localhost:3000", "http://localhost:3001", "http://localhost:5173"]);
  return Array.from(set).map((o) => o.replace(/\/+$/, ""));
}
const ALLOWED_ORIGINS = parseOrigins(WEB_ORIGIN, CORS_ORIGINS);
const DEFAULT_SAMESITE: "lax" | "strict" | "none" = COOKIE_SAMESITE ?? (IS_PROD ? "none" : "lax");

/* ------------------------------- Build Server ------------------------------ */
export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
    bodyLimit: 8 * 1024 * 1024,
    trustProxy: true,
    caseSensitive: true,
    ignoreTrailingSlash: true,
    maxParamLength: 2000,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const o = origin.replace(/\/+$/, "");
      if (ALLOWED_ORIGINS.includes(o)) return cb(null, true);
      if (/^https?:\/\/localhost(?::\d+)?$/i.test(o)) return cb(null, true);
      return cb(new Error(`CORS: origin ${origin} not allowed`), false);
    },
    credentials: true,
    methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
    allowedHeaders: ["content-type","authorization","x-requested-with","accept","x-csrf-token"],
    exposedHeaders: ["set-cookie"],
    maxAge: 600,
  });

  await app.register(cookie, {
    secret: SESSION_SECRET,
    hook: "onRequest",
    parseOptions: {
      path: "/",
      httpOnly: true,
      sameSite: DEFAULT_SAMESITE,
      secure: IS_PROD,
      ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
    },
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  // Globale Config
  app.decorate("gbConfig", {
    sessionCookieName: SESSION_COOKIE_NAME,
    sessionCookieOpts: {
      path: "/",
      httpOnly: true,
      sameSite: DEFAULT_SAMESITE,
      secure: IS_PROD,
      ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
    },
    webOrigins: ALLOWED_ORIGINS,
  } as const);

  // Optional: Präfix "/api" vor Routing entfernen, wenn Proxy NICHT strippt
  if (API_STRIP_PREFIX) {
    const prefix = API_STRIP_PREFIX.endsWith("/") ? API_STRIP_PREFIX.slice(0, -1) : API_STRIP_PREFIX;
    app.addHook("onRequest", async (req) => {
      if (req.url.startsWith(prefix + "/")) {
        const old = req.url;
        (req as any).url = req.url.slice(prefix.length);
        req.log.debug({ old, now: req.url, prefix }, "API_STRIP_PREFIX applied");
      }
      // Kleines Login-Debug
      if (req.method === "POST" && req.url.endsWith("/auth/login")) {
        req.log.info({ path: req.url }, "login request");
      }
    });
  }

  // Session-Plugin
  await safeRegister(app, "./plugins/session", {
    cookieName: SESSION_COOKIE_NAME,
    ttlSeconds: 60 * 60 * 24 * 7,
  });

  // Bridge: session → req.user (robust)
  app.addHook("preHandler", async (req) => {
    const r: any = req as any;
    if (r.user) return;
    const s = r.session ?? {};
    const get = (o: any, k: string) => (o && typeof o === "object" ? o[k] : undefined);
    const u =
      get(s, "user") ||
      get(get(s, "data"), "user") ||
      get(get(s, "auth"), "user") ||
      (typeof s.get === "function" ? s.get("user") : null);

    if (u?.id) r.user = { id: u.id, email: u.email ?? "" };
    else if (s.userId) r.user = { id: s.userId, email: s.email ?? "" };
    else if (get(s, "data")?.userId) r.user = { id: get(s, "data").userId, email: get(s, "data").email ?? "" };
  });

  // Health
  app.get("/health", async () => ({ ok: true }));

  // Routes
  await safeRegister(app, "./routes/auth");
  await safeRegister(app, "./routes/license");
  await safeRegister(app, "./routes/theme");
  await safeRegister(app, "./routes/admins");
  await safeRegister(app, "./routes/roles");
  await safeRegister(app, "./routes/profile");
  // await safeRegister(app, "./routes/profile-status"); // ← bleibt aus, um Duplikate zu vermeiden
  await safeRegister(app, "./routes/me");               // ← WIEDER AKTIV (stellt /me bereit)
  await safeRegister(app, "./routes/account");

  if (NODE_ENV !== "production") {
    await safeRegister(app, "./routes/debug");
  }

  // Error-Handler: Login → 401, egal ob mit /api davor
  app.setErrorHandler((err: FastifyError & { statusCode?: number }, req, reply) => {
    const path = req.url || "";
    if (req.method === "POST" && (path === "/auth/login" || path.endsWith("/auth/login"))) {
      app.log.warn({ err, path }, "login failed (mapped to 401)");
      return reply
        .code(401)
        .send({ code: "LOGIN_FAILED", message: "E-Mail oder Passwort falsch oder Konto nicht verifiziert." });
    }
    if (/CORS/i.test(String(err?.message ?? ""))) {
      app.log.warn({ path, origin: req.headers.origin }, "blocked by CORS");
      return reply.code(403).send({ code: "CORS_FORBIDDEN", message: "Origin nicht erlaubt." });
    }
    const status = err.statusCode ?? 500;
    app.log.error({ err, path, method: req.method }, "unhandled error");
    return reply.code(status).send({ code: "SERVER_ERROR", message: "Interner Fehler." });
  });

  // Startup-Info
  app.log.info(
    {
      env: NODE_ENV,
      port: Number(API_PORT ?? PORT),
      host: HOST,
      webOrigins: ALLOWED_ORIGINS,
      cookieName: SESSION_COOKIE_NAME,
      cookieSameSite: DEFAULT_SAMESITE,
      cookieSecure: IS_PROD,
      cookieDomain: COOKIE_DOMAIN ?? null,
      apiStripPrefix: API_STRIP_PREFIX || null,
    },
    "GateBook API configured",
  );

  if (IS_PROD && SESSION_SECRET === "dev_session_secret_change_me") {
    app.log.warn("SESSION_SECRET hat DEV-Default – bitte setzen!");
  }
  if (IS_PROD && DEFAULT_SAMESITE !== "none") {
    app.log.warn("PROD ohne SameSite=None – kann Cookies hinter Proxy/Cross-Site blockieren.");
  }

  return app;
}

/* --------------------------------- Start ---------------------------------- */
export async function start() {
  const app = await buildServer();
  await app.listen({ port: Number(API_PORT ?? PORT), host: HOST });
  app.log.info({ port: Number(API_PORT ?? PORT), host: HOST }, "GateBook API listening");
}
export default start;

/* ------------------------------- safeRegister ------------------------------ */
async function safeRegister(app: FastifyInstance, modulePath: string, opts?: FastifyPluginOptions) {
  try {
    let mod: any;
    try { mod = require(modulePath); } catch { mod = await import(/* @vite-ignore */ modulePath); }
    const plugin = (mod?.default ?? mod) as unknown;
    if (typeof plugin !== "function") {
      app.log.warn({ modulePath }, "Skip route: no function export");
      return;
    }
    await app.register(plugin as any, opts as any);
    app.log.info({ modulePath, opts }, "Route module mounted");
  } catch (err: any) {
    const msg = String(err?.message ?? err ?? "");
    if (err?.code === "MODULE_NOT_FOUND" || err?.code === "ERR_MODULE_NOT_FOUND" || /Cannot find module/.test(msg)) {
      app.log.warn({ modulePath, msg }, "Optional route not found (skipped)");
      return;
    }
    app.log.error({ modulePath, err }, "Failed to mount route");
    throw err;
  }
}
