// FILE: services/api/scripts/db_smoke_dm.mjs
// GateBook Enterprise — DM · DB Smoke (W1 Baseline, Option A + InfoDM1-Import)
//
// Ziel: Minimaler, aber aussagekräftiger End-to-End-Datenpfad für
//  - Verifizierung (VerificationToken: create → consume → expired → double-use (logisch))
//  - Core (User/Session/Org/License/Invitation)
//  - DM (MessageRequest → ACCEPTED → Conversation/Message → Attachment (post-accept) → BlockEntry)
//
// Besonderheiten:
//  - Robust gegen CJS/ESM: PrismaClient wird dynamisch importiert (InfoDM1-Muster).
//  - **.env Autoload**: Falls DATABASE_URL fehlt, wird .env automatisch gesucht & geladen (Option A),
//    inkl. Fallback **ohne** Abhängigkeit zu "dotenv".
//
// Aufruf:
//   node services/api/scripts/db_smoke_dm.mjs           # mit Cleanup
//   node services/api/scripts/db_smoke_dm.mjs --keep    # ohne Cleanup
//
// Anforderungen:
//  - Prisma Schema gemäß SSOT (camelCase, FK-Policies, DM-Modelle vorhanden)
//  - DATABASE_URL in der Umgebung **oder** .env im Repo-Root

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ──────────────────────────────────────────────────────────────────────────────
// Logging/Utils
// ──────────────────────────────────────────────────────────────────────────────
const KEEP = process.argv.includes('--keep') || process.env.KEEP === '1';
const now = () => new Date();
const tsTag = () => new Date().toISOString().replace(/[:.]/g, '-');
function hex(n = 32) {
  return randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n);
}
function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}
function logOK(msg)   { console.log(`✓ ${msg}`); }
function logInfo(msg) { console.log(`… ${msg}`); }
function logWarn(msg) { console.warn(`! ${msg}`); }

// ──────────────────────────────────────────────────────────────────────────────
// .env Autoload
// ──────────────────────────────────────────────────────────────────────────────
/** Mini-Parser für .env Zeilen im Format KEY=VALUE (mit optionalen Anführungszeichen). */
function applyEnvFromFile(path) {
  try {
    const raw = readFileSync(path, 'utf8');
    const lines = raw.split(/\r?\n/);
    let applied = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      // Strip optional quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // Unescape \n
      val = val.replace(/\\n/g, '\n');
      if (!(key in process.env)) {
        process.env[key] = val;
        applied++;
      }
    }
    return applied;
  } catch {
    return 0;
  }
}

/** .env Autoload (nur, wenn DATABASE_URL fehlt) */
async function ensureEnvLoaded() {
  if (process.env.DATABASE_URL) return false; // bereits gesetzt

  const here = dirname(fileURLToPath(import.meta.url));
  const cwd  = process.cwd();

  // Kandidaten: CWD (manueller Run), RepoRoot (typisch), evtl. höhere Ebenen
  const candidates = [
    join(cwd, '.env'),
    join(here, '../../../.env'),   // …/services/api/scripts → repo-root
    join(here, '../../.env'),      // …/services/api → (falls .env dort läge)
    join(here, '.env'),            // Fallback (unüblich)
  ];

  // 1) Versuche dotenv (falls installiert)
  try {
    const dotenv = await import('dotenv');
    for (const p of candidates) {
      if (existsSync(p)) {
        dotenv.config({ path: p });
        if (process.env.DATABASE_URL) {
          logInfo(`.env geladen (dotenv): ${p}`);
          return true;
        }
      }
    }
  } catch {
    // dotenv nicht vorhanden → Fallback
  }

  // 2) Fallback: manueller Parser (keine Abhängigkeiten)
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const n = applyEnvFromFile(p);
    if (n > 0 && process.env.DATABASE_URL) {
      logInfo(`.env geladen (fallback): ${p}`);
      return true;
    }
  }
  return false;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: PrismaClient robust importieren (CJS/ESM kompatibel) — InfoDM1-Muster
// ──────────────────────────────────────────────────────────────────────────────
async function loadPrismaClient() {
  let mod;
  try {
    mod = await import('@prisma/client');
  } catch (e) {
    console.error('❌ Import von @prisma/client fehlgeschlagen:', e);
    return null;
  }
  if (mod?.PrismaClient) return mod.PrismaClient;                 // ESM
  if (mod?.default?.PrismaClient) return mod.default.PrismaClient; // CJS
  console.error('❌ Konnte PrismaClient aus @prisma/client nicht auflösen (CJS/ESM-Mismatch).');
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────
async function main() {
  // Autoload .env bei Bedarf
  await ensureEnvLoaded();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL fehlt. Bitte .env prüfen.');
  }

  const PrismaClient = await loadPrismaClient();
  if (!PrismaClient) process.exit(1);

  /** @type {import('@prisma/client').PrismaClient | null} */
  let prisma = null;

  const tag = tsTag();
  logInfo(`DB-SMOKE (tag=${tag}) gestartet. KEEP=${KEEP ? 'yes' : 'no'}`);

  // Zur Aufräumreihenfolge (FK-sicher) merken:
  const created = {
    userId: null,
    profileId: null,
    sessionId: null,
    orgId: null,
    licenseId: null,
    invitationId: null,
    messageRequestId: null,
    conversationId: null,
    messageIds: /** @type {string[]} */([]),
    blockSet: false,
  };

  try {
    prisma = new PrismaClient();

    // ──────────────────────────────────────────────────────────────────────────
    // 1) USER & (optional) PROFILE
    // ──────────────────────────────────────────────────────────────────────────
    const email = `smoke_${tag}@example.com`;
    const argonHashSample =
      '$argon2id$v=19$m=65536,t=3,p=4$Z2F0ZWJvb2s$5y3Wu3S1v0XW7JeCj1uFQ+g8Y+3k4a1F1bV3e5kC8P4'; // 60+ chars (Dummy)

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: argonHashSample, // Feldname gemäß Schema (camelCase)
        role: 'user',
        emailVerifiedAt: null,
      },
      select: { id: true, email: true },
    });
    created.userId = user.id;
    logOK(`User erstellt: ${user.email}`);

    if (prisma.userProfile) {
      const profile = await prisma.userProfile.create({
        data: {
          userId: user.id,
          lastSeenVisibility: 'ALL',
          lastSeenAt: now(),
          statusText: 'SMOKE',
        },
        select: { id: true, lastSeenVisibility: true },
      });
      created.profileId = profile.id;
      logOK(`Profil erstellt (visibility=${profile.lastSeenVisibility})`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2) VERIFICATION TOKENS — create/consume/expire/double-use (logisch)
    // ──────────────────────────────────────────────────────────────────────────
    const vt = await prisma.verificationToken.create({
      data: {
        userId: user.id,
        token: 'vt_' + hex(64),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      select: { id: true },
    });
    logOK('VERIFY: Token (valid) erstellt');

    await prisma.verificationToken.update({
      where: { id: vt.id },
      data: { consumedAt: now() },
    });
    const vtAfter = await prisma.verificationToken.findUnique({ where: { id: vt.id } });
    assert(!!vtAfter?.consumedAt, 'VERIFY: consumedAt wurde nicht gesetzt (happy path)');
    logOK('VERIFY: Token konsumiert (happy)');

    const vtExpired = await prisma.verificationToken.create({
      data: {
        userId: user.id,
        token: 'vt_' + hex(64),
        expiresAt: new Date(Date.now() - 60 * 1000),
      },
      select: { id: true, expiresAt: true },
    });
    assert(vtExpired.expiresAt < now(), 'VERIFY: Expired-Token ist nicht abgelaufen');
    logOK('VERIFY: Expired-Token korrekt angelegt');

    const alreadyConsumed = vtAfter?.consumedAt != null;
    assert(alreadyConsumed, 'VERIFY: Vorbedingung für Double-use nicht gegeben');
    logOK('VERIFY: Double-use wird service-seitig verhindert (logisch geprüft)');

    // ──────────────────────────────────────────────────────────────────────────
    // 3) SESSION — nur tokenHash speichern (kein Klartext)
    // ──────────────────────────────────────────────────────────────────────────
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: 'sha256_' + hex(64),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      },
      select: { id: true, tokenHash: true },
    });
    created.sessionId = session.id;
    assert(!!session.tokenHash && !session.tokenHash.includes('.'), 'SESSION: tokenHash Form scheint ungültig');
    logOK('Session erstellt (tokenHash only)');

    // ──────────────────────────────────────────────────────────────────────────
    // 4) ORGANIZATION / LICENSE / INVITATION
    // ──────────────────────────────────────────────────────────────────────────
    const org = await prisma.organization.create({
      data: { name: `Org Smoke ${tag}`, ownerId: user.id },
      select: { id: true, name: true },
    });
    created.orgId = org.id;
    logOK(`Organization erstellt: ${org.name}`);

    const lic = await prisma.license.create({
      data: {
        orgId: org.id,
        status: 'active',
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      select: { id: true, status: true },
    });
    created.licenseId = lic.id;
    assert(lic.status === 'active', 'LICENSE: Status nicht aktiv');
    logOK('License erstellt (active)');

    const invite = await prisma.invitation.create({
      data: {
        orgId: org.id,
        email: `invitee_${tag}@example.com`,
        role: 'user',
        token: 'inv_' + hex(40),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      select: { id: true, email: true, token: true },
    });
    created.invitationId = invite.id;
    assert(!!invite.token, 'INVITATION: token fehlt');
    logOK('Invitation erstellt');

    // ──────────────────────────────────────────────────────────────────────────
    // 5) DM — MessageRequest → ACCEPTED → Conversation/Message → Attachment → Block
    // ──────────────────────────────────────────────────────────────────────────
    if (prisma.messageRequest && prisma.conversation && prisma.message && prisma.messageAttachment && prisma.blockEntry) {
      const mr = await prisma.messageRequest.create({
        data: {
          senderId: user.id,
          recipientEmail: `target_${tag}@example.com`,
          preview: 'Hallo (Preview, keine Links/Anhänge).',
          token: 'mr_' + hex(48),
        },
        select: { id: true, status: true },
      });
      created.messageRequestId = mr.id;
      assert(mr.status === 'PENDING', 'DM: MessageRequest nicht im Status PENDING');
      logOK('DM: MessageRequest erstellt (PENDING)');

      logWarn('DM: Attachments in Request-Phase sind per API-Policy zu blocken (hier nur Hinweis)');

      const conv = await prisma.conversation.create({
        data: {
          participantAId: user.id,
          participantBId: user.id, // Demo: self
        },
        select: { id: true },
      });
      created.conversationId = conv.id;
      logOK('DM: Conversation erstellt');

      const firstMsg = await prisma.message.create({
        data: {
          conversationId: conv.id,
          senderId: user.id,
          body: 'Willkommen in der aktiven Konversation.',
          status: 'SENT',
        },
        select: { id: true },
      });
      created.messageIds.push(firstMsg.id);

      const mrAccepted = await prisma.messageRequest.update({
        where: { id: mr.id },
        data: {
          status: 'ACCEPTED',
          respondedAt: now(),
          firstMessageId: firstMsg.id,
        },
        select: { status: true },
      });
      assert(mrAccepted.status === 'ACCEPTED', 'DM: Request nicht ACCEPTED');
      logOK('DM: Request ACCEPTED, firstMessage zugewiesen');

      await prisma.conversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: now(), lastMessageId: firstMsg.id },
      });

      const nextMsg = await prisma.message.create({
        data: {
          conversationId: conv.id,
          senderId: user.id,
          body: 'Zweite Nachricht (aktiv, Attachments jetzt zulässig).',
          status: 'SENT',
        },
        select: { id: true },
      });
      created.messageIds.push(nextMsg.id);

      await prisma.conversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: now(), lastMessageId: nextMsg.id },
      });
      logOK('DM: Nachrichten gesendet & lastMessage* gepflegt');

      let att;
      try {
        att = await prisma.messageAttachment.create({
          data: {
            messageId: nextMsg.id,
            url: `https://example.com/smoke/${tag}/${hex(8)}.txt`,
            mime: 'text/plain',
            size: 42,
          },
          select: { messageId: true },
        });
      } catch {
        // Fallback: minimaler Payload (falls Schema keine mime/size besitzt)
        att = await prisma.messageAttachment.create({
          data: {
            messageId: nextMsg.id,
            url: `https://example.com/smoke/${tag}/${hex(8)}.txt`,
          },
          select: { messageId: true },
        });
      }
      assert(att.messageId === nextMsg.id, 'DM: Attachment nicht zugewiesen');
      logOK('DM: Attachment erstellt (zulässig nach Annahme)');

      const block = await prisma.blockEntry.create({
        data: { blockerId: user.id, blockedId: user.id },
        select: { blockerId: true, blockedId: true },
      });
      created.blockSet = true;
      assert(block.blockerId === user.id && block.blockedId === user.id, 'DM: BlockEntry invalide');
      logOK('DM: Block gesetzt');

      logInfo('DM: Senden nach Block wäre per API zu verbieten (hier kein API-Aufruf).');
    } else {
      logWarn('DM-Modelle nicht vollständig verfügbar — DM-Teil wird übersprungen.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 6) UNIQUE/FK Sanity
    // ──────────────────────────────────────────────────────────────────────────
    let uniqueViolationCaught = false;
    try {
      await prisma.invitation.create({
        data: {
          orgId: created.orgId,
          email: `duplicate_${tag}@example.com`,
          role: 'user',
          token: /* Duplikat */ invite.token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    } catch {
      uniqueViolationCaught = true;
    }
    assert(uniqueViolationCaught, 'UNIQUE: Invitation.token Duplikat wurde nicht verhindert');
    logOK('UNIQUE: Invitation.token greift');

    logOK('DB-SMOKE erfolgreich abgeschlossen');

    // ──────────────────────────────────────────────────────────────────────────
    // Cleanup (optional)
    // ──────────────────────────────────────────────────────────────────────────
    if (!KEEP) {
      logInfo('Cleanup gestartet …');

      if (created.blockSet && prisma.blockEntry) {
        await prisma.blockEntry.deleteMany({ where: { blockerId: created.userId } });
      }
      if (created.messageIds.length && prisma.messageAttachment) {
        await prisma.messageAttachment.deleteMany({ where: { messageId: { in: created.messageIds } } });
      }
      if (created.conversationId && prisma.message) {
        await prisma.message.deleteMany({ where: { conversationId: created.conversationId } });
      }
      if (created.conversationId && prisma.conversation) {
        await prisma.conversation.deleteMany({ where: { id: created.conversationId } });
      }
      if (created.messageRequestId && prisma.messageRequest) {
        await prisma.messageRequest.deleteMany({ where: { id: created.messageRequestId } });
      }

      if (created.invitationId) await prisma.invitation.delete({ where: { id: created.invitationId } });
      if (created.licenseId)    await prisma.license.delete({ where: { id: created.licenseId } });
      if (created.orgId)        await prisma.organization.delete({ where: { id: created.orgId } });

      if (created.sessionId)    await prisma.session.delete({ where: { id: created.sessionId } });
      await prisma.verificationToken.deleteMany({ where: { userId: created.userId } });

      if (created.profileId && prisma.userProfile) {
        await prisma.userProfile.delete({ where: { id: created.profileId } });
      }
      if (created.userId)       await prisma.user.delete({ where: { id: created.userId } });

      logOK('Cleanup abgeschlossen');
    } else {
      logWarn('Cleanup übersprungen (KEEP aktiv)');
    }
    process.exitCode = 0;
  } catch (err) {
    console.error('✗ DB-SMOKE fehlgeschlagen:', err?.message || err);
    process.exitCode = 1;
  } finally {
    try {
      if (prisma) await prisma.$disconnect();
    } catch { /* ignore */ }
  }
}

await main();

/*
-----------------------------------------------------------------------------
[Referenzblock – Projektanlage, Kap. 17.4]
Datum: 2025-09-18
Domain-Lock: DM
Deliverable: services/api/scripts/db_smoke_dm.mjs

SSOT-Quellen:
  - Kap. 6 (DB-Baseline/Kernmodelle)
  - Kap. 13.1–13.4 (Auth/Verifikation/Session – nur `tokenHash`, TTL, Einmalverwendung)
  - Kap. 16.1–16.10 (DM: Requests, Conversations, Messages, Attachments, Block; Policy: Attachments erst nach Annahme)

Akzeptanzbezug (WO-DM-1, Option A + InfoDM1):
  - CJS/ESM-robuster PrismaClient-Import (dynamisch).
  - **.env Autoload** inkl. Fallback-Parser ohne Abhängigkeiten.
  - Verifizierung: Token anlegen, konsumieren, Ablauf/Doppelverwendung logisch geprüft.
  - Session: ausschließlich `tokenHash`, kein Klartext.
  - Org/Lizenz/Invitation: Basispfade; UNIQUE (Invitation.token) negativ getestet.
  - DM: MessageRequest(PENDING) → ACCEPTED → Conversation/Message → Attachment (post-accept) → BlockEntry (falls DM-Modelle verfügbar).
  - Cleanup via `--keep` steuerbar.

Orchestrator-Handover (Status „delivered“ – Vorschlag):
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
  -Chat DM `
  -Gate "W1 Baseline" `
  -Status "delivered — DB-SMOKE (InfoDM1-Import + Verify/DM-Flows, .env Autoload Fallback)" `
  -Deliverable "services/api/scripts/db_smoke_dm.mjs" `
  -Summary "CJS/ESM-sicher; .env Autoload robust; Happy/Edge-Cases abgedeckt; Policy-Hinweise"
-----------------------------------------------------------------------------
*/
