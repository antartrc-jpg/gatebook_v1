const { PrismaClient } = require("@prisma/client");
(async () => {
  const p = new PrismaClient();
  await p.user.update({
    where: { email: "antartrc@gmail.com" },
    data: { emailVerifiedAt: new Date() }
  });
  console.log("verified");
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
