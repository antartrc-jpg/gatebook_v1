const { PrismaClient } = require("@prisma/client");
(async () => {
  const p = new PrismaClient();
  const u = await p.user.findUnique({ where: { email: "antartrc@gmail.com" }});
  console.log(u ?? null);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
