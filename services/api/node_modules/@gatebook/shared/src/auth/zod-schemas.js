"use strict";
// packages/shared/src/auth/zod-schemas.ts
// TECHNIKER — TD-1: Zod Auth Schemas (Export für API & WEB; deckungsgleich zu OpenAPI-Scope W1)
// Hinweis: Diese Datei berücksichtigt die bestehende Fassung (zRegister) und erweitert sie um alle
// im W1-Flow benötigten Auth-Schemas. Strikte, neutrale Fehlermeldungen (Kap. 14.1).
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthSchemas = exports.zChangePassword = exports.zResetPassword = exports.zRequestPasswordReset = exports.zResendVerification = exports.zVerifyEmail = exports.zLogin = exports.zRegister = exports.zToken = exports.zPassword = exports.zEmail = exports.PASSWORD_MAX = exports.PASSWORD_MIN = void 0;
const zod_1 = require("zod");
/* ============================================================================
   Grundbausteine (Policy & Re-Use)
   ========================================================================== */
exports.PASSWORD_MIN = 8;
exports.PASSWORD_MAX = 72;
const MSG = {
    email: "Bitte eine gültige E-Mail eingeben.",
    pass_min: `Mindestens ${exports.PASSWORD_MIN} Zeichen.`,
    pass_max: `Maximal ${exports.PASSWORD_MAX} Zeichen.`,
    pass_confirm: "Passwörter stimmen nicht überein.",
    token_required: "Token fehlt oder ist ungültig.",
    current_required: "Aktuelles Passwort wird benötigt.",
};
exports.zEmail = zod_1.z
    .string()
    .trim()
    .email(MSG.email)
    // Normalisierung für stabile Vergleiche (Backend sollte dennoch case-insensitive prüfen)
    .transform((s) => s.toLowerCase());
exports.zPassword = zod_1.z
    .string()
    .min(exports.PASSWORD_MIN, MSG.pass_min)
    .max(exports.PASSWORD_MAX, MSG.pass_max);
// Token: bewusst tolerant (Base64url/JWT/opaque), nur Länge grob prüfen.
exports.zToken = zod_1.z.string().min(8, MSG.token_required).max(512, MSG.token_required);
/* ============================================================================
   1) Registrierung
   SSOT: Kap. 13.1 (Felder/Regeln), 14.1 (Mikrotexte)
   - Keine Enumeration bestehender E-Mails (Server antwortet neutral)
   ========================================================================== */
exports.zRegister = zod_1.z
    .object({
    email: exports.zEmail,
    password: exports.zPassword,
    confirmPassword: zod_1.z.string(),
})
    .strict()
    .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: MSG.pass_confirm,
});
/* ============================================================================
   2) Login
   SSOT: Kap. 13.2 (Login/Redirect-Regeln), 14.1
   ========================================================================== */
exports.zLogin = zod_1.z
    .object({
    email: exports.zEmail,
    password: exports.zPassword, // kein spezielles Feedback bei Fehlern (Server entscheidet neutral)
})
    .strict();
/* ============================================================================
   3) Verifikation (E-Mail-Bestätigung)
   SSOT: Kap. 13.1/13.3 (Verifikation; /verify/[token]), 7xx-Fehlerführung inkl. 410
   ========================================================================== */
exports.zVerifyEmail = zod_1.z
    .object({
    token: exports.zToken,
})
    .strict();
// Optional: erneutes Senden der Verifikationsmail
exports.zResendVerification = zod_1.z
    .object({
    email: exports.zEmail,
})
    .strict();
/* ============================================================================
   4) Passwort-Zurücksetzen (Forgot / Reset)
   SSOT: Kap. 13.4 (Sessions/Reset-Grundsätze), 14.1
   ========================================================================== */
// Schritt A: Reset anfordern (per E-Mail)
exports.zRequestPasswordReset = zod_1.z
    .object({
    email: exports.zEmail,
})
    .strict();
// Schritt B: Reset per Token + neues Passwort
exports.zResetPassword = zod_1.z
    .object({
    token: exports.zToken,
    password: exports.zPassword,
    confirmPassword: zod_1.z.string(),
})
    .strict()
    .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: MSG.pass_confirm,
});
/* ============================================================================
   5) Passwort ändern (eingeloggte Nutzer)
   SSOT: Kap. 13.4 — DB-Session per HttpOnly-Cookie (kein LocalStorage-JWT)
   ========================================================================== */
exports.zChangePassword = zod_1.z
    .object({
    currentPassword: exports.zPassword.min(1, MSG.current_required),
    newPassword: exports.zPassword,
    confirmNewPassword: zod_1.z.string(),
})
    .strict()
    .refine((v) => v.newPassword === v.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: MSG.pass_confirm,
});
/* ============================================================================
   6) Named Exports als Sammel-Namespace (API & WEB konsumieren diese)
   ========================================================================== */
exports.AuthSchemas = {
    Register: exports.zRegister,
    Login: exports.zLogin,
    VerifyEmail: exports.zVerifyEmail,
    ResendVerification: exports.zResendVerification,
    RequestPasswordReset: exports.zRequestPasswordReset,
    ResetPassword: exports.zResetPassword,
    ChangePassword: exports.zChangePassword,
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
//# sourceMappingURL=zod-schemas.js.map