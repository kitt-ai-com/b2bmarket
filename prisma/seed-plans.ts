import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const plans = [
    {
      name: "FREE",
      displayName: "무료 체험",
      price: 0,
      maxSellers: 5,
      maxMonthlyOrders: 100,
      maxProducts: 50,
      maxDailyAiChats: 5,
      hasExcel: false,
      hasFullStats: false,
      trialDays: 30,
      sortOrder: 0,
    },
    {
      name: "BASIC",
      displayName: "베이직",
      price: 99000,
      maxSellers: 30,
      maxMonthlyOrders: 1000,
      maxProducts: 500,
      maxDailyAiChats: 200,
      hasExcel: true,
      hasFullStats: true,
      trialDays: 0,
      sortOrder: 1,
    },
    {
      name: "PRO",
      displayName: "프로",
      price: 299000,
      maxSellers: -1,
      maxMonthlyOrders: -1,
      maxProducts: -1,
      maxDailyAiChats: -1,
      hasExcel: true,
      hasFullStats: true,
      trialDays: 0,
      sortOrder: 2,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }
  console.log("Plans seeded successfully");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
