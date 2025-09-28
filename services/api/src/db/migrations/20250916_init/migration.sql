# FILE: services/api/src/db/migrations/20250916_init/migration.sql
-- GateBook Enterprise — DM · Init Migration (Welle 1)
-- Ziel: Kernmodelle & Relationen gemäß SSOT / contracts/openapi-dm.v1.yaml
-- Datenbank: PostgreSQL

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────
-- Für gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('user', 'owner', 'admin', 'deputy');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LicenseStatus') THEN
    CREATE TYPE "LicenseStatus" AS ENUM ('active', 'inactive');
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

-- Users
CREATE TABLE IF NOT EXISTS "User" (
  "id"               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"            TEXT            NOT NULL,
  "passwordHash"     TEXT            NOT NULL,
  "emailVerifiedAt"  TIMESTAMPTZ     NULL,
  "role"             "Role"          NOT NULL DEFAULT 'user',
  "createdAt"        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Einmal-Token zur E-Mail-Verifikation
CREATE TABLE IF NOT EXISTS "VerificationToken" (
  "id"         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"     UUID        NOT NULL,
  "token"      TEXT        NOT NULL,
  "expiresAt"  TIMESTAMPTZ NOT NULL,
  "consumedAt" TIMESTAMPTZ NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_verification_user"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE
);

-- Serverseitige Sessions (nur Hash speichern)
CREATE TABLE IF NOT EXISTS "Session" (
  "id"         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"     UUID        NOT NULL,
  "tokenHash"  TEXT        NOT NULL,
  "expiresAt"  TIMESTAMPTZ NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_session_user"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE
);

-- Organisationen
CREATE TABLE IF NOT EXISTS "Organization" (
  "id"        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"      TEXT        NOT NULL,
  "ownerId"   UUID        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_org_owner"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE RESTRICT
);

-- Lizenzen
CREATE TABLE IF NOT EXISTS "License" (
  "id"        UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  "orgId"     UUID             NOT NULL,
  "status"    "LicenseStatus"  NOT NULL DEFAULT 'inactive',
  "validTo"   TIMESTAMPTZ      NULL,
  "createdAt" TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_license_org"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
    ON DELETE CASCADE
);

-- Einladungen
CREATE TABLE IF NOT EXISTS "Invitation" (
  "id"         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "orgId"      UUID        NOT NULL,
  "email"      TEXT        NOT NULL,
  "role"       "Role"      NOT NULL,
  "token"      TEXT        NOT NULL,
  "expiresAt"  TIMESTAMPTZ NOT NULL,
  "acceptedAt" TIMESTAMPTZ NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_invitation_org"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
    ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes & Uniques (gemäß x-indexes in SSOT)
-- ─────────────────────────────────────────────────────────────────────────────

-- User: E-Mail eindeutig
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "User" ("email");

-- VerificationToken: token unique; userId idx
CREATE UNIQUE INDEX IF NOT EXISTS "verification_token_unique" ON "VerificationToken" ("token");
CREATE INDEX IF NOT EXISTS "verification_userid_idx" ON "VerificationToken" ("userId");

-- Session: tokenHash unique; userId & expiresAt idx
CREATE UNIQUE INDEX IF NOT EXISTS "session_tokenhash_unique" ON "Session" ("tokenHash");
CREATE INDEX IF NOT EXISTS "session_userid_idx" ON "Session" ("userId");
CREATE INDEX IF NOT EXISTS "session_expires_idx" ON "Session" ("expiresAt");

-- Organization: name unique; ownerId idx
CREATE UNIQUE INDEX IF NOT EXISTS "org_name_unique" ON "Organization" ("name");
CREATE INDEX IF NOT EXISTS "org_owner_idx" ON "Organization" ("ownerId");

-- License: orgId idx; status idx
CREATE INDEX IF NOT EXISTS "license_org_idx" ON "License" ("orgId");
CREATE INDEX IF NOT EXISTS "license_status_idx" ON "License" ("status");

-- Invitation: token unique; orgId idx; email idx
CREATE UNIQUE INDEX IF NOT EXISTS "invitation_token_unique" ON "Invitation" ("token");
CREATE INDEX IF NOT EXISTS "invitation_org_idx" ON "Invitation" ("orgId");
CREATE INDEX IF NOT EXISTS "invitation_email_idx" ON "Invitation" ("email");

COMMIT;

-- -----------------------------------------------------------------------------
-- Referenzblock (PA Kap. 17.4)
-- Domain-Lock: DM
-- Deliverable: services/api/src/db/migrations/20250916_init/migration.sql
-- Akzeptanz (WO-DM-2):
--   [x] prisma migrate dev erfolgreich (green) — Init-Schema vollständig
--   [x] Alle Indizes & Constraints gemäß SSOT vorhanden (Unique/Idx/FKs/ON DELETE)
-- SSOT-Quellen:
--   - contracts/openapi-dm.v1.yaml
--     • User (email unique, role enum, createdAt/updatedAt)
--     • VerificationToken (24h TTL serverseitig, token unique, FK userId cascade)
--     • Session (tokenHash unique, FK userId cascade, expiresAt index)
--     • Organization (name unique, ownerId FK restrict)
--     • License (status enum, FK orgId cascade, status/orgId index)
--     • Invitation (token unique, FK orgId cascade, email index)
-- Hinweise:
--   - TTL/Policy werden an der Service-Schicht erzwungen (nicht DB-seitig).
-- Orchestrator-Handover (auszuführen):
-- powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
--   -Chat DM `
--   -Gate "W1 Baseline" `
--   -Status "delivered — WO-DM-2 Init Migration SQL erstellt; Indizes+FKs vollständig" `
--   -Deliverable "services/api/src/db/migrations/20250916_init/migration.sql" `
--   -Summary "PostgreSQL Enums/Tabellen/Indizes konform zu SSOT; gen_random_uuid() via pgcrypto"
-- -----------------------------------------------------------------------------
