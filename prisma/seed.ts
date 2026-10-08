// Creates the first administrator account. Run once after the first deploy:
//   ADMIN_EMAIL=you@clinic.com ADMIN_PASSWORD='a long password' ADMIN_NAME='Your Name' npm run db:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Practice Administrator";
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD.");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`${email} already exists; nothing changed.`);
    return;
  }
  await db.user.create({ data: { email, name, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) } });
  console.log(`Created administrator ${email}.`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
