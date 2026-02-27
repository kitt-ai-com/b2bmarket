import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hash = await bcrypt.hash("admin1234!", 12);

  const existing = await prisma.user.findUnique({ where: { email: "admin@b2bmarket.com" } });
  if (existing) {
    console.log("Admin already exists:", existing.email, existing.role, existing.status);
    return;
  }

  const admin = await prisma.user.create({
    data: {
      email: "admin@b2bmarket.com",
      password: hash,
      name: "Admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  console.log("Admin created:", admin.email, admin.role, admin.status);
}

main()
  .catch((e) => console.error("Error:", e))
  .finally(() => prisma.$disconnect());
