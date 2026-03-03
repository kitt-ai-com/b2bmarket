import { prisma } from "@/lib/prisma";

type NotificationType =
  | "ORDER_NEW"
  | "TRACKING_UPDATED"
  | "PRICE_CHANGED"
  | "STOCK_LOW"
  | "CLAIM_NEW"
  | "SETTLEMENT_READY"
  | "NOTICE"
  | "SYSTEM"
  | "ORDER_MOD_REQUESTED"
  | "ORDER_MOD_RESPONDED";

/**
 * 알림 생성 유틸리티
 */
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data,
    },
  });
}

/**
 * 재고 부족 체크 및 알림 생성 (관리자에게)
 */
export async function checkLowStock() {
  const lowStockProducts = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      stock: { lte: prisma.product.fields.minStock },
    },
    select: { id: true, name: true, code: true, stock: true, minStock: true },
  });

  if (lowStockProducts.length === 0) return [];

  // 관리자 조회
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true },
  });

  const notifications = [];
  for (const product of lowStockProducts) {
    for (const admin of admins) {
      notifications.push({
        userId: admin.id,
        type: "STOCK_LOW" as const,
        title: `재고 부족: ${product.name}`,
        message: `${product.code} ${product.name}의 재고가 ${product.stock}개로 최소 재고(${product.minStock}개) 이하입니다.`,
        data: { productId: product.id },
      });
    }
  }

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }

  return lowStockProducts;
}
