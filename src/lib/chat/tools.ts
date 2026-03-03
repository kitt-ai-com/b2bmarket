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
  {
    name: "get_sales_chart",
    description: "매출 차트 데이터를 조회합니다. 일별/주별/월별 매출 추이를 시각화합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        period: { type: SchemaType.STRING, description: "기간: daily (최근 14일), weekly (최근 12주), monthly (최근 12개월). 기본값 daily" },
      },
    },
  },
  {
    name: "update_order_status",
    description: "주문 상태를 변경합니다. 관리자만 사용 가능합니다. 상태 전이 규칙: PENDING→PREPARING→SHIPPING→DELIVERED, 취소는 PENDING/PREPARING에서만 가능.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderNumber: { type: SchemaType.STRING, description: "주문번호" },
        newStatus: { type: SchemaType.STRING, description: "변경할 상태: PREPARING, SHIPPING, DELIVERED, CANCELLED" },
      },
      required: ["orderNumber", "newStatus"],
    },
  },
  {
    name: "search_inquiries",
    description: "문의 내역을 조회합니다. 셀러는 본인 문의만, 관리자는 전체 문의를 볼 수 있습니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, description: "문의 상태: OPEN, ANSWERED, CLOSED" },
        keyword: { type: SchemaType.STRING, description: "제목 검색" },
        limit: { type: SchemaType.NUMBER, description: "조회 수 (기본 10, 최대 20)" },
      },
    },
  },
  // ============================================
  // Admin Write Tools
  // ============================================
  {
    name: "create_product",
    description: "새 상품을 등록합니다. 관리자만 사용 가능합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        code: { type: SchemaType.STRING, description: "상품코드 (예: GAM-001)" },
        name: { type: SchemaType.STRING, description: "상품명" },
        basePrice: { type: SchemaType.NUMBER, description: "기본 판매가 (원)" },
        costPrice: { type: SchemaType.NUMBER, description: "원가 (원, 선택)" },
        stock: { type: SchemaType.NUMBER, description: "초기 재고 수량" },
        minStock: { type: SchemaType.NUMBER, description: "최소 재고 (기본 10)" },
        source: { type: SchemaType.STRING, description: "상품 출처: SELF (자체), SUPPLIER (공급사). 기본 SELF" },
        description: { type: SchemaType.STRING, description: "상품 설명 (선택)" },
      },
      required: ["code", "name", "basePrice"],
    },
  },
  {
    name: "update_product",
    description: "상품 정보를 수정합니다 (가격, 재고, 상태 등). 관리자만 사용 가능합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        code: { type: SchemaType.STRING, description: "수정할 상품코드" },
        basePrice: { type: SchemaType.NUMBER, description: "변경할 기본 판매가" },
        costPrice: { type: SchemaType.NUMBER, description: "변경할 원가" },
        stock: { type: SchemaType.NUMBER, description: "변경할 재고 수량" },
        minStock: { type: SchemaType.NUMBER, description: "변경할 최소 재고" },
        status: { type: SchemaType.STRING, description: "변경할 상태: ACTIVE, OUT_OF_STOCK, DISCONTINUED" },
        name: { type: SchemaType.STRING, description: "변경할 상품명" },
      },
      required: ["code"],
    },
  },
  {
    name: "bulk_update_price",
    description: "여러 상품의 가격을 일괄 변경합니다 (비율 또는 금액). 관리자만 사용 가능합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        keyword: { type: SchemaType.STRING, description: "대상 상품 검색 키워드 (이름 또는 코드)" },
        categoryName: { type: SchemaType.STRING, description: "대상 카테고리명" },
        adjustType: { type: SchemaType.STRING, description: "조정 방식: percent (비율), amount (금액)" },
        adjustValue: { type: SchemaType.NUMBER, description: "조정값 (percent: 10이면 10% 인상, -10이면 10% 인하 / amount: 1000이면 1000원 인상)" },
      },
      required: ["adjustType", "adjustValue"],
    },
  },
  {
    name: "input_tracking_number",
    description: "주문에 송장번호를 입력합니다. 관리자만 사용 가능합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderNumber: { type: SchemaType.STRING, description: "주문번호" },
        trackingNumber: { type: SchemaType.STRING, description: "송장번호" },
        courier: { type: SchemaType.STRING, description: "택배사 (예: CJ대한통운, 한진택배, 롯데택배). 기본 CJ대한통운" },
      },
      required: ["orderNumber", "trackingNumber"],
    },
  },
  {
    name: "process_claim",
    description: "클레임을 승인/거절/처리 완료합니다. 관리자만 사용 가능합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderNumber: { type: SchemaType.STRING, description: "클레임이 속한 주문번호" },
        action: { type: SchemaType.STRING, description: "처리 동작: approve (승인), reject (거절), complete (처리완료)" },
        adminNote: { type: SchemaType.STRING, description: "관리자 메모 (선택)" },
        amount: { type: SchemaType.NUMBER, description: "환불/차감 금액 (선택, 승인 시)" },
        newTrackingNo: { type: SchemaType.STRING, description: "교환 시 새 송장번호 (선택)" },
      },
      required: ["orderNumber", "action"],
    },
  },
  {
    name: "send_notice",
    description: "전체 공지사항을 등록합니다. 관리자만 사용 가능합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: "공지 제목" },
        content: { type: SchemaType.STRING, description: "공지 내용" },
        isImportant: { type: SchemaType.BOOLEAN, description: "중요 공지 여부 (기본 false)" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "answer_inquiry",
    description: "셀러 문의에 답변합니다. 관리자만 사용 가능합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        inquiryTitle: { type: SchemaType.STRING, description: "답변할 문의 제목 (검색용)" },
        inquiryId: { type: SchemaType.STRING, description: "답변할 문의 ID (정확한 ID)" },
        answer: { type: SchemaType.STRING, description: "답변 내용" },
      },
      required: ["answer"],
    },
  },
  {
    name: "manage_seller",
    description: "셀러를 승인/반려/등급변경 합니다. 관리자만 사용 가능합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        sellerEmail: { type: SchemaType.STRING, description: "셀러 이메일" },
        sellerName: { type: SchemaType.STRING, description: "셀러 이름 (검색용)" },
        action: { type: SchemaType.STRING, description: "동작: approve (승인), reject (반려), suspend (정지), change_grade (등급변경)" },
        gradeName: { type: SchemaType.STRING, description: "변경할 등급 이름 (change_grade 시 필수)" },
      },
      required: ["action"],
    },
  },
  // ============================================
  // Seller Write Tools
  // ============================================
  {
    name: "create_order",
    description: "새 주문을 등록합니다. 셀러가 수동으로 주문을 생성합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        recipientName: { type: SchemaType.STRING, description: "수취인 이름" },
        recipientPhone: { type: SchemaType.STRING, description: "수취인 전화번호" },
        recipientAddr: { type: SchemaType.STRING, description: "배송 주소" },
        postalCode: { type: SchemaType.STRING, description: "우편번호 (선택)" },
        items: {
          type: SchemaType.ARRAY,
          description: "주문 상품 목록",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              productCode: { type: SchemaType.STRING, description: "상품코드" },
              quantity: { type: SchemaType.NUMBER, description: "수량" },
            },
            required: ["productCode", "quantity"],
          },
        },
        notes: { type: SchemaType.STRING, description: "주문 메모 (선택)" },
      },
      required: ["recipientName", "recipientPhone", "recipientAddr", "items"],
    },
  },
  {
    name: "create_claim",
    description: "클레임(반품/환불/교환)을 요청합니다. 셀러가 본인 주문에 대해 요청합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderNumber: { type: SchemaType.STRING, description: "클레임 대상 주문번호" },
        type: { type: SchemaType.STRING, description: "클레임 유형: RETURN (반품), REFUND (환불), EXCHANGE (교환)" },
        reason: { type: SchemaType.STRING, description: "클레임 사유" },
      },
      required: ["orderNumber", "type", "reason"],
    },
  },
  {
    name: "create_inquiry",
    description: "관리자에게 문의를 작성합니다. 셀러가 사용합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: "문의 제목" },
        content: { type: SchemaType.STRING, description: "문의 내용" },
      },
      required: ["title", "content"],
    },
  },
  // ============================================
  // Advanced Tools (Phase 5)
  // ============================================
  {
    name: "upload_tracking_excel",
    description: "첨부된 엑셀/CSV 파일에서 송장번호를 읽어 주문에 자동 매칭합니다. 관리자만 사용 가능. 파일이 첨부된 상태에서 사용하세요. 파일 내용에서 주문번호와 송장번호 컬럼을 인식하여 매칭합니다.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        mappings: {
          type: SchemaType.ARRAY,
          description: "파일에서 추출한 주문번호-송장번호 매핑 목록",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              orderNumber: { type: SchemaType.STRING, description: "주문번호" },
              trackingNumber: { type: SchemaType.STRING, description: "송장번호" },
              courier: { type: SchemaType.STRING, description: "택배사 (선택, 기본 CJ대한통운)" },
            },
            required: ["orderNumber", "trackingNumber"],
          },
        },
      },
      required: ["mappings"],
    },
  },
  {
    name: "bulk_create_orders",
    description: "첨부된 엑셀/CSV 파일의 데이터로 주문을 일괄 등록합니다. 파일 내용에서 수취인, 상품, 수량 등을 인식하여 주문을 생성합니다. 셀러와 관리자 모두 사용 가능.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orders: {
          type: SchemaType.ARRAY,
          description: "생성할 주문 목록",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              recipientName: { type: SchemaType.STRING, description: "수취인 이름" },
              recipientPhone: { type: SchemaType.STRING, description: "수취인 전화번호" },
              recipientAddr: { type: SchemaType.STRING, description: "배송 주소" },
              postalCode: { type: SchemaType.STRING, description: "우편번호 (선택)" },
              productCode: { type: SchemaType.STRING, description: "상품코드" },
              quantity: { type: SchemaType.NUMBER, description: "수량 (기본 1)" },
              notes: { type: SchemaType.STRING, description: "주문 메모 (선택)" },
            },
            required: ["recipientName", "recipientPhone", "recipientAddr", "productCode"],
          },
        },
      },
      required: ["orders"],
    },
  },
  {
    name: "get_margin_stats",
    description: "상품별 마진율을 분석합니다. 원가(costPrice)와 판매가(basePrice) 기반 마진 현황을 조회합니다. 관리자만 사용 가능.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        keyword: { type: SchemaType.STRING, description: "상품명/코드 검색 (선택)" },
        sortBy: { type: SchemaType.STRING, description: "정렬: margin_high (마진율 높은순), margin_low (마진율 낮은순), sales (판매량순). 기본 margin_low" },
        limit: { type: SchemaType.NUMBER, description: "조회 수 (기본 10, 최대 30)" },
      },
    },
  },
  {
    name: "detect_anomalies",
    description: "이상 징후를 탐지합니다. 주문 급증, 높은 반품률, 재고 부족, 미처리 건 등을 분석합니다. 관리자만 사용 가능.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        checkType: { type: SchemaType.STRING, description: "점검 유형: all (전체), orders (주문 이상), claims (반품률), stock (재고), pending (미처리). 기본 all" },
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
      return searchProducts(args, isSeller ? userId : undefined);
    case "get_dashboard_stats":
      return getDashboardStats(isSeller ? userId : undefined);
    case "search_sellers":
      if (isSeller) return { error: "셀러는 다른 셀러 정보를 조회할 수 없습니다." };
      return searchSellers(args);
    case "get_order_detail":
      return getOrderDetail(args, isSeller ? userId : undefined);
    case "get_recent_claims":
      return getRecentClaims(args, isSeller ? userId : undefined);
    case "get_sales_chart":
      return getSalesChart(args, isSeller ? userId : undefined);
    case "update_order_status":
      if (isSeller) return { error: "셀러는 주문 상태를 변경할 수 없습니다." };
      return updateOrderStatus(args);
    case "search_inquiries":
      return searchInquiries(args, isSeller ? userId : undefined);
    // Admin write tools
    case "create_product":
      if (isSeller) return { error: "셀러는 상품을 등록할 수 없습니다." };
      return createProduct(args);
    case "update_product":
      if (isSeller) return { error: "셀러는 상품을 수정할 수 없습니다." };
      return updateProduct(args);
    case "bulk_update_price":
      if (isSeller) return { error: "셀러는 가격을 변경할 수 없습니다." };
      return bulkUpdatePrice(args);
    case "input_tracking_number":
      if (isSeller) return { error: "셀러는 송장을 입력할 수 없습니다." };
      return inputTrackingNumber(args);
    case "process_claim":
      if (isSeller) return { error: "셀러는 클레임을 처리할 수 없습니다." };
      return processClaim(args);
    case "send_notice":
      if (isSeller) return { error: "셀러는 공지를 작성할 수 없습니다." };
      return sendNotice(args, userId);
    case "answer_inquiry":
      if (isSeller) return { error: "셀러는 문의에 답변할 수 없습니다." };
      return answerInquiry(args);
    case "manage_seller":
      if (isSeller) return { error: "셀러는 셀러를 관리할 수 없습니다." };
      return manageSeller(args);
    // Seller write tools
    case "create_order":
      return createOrder(args, userId);
    case "create_claim":
      return createClaim(args, isSeller ? userId : undefined);
    case "create_inquiry":
      return createInquiry(args, userId);
    // Advanced tools (Phase 5)
    case "upload_tracking_excel":
      if (isSeller) return { error: "셀러는 송장 엑셀을 업로드할 수 없습니다." };
      return uploadTrackingExcel(args);
    case "bulk_create_orders":
      return bulkCreateOrders(args, userId, isSeller);
    case "get_margin_stats":
      if (isSeller) return { error: "셀러는 마진 정보를 조회할 수 없습니다." };
      return getMarginStats(args);
    case "detect_anomalies":
      if (isSeller) return { error: "셀러는 이상 탐지를 실행할 수 없습니다." };
      return detectAnomalies(args);
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

async function searchProducts(args: ToolArgs, sellerId?: string) {
  const where: Record<string, unknown> = {};
  if (args.keyword) {
    where.OR = [
      { name: { contains: args.keyword as string, mode: "insensitive" } },
      { code: { contains: args.keyword as string, mode: "insensitive" } },
    ];
  }
  if (args.status) where.status = args.status;
  // lowStock filtering handled via $queryRaw below (stock <= minStock requires column comparison)

  const limit = Math.min(Number(args.limit) || 10, 20);

  // Seller: get grade-specific price instead of basePrice
  if (sellerId) {
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: sellerId },
      select: { gradeId: true },
    });
    const gradeId = sellerProfile?.gradeId;

    let products;
    if (args.lowStock) {
      products = await prisma.$queryRaw`
        SELECT p.id, p.code, p.name, p."basePrice", p.stock, p."minStock", p.status,
               pp.price as "gradePrice"
        FROM "Product" p
        LEFT JOIN "ProductPrice" pp ON pp."productId" = p.id AND pp."gradeId" = ${gradeId || ""}
        WHERE p.stock <= p."minStock"
        ORDER BY p.stock ASC
        LIMIT ${limit}
      ` as Array<Record<string, unknown>>;
    } else {
      products = await prisma.product.findMany({
        where,
        take: limit,
        orderBy: { updatedAt: "desc" },
        select: {
          code: true, name: true, basePrice: true, stock: true, minStock: true, status: true,
          gradePrices: gradeId ? { where: { gradeId }, select: { price: true } } : undefined,
        },
      });
    }

    return (products as Array<Record<string, unknown>>).map((p) => {
      const gradePrices = p.gradePrices as Array<{ price: unknown }> | undefined;
      const gradePrice = (p as Record<string, unknown>).gradePrice ?? gradePrices?.[0]?.price;
      const displayPrice = gradePrice ? Number(gradePrice) : Number(p.basePrice);
      return {
        코드: p.code,
        상품명: p.name,
        판매가: `₩${displayPrice.toLocaleString()}`,
        재고: p.stock,
        최소재고: p.minStock,
        상태: p.status,
      };
    });
  }

  // Admin: show basePrice
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
    원가: `₩${Number(p.basePrice).toLocaleString()}`,
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

async function getSalesChart(args: ToolArgs, sellerId?: string) {
  const period = (args.period as string) || "daily";
  const now = new Date();
  const data: { label: string; 매출: number }[] = [];

  if (period === "monthly") {
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const where: Record<string, unknown> = {
        createdAt: { gte: monthStart, lt: monthEnd },
        status: { notIn: ["CANCELLED", "RETURNED"] },
      };
      if (sellerId) where.sellerId = sellerId;
      const result = await prisma.order.aggregate({ where, _sum: { totalAmount: true } });
      data.push({
        label: `${monthStart.getFullYear()}.${monthStart.getMonth() + 1}`,
        매출: Number(result._sum.totalAmount || 0),
      });
    }
  } else if (period === "weekly") {
    for (let i = 11; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);
      const where: Record<string, unknown> = {
        createdAt: { gte: weekStart, lt: weekEnd },
        status: { notIn: ["CANCELLED", "RETURNED"] },
      };
      if (sellerId) where.sellerId = sellerId;
      const result = await prisma.order.aggregate({ where, _sum: { totalAmount: true } });
      data.push({
        label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}~`,
        매출: Number(result._sum.totalAmount || 0),
      });
    }
  } else {
    // daily - last 14 days
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const where: Record<string, unknown> = {
        createdAt: { gte: dayStart, lt: dayEnd },
        status: { notIn: ["CANCELLED", "RETURNED"] },
      };
      if (sellerId) where.sellerId = sellerId;
      const result = await prisma.order.aggregate({ where, _sum: { totalAmount: true } });
      data.push({
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        매출: Number(result._sum.totalAmount || 0),
      });
    }
  }

  const totalSales = data.reduce((sum, d) => sum + d.매출, 0);

  return {
    __chart: true,
    type: period === "monthly" ? "bar" : "line",
    title: period === "daily" ? "일별 매출 추이 (14일)" : period === "weekly" ? "주별 매출 추이 (12주)" : "월별 매출 추이 (12개월)",
    data,
    xKey: "label",
    yKey: "매출",
    summary: `${period === "daily" ? "최근 14일" : period === "weekly" ? "최근 12주" : "최근 12개월"} 매출 데이터입니다. 총 매출: ₩${totalSales.toLocaleString()}`,
  };
}

async function updateOrderStatus(args: ToolArgs) {
  const orderNumber = args.orderNumber as string;
  const newStatus = args.newStatus as string;

  const validStatuses = ["PREPARING", "SHIPPING", "DELIVERED", "CANCELLED"];
  if (!validStatuses.includes(newStatus)) {
    return { error: `유효하지 않은 상태입니다. 가능한 상태: ${validStatuses.join(", ")}` };
  }

  const order = await prisma.order.findFirst({ where: { orderNumber } });
  if (!order) return { error: "주문을 찾을 수 없습니다." };

  const transitions: Record<string, string[]> = {
    PENDING: ["PREPARING", "CANCELLED"],
    PREPARING: ["SHIPPING", "CANCELLED"],
    SHIPPING: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
    RETURNED: [],
    EXCHANGED: [],
  };

  const allowed = transitions[order.status] || [];
  if (!allowed.includes(newStatus)) {
    return { error: `${order.status} 상태에서 ${newStatus}로 변경할 수 없습니다. 가능한 변경: ${allowed.join(", ") || "없음"}` };
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: newStatus as "PREPARING" | "SHIPPING" | "DELIVERED" | "CANCELLED" },
    select: { orderNumber: true, status: true },
  });

  return {
    성공: true,
    주문번호: updated.orderNumber,
    변경된상태: updated.status,
    메시지: `주문 ${updated.orderNumber}의 상태가 ${newStatus}로 변경되었습니다.`,
  };
}

async function searchInquiries(args: ToolArgs, sellerId?: string) {
  const where: Record<string, unknown> = {};
  if (sellerId) where.userId = sellerId;
  if (args.status) where.status = args.status;
  if (args.keyword) where.title = { contains: args.keyword as string, mode: "insensitive" };

  const limit = Math.min(Number(args.limit) || 10, 20);
  const inquiries = await prisma.inquiry.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      answer: true,
      status: true,
      createdAt: true,
      answeredAt: true,
      user: { select: { name: true } },
    },
  });

  return inquiries.map((inq) => ({
    문의ID: inq.id,
    제목: inq.title,
    내용: inq.content.length > 100 ? inq.content.slice(0, 100) + "..." : inq.content,
    상태: inq.status,
    ...(sellerId ? {} : { 작성자: inq.user.name }),
    답변: inq.answer ? (inq.answer.length > 100 ? inq.answer.slice(0, 100) + "..." : inq.answer) : "-",
    문의일: inq.createdAt.toLocaleDateString("ko-KR"),
    답변일: inq.answeredAt ? inq.answeredAt.toLocaleDateString("ko-KR") : "-",
  }));
}

// ============================================
// Admin Write Tool Executors
// ============================================

async function createProduct(args: ToolArgs) {
  const code = args.code as string;
  const name = args.name as string;
  const basePrice = Number(args.basePrice);

  const existing = await prisma.product.findUnique({ where: { code } });
  if (existing) return { error: `상품코드 ${code}는 이미 존재합니다.` };

  const product = await prisma.product.create({
    data: {
      code,
      name,
      basePrice,
      costPrice: args.costPrice ? Number(args.costPrice) : undefined,
      stock: Number(args.stock) || 0,
      minStock: Number(args.minStock) || 10,
      source: (args.source as "SELF" | "SUPPLIER") || "SELF",
      description: (args.description as string) || undefined,
    },
    select: { code: true, name: true, basePrice: true, stock: true, status: true },
  });

  return {
    성공: true,
    메시지: `상품 "${product.name}" (${product.code})이 등록되었습니다.`,
    상품코드: product.code,
    상품명: product.name,
    가격: `₩${Number(product.basePrice).toLocaleString()}`,
    재고: product.stock,
  };
}

async function updateProduct(args: ToolArgs) {
  const code = args.code as string;
  const product = await prisma.product.findUnique({ where: { code } });
  if (!product) return { error: `상품코드 ${code}를 찾을 수 없습니다.` };

  const data: Record<string, unknown> = {};
  if (args.basePrice !== undefined) data.basePrice = Number(args.basePrice);
  if (args.costPrice !== undefined) data.costPrice = Number(args.costPrice);
  if (args.stock !== undefined) data.stock = Number(args.stock);
  if (args.minStock !== undefined) data.minStock = Number(args.minStock);
  if (args.status) data.status = args.status;
  if (args.name) data.name = args.name;

  if (Object.keys(data).length === 0) return { error: "변경할 항목을 지정해주세요." };

  const updated = await prisma.product.update({
    where: { code },
    data,
    select: { code: true, name: true, basePrice: true, stock: true, minStock: true, status: true },
  });

  const changes = Object.keys(data).map((k) => {
    const labels: Record<string, string> = { basePrice: "가격", costPrice: "원가", stock: "재고", minStock: "최소재고", status: "상태", name: "상품명" };
    return labels[k] || k;
  });

  // Auto-notify sellers on price/status change
  if (data.basePrice || data.status) {
    const sellers = await prisma.user.findMany({
      where: { role: "SELLER", status: "ACTIVE" },
      select: { id: true },
    });
    if (sellers.length > 0) {
      const notifType = data.status === "OUT_OF_STOCK" ? "STOCK_LOW" as const : "PRICE_CHANGED" as const;
      const notifTitle = data.status === "OUT_OF_STOCK"
        ? `상품 품절: ${updated.name}`
        : `가격 변경: ${updated.name}`;
      const notifMsg = data.status === "OUT_OF_STOCK"
        ? `${updated.name} (${updated.code}) 상품이 품절되었습니다.`
        : `${updated.name} (${updated.code}) 가격이 ₩${Number(updated.basePrice).toLocaleString()}으로 변경되었습니다.`;
      await prisma.notification.createMany({
        data: sellers.map((s) => ({
          userId: s.id,
          type: notifType,
          title: notifTitle,
          message: notifMsg,
          data: { productCode: updated.code },
        })),
      });
    }
  }

  return {
    성공: true,
    메시지: `상품 "${updated.name}" (${updated.code})의 ${changes.join(", ")}이(가) 수정되었습니다.`,
    상품코드: updated.code,
    상품명: updated.name,
    가격: `₩${Number(updated.basePrice).toLocaleString()}`,
    재고: updated.stock,
    상태: updated.status,
  };
}

async function bulkUpdatePrice(args: ToolArgs) {
  const adjustType = args.adjustType as string;
  const adjustValue = Number(args.adjustValue);

  const where: Record<string, unknown> = { status: "ACTIVE" };
  if (args.keyword) {
    where.OR = [
      { name: { contains: args.keyword as string, mode: "insensitive" } },
      { code: { contains: args.keyword as string, mode: "insensitive" } },
    ];
  }
  if (args.categoryName) {
    where.category = { name: { contains: args.categoryName as string, mode: "insensitive" } };
  }

  const products = await prisma.product.findMany({
    where,
    select: { id: true, code: true, name: true, basePrice: true },
  });

  if (products.length === 0) return { error: "조건에 맞는 상품이 없습니다." };
  if (products.length > 100) return { error: `대상 상품이 ${products.length}개로 너무 많습니다. 검색 조건을 좁혀주세요 (최대 100개).` };

  let updatedCount = 0;
  for (const p of products) {
    const oldPrice = Number(p.basePrice);
    let newPrice: number;
    if (adjustType === "percent") {
      newPrice = Math.round(oldPrice * (1 + adjustValue / 100));
    } else {
      newPrice = oldPrice + adjustValue;
    }
    if (newPrice < 0) newPrice = 0;

    await prisma.product.update({
      where: { id: p.id },
      data: { basePrice: newPrice },
    });
    updatedCount++;
  }

  const desc = adjustType === "percent"
    ? `${adjustValue > 0 ? "+" : ""}${adjustValue}%`
    : `${adjustValue > 0 ? "+" : ""}₩${adjustValue.toLocaleString()}`;

  return {
    성공: true,
    메시지: `${updatedCount}개 상품의 가격이 ${desc} 변경되었습니다.`,
    변경수: updatedCount,
    조정: desc,
  };
}

async function inputTrackingNumber(args: ToolArgs) {
  const orderNumber = args.orderNumber as string;
  const trackingNumber = args.trackingNumber as string;
  const courier = (args.courier as string) || "CJ대한통운";

  const order = await prisma.order.findFirst({ where: { orderNumber } });
  if (!order) return { error: "주문을 찾을 수 없습니다." };

  if (order.status === "CANCELLED" || order.status === "RETURNED") {
    return { error: `${order.status} 상태의 주문에는 송장을 입력할 수 없습니다.` };
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      trackingNumber,
      courier,
      status: "SHIPPING",
      shippedAt: new Date(),
    },
    select: { orderNumber: true, trackingNumber: true, courier: true, status: true },
  });

  // Notify seller
  await prisma.notification.create({
    data: {
      userId: order.sellerId,
      type: "TRACKING_UPDATED",
      title: "송장번호 입력",
      message: `주문 ${orderNumber}의 송장번호가 입력되었습니다. (${courier}: ${trackingNumber})`,
      data: { orderNumber, trackingNumber, courier },
    },
  });

  return {
    성공: true,
    주문번호: updated.orderNumber,
    택배사: updated.courier,
    송장번호: updated.trackingNumber,
    상태: updated.status,
    메시지: `주문 ${orderNumber}에 송장번호 ${trackingNumber}이(가) 입력되었습니다.`,
  };
}

async function processClaim(args: ToolArgs) {
  const orderNumber = args.orderNumber as string;
  const action = args.action as string;

  const claim = await prisma.claim.findFirst({
    where: { order: { orderNumber } },
    orderBy: { createdAt: "desc" },
    include: { order: { select: { orderNumber: true, sellerId: true } } },
  });

  if (!claim) return { error: `주문 ${orderNumber}에 대한 클레임을 찾을 수 없습니다.` };

  const data: Record<string, unknown> = {};
  let statusMsg = "";

  switch (action) {
    case "approve":
      if (claim.status !== "REQUESTED") return { error: `현재 ${claim.status} 상태에서는 승인할 수 없습니다.` };
      data.status = "APPROVED";
      if (args.amount) data.amount = Number(args.amount);
      if (args.adminNote) data.adminNote = args.adminNote;
      statusMsg = "승인";
      break;
    case "reject":
      if (claim.status !== "REQUESTED") return { error: `현재 ${claim.status} 상태에서는 거절할 수 없습니다.` };
      data.status = "REJECTED";
      if (args.adminNote) data.adminNote = args.adminNote;
      statusMsg = "거절";
      break;
    case "complete":
      if (!["APPROVED", "PROCESSING"].includes(claim.status)) return { error: `현재 ${claim.status} 상태에서는 완료 처리할 수 없습니다.` };
      data.status = "COMPLETED";
      data.processedAt = new Date();
      if (args.newTrackingNo) data.newTrackingNo = args.newTrackingNo;
      if (args.adminNote) data.adminNote = args.adminNote;
      statusMsg = "처리 완료";
      break;
    default:
      return { error: "action은 approve, reject, complete 중 하나여야 합니다." };
  }

  const updated = await prisma.claim.update({
    where: { id: claim.id },
    data,
    select: { type: true, status: true, amount: true, adminNote: true },
  });

  // Notify seller (use SYSTEM type for claim status updates, CLAIM_NEW is only for new claims)
  await prisma.notification.create({
    data: {
      userId: claim.order.sellerId,
      type: "SYSTEM",
      title: `클레임 ${statusMsg}`,
      message: `주문 ${orderNumber}의 ${claim.type} 클레임이 ${statusMsg}되었습니다.`,
      data: { orderNumber, claimId: claim.id },
    },
  });

  return {
    성공: true,
    주문번호: orderNumber,
    유형: updated.type,
    상태: updated.status,
    금액: updated.amount ? `₩${Number(updated.amount).toLocaleString()}` : "-",
    메시지: `클레임이 ${statusMsg}되었습니다.`,
  };
}

async function sendNotice(args: ToolArgs, adminUserId: string) {
  const title = args.title as string;
  const content = args.content as string;
  const isImportant = Boolean(args.isImportant);

  const notice = await prisma.notice.create({
    data: { title, content, isImportant, authorId: adminUserId },
    select: { id: true, title: true, isImportant: true },
  });

  // Notify all active sellers
  const sellers = await prisma.user.findMany({
    where: { role: "SELLER", status: "ACTIVE" },
    select: { id: true },
  });

  if (sellers.length > 0) {
    await prisma.notification.createMany({
      data: sellers.map((s) => ({
        userId: s.id,
        type: "NOTICE" as const,
        title: isImportant ? `[중요] ${title}` : title,
        message: content.length > 100 ? content.slice(0, 100) + "..." : content,
        data: { noticeId: notice.id },
      })),
    });
  }

  return {
    성공: true,
    메시지: `공지 "${title}"이(가) 등록되었습니다. ${sellers.length}명의 셀러에게 알림이 발송되었습니다.`,
    제목: notice.title,
    중요: notice.isImportant,
    알림발송: `${sellers.length}명`,
  };
}

async function answerInquiry(args: ToolArgs) {
  const answer = args.answer as string;

  let inquiry;
  if (args.inquiryId) {
    inquiry = await prisma.inquiry.findUnique({
      where: { id: args.inquiryId as string },
      select: { id: true, title: true, status: true, userId: true },
    });
  } else if (args.inquiryTitle) {
    inquiry = await prisma.inquiry.findFirst({
      where: {
        title: { contains: args.inquiryTitle as string, mode: "insensitive" },
        status: "OPEN",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true, userId: true },
    });
  } else {
    // Find most recent unanswered inquiry
    inquiry = await prisma.inquiry.findFirst({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true, userId: true },
    });
  }

  if (!inquiry) return { error: "답변할 문의를 찾을 수 없습니다." };
  if (inquiry.status !== "OPEN") return { error: `이미 ${inquiry.status} 상태인 문의입니다.` };

  await prisma.inquiry.update({
    where: { id: inquiry.id },
    data: { answer, status: "ANSWERED", answeredAt: new Date() },
  });

  // Notify seller
  await prisma.notification.create({
    data: {
      userId: inquiry.userId,
      type: "SYSTEM",
      title: "문의 답변 완료",
      message: `"${inquiry.title}" 문의에 답변이 등록되었습니다.`,
      data: { inquiryId: inquiry.id },
    },
  });

  return {
    성공: true,
    메시지: `"${inquiry.title}" 문의에 답변이 등록되었습니다.`,
    문의제목: inquiry.title,
    답변: answer.length > 100 ? answer.slice(0, 100) + "..." : answer,
  };
}

async function manageSeller(args: ToolArgs) {
  const action = args.action as string;

  // Find seller
  let seller;
  if (args.sellerEmail) {
    seller = await prisma.user.findFirst({
      where: { email: args.sellerEmail as string, role: "SELLER" },
      select: { id: true, name: true, email: true, status: true, sellerProfile: { select: { id: true, grade: { select: { name: true } } } } },
    });
  } else if (args.sellerName) {
    seller = await prisma.user.findFirst({
      where: { name: { contains: args.sellerName as string, mode: "insensitive" }, role: "SELLER" },
      select: { id: true, name: true, email: true, status: true, sellerProfile: { select: { id: true, grade: { select: { name: true } } } } },
    });
  } else {
    return { error: "셀러 이메일 또는 이름을 지정해주세요." };
  }

  if (!seller) return { error: "셀러를 찾을 수 없습니다." };

  switch (action) {
    case "approve": {
      if (seller.status !== "PENDING") return { error: `현재 ${seller.status} 상태에서는 승인할 수 없습니다. PENDING 상태만 승인 가능합니다.` };
      await prisma.user.update({ where: { id: seller.id }, data: { status: "ACTIVE" } });
      return { 성공: true, 메시지: `셀러 "${seller.name}" (${seller.email})이(가) 승인되었습니다.`, 이름: seller.name, 상태: "ACTIVE" };
    }
    case "reject": {
      if (seller.status !== "PENDING") return { error: `현재 ${seller.status} 상태에서는 반려할 수 없습니다.` };
      await prisma.user.update({ where: { id: seller.id }, data: { status: "REJECTED" } });
      return { 성공: true, 메시지: `셀러 "${seller.name}" (${seller.email})이(가) 반려되었습니다.`, 이름: seller.name, 상태: "REJECTED" };
    }
    case "suspend": {
      if (seller.status !== "ACTIVE") return { error: `현재 ${seller.status} 상태에서는 정지할 수 없습니다.` };
      await prisma.user.update({ where: { id: seller.id }, data: { status: "SUSPENDED" } });
      return { 성공: true, 메시지: `셀러 "${seller.name}" (${seller.email})이(가) 정지되었습니다.`, 이름: seller.name, 상태: "SUSPENDED" };
    }
    case "change_grade": {
      if (!args.gradeName) return { error: "변경할 등급 이름을 지정해주세요." };
      const grade = await prisma.sellerGrade.findFirst({ where: { name: { contains: args.gradeName as string, mode: "insensitive" } } });
      if (!grade) return { error: `"${args.gradeName}" 등급을 찾을 수 없습니다.` };
      if (!seller.sellerProfile) return { error: "셀러 프로필이 없습니다." };
      await prisma.sellerProfile.update({ where: { id: seller.sellerProfile.id }, data: { gradeId: grade.id } });
      return { 성공: true, 메시지: `셀러 "${seller.name}"의 등급이 "${grade.name}"으로 변경되었습니다.`, 이름: seller.name, 변경등급: grade.name };
    }
    default:
      return { error: "action은 approve, reject, suspend, change_grade 중 하나여야 합니다." };
  }
}

// ============================================
// Seller Write Tool Executors
// ============================================

async function createOrder(args: ToolArgs, sellerId: string) {
  const items = args.items as Array<{ productCode: string; quantity: number }>;
  if (!items?.length) return { error: "주문 상품을 지정해주세요." };

  // Get seller grade for price
  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: sellerId },
    select: { gradeId: true },
  });

  // Validate products and calculate prices
  const orderItems: Array<{ productId: string; quantity: number; unitPrice: number; totalPrice: number; productName: string }> = [];

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { code: item.productCode },
      select: {
        id: true, name: true, code: true, basePrice: true, stock: true, status: true,
        gradePrices: sellerProfile?.gradeId ? { where: { gradeId: sellerProfile.gradeId }, select: { price: true } } : undefined,
        sellerPrices: { where: { sellerId }, select: { price: true } },
      },
    });

    if (!product) return { error: `상품코드 ${item.productCode}를 찾을 수 없습니다.` };
    if (product.status !== "ACTIVE") return { error: `상품 "${product.name}"은(는) 현재 판매중이 아닙니다 (${product.status}).` };
    if (product.stock < item.quantity) return { error: `상품 "${product.name}"의 재고가 부족합니다. (재고: ${product.stock}, 요청: ${item.quantity})` };

    // Price priority: SellerPrice > GradePrice > BasePrice
    const sellerPrice = product.sellerPrices[0]?.price;
    const gradePrice = product.gradePrices?.[0]?.price;
    const unitPrice = Number(sellerPrice ?? gradePrice ?? product.basePrice);

    orderItems.push({
      productId: product.id,
      quantity: item.quantity,
      unitPrice,
      totalPrice: unitPrice * item.quantity,
      productName: product.name,
    });
  }

  const totalAmount = orderItems.reduce((sum, i) => sum + i.totalPrice, 0);

  // Check deposit balance
  const deposit = await prisma.deposit.findUnique({ where: { sellerId } });
  if (!deposit || Number(deposit.balance) < totalAmount) {
    return { error: `예치금이 부족합니다. 필요: ₩${totalAmount.toLocaleString()}, 잔액: ₩${Number(deposit?.balance || 0).toLocaleString()}` };
  }

  // Create order in transaction (order number generated inside to avoid race condition)
  const order = await prisma.$transaction(async (tx) => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const todayCount = await tx.order.count({
      where: { orderNumber: { startsWith: `ORD-${today}` } },
    });
    const orderNumber = `ORD-${today}-${String(todayCount + 1).padStart(4, "0")}`;

    const created = await tx.order.create({
      data: {
        orderNumber,
        sellerId,
        recipientName: args.recipientName as string,
        recipientPhone: args.recipientPhone as string,
        recipientAddr: args.recipientAddr as string,
        postalCode: (args.postalCode as string) || undefined,
        totalAmount,
        notes: (args.notes as string) || undefined,
        items: {
          create: orderItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: i.totalPrice,
          })),
        },
      },
      select: { orderNumber: true, totalAmount: true, status: true },
    });

    // Deduct stock
    for (const item of orderItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Deduct deposit
    const newBalance = Number(deposit.balance) - totalAmount;
    await tx.deposit.update({
      where: { sellerId },
      data: { balance: newBalance },
    });
    await tx.depositTransaction.create({
      data: {
        depositId: deposit.id,
        type: "DEDUCT",
        amount: totalAmount,
        balanceAfter: newBalance,
        description: `주문 ${orderNumber}`,
      },
    });

    return created;
  });

  return {
    성공: true,
    주문번호: order.orderNumber,
    총금액: `₩${Number(order.totalAmount).toLocaleString()}`,
    상태: order.status,
    상품: orderItems.map((i) => `${i.productName} x${i.quantity}`).join(", "),
    메시지: `주문 ${order.orderNumber}이(가) 등록되었습니다.`,
  };
}

async function createClaim(args: ToolArgs, sellerId?: string) {
  const orderNumber = args.orderNumber as string;
  const type = args.type as string;
  const reason = args.reason as string;

  if (!["RETURN", "REFUND", "EXCHANGE"].includes(type)) {
    return { error: "type은 RETURN, REFUND, EXCHANGE 중 하나여야 합니다." };
  }

  const where: Record<string, unknown> = { orderNumber };
  if (sellerId) where.sellerId = sellerId;

  const order = await prisma.order.findFirst({ where });
  if (!order) return { error: sellerId ? "본인 주문을 찾을 수 없습니다." : "주문을 찾을 수 없습니다." };

  if (!["DELIVERED", "SHIPPING"].includes(order.status)) {
    return { error: `${order.status} 상태의 주문에는 클레임을 등록할 수 없습니다. 배송중 또는 배송완료 상태만 가능합니다.` };
  }

  // Check if active claim exists
  const existingClaim = await prisma.claim.findFirst({
    where: { orderId: order.id, status: { in: ["REQUESTED", "APPROVED", "PROCESSING"] } },
  });
  if (existingClaim) return { error: "이미 진행 중인 클레임이 있습니다." };

  const claim = await prisma.claim.create({
    data: {
      orderId: order.id,
      type: type as "RETURN" | "REFUND" | "EXCHANGE",
      reason,
    },
    select: { type: true, status: true, reason: true },
  });

  // Notify admins
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true },
  });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "CLAIM_NEW" as const,
        title: "새 클레임 요청",
        message: `주문 ${orderNumber}에 대한 ${type} 클레임이 접수되었습니다.`,
        data: { orderNumber },
      })),
    });
  }

  return {
    성공: true,
    주문번호: orderNumber,
    유형: claim.type,
    상태: claim.status,
    사유: claim.reason,
    메시지: `주문 ${orderNumber}에 대한 ${type} 클레임이 접수되었습니다.`,
  };
}

async function createInquiry(args: ToolArgs, userId: string) {
  const title = args.title as string;
  const content = args.content as string;

  const inquiry = await prisma.inquiry.create({
    data: { userId, title, content },
    select: { id: true, title: true, status: true },
  });

  // Notify admins
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true },
  });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "SYSTEM" as const,
        title: "새 문의 접수",
        message: `"${title}" 문의가 접수되었습니다.`,
        data: { inquiryId: inquiry.id },
      })),
    });
  }

  return {
    성공: true,
    제목: inquiry.title,
    상태: inquiry.status,
    메시지: `문의 "${title}"이(가) 접수되었습니다. 관리자가 확인 후 답변드리겠습니다.`,
  };
}

// ============================================
// Advanced Tool Executors (Phase 5)
// ============================================

async function uploadTrackingExcel(args: ToolArgs) {
  const mappings = args.mappings as Array<{ orderNumber: string; trackingNumber: string; courier?: string }>;
  if (!mappings?.length) return { error: "매핑 데이터가 없습니다." };

  let matched = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const m of mappings) {
    const order = await prisma.order.findFirst({
      where: { orderNumber: m.orderNumber },
    });

    if (!order) {
      errors.push(`${m.orderNumber}: 주문 없음`);
      failed++;
      continue;
    }

    if (order.status === "CANCELLED" || order.status === "RETURNED") {
      errors.push(`${m.orderNumber}: ${order.status} 상태`);
      failed++;
      continue;
    }

    if (order.trackingNumber) {
      errors.push(`${m.orderNumber}: 이미 송장 있음 (${order.trackingNumber})`);
      failed++;
      continue;
    }

    const courier = m.courier || "CJ대한통운";
    await prisma.order.update({
      where: { id: order.id },
      data: {
        trackingNumber: m.trackingNumber,
        courier,
        status: "SHIPPING",
        shippedAt: new Date(),
      },
    });

    // Notify seller
    await prisma.notification.create({
      data: {
        userId: order.sellerId,
        type: "TRACKING_UPDATED",
        title: "송장번호 입력",
        message: `주문 ${m.orderNumber}의 송장번호가 입력되었습니다. (${courier}: ${m.trackingNumber})`,
        data: { orderNumber: m.orderNumber, trackingNumber: m.trackingNumber },
      },
    });

    matched++;
  }

  return {
    성공: true,
    전체: mappings.length,
    매칭성공: matched,
    실패: failed,
    ...(errors.length > 0 && { 실패내역: errors.slice(0, 10) }),
    메시지: `${mappings.length}건 중 ${matched}건 송장 매칭 완료, ${failed}건 실패`,
  };
}

async function bulkCreateOrders(args: ToolArgs, userId: string, isSeller: boolean) {
  const orders = args.orders as Array<{
    recipientName: string;
    recipientPhone: string;
    recipientAddr: string;
    postalCode?: string;
    productCode: string;
    quantity?: number;
    notes?: string;
  }>;

  if (!orders?.length) return { error: "주문 데이터가 없습니다." };
  if (orders.length > 50) return { error: `한 번에 최대 50건까지 등록 가능합니다. (요청: ${orders.length}건)` };

  const sellerId = isSeller ? userId : undefined;

  // Get seller profile for pricing
  const sellerProfile = sellerId ? await prisma.sellerProfile.findUnique({
    where: { userId: sellerId },
    select: { gradeId: true },
  }) : null;

  // Check deposit if seller
  let deposit: { id: string; balance: unknown } | null = null;
  if (sellerId) {
    deposit = await prisma.deposit.findUnique({ where: { sellerId } });
    if (!deposit) return { error: "예치금 정보를 찾을 수 없습니다." };
  }

  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];
  let totalDeducted = 0;

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    try {
      const product = await prisma.product.findUnique({
        where: { code: o.productCode },
        select: {
          id: true, name: true, basePrice: true, stock: true, status: true,
          gradePrices: sellerProfile?.gradeId ? { where: { gradeId: sellerProfile.gradeId }, select: { price: true } } : undefined,
          sellerPrices: sellerId ? { where: { sellerId }, select: { price: true } } : undefined,
        },
      });

      if (!product) { errors.push(`#${i + 1}: 상품코드 ${o.productCode} 없음`); failCount++; continue; }
      if (product.status !== "ACTIVE") { errors.push(`#${i + 1}: ${product.name} 판매중단`); failCount++; continue; }

      const qty = o.quantity || 1;
      if (product.stock < qty) { errors.push(`#${i + 1}: ${product.name} 재고부족 (${product.stock})`); failCount++; continue; }

      const sellerPrice = product.sellerPrices?.[0]?.price;
      const gradePrice = product.gradePrices?.[0]?.price;
      const unitPrice = Number(sellerPrice ?? gradePrice ?? product.basePrice);
      const totalAmount = unitPrice * qty;

      // Check deposit balance
      if (deposit) {
        const remaining = Number(deposit.balance) - totalDeducted;
        if (remaining < totalAmount) { errors.push(`#${i + 1}: 예치금 부족`); failCount++; continue; }
      }

      await prisma.$transaction(async (tx) => {
        const todayCount = await tx.order.count({
          where: { orderNumber: { startsWith: `ORD-${today}` } },
        });
        const orderNumber = `ORD-${today}-${String(todayCount + 1).padStart(4, "0")}`;

        await tx.order.create({
          data: {
            orderNumber,
            sellerId: sellerId || userId,
            recipientName: o.recipientName,
            recipientPhone: o.recipientPhone,
            recipientAddr: o.recipientAddr,
            postalCode: o.postalCode || undefined,
            totalAmount,
            notes: o.notes || undefined,
            items: {
              create: [{
                productId: product.id,
                quantity: qty,
                unitPrice,
                totalPrice: totalAmount,
              }],
            },
          },
        });

        await tx.product.update({
          where: { id: product.id },
          data: { stock: { decrement: qty } },
        });

        if (deposit && sellerId) {
          const updated = await tx.deposit.update({
            where: { sellerId },
            data: { balance: { decrement: totalAmount } },
          });
          await tx.depositTransaction.create({
            data: {
              depositId: deposit.id,
              type: "DEDUCT",
              amount: totalAmount,
              balanceAfter: updated.balance,
              description: `주문 ${orderNumber}`,
            },
          });
        }
      });

      totalDeducted += totalAmount;
      successCount++;
    } catch {
      errors.push(`#${i + 1}: 처리 오류`);
      failCount++;
    }
  }

  return {
    성공: true,
    전체: orders.length,
    등록성공: successCount,
    실패: failCount,
    ...(totalDeducted > 0 && { 차감예치금: `₩${totalDeducted.toLocaleString()}` }),
    ...(errors.length > 0 && { 실패내역: errors.slice(0, 10) }),
    메시지: `${orders.length}건 중 ${successCount}건 주문 등록 완료`,
  };
}

async function getMarginStats(args: ToolArgs) {
  const where: Record<string, unknown> = { costPrice: { not: null } };
  if (args.keyword) {
    where.OR = [
      { name: { contains: args.keyword as string, mode: "insensitive" } },
      { code: { contains: args.keyword as string, mode: "insensitive" } },
    ];
  }

  const limit = Math.min(Number(args.limit) || 10, 30);
  const sortBy = (args.sortBy as string) || "margin_low";

  const products = await prisma.product.findMany({
    where,
    select: {
      code: true, name: true, basePrice: true, costPrice: true, stock: true, status: true,
      _count: { select: { orderItems: true } },
    },
  });

  // Calculate margins
  const withMargin = products
    .filter((p) => p.costPrice && Number(p.costPrice) > 0)
    .map((p) => {
      const cost = Number(p.costPrice);
      const price = Number(p.basePrice);
      const margin = price - cost;
      const marginRate = ((margin / price) * 100);
      return {
        코드: p.code,
        상품명: p.name,
        원가: `₩${cost.toLocaleString()}`,
        판매가: `₩${price.toLocaleString()}`,
        마진: `₩${margin.toLocaleString()}`,
        마진율: `${marginRate.toFixed(1)}%`,
        _marginRate: marginRate,
        _salesCount: p._count.orderItems,
        판매건수: p._count.orderItems,
        상태: p.status,
      };
    });

  // Sort
  if (sortBy === "margin_high") {
    withMargin.sort((a, b) => b._marginRate - a._marginRate);
  } else if (sortBy === "sales") {
    withMargin.sort((a, b) => b._salesCount - a._salesCount);
  } else {
    withMargin.sort((a, b) => a._marginRate - b._marginRate);
  }

  const result = withMargin.slice(0, limit);

  // Calculate averages
  const avgMarginRate = withMargin.length > 0
    ? withMargin.reduce((sum, p) => sum + p._marginRate, 0) / withMargin.length
    : 0;

  const lowMarginCount = withMargin.filter((p) => p._marginRate < 10).length;
  const negativeMarginCount = withMargin.filter((p) => p._marginRate < 0).length;

  // Clean up internal fields
  const cleaned = result.map(({ _marginRate, _salesCount, ...rest }) => {
    void _marginRate;
    void _salesCount;
    return rest;
  });

  return {
    상품목록: cleaned,
    요약: {
      총분석상품수: withMargin.length,
      평균마진율: `${avgMarginRate.toFixed(1)}%`,
      저마진상품: `${lowMarginCount}개 (10% 미만)`,
      ...(negativeMarginCount > 0 && { 역마진상품: `${negativeMarginCount}개 (원가 > 판매가)` }),
    },
  };
}

async function detectAnomalies(args: ToolArgs) {
  const checkType = (args.checkType as string) || "all";
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(todayStart);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(todayStart);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const anomalies: Array<{ 유형: string; 심각도: string; 내용: string }> = [];

  // 1. Order anomalies - sudden spike
  if (checkType === "all" || checkType === "orders") {
    const thisWeekOrders = await prisma.order.count({
      where: { createdAt: { gte: weekAgo } },
    });
    const lastWeekOrders = await prisma.order.count({
      where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
    });

    if (lastWeekOrders > 0 && thisWeekOrders > lastWeekOrders * 2) {
      anomalies.push({
        유형: "주문 급증",
        심각도: "주의",
        내용: `이번 주 주문 ${thisWeekOrders}건 (지난주 ${lastWeekOrders}건 대비 ${Math.round((thisWeekOrders / lastWeekOrders - 1) * 100)}% 증가)`,
      });
    }

    if (lastWeekOrders > 5 && thisWeekOrders < lastWeekOrders * 0.3) {
      anomalies.push({
        유형: "주문 급감",
        심각도: "경고",
        내용: `이번 주 주문 ${thisWeekOrders}건 (지난주 ${lastWeekOrders}건 대비 ${Math.round((1 - thisWeekOrders / lastWeekOrders) * 100)}% 감소)`,
      });
    }
  }

  // 2. Claim anomalies - high return rate
  if (checkType === "all" || checkType === "claims") {
    const recentOrders = await prisma.order.count({
      where: { createdAt: { gte: weekAgo } },
    });
    const recentClaims = await prisma.claim.count({
      where: { createdAt: { gte: weekAgo } },
    });

    if (recentOrders > 10 && recentClaims / recentOrders > 0.1) {
      anomalies.push({
        유형: "높은 반품률",
        심각도: "경고",
        내용: `최근 7일 반품률 ${(recentClaims / recentOrders * 100).toFixed(1)}% (${recentClaims}건/${recentOrders}건)`,
      });
    }

    // Seller with most claims
    const sellerClaims = await prisma.claim.groupBy({
      by: ["orderId"],
      where: { createdAt: { gte: weekAgo } },
      _count: true,
    });

    if (sellerClaims.length > 0) {
      // Get orders to find sellers
      const claimOrderIds = sellerClaims.map((c) => c.orderId);
      const claimOrders = await prisma.order.findMany({
        where: { id: { in: claimOrderIds } },
        select: { sellerId: true, seller: { select: { name: true } } },
      });

      const sellerClaimCount: Record<string, { name: string; count: number }> = {};
      for (const o of claimOrders) {
        if (!sellerClaimCount[o.sellerId]) sellerClaimCount[o.sellerId] = { name: o.seller.name, count: 0 };
        sellerClaimCount[o.sellerId].count++;
      }

      const topClaimer = Object.values(sellerClaimCount).sort((a, b) => b.count - a.count)[0];
      if (topClaimer && topClaimer.count >= 3) {
        anomalies.push({
          유형: "셀러 클레임 집중",
          심각도: "주의",
          내용: `${topClaimer.name} 셀러 최근 7일 클레임 ${topClaimer.count}건`,
        });
      }
    }
  }

  // 3. Stock anomalies
  if (checkType === "all" || checkType === "stock") {
    const outOfStock = await prisma.product.count({
      where: { status: "ACTIVE", stock: 0 },
    });

    if (outOfStock > 0) {
      anomalies.push({
        유형: "재고 소진",
        심각도: "긴급",
        내용: `판매중인 상품 ${outOfStock}개의 재고가 0입니다`,
      });
    }

    const lowStockCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "Product" WHERE status = 'ACTIVE' AND stock > 0 AND stock <= "minStock"
    `.then((r) => Number((r as Array<{ count: bigint }>)[0]?.count || 0));

    if (lowStockCount > 0) {
      anomalies.push({
        유형: "재고 부족",
        심각도: "주의",
        내용: `${lowStockCount}개 상품이 최소재고 이하입니다`,
      });
    }
  }

  // 4. Pending items
  if (checkType === "all" || checkType === "pending") {
    const pendingOrders = await prisma.order.count({
      where: { status: "PENDING", createdAt: { lte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
    });

    if (pendingOrders > 0) {
      anomalies.push({
        유형: "미처리 주문",
        심각도: "경고",
        내용: `48시간 이상 미처리 주문 ${pendingOrders}건`,
      });
    }

    const pendingClaims = await prisma.claim.count({
      where: { status: "REQUESTED", createdAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });

    if (pendingClaims > 0) {
      anomalies.push({
        유형: "미처리 클레임",
        심각도: "경고",
        내용: `24시간 이상 미처리 클레임 ${pendingClaims}건`,
      });
    }

    const pendingInquiries = await prisma.inquiry.count({
      where: { status: "OPEN", createdAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });

    if (pendingInquiries > 0) {
      anomalies.push({
        유형: "미답변 문의",
        심각도: "주의",
        내용: `24시간 이상 미답변 문의 ${pendingInquiries}건`,
      });
    }

    const pendingSellers = await prisma.user.count({
      where: { role: "SELLER", status: "PENDING" },
    });

    if (pendingSellers > 0) {
      anomalies.push({
        유형: "미승인 셀러",
        심각도: "정보",
        내용: `승인 대기 셀러 ${pendingSellers}명`,
      });
    }
  }

  if (anomalies.length === 0) {
    return { 메시지: "현재 이상 징후가 감지되지 않았습니다. 모든 지표가 정상 범위입니다." };
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { "긴급": 0, "경고": 1, "주의": 2, "정보": 3 };
  anomalies.sort((a, b) => (severityOrder[a.심각도] ?? 9) - (severityOrder[b.심각도] ?? 9));

  return {
    이상징후: anomalies,
    요약: `${anomalies.length}건의 이상 징후가 감지되었습니다.`,
    긴급: anomalies.filter((a) => a.심각도 === "긴급").length,
    경고: anomalies.filter((a) => a.심각도 === "경고").length,
    주의: anomalies.filter((a) => a.심각도 === "주의").length,
  };
}
