// No fake demo data — this is Mehlab's real production data from day one.
// Only seeds what the app needs to not crash on first load: the default
// settings row, and (Phase 1 only) the single admin login user.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.setting.upsert({
    where: { key: "daily_digest_time" },
    update: {},
    create: { key: "daily_digest_time", value: "08:00" },
  });

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash },
      create: { email: adminEmail, passwordHash },
    });
    console.log(`Seeded admin user: ${adminEmail}`);
  } else {
    console.log(
      "ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin user seed."
    );
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
