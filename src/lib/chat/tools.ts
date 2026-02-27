import { prisma } from "@/lib/prisma";
import { SchemaType } from "@google/generative-ai";

// ============================================
// Tool Definitions (Gemini function calling format)
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const chatTools: any[] = [
  {
    name: "search_orders",
    description: "주문을 검색합니다. 주문번호, 상태, 날짜 범위로 필터링 가능합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderNumber: { type: SchemaType.STRING, description: "주문번호 (부분 검색)" },
        status: { type: SchemaType.STRING, description: "주문 상태: PENDING, PREPARING, SHIPPING, DELIVERED, CANCELLED, RETURNED, EXCHANGED" },
        startDate: { type: SchemaType.STRING, description: "시작일 (YYYY-MM-DD)" },
        endDate: { type: SchemaType.STRING, description: "종료일 (YYYY-MM-DD)" },
        limit: { type: SchemaType.NUMBER, description: "조회 수 (기본 10, 최대 20)" },
      },
    },
  },
  {
    name: "search_products",
    description: "상품을 검색합니다. 이름, 코드, 상태로 필터링 가능합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        keyword: { type: SchemaType.STRING, description: "상품명 또는 코드 검색" },
        status: { type: SchemaType.STRING, description: "상품 상태: ACTIVE, OUT_OF_STOCK, DISCONTINUED" },
        lowStock: { type: SchemaType.BOOLEAN, description: "재고 부족 상품만 (stock <= minStock)" },
        limit: { type: SchemaType.NUMBER, description: "조회 수 (기본 10, 최대 20)" },
      },
    },
  },
  {
    name: "get_dashboard_stats",
    description: "대시보드 통계를 조회합니다. 오늘 주문수, 이번 달 매출, 총 상품수, 재고 부족 상품수 등을 반환합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: "search_sellers",
    description: "셀러(판매자) 목록을 검색합니다. 이름, 상태로 필터링 가능합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        keyword: { type: SchemaType.STRING, description: "셀러 이름 검색" },
        status: { type: SchemaType.STRING, description: "셀러 상태: ACTIVE, PENDING, SUSPENDED" },
        limit: { type: SchemaType.NUMBER, description: "조회 수 (기본 10, 최대 20)" },
      },
    },
  },
  {
    name: "get_order_detail",
    description: "특정 주문의 상세 정보를 조회합니다. 주문 항목, 배송 정보, 클레임 포함.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderNumber: { type: SchemaType.STRING, description: "주문번호" },
      },
      required: ["orderNumber"],
    },
  },
  {
    name: "get_recent_claims",
    description: "최근 클레임(반품/환불/교환) 목록을 조회합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, description: "클레임 상태: REQUESTED, APPROVED, PROCESSING, COMPLETED, REJECTED" },
        type: { type: SchemaType.STRING, description: "클레임 유형: RETURN, REFUND, EXCHANGE" },
        limit: { type: SchemaType.NUMBER, description: "조회 수 (기본 10, 최대 20)" },
      },
    },
  },
];

// ============================================
// Tool Executors
// ============================================

type ToolArgs = Record<string, unknown>;

export async function executeTool(
  name: string,
  args: ToolArgs,
  userId: string,
  role: string
): Promise<unknown> {
  const isSeller = role === "SELLER";

  switch (name) {
    case "search_orders":
      return searchOrders(args, isSeller ? userId : undefined);
    case "search_products":
      return searchProducts(args);
    case "get_dashboard_stats":
      return getDashboardStats(isSeller ? userId : undefined);
    case "search_sellers":
      if (isSeller) return { error: "셀러는 다른 셀러 정보를 조회할 수 없습니다." };
      return searchSellers(args);
    case "get_order_detail":
      return getOrderDetail(args, isSeller ? userId : undefined);
    case "get_recent_claims":
      return getRecentClaims(args, isSeller ? userId : undefined);
    default:
      return { error: `알 수 없는 도구: ${name}` };
  }
}

async function searchOrders(args: ToolArgs, sellerId?: string) {
  const where: Record<string, unknown> = {};
  if (sellerId) where.sellerId = sellerId;
  if (args.orderNumber) where.orderNumber = { contains: args.orderNumber as string, mode: "insensitive" };
  if (args.status) where.status = args.status;
  if (args.startDate || args.endDate) {
    where.createdAt = {
      ...(args.startDate ? { gte: new Date(args.startDate as string) } : {}),
      ...(args.endDate ? { lte: new Date(args.endDate as string + "T23:59:59") } : {}),
    };
  }

  const limit = Math.min(Number(args.limit) || 10, 20);
  const orders = await prisma.order.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      orderNumber: true,
      status: true,
      totalAmount: true,
      recipientName: true,
      trackingNumber: true,
      createdAt: true,
      seller: { select: { name: true } },
    },
  });

  return orders.map((o) => ({
    주문번호: o.orderNumber,
    상태: o.status,
    금액: `₩${Number(o.totalAmount).toLocaleString()}`,
    수취인: o.recipientName,
    셀러: o.seller.name,
    송장번호: o.trackingNumber || "-",
    주문일: o.createdAt.toLocaleDateString("ko-KR"),
  }));
}

async function searchProducts(args: ToolArgs) {
  const where: Record<string, unknown> = {};
  if (args.keyword) {
    where.OR = [
      { name: { contains: args.keyword as string, mode: "insensitive" } },
      { code: { contains: args.keyword as string, mode: "insensitive" } },
    ];
  }
  if (args.status) where.status = args.status;
  if (args.lowStock) {
    where.stock = { lte: prisma.product.fields.minStock };
  }

  const limit = Math.min(Number(args.limit) || 10, 20);

  // lowStock filter needs raw comparison
  let products;
  if (args.lowStock) {
    products = await prisma.$queryRaw`
      SELECT id, code, name, "basePrice", stock, "minStock", status
      FROM "Product"
      WHERE stock <= "minStock"
      ORDER BY stock ASC
      LIMIT ${limit}
    ` as Array<{ id: string; code: string; name: string; basePrice: number; stock: number; minStock: number; status: string }>;
  } else {
    products = await prisma.product.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: { code: true, name: true, basePrice: true, stock: true, minStock: true, status: true },
    });
  }

  return (products as Array<Record<string, unknown>>).map((p) => ({
    코드: p.code,
    상품명: p.name,
    가격: `₩${Number(p.basePrice).toLocaleString()}`,
    재고: p.stock,
    최소재고: p.minStock,
    상태: p.status,
  }));
}

async function getDashboardStats(sellerId?: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const orderWhere = sellerId ? { sellerId } : {};

  const [todayOrders, monthSales, totalProducts, lowStockCount, pendingClaims] = await Promise.all([
    prisma.order.count({
      where: { ...orderWhere, createdAt: { gte: todayStart } },
    }),
    prisma.order.aggregate({
      where: {
        ...orderWhere,
        createdAt: { gte: monthStart },
        status: { notIn: ["CANCELLED", "RETURNED"] },
      },
      _sum: { totalAmount: true },
    }),
    sellerId
      ? prisma.orderItem.groupBy({ by: ["productId"], where: { order: { sellerId } }, _count: true }).then((r) => r.length)
      : prisma.product.count(),
    prisma.$queryRaw`SELECT COUNT(*) as count FROM "Product" WHERE stock <= "minStock"`.then(
      (r) => Number((r as Array<{ count: bigint }>)[0]?.count || 0)
    ),
    prisma.claim.count({
      where: {
        status: "REQUESTED",
        ...(sellerId ? { order: { sellerId } } : {}),
      },
    }),
  ]);

  return {
    오늘주문수: todayOrders,
    이번달매출: `₩${Number(monthSales._sum.totalAmount || 0).toLocaleString()}`,
    총상품수: totalProducts,
    재고부족: lowStockCount,
    미처리클레임: pendingClaims,
  };
}

async function searchSellers(args: ToolArgs) {
  const where: Record<string, unknown> = { role: "SELLER" };
  if (args.keyword) where.name = { contains: args.keyword as string, mode: "insensitive" };
  if (args.status) where.status = args.status;

  const limit = Math.min(Number(args.limit) || 10, 20);
  const sellers = await prisma.user.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      name: true,
      email: true,
      status: true,
      createdAt: true,
      sellerProfile: { select: { businessName: true, grade: { select: { name: true } } } },
    },
  });

  return sellers.map((s) => ({
    이름: s.name,
    이메일: s.email,
    상호명: s.sellerProfile?.businessName || "-",
    등급: s.sellerProfile?.grade?.name || "-",
    상태: s.status,
    가입일: s.createdAt.toLocaleDateString("ko-KR"),
  }));
}

async function getOrderDetail(args: ToolArgs, sellerId?: string) {
  const where: Record<string, unknown> = { orderNumber: args.orderNumber as string };
  if (sellerId) where.sellerId = sellerId;

  const order = await prisma.order.findFirst({
    where,
    include: {
      seller: { select: { name: true } },
      items: { include: { product: { select: { name: true, code: true } } } },
      claims: { select: { type: true, status: true, reason: true, amount: true, createdAt: true } },
    },
  });

  if (!order) return { error: "주문을 찾을 수 없습니다." };

  return {
    주문번호: order.orderNumber,
    상태: order.status,
    셀러: order.seller.name,
    수취인: order.recipientName,
    연락처: order.recipientPhone,
    주소: order.recipientAddr,
    송장번호: order.trackingNumber || "-",
    택배사: order.courier || "-",
    총금액: `₩${Number(order.totalAmount).toLocaleString()}`,
    주문일: order.createdAt.toLocaleDateString("ko-KR"),
    주문항목: order.items.map((item) => ({
      상품: `${item.product.name} (${item.product.code})`,
      수량: item.quantity,
      단가: `₩${Number(item.unitPrice).toLocaleString()}`,
      소계: `₩${Number(item.totalPrice).toLocaleString()}`,
    })),
    클레임: order.claims.length > 0
      ? order.claims.map((c) => ({
          유형: c.type,
          상태: c.status,
          사유: c.reason,
          금액: c.amount ? `₩${Number(c.amount).toLocaleString()}` : "-",
        }))
      : "없음",
  };
}

async function getRecentClaims(args: ToolArgs, sellerId?: string) {
  const where: Record<string, unknown> = {};
  if (sellerId) where.order = { sellerId };
  if (args.status) where.status = args.status;
  if (args.type) where.type = args.type;

  const limit = Math.min(Number(args.limit) || 10, 20);
  const claims = await prisma.claim.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      order: { select: { orderNumber: true, seller: { select: { name: true } } } },
    },
  });

  return claims.map((c) => ({
    주문번호: c.order.orderNumber,
    셀러: c.order.seller.name,
    유형: c.type,
    상태: c.status,
    사유: c.reason,
    금액: c.amount ? `₩${Number(c.amount).toLocaleString()}` : "-",
    요청일: c.createdAt.toLocaleDateString("ko-KR"),
  }));
}
