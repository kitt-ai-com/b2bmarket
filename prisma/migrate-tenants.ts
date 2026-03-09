/**
 * 기존 데이터에 기본 테넌트를 할당하는 마이그레이션 스크립트
 *
 * 1. FREE 요금제 확인 (없으면 생성)
 * 2. 기존 ADMIN 유저 → 각각 Tenant 생성 + 연결
 * 3. 기존 SELLER 유저 → 첫 번째 ADMIN의 Tenant로 연결
 * 4. 기존 데이터 (상품, 주문 등) → 해당 Tenant로 연결
 *
 * 사용법: npx tsx prisma/migrate-tenants.ts
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== 테넌트 마이그레이션 시작 ===\n");

  // 1. FREE 요금제 확인
  let freePlan = await prisma.plan.findUnique({ where: { name: "FREE" } });
  if (!freePlan) {
    console.log("FREE 요금제가 없습니다. seed-plans.ts를 먼저 실행해주세요.");
    console.log("  npx tsx prisma/seed-plans.ts");
    process.exit(1);
  }
  console.log(`✓ FREE 요금제 확인: ${freePlan.id}`);

  // 2. 기존 ADMIN 유저 확인
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", tenantId: null },
  });

  if (admins.length === 0) {
    console.log("tenantId가 없는 ADMIN 유저가 없습니다. 마이그레이션 불필요.");

    // 그래도 tenantId null인 데이터가 있는지 확인
    const nullCount = await prisma.user.count({ where: { tenantId: null, role: { not: "SUPER_ADMIN" } } });
    if (nullCount > 0) {
      console.log(`경고: tenantId가 null인 비-SUPER_ADMIN 유저 ${nullCount}명 존재`);
    }
    return;
  }

  console.log(`\n발견된 ADMIN 유저: ${admins.length}명`);

  for (const admin of admins) {
    console.log(`\n--- ADMIN: ${admin.name} (${admin.email}) ---`);

    // 이미 이 admin이 소유한 테넌트가 있는지 확인
    let tenant = await prisma.tenant.findFirst({
      where: { ownerId: admin.id },
    });

    if (!tenant) {
      // slug 생성: 이름에서 특수문자 제거 + 랜덤 4자리
      const baseSlug = (admin.name || "tenant")
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, "")
        .slice(0, 20);
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);

      tenant = await prisma.tenant.create({
        data: {
          name: admin.name || "기본 업체",
          slug,
          ownerId: admin.id,
          planId: freePlan.id,
          status: "ACTIVE",
          trialEndsAt: trialEnd,
        },
      });
      console.log(`  ✓ 테넌트 생성: ${tenant.name} (${tenant.slug})`);
    } else {
      console.log(`  ✓ 기존 테넌트 사용: ${tenant.name} (${tenant.slug})`);
    }

    // ADMIN 유저에 tenantId 할당
    await prisma.user.update({
      where: { id: admin.id },
      data: { tenantId: tenant.id },
    });
    console.log(`  ✓ ADMIN tenantId 할당`);

    // 3. SELLER 유저들을 이 테넌트에 연결 (tenantId가 없는 셀러들)
    const updatedSellers = await prisma.user.updateMany({
      where: { role: "SELLER", tenantId: null },
      data: { tenantId: tenant.id },
    });
    if (updatedSellers.count > 0) {
      console.log(`  ✓ SELLER ${updatedSellers.count}명 연결`);
    }

    // 4. 비즈니스 데이터를 이 테넌트에 연결
    const tables = [
      { name: "sellerGrade", model: prisma.sellerGrade },
      { name: "category", model: prisma.category },
      { name: "product", model: prisma.product },
      { name: "supplier", model: prisma.supplier },
      { name: "order", model: prisma.order },
      { name: "purchaseOrder", model: prisma.purchaseOrder },
      { name: "claim", model: prisma.claim },
      { name: "settlement", model: prisma.settlement },
      { name: "deposit", model: prisma.deposit },
      { name: "depositTransaction", model: prisma.depositTransaction },
      { name: "depositRequest", model: prisma.depositRequest },
      { name: "inquiry", model: prisma.inquiry },
      { name: "notice", model: prisma.notice },
      { name: "notification", model: prisma.notification },
      { name: "orderModificationRequest", model: prisma.orderModificationRequest },
      { name: "activityLog", model: prisma.activityLog },
      { name: "chatMessage", model: prisma.chatMessage },
    ] as const;

    for (const table of tables) {
      try {
        const result = await (table.model as any).updateMany({
          where: { tenantId: null },
          data: { tenantId: tenant.id },
        });
        if (result.count > 0) {
          console.log(`  ✓ ${table.name}: ${result.count}건 연결`);
        }
      } catch (e: any) {
        console.log(`  ⚠ ${table.name}: ${e.message?.slice(0, 80)}`);
      }
    }
  }

  // 5. 최종 확인
  console.log("\n=== 마이그레이션 결과 ===");
  const tenantCount = await prisma.tenant.count();
  const nullUsers = await prisma.user.count({ where: { tenantId: null, role: { not: "SUPER_ADMIN" } } });
  const nullProducts = await prisma.product.count({ where: { tenantId: null } });
  const nullOrders = await prisma.order.count({ where: { tenantId: null } });

  console.log(`총 테넌트: ${tenantCount}`);
  console.log(`tenantId 미할당 유저 (비-SUPER_ADMIN): ${nullUsers}`);
  console.log(`tenantId 미할당 상품: ${nullProducts}`);
  console.log(`tenantId 미할당 주문: ${nullOrders}`);

  if (nullUsers === 0 && nullProducts === 0 && nullOrders === 0) {
    console.log("\n✓ 마이그레이션 완료!");
  } else {
    console.log("\n⚠ 일부 데이터가 미할당 상태입니다. 수동 확인 필요.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
