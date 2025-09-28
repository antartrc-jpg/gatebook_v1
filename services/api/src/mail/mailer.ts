// services/api/src/mail/mailer.ts
// TECHNIKER — TO-D: Mailer-Transport (MailHog/SMTP)
// Zweck: Zentrale Transport-Factory für Nodemailer auf Basis .env. Keine Secrets einchecken.
// Nutzung: In Routen (z. B. /auth/register → Verify-Mail) via createTransport() verwenden.
// Policy: Neutrale Texte (Kap. 14.1) in Templates; Transport hier nur Infrastruktur.

import nodemailer, { type Transporter, type SendMailOptions } from "nodemailer";

/** ENV-Quellen für den Mailtransport (dev-freundlich; MailHog-defaults). */
export type MailConfig = {
  host: string;            // SMTP Host (Dev: localhost)
  port: number;            // SMTP Port (Dev: 1025 für MailHog)
  secure: boolean;         // STARTTLS=false bei MailHog → secure=false
  user?: string;           // Optional (bei MailHog leer)
  pass?: string;           // Optional (bei MailHog leer)
  from: string;            // Absenderadresse (neutral)
  tlsRejectUnauthorized?: boolean; // optional für Lab-Setups
};

/** Minimales Payload-Interface für das Versenden. */
export type MailPayload = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
};

/** Liest ENV und stellt Defaults bereit (MailHog, neutrale From-Adresse). */
export function readMailConfigFromEnv(): MailConfig {
  const {
    SMTP_HOST = "localhost",
    SMTP_PORT = "1025",
    SMTP_SECURE = "false",
    SMTP_USER,
    SMTP_PASS,
    MAIL_FROM = "GateBook <no-reply@gatebook.local>",
    SMTP_TLS_REJECT_UNAUTHORIZED = "false",
  } = process.env;

  const cfg: MailConfig = {
    host: String(SMTP_HOST),
    port: Number(SMTP_PORT),
    secure: /^true$/i.test(String(SMTP_SECURE)),
    // Wichtig: keine Properties mit `undefined` erzwingen – optional lassen
    ...(SMTP_USER ? { user: SMTP_USER } : {}),
    ...(SMTP_PASS ? { pass: SMTP_PASS } : {}),
    from: String(MAIL_FROM),
    tlsRejectUnauthorized: /^true$/i.test(String(SMTP_TLS_REJECT_UNAUTHORIZED)),
  };

  return cfg;
}

/**
 * Erstellt einen Nodemailer-Transporter.
 * - MailHog: secure=false, keine Auth, TLS nicht erzwingen.
 * - Produktiv: secure=true (465) ODER STARTTLS via secure=false + Server-Policy; Auth verwenden.
 */
export function createTransport(config: MailConfig = readMailConfigFromEnv()): Transporter {
  const base = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    tls: { rejectUnauthorized: config.tlsRejectUnauthorized ?? false },
  };

  // exactOptionalPropertyTypes: auth nur hinzufügen, wenn beide Werte vorhanden
  const options = config.user && config.pass
    ? { ...base, auth: { user: config.user, pass: config.pass } }
    : base;

  return nodemailer.createTransport(options);
}

/**
 * Sendet eine E-Mail mit dem gegebenen Transporter.
 * - `from` wird aus Config bezogen; Routen geben nur Payload an.
 * - Fehler propagieren (Routen fangen sie ab und antworten 500 gemäß Kap. 7).
 */
export async function sendMail(
  transporter: Transporter,
  payload: MailPayload,
  cfg: MailConfig = readMailConfigFromEnv()
) {
  // exactOptionalPropertyTypes: optionale Felder nur setzen, wenn vorhanden
  const opts: SendMailOptions = {
    from: cfg.from,
    to: payload.to,
    subject: payload.subject,
    ...(payload.text ? { text: payload.text } : {}),
    ...(payload.html ? { html: payload.html } : {}),
    ...(payload.headers ? { headers: payload.headers } : {}),
  };

  const info = await transporter.sendMail(opts);
  return info;
}

/**
 * Dev-Helfer: Sanity-Check, ob die Mail-Konfiguration erreichbar wirkt.
 * - Versucht NOOP Verbindung (SMTP handshake), ohne eine echte Mail zu senden.
 * - Für CI/Local sinnvoll, um Konfigurationsfehler früh zu melden.
 */
export async function assertMailConfigReachable(
  config: MailConfig = readMailConfigFromEnv()
): Promise<void> {
  const transporter = createTransport(config);
  await transporter.verify(); // wirft bei Fehler
}
