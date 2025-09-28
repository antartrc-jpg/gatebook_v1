// # FILE: scripts/dm/test_migration_dm.mjs
// GateBook Enterprise — DM · Test WO-DM-2 (Init Migration SQL)
// Ziel: Nachweis, dass
//  1) `prisma migrate dev` erfolgreich läuft (green) und
//  2) alle Indizes & Constraints gemäß SSOT vorhanden sind.
//
// AUSFÜHRUNG (PowerShell, im Repo-Root):
//   Set-Location "C:\\Users\\antar\\Documents\\gatebook_v1"
//   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
//   node .\\scripts\\dm\\test_migration_dm.mjs
//
// Robustheitsfix: Wenn **pnpm** NICHT vorhanden ist **und** `npx` nicht im PATH liegt,
// nutzt dieses Skript **direkte Pfade** zur Node-Installation (npx.cmd / npx-cli.js).
//
// -----------------------------------------------------------------------------
/* eslint-disable no-console */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve, join as pathJoin } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ── small utils ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log  = (...a) => console.log(...a);
const ok   = (m) => console.log('✓', m);
const warn = (m) => console.warn('!', m);
const err  = (m) => console.error('❌', m);

function findRepoRoot(startDir) {
  const cands = [
    startDir,
    pathResolve(startDir, '..'),
    pathResolve(startDir, '..', '..'),
    pathResolve(startDir, '..', '..', '..'),
    pathResolve(startDir, '..', '..', '..', '..'),
  ];
  for (const c of cands) {
    if (existsSync(pathJoin(c, 'pnpm-workspace.yaml'))) return c;
    if (existsSync(pathJoin(c, 'services', 'api'))) return c;
  }
  return pathResolve(process.cwd());
}

function parseDotEnv(dotenvPath) {
  const content = readFileSync(dotenvPath, 'utf8');
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const [k, ...rest] = line.split('=');
    if (!k) continue;
    let v = rest.join('=').trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k.trim()] = v;
  }
  return out;
}

function which(cmd) {
  return new Promise((resolveWhich) => {
    const bin = process.platform === 'win32' ? 'where' : 'which';
    const p = spawn(bin, [cmd], { stdio: 'ignore', shell: false });
    p.on('exit', (code) => resolveWhich(code === 0));
    p.on('error', () => resolveWhich(false));
  });
}

async function run(cmd, args, cwd) {
  return new Promise((resolveRun, rejectRun) => {
    const p = spawn(cmd, args, { cwd, stdio: 'inherit', shell: false });
    p.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`Command failed (${code}): ${cmd} ${args.join(' ')}`));
    });
    p.on('error', (e) => rejectRun(e));
  });
}

async function loadPrismaClient() {
  try {
    const mod = await import('@prisma/client');
    if (mod?.PrismaClient) return mod.PrismaClient;
    if (mod?.default?.PrismaClient) return mod.default.PrismaClient;
  } catch (e) {
    err('PrismaClient Import fehlgeschlagen:', e?.message || e);
  }
  return null;
}

// ── Executable Discovery (robust, Windows-freundlich) ─────────────────────────
function findNpxExecutable() {
  // 1) PATH?
  if (process.platform === 'win32') {
    // On Windows, .cmd launchers are typical
    const pathCandidates = [];
    const nodeDir = dirname(process.execPath);
    if (existsSync(pathJoin(nodeDir, 'npx.cmd'))) pathCandidates.push(pathJoin(nodeDir, 'npx.cmd'));
    if (process.env.APPDATA) {
      const appdataNpx = pathJoin(process.env.APPDATA, 'npm', 'npx.cmd');
      if (existsSync(appdataNpx)) pathCandidates.push(appdataNpx);
    }
    // Typical default install path
    const programFilesNpx = 'C:\\Program Files\\nodejs\\npx.cmd';
    if (existsSync(programFilesNpx)) pathCandidates.push(programFilesNpx);

    // If any .cmd exists, use it
    if (pathCandidates.length > 0) {
      return { type: 'cmd', path: pathCandidates[0] };
    }

    // 2) Direct npx-cli.js (ship with Node/npm)
    const npxCliJsCandidates = [
      pathJoin(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js'),
      'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js',
    ];
    for (const js of npxCliJsCandidates) {
      if (existsSync(js)) {
        return { type: 'cli-js', path: js };
      }
    }
    // 3) Fallback to 'npx' in PATH if which() later finds it
    return null;
  } else {
    // Non-Windows
    const nodeDir = dirname(process.execPath);
    const candidates = [
      'npx',
      pathJoin(nodeDir, 'npx'),
      '/usr/local/bin/npx',
      '/usr/bin/npx',
    ];
    for (const c of candidates) {
      if (c.includes('/') ? existsSync(c) : true) {
        return { type: 'bin', path: c };
      }
    }
    // cli-js fallback
    const jsCandidates = [
      pathJoin(nodeDir, 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
      '/usr/local/lib/node_modules/npm/bin/npx-cli.js',
    ];
    for (const js of jsCandidates) {
      if (existsSync(js)) return { type: 'cli-js', path: js };
    }
    return null;
  }
}

// Robust: pnpm-first, bei Fehlern → npx-Fallback (inkl. direkter Pfadauflösung)
async function prismaMigrateDev({ apiRoot, schema, repoRoot }) {
  const pnpmArgs = ['-C', apiRoot, 'dlx', 'prisma', 'migrate', 'dev',
    '--name', 'w1_dm_schema', '--skip-seed', '--schema', schema];

  const npxArgs = ['--yes', 'prisma@latest', 'migrate', 'dev',
    '--name', 'w1_dm_schema', '--skip-seed', '--schema', schema];

  // 1) Try pnpm if present
  if (await which('pnpm')) {
    try {
      await run('pnpm', pnpmArgs, repoRoot);
      ok('prisma migrate dev via pnpm → OK');
      return;
    } catch (e) {
      warn(`pnpm-Aufruf fehlgeschlagen (${e?.code || e?.message || e}) — Fallback auf npx.`);
    }
  } else {
    warn('pnpm nicht gefunden — versuche npx (Pfad oder CLI-JS).');
  }

  // 2) Try npx from PATH
  if (await which('npx')) {
    await run('npx', npxArgs, apiRoot);
    ok('prisma migrate dev via npx (PATH) → OK');
    return;
  }

  // 3) No npx in PATH — try direct executables / cli-js near Node
  const npx = findNpxExecutable();
  if (!npx) {
    throw new Error('Weder pnpm noch npx gefunden (auch nicht in Node-Installationspfaden). Bitte entweder `corepack enable` (für pnpm) oder Node/npm korrekt in PATH bringen.');
  }

  if (npx.type === 'cmd' || npx.type === 'bin') {
    await run(npx.path, npxArgs, apiRoot);
    ok(`prisma migrate dev via ${npx.path} → OK`);
    return;
  }

  if (npx.type === 'cli-js') {
    // Invoke: node <npx-cli.js> <args>
    await run(process.execPath, [npx.path, ...npxArgs], apiRoot);
    ok(`prisma migrate dev via node ${npx.path} → OK`);
    return;
  }

  throw new Error('Unbekannter npx-Aufrufmodus.');
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
async function main() {
  log('▶ DM — Test WO-DM-2 (Init Migration) — start');

  // Preconditions
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (Number.isNaN(nodeMajor) || nodeMajor < 22) {
    throw new Error(`Node ${process.version} gefunden — benötigt wird ≥ 22.x`);
  }

  const repoRoot = findRepoRoot(__dirname);
  const apiRoot  = pathJoin(repoRoot, 'services', 'api');
  const schema   = pathJoin(apiRoot, 'src', 'db', 'prisma', 'schema.prisma');
  const dotenv   = pathJoin(repoRoot, '.env');

  log('RepoRoot:', repoRoot);
  log('Schema:  ', schema);

  if (!existsSync(dotenv)) throw new Error(`.env nicht gefunden: ${dotenv}`);
  const envs = parseDotEnv(dotenv);
  if (!envs.DATABASE_URL) throw new Error('DATABASE_URL fehlt in .env');
  process.env.DATABASE_URL = envs.DATABASE_URL;
  ok('.env geladen (DATABASE_URL gesetzt)');

  // 1) prisma migrate dev (robust)
  log('\n=== Prisma · migrate dev (apply) ===');
  await prismaMigrateDev({ apiRoot, schema, repoRoot });

  // 2) Prisma Client laden
  const PrismaClient = await loadPrismaClient();
  if (!PrismaClient) throw new Error('PrismaClient nicht verfügbar.');
  const prisma = new PrismaClient();

  // helpers for assertions
  const checks = [];
  async function expectExists(sql, label) {
    const rows = await prisma.$queryRawUnsafe(sql);
    const okRow = Array.isArray(rows) && rows.length > 0 && Object.values(rows[0])[0] === 1;
    if (!okRow) throw new Error(`Check fehlgeschlagen: ${label}`);
    ok(label);
    checks.push(label);
  }

  // 3) Checks — Enums
  log('\n=== Checks · Enums ===');
  await expectExists(`SELECT 1 FROM pg_type WHERE typname = 'Role'`, 'Enum Role vorhanden');
  await expectExists(`SELECT 1 FROM pg_type WHERE typname = 'LicenseStatus'`, 'Enum LicenseStatus vorhanden');

  // 4) Checks — Indizes/Uniques
  log('\n=== Checks · Indexe/Uniques ===');
  const idxNames = [
    'user_email_unique',
    'verification_token_unique',
    'verification_userid_idx',
    'session_tokenhash_unique',
    'session_userid_idx',
    'session_expires_idx',
    'org_name_unique',
    'org_owner_idx',
    'license_org_idx',
    'license_status_idx',
    'invitation_token_unique',
    'invitation_org_idx',
    'invitation_email_idx',
  ];
  for (const name of idxNames) {
    await expectExists(
      `SELECT 1 FROM pg_class WHERE relname = '${name}' AND relkind = 'i'`,
      `Index vorhanden: ${name}`
    );
  }

  // 5) Checks — Foreign Keys + ON DELETE
  log('\n=== Checks · Foreign Keys ===');
  const fkRules = [
    { name: 'fk_verification_user', del: 'c', desc: 'VerificationToken.userId → User.id ON DELETE CASCADE' },
    { name: 'fk_session_user',      del: 'c', desc: 'Session.userId → User.id ON DELETE CASCADE' },
    { name: 'fk_org_owner',         del: 'r', desc: 'Organization.ownerId → User.id ON DELETE RESTRICT' },
    { name: 'fk_license_org',       del: 'c', desc: 'License.orgId → Organization.id ON DELETE CASCADE' },
    { name: 'fk_invitation_org',    del: 'c', desc: 'Invitation.orgId → Organization.id ON DELETE CASCADE' },
  ];
  for (const fk of fkRules) {
    await expectExists(
      `SELECT 1 FROM pg_constraint WHERE contype = 'f' AND conname = '${fk.name}' AND confdeltype = '${fk.del}'`,
      `FK vorhanden: ${fk.desc}`
    );
  }

  // 6) Checks — Spaltennamen (kritische Felder)
  log('\n=== Checks · Spaltennamen ===');
  const columnChecks = [
    { tbl: 'public."User"',          col: 'passwordHash' },
    { tbl: 'public."Session"',       col: 'tokenHash' },
    { tbl: 'public."Organization"',  col: 'ownerId' },
    { tbl: 'public."License"',       col: 'status' },
    { tbl: 'public."Invitation"',    col: 'token' },
  ];
  for (const c of columnChecks) {
    await expectExists(
      `SELECT 1 FROM pg_attribute WHERE attrelid = '${c.tbl}'::regclass AND attname = '${c.col}' AND NOT attisdropped`,
      `Spalte vorhanden: ${c.tbl}.${c.col}`
    );
  }

  // 7) Summary
  log('\n🎉 Alle Checks erfolgreich:', checks.length, 'OK');
  await prisma.$disconnect();
  process.exitCode = 0;
}

main().catch(async (e) => {
  err(e?.message || e);
  await sleep(50);
  process.exitCode = 1;
});


/*
-----------------------------------------------------------------------------
Referenzblock (PA Kap. 17.4)
Domain-Lock: DM
Deliverable: scripts/dm/test_migration_dm.mjs

Akzeptanz (WO-DM-2):
  - Führt `prisma migrate dev` aus:
      * pnpm-first
      * Fallback 1: npx (PATH)
      * Fallback 2: direkte Aufrufe (Windows: npx.cmd unter Node / %APPDATA%\npm; oder node npx-cli.js)
  - Prüft via Prisma/SQL:
      * Enums: Role, LicenseStatus
      * Indizes/Uniques: user_email_unique, verification_token_unique, verification_userid_idx,
        session_tokenhash_unique, session_userid_idx, session_expires_idx, org_name_unique,
        org_owner_idx, license_org_idx, license_status_idx, invitation_token_unique,
        invitation_org_idx, invitation_email_idx
      * FKs inkl. ON DELETE: fk_verification_user (CASCADE), fk_session_user (CASCADE),
        fk_org_owner (RESTRICT), fk_license_org (CASCADE), fk_invitation_org (CASCADE)
      * Spalten: "User".passwordHash, "Session".tokenHash, "Organization".ownerId,
        "License".status, "Invitation".token
  - ExitCode 0 bei Erfolg; ≠0 bei Fehler; klare Logs.

SSOT:
  - Kap. 6 (DB-Baseline — Kernmodelle)
  - Kap. 13.1–13.4 (Auth/Verifikation/Session — nur tokenHash)
  - Kap. 16.1–16.10 (DM-Basis; Indizes/Constraints aus openapi-dm.v1.yaml)
-----------------------------------------------------------------------------
*/
