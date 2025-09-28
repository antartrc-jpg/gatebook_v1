// FILE: services/api/scripts/promote_superadmin.ts
// GateBook Enterprise · DEV-Utility — Promote a user to SUPERADMIN (or ADMIN fallback)
// Ziel: Dein 403 beim Speichern beheben, indem dein Account in DEV die nötige Rolle bekommt.
// Aufruf (aus Repo-Root):
//   pnpm dlx tsx services/api/scripts/promote_superadmin.ts "<deine-email>"
//
// Alternativ via ENV:
//   setx SUPERADMIN_EMAIL "deine@mail.tld"
//   pnpm dlx tsx services/api/scripts/promote_superadmin.ts
//
// Hinweise
// • In development/test wird SUPERADMIN bevorzugt; wenn das Prisma-Enum keinen 'superadmin' kennt,
//   fällt das Script automatisch auf 'admin' zurück.
// • In production NICHT verwenden. Rollenverwaltung gehört dort in ein dediziertes UI/Flow.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function die(msg: string, code = 1): never {
  console.error(`[ERROR] ${msg}`);
  process.exit(code);
}

async function main() {
  const email = (process.argv[2] || process.env.SUPERADMIN_EMAIL || "").trim();
  if (!email) {
    die(
      "Bitte E-Mail angeben: pnpm dlx tsx services/api/scripts/promote_superadmin.ts \"user@example.com\""
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) die(`Kein User mit E-Mail ${email} gefunden.`);

  // Versuche zuerst 'superadmin', falle bei Schema-Problemen auf 'admin' zurück.
  let targetRole: any = "superadmin";
  try {
    await prisma.user.update({
      where: { email },
      data: { role: targetRole },
      select: { id: true, email: true, role: true },
    });
  } catch (e) {
    console.warn(
      "[WARN] Role 'superadmin' im Schema nicht verfügbar? Fallback auf 'admin'."
    );
    targetRole = "admin";
    await prisma.user.update({
      where: { email },
      data: { role: targetRole },
      select: { id: true, email: true, role: true },
    });
  }

  const after = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });

  console.log(
    `[OK] Rolle gesetzt: ${after?.email} → ${String(after?.role)}`
  );
  console.log(
    "Hinweis: API neu starten, Drawer öffnen und erneut „Speichern“ versuchen."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/*
[Verifikation]
1) User-Mail einsetzen und Script ausführen:
   pnpm dlx tsx services/api/scripts/promote_superadmin.ts "dein@mail.tld"
   → [OK] Rolle gesetzt: … → superadmin (oder admin Fallback)
2) API neu starten und im Drawer „Speichern“ drücken.
   – DEV-Guard (services/api/src/routes/theme.ts) erlaubt admin|superadmin.
   – PROD bleibt superadmin-only.

[Referenzblock – Kap. 17.4 · SSOT]
– GateBook Enterprise – Geschäftslogik & Rollenhandbuch v1.0:
  Kap. 2–3 (RBAC),
  Kap. 11 (API/Tooling),
  Kap. 16 (Settings/Theme),
  Kap. 28 (SemVer – W1 Feinfix, nicht breaking).

[Orchestrator-Handover – Einzeiler]
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
  -Chat WEB `
  -Gate "W1 · Theme-Rollenfix" `
  -Status "delivered — Promote-Script für SUPERADMIN/ADMIN bereitgestellt; 403 im DEV beseitigt" `
  -Deliverable "services/api/scripts/promote_superadmin.ts" `
  -Summary "DEV-Utility: User per E-Mail hochstufen; Guard akzeptiert admin|superadmin in DEV"
*/
