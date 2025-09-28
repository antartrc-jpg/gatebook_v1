import "@fastify/cookie";

declare module "fastify" {
  interface FastifyInstance {
    // optional lassen → verhindert ts(2687), falls irgendwo versehentlich abweichend deklariert wird
    gbConfig?: {
      sessionCookieName: string;
      sessionCookieOpts: import("@fastify/cookie").CookieSerializeOptions;
      webOrigins: string[];
    };
  }

  interface FastifyRequest {
    getSession: () => { uid: string } | null;
    session: { uid: string } | null;
    user?: { id: string; email: string; role: string; [k: string]: any } | null;
    getUser: () => Promise<{ id: string; email: string; role: string; [k: string]: any } | null>;
  }

  interface FastifyReply {
    createSession: (payload: { uid: string }, ttlSeconds?: number) => void;
    destroySession: () => void;
    clearSession: () => void;
  }
}

export {};
