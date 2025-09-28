// services/api/src/types/nodemailer.d.ts
// TECHNIKER — Hotfix: Ambient-Typen für 'nodemailer', bis offizielle Typen verfügbar/installiert.
// Zweck: Rote Zickzacklinie in VS Code beseitigen (ts(7016) – "Could not find a declaration file").
// Hinweis: Wenn @types/nodemailer oder eingebaute Typen verwendet werden, kann diese Datei entfernt werden.

declare module "nodemailer" {
  /** Minimal-Options für SMTP-Transport (Dev: MailHog / Prod: SMTP) */
  export interface SmtpOptions {
    host: string;
    port: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
    tls?: { rejectUnauthorized?: boolean };
  }

  /** Vereinfachte Send-Options (reichen für Verify-/Info-Mails im W1-Flow) */
  export interface SendMailOptions {
    from?: string;
    to?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
  }

  /** Rückgabe-Info des Sendens (vereinfacht/erweiterbar) */
  export interface SentMessageInfo {
    accepted?: Array<string | number | object>;
    rejected?: Array<string | number | object>;
    response?: string;
    envelope?: Record<string, unknown>;
    messageId?: string;
    [key: string]: unknown;
  }

  /** Transporter-Interface (nur benötigte Methoden) */
  export interface Transporter {
    sendMail(mail: SendMailOptions): Promise<SentMessageInfo>;
    verify(): Promise<boolean>;
  }

  /** Default-Export-Form mit Factory-Methode (passt zu `import nodemailer from "nodemailer"`) */
  interface Nodemailer {
    createTransport(options: SmtpOptions): Transporter;
  }

  const nodemailer: Nodemailer;
  export default nodemailer;

  // Zusätzlich erlauben die meisten Projekte den benannten Import von Typen:
  export { Transporter, SendMailOptions };
}

/*
================================================================================
[Referenzblock — Kap. 17.4]
Datei: services/api/src/types/nodemailer.d.ts
Deliverable: Hotfix — Typdeklaration für 'nodemailer'
Autor/Abteilung: TECHNIKER
Datum: 2025-09-19

Kontext & Begründung:
- VS Code meldet ts(7016): "Could not find a declaration file for module 'nodemailer'."
- Ziel ist es, die Arbeit an `services/api/src/mail/mailer.ts` (TO-D) ohne Build-Fehler fortzusetzen.
- Diese Minimal-Typen decken den W1-Use-Case (createTransport, sendMail, verify) ab.

Hinweise zur späteren Ablösung:
- Sobald offizielle Typen greifbar sind (eingebaut oder `@types/nodemailer`):
  1) Dev-Dep installieren und tsconfig-Pfade prüfen,
  2) diese Datei entfernen, um Doppeldefinitionen zu vermeiden.

Relevante SSOT-Abschnitte:
- Kap. 4.1 (Mail im Verifikationsfluss)
- Kap. 7 (Fehlercodes; Transportfehler → 500 auf Routenebene)
- Kap. 18 (Meta-Governance; schnelle, dokumentierte Hotfixes)
- Kap. 28 (Change-Log/Wirksamkeit)

Orchestrator-Handover (Einzeiler):
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
  -Chat TECHNIKER `
  -Gate "Welle 1" `
  -Status "delivered — VS Code Typfehler behoben (nodemailer.d.ts Hotfix)" `
  -Deliverable "services/api/src/types/nodemailer.d.ts" `
  -Summary "Ambient-Typen für nodemailer; kompatibel mit mailer.ts (createTransport/sendMail/verify)"
================================================================================
*/
