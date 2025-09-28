// packages/shared/src/auth/zod-schemas.ts
// TECHNIKER — TD-1: Zod Auth Schemas (Export für API & WEB; deckungsgleich zu OpenAPI-Scope W1)
// Hinweis: Diese Datei berücksichtigt die bestehende Fassung (zRegister) und erweitert sie um alle
// im W1-Flow benötigten Auth-Schemas. Strikte, neutrale Fehlermeldungen (Kap. 14.1).

import { z } from "zod";

/* ============================================================================
   Grundbausteine (Policy & Re-Use)
   ========================================================================== */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

const MSG = {
  email: "Bitte eine gültige E-Mail eingeben.",
  pass_min: `Mindestens ${PASSWORD_MIN} Zeichen.`,
  pass_max: `Maximal ${PASSWORD_MAX} Zeichen.`,
  pass_confirm: "Passwörter stimmen nicht überein.",
  token_required: "Token fehlt oder ist ungültig.",
  current_required: "Aktuelles Passwort wird benötigt.",
};

export const zEmail = z
  .string()
  .trim()
  .email(MSG.email)
  // Normalisierung für stabile Vergleiche (Backend sollte dennoch case-insensitive prüfen)
  .transform((s) => s.toLowerCase());

export const zPassword = z
  .string()
  .min(PASSWORD_MIN, MSG.pass_min)
  .max(PASSWORD_MAX, MSG.pass_max);

// Token: bewusst tolerant (Base64url/JWT/opaque), nur Länge grob prüfen.
export const zToken = z.string().min(8, MSG.token_required).max(512, MSG.token_required);

/* ============================================================================
   1) Registrierung
   SSOT: Kap. 13.1 (Felder/Regeln), 14.1 (Mikrotexte)
   - Keine Enumeration bestehender E-Mails (Server antwortet neutral)
   ========================================================================== */

export const zRegister = z
  .object({
    email: zEmail,
    password: zPassword,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: MSG.pass_confirm,
  });

export type RegisterInput = z.infer<typeof zRegister>;

/* ============================================================================
   2) Login
   SSOT: Kap. 13.2 (Login/Redirect-Regeln), 14.1
   ========================================================================== */

export const zLogin = z
  .object({
    email: zEmail,
    password: zPassword, // kein spezielles Feedback bei Fehlern (Server entscheidet neutral)
  })
  .strict();

export type LoginInput = z.infer<typeof zLogin>;

/* ============================================================================
   3) Verifikation (E-Mail-Bestätigung)
   SSOT: Kap. 13.1/13.3 (Verifikation; /verify/[token]), 7xx-Fehlerführung inkl. 410
   ========================================================================== */

export const zVerifyEmail = z
  .object({
    token: zToken,
  })
  .strict();

export type VerifyEmailInput = z.infer<typeof zVerifyEmail>;

// Optional: erneutes Senden der Verifikationsmail
export const zResendVerification = z
  .object({
    email: zEmail,
  })
  .strict();

export type ResendVerificationInput = z.infer<typeof zResendVerification>;

/* ============================================================================
   4) Passwort-Zurücksetzen (Forgot / Reset)
   SSOT: Kap. 13.4 (Sessions/Reset-Grundsätze), 14.1
   ========================================================================== */

// Schritt A: Reset anfordern (per E-Mail)
export const zRequestPasswordReset = z
  .object({
    email: zEmail,
  })
  .strict();

export type RequestPasswordResetInput = z.infer<typeof zRequestPasswordReset>;

// Schritt B: Reset per Token + neues Passwort
export const zResetPassword = z
  .object({
    token: zToken,
    password: zPassword,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: MSG.pass_confirm,
  });

export type ResetPasswordInput = z.infer<typeof zResetPassword>;

/* ============================================================================
   5) Passwort ändern (eingeloggte Nutzer)
   SSOT: Kap. 13.4 — DB-Session per HttpOnly-Cookie (kein LocalStorage-JWT)
   ========================================================================== */

export const zChangePassword = z
  .object({
    currentPassword: zPassword.min(1, MSG.current_required),
    newPassword: zPassword,
    confirmNewPassword: z.string(),
  })
  .strict()
  .refine((v) => v.newPassword === v.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: MSG.pass_confirm,
  });

export type ChangePasswordInput = z.infer<typeof zChangePassword>;

/* ============================================================================
   6) Named Exports als Sammel-Namespace (API & WEB konsumieren diese)
   ========================================================================== */

export const AuthSchemas = {
  Register: zRegister,
  Login: zLogin,
  VerifyEmail: zVerifyEmail,
  ResendVerification: zResendVerification,
  RequestPasswordReset: zRequestPasswordReset,
  ResetPassword: zResetPassword,
  ChangePassword: zChangePassword,
};

export type {
  RegisterInput as AuthRegisterInput,
  LoginInput as AuthLoginInput,
  VerifyEmailInput as AuthVerifyEmailInput,
  ResendVerificationInput as AuthResendVerificationInput,
  RequestPasswordResetInput as AuthRequestPasswordResetInput,
  ResetPasswordInput as AuthResetPasswordInput,
  ChangePasswordInput as AuthChangePasswordInput,
};

/* ============================================================================
   Kompatibilität & Überarbeitungskette
   ----------------------------------------------------------------------------
   - Berücksichtigt Reihenfolge: OPS → BASIS → DM → API → WEB → ADM → QA.
   - Diese TECHNIKER-Fassung ersetzt frühere Fassungen derselben Datei
     unter Berücksichtigung der Führungsfreigabe (Ausnahmegenehmigung).
   - Ziel: Deckungsgleichheit zu OpenAPI (W1). Bei YAML-Änderungen sind die
     Zod-Schemas synchron zu aktualisieren (One-File-Policy).
   ========================================================================== */

/*
[Referenzblock – Kap. 17.4]
- Kap. 4.1 Registrierung & Onboarding (Prozesskontext)
- Kap. 10.1 UI/UX Login & Registrierung (Form/Feedback)
- Kap. 11 Rollen-Dashboards (Redirect-Ziele)
- Kap. 13.1–13.4 Auth & Sitzungen (Register/Verify/Login/Reset)
- Kap. 14.1 UI-Mikrotexte (neutral, keine Enumeration)
- Kap. 17.4 Referenzblock (Dokupflicht)
- Kap. 28 Change-Log & SemVer (Wirksamkeit)

[Protokoll – Umsetzung]
- Bestehendes zRegister übernommen und um Login/Verify/Resend/Reset/Change erweitert.
- Einheitliche Policy (min/max) und Normalisierung (toLowerCase für E-Mail).
- Token absichtlich tolerant (min 8..max 512) für base64url/opaque/JWT.
- .strict() auf Objekten, um unbekannte Felder abzuweisen.

[Orchestrator-Handover – Einzeiler]
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
  -Chat TECHNIKER `
  -Gate "Welle 1" `
  -Status "delivered — TD-1 Auth Zod Schemas bereit (API & WEB Exporte)" `
  -Deliverable "packages/shared/src/auth/zod-schemas.ts" `
  -Summary "Register/Login/Verify/Reset/Change; neutrale Texte; strict() aktiviert"
*/
