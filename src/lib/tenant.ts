import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export interface TenantContext {
  userId: string;
  tenantId: string;
  role: string;
  isSuperAdmin: boolean;
}

/**
 * API 라우트에서 테넌트 컨텍스트를 가져옵니다.
 * SUPER_ADMIN은 tenantId 없이도 접근 가능.
 * ADMIN/SELLER는 반드시 tenantId가 있어야 합니다.
 */
export async function getTenantContext(): Promise<
  { error: NextResponse; ctx: null } | { error: null; ctx: TenantContext }
> {
  const session = await auth();
  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: { message: "인증이 필요합니다" } },
        { status: 401 }
      ),
      ctx: null,
    };
  }

  const user = session.user as { id: string; role: string; tenantId?: string };
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  if (!isSuperAdmin && !user.tenantId) {
    return {
      error: NextResponse.json(
        { error: { message: "테넌트에 소속되어 있지 않습니다" } },
        { status: 403 }
      ),
      ctx: null,
    };
  }

  return {
    error: null,
    ctx: {
      userId: user.id,
      tenantId: user.tenantId || "",
      role: user.role,
      isSuperAdmin,
    },
  };
}

/**
 * 테넌트 사용량을 확인합니다.
 */
export async function checkUsageLimit(
  tenantId: string,
  type: "orders" | "aiChats" | "sellers" | "products"
): Promise<{ allowed: boolean; message?: string }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true },
  });

  if (!tenant || tenant.status !== "ACTIVE") {
    return { allowed: false, message: "비활성 테넌트입니다" };
  }

  if (tenant.trialEndsAt && new Date() > tenant.trialEndsAt) {
    return { allowed: false, message: "무료 체험 기간이 만료되었습니다. 요금제를 업그레이드해주세요." };
  }

  const plan = tenant.plan;

  switch (type) {
    case "orders": {
      if (plan.maxMonthlyOrders === -1) return { allowed: true };
      const month = new Date().toISOString().slice(0, 7);
      const monthlyTotal = await prisma.usageTracker.aggregate({
        where: { tenantId, month },
        _sum: { monthlyOrders: true },
      });
      if ((monthlyTotal._sum.monthlyOrders || 0) >= plan.maxMonthlyOrders) {
        return { allowed: false, message: `월 주문 ${plan.maxMonthlyOrders}건 한도를 초과했습니다` };
      }
      return { allowed: true };
    }
    case "aiChats": {
      if (plan.maxDailyAiChats === -1) return { allowed: true };
      const today = new Date().toISOString().slice(0, 10);
      const month = today.slice(0, 7);
      const usage = await prisma.usageTracker.findFirst({
        where: { tenantId, month, date: today },
      });
      if ((usage?.dailyAiChats || 0) >= plan.maxDailyAiChats) {
        return { allowed: false, message: `일일 AI 채팅 ${plan.maxDailyAiChats}회 한도를 초과했습니다` };
      }
      return { allowed: true };
    }
    case "sellers": {
      if (plan.maxSellers === -1) return { allowed: true };
      const count = await prisma.user.count({ where: { tenantId, role: "SELLER" } });
      if (count >= plan.maxSellers) {
        return { allowed: false, message: `셀러 ${plan.maxSellers}명 한도를 초과했습니다` };
      }
      return { allowed: true };
    }
    case "products": {
      if (plan.maxProducts === -1) return { allowed: true };
      const count = await prisma.product.count({ where: { tenantId } });
      if (count >= plan.maxProducts) {
        return { allowed: false, message: `상품 ${plan.maxProducts}개 한도를 초과했습니다` };
      }
      return { allowed: true };
    }
  }
}

/**
 * 사용량을 증가시킵니다.
 */
export async function incrementUsage(
  tenantId: string,
  type: "orders" | "aiChats"
) {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  await prisma.usageTracker.upsert({
    where: { tenantId_month_date: { tenantId, month, date: today } },
    create: {
      tenantId,
      month,
      date: today,
      monthlyOrders: type === "orders" ? 1 : 0,
      dailyAiChats: type === "aiChats" ? 1 : 0,
    },
    update: {
      ...(type === "orders" && { monthlyOrders: { increment: 1 } }),
      ...(type === "aiChats" && { dailyAiChats: { increment: 1 } }),
    },
  });
}

/**
 * Prisma 쿼리용 where 조건에 tenantId 필터를 추가합니다.
 * SUPER_ADMIN은 전체 조회, 나머지는 자신의 테넌트만.
 */
export function tenantFilter(ctx: TenantContext): { tenantId?: string } {
  if (ctx.isSuperAdmin) return {};
  return { tenantId: ctx.tenantId };
}
