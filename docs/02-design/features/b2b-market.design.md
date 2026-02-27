# 네놈마켓 B2B 플랫폼 - 설계 문서

> Plan Reference: `docs/01-plan/PRD.md`
> Phase: Design
> Created: 2026-02-26

---

## 1. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                    Client (Browser)                  │
│  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │   웹 대시보드 UI   │  │    AI 채팅 UI (WebSocket) │ │
│  └────────┬─────────┘  └────────────┬─────────────┘ │
└───────────┼─────────────────────────┼───────────────┘
            │ REST API                │ WebSocket
┌───────────┼─────────────────────────┼───────────────┐
│           ▼                         ▼               │
│  ┌─────────────────────────────────────────────┐    │
│  │           Next.js App Router                 │    │
│  │  ┌───────────┐  ┌───────────┐  ┌─────────┐  │    │
│  │  │ API Routes│  │ WebSocket │  │  Pages  │  │    │
│  │  │ /api/*    │  │ Server    │  │ /app/*  │  │    │
│  │  └─────┬─────┘  └─────┬─────┘  └─────────┘  │    │
│  │        │              │                      │    │
│  │  ┌─────▼──────────────▼──────────────────┐   │    │
│  │  │         비즈니스 로직 레이어              │   │    │
│  │  │  ┌────────┐ ┌────────┐ ┌────────────┐ │   │    │
│  │  │  │상품서비스│ │주문서비스│ │AI 채팅 엔진 │ │   │    │
│  │  │  └────────┘ └────────┘ └──────┬─────┘ │   │    │
│  │  └───────────────────────────────┼───────┘   │    │
│  └──────────────────────────────────┼───────────┘    │
│                                     │               │
│  ┌──────────┐  ┌──────────┐  ┌──────▼──────┐        │
│  │ Prisma   │  │ 엑셀처리  │  │ Claude API │        │
│  │ ORM      │  │ (xlsx)   │  │            │        │
│  └────┬─────┘  └──────────┘  └─────────────┘        │
│       │                                             │
└───────┼─────────────────────────────────────────────┘
        │
┌───────▼─────────┐  ┌──────────────┐  ┌──────────────┐
│   PostgreSQL    │  │ CJ대한통운 API │  │ 카카오 알림톡  │
│   (Supabase)    │  │              │  │    API       │
└─────────────────┘  └──────────────┘  └──────────────┘

배포 구성:
┌──────────────────┐  ┌──────────────────────────┐
│   Vercel          │  │  Railway/Render           │
│   (웹 대시보드)    │  │  (채팅 WebSocket 서버)     │
│   - Next.js SSR   │  │  - WebSocket 상시 연결     │
│   - API Routes    │  │  - Claude API 호출        │
│   - 정적 페이지    │  │  - 실시간 알림 푸시        │
└──────────────────┘  └──────────────────────────┘
         │                       │
         └───────┬───────────────┘
                 ▼
┌─────────────────────────────┐
│  Supabase                    │
│  - PostgreSQL (DB)           │
│  - Storage (파일/엑셀/이미지) │
│  → 추후 AWS RDS + S3 전환    │
└─────────────────────────────┘
```

---

## 2. 데이터베이스 스키마

### 2.1 ERD 개요

```
User (관리자/셀러)
  │
  ├── 1:1 ── SellerProfile (셀러 추가 정보)
  │            │
  │            └── N:1 ── SellerGrade (등급)
  │
  ├── 1:N ── Order (주문)
  │            │
  │            ├── 1:N ── OrderItem (주문 상품)
  │            │            │
  │            │            └── N:1 ── Product (상품)
  │            │
  │            └── 1:N ── Claim (클레임)
  │
  ├── 1:N ── Inquiry (문의)
  │
  └── 1:N ── Settlement (정산)

Product (상품)
  │
  ├── N:1 ── Category (카테고리)
  ├── N:1 ── Supplier (공급사)
  ├── 1:N ── ProductPrice (등급별 가격)
  └── 1:N ── SellerPrice (셀러 개별 가격)

Supplier (공급사)
  │
  ├── 1:N ── Product
  ├── 1:N ── PurchaseOrder (발주)
  └── 1:1 ── ExcelTemplate (발주 양식)

Notification (알림)
ActivityLog (활동 로그)
ChatMessage (채팅 메시지)
```

### 2.2 상세 스키마 (Prisma)

```prisma
// ============================================
// 사용자 & 인증
// ============================================

enum UserRole {
  SUPER_ADMIN    // 슈퍼 관리자
  ADMIN          // 일반 관리자
  SELLER         // 셀러
}

enum UserStatus {
  PENDING        // 승인 대기
  ACTIVE         // 활성
  SUSPENDED      // 정지
  REJECTED       // 반려
}

model User {
  id            String       @id @default(cuid())
  email         String       @unique
  password      String       // bcrypt hashed
  name          String
  phone         String?
  role          UserRole     @default(SELLER)
  status        UserStatus   @default(PENDING)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  sellerProfile SellerProfile?
  orders        Order[]
  inquiries     Inquiry[]
  notifications Notification[]
  activityLogs  ActivityLog[]
  chatMessages  ChatMessage[]
}

model SellerProfile {
  id               String      @id @default(cuid())
  userId           String      @unique
  user             User        @relation(fields: [userId], references: [id])
  businessName     String      // 상호명
  businessNumber   String      // 사업자번호 (필수)
  bizLicenseUrl    String      // 사업자등록증 파일 URL (필수)
  gradeId          String
  grade            SellerGrade @relation(fields: [gradeId], references: [id])
  customFeeRate    Decimal?    // 개별 수수료율 (null이면 등급 수수료 적용)
  salesChannels    Json?       // 판매 채널 정보 ["쿠팡", "스마트스토어"]
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt
}

model SellerGrade {
  id            String          @id @default(cuid())
  name          String          @unique  // VIP, Gold, Silver, Basic
  level         Int             @unique  // 정렬용 숫자 (높을수록 높은 등급)
  feeRate       Decimal         // 기본 수수료율 (예: 5.0 = 5%)
  description   String?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  sellers       SellerProfile[]
  prices        ProductPrice[]
}

// ============================================
// 상품 & 카테고리
// ============================================

enum ProductStatus {
  ACTIVE         // 판매중
  OUT_OF_STOCK   // 품절
  DISCONTINUED   // 단종
}

enum ProductSource {
  SELF           // 자체 상품
  SUPPLIER       // 공급사 상품
}

model Category {
  id          String    @id @default(cuid())
  name        String    // 농산물, 수산물, 축산물 등
  parentId    String?
  parent      Category? @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryTree")
  createdAt   DateTime  @default(now())

  products    Product[]
}

model Product {
  id            String        @id @default(cuid())
  code          String        @unique  // 상품코드 (GAM-001 등)
  name          String
  description   String?
  basePrice     Decimal       // 기본 가격 (등급 미적용)
  costPrice     Decimal?      // 원가
  unit          String        @default("EA") // 단위 (EA, kg, box 등)
  stock         Int           @default(0)    // 재고 수량
  minStock      Int           @default(10)   // 최소 재고 (알림 기준)
  status        ProductStatus @default(ACTIVE)
  source        ProductSource // 자체/공급사
  categoryId    String?
  category      Category?     @relation(fields: [categoryId], references: [id])
  supplierId    String?
  supplier      Supplier?     @relation(fields: [supplierId], references: [id])
  imageUrl      String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  gradePrices   ProductPrice[]   // 등급별 가격
  sellerPrices  SellerPrice[]    // 셀러 개별 가격
  orderItems    OrderItem[]
}

model ProductPrice {
  id          String      @id @default(cuid())
  productId   String
  product     Product     @relation(fields: [productId], references: [id], onDelete: Cascade)
  gradeId     String
  grade       SellerGrade @relation(fields: [gradeId], references: [id])
  price       Decimal     // 등급별 판매가

  @@unique([productId, gradeId])
}

model SellerPrice {
  id          String   @id @default(cuid())
  productId   String
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  sellerId    String   // User.id (셀러)
  price       Decimal  // 개별 판매가

  @@unique([productId, sellerId])
}

// ============================================
// 공급사
// ============================================

model Supplier {
  id              String   @id @default(cuid())
  name            String
  contactName     String?  // 담당자명
  phone           String?
  email           String?
  kakaoId         String?  // 카톡 ID
  address         String?
  excelTemplateId String?  // 발주서 엑셀 양식
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  products        Product[]
  purchaseOrders  PurchaseOrder[]
  excelTemplate   ExcelTemplate?
}

model ExcelTemplate {
  id          String   @id @default(cuid())
  supplierId  String   @unique
  supplier    Supplier @relation(fields: [supplierId], references: [id])
  name        String   // 양식 이름
  columns     Json     // 컬럼 매핑 정보 [{"name":"상품명","mappedTo":"productName"}, ...]
  fileUrl     String?  // 양식 파일 URL
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ============================================
// 주문
// ============================================

enum OrderStatus {
  PENDING        // 접수 대기
  CONFIRMED      // 확인됨
  PROCESSING     // 처리중 (발주 진행)
  SHIPPING       // 배송중
  DELIVERED      // 배송완료
  CANCELLED      // 취소
}

enum SalesChannel {
  COUPANG        // 쿠팡
  SMARTSTORE     // 스마트스토어
  OWN_MALL       // 자사몰
  OTHER          // 기타
}

model Order {
  id              String       @id @default(cuid())
  orderNumber     String       @unique  // 플랫폼 주문번호
  sellerId        String
  seller          User         @relation(fields: [sellerId], references: [id])
  salesChannel    SalesChannel // 판매 채널
  channelOrderNo  String?      // 원본 주문번호 (쿠팡 주문번호 등)
  status          OrderStatus  @default(PENDING)

  // 수취인 정보
  recipientName   String
  recipientPhone  String
  recipientAddr   String
  postalCode      String?

  // 배송 정보
  trackingNumber  String?      // 송장번호
  courier         String?      // 택배사
  shippedAt       DateTime?
  deliveredAt     DateTime?

  // 금액
  totalAmount     Decimal      // 주문 총액
  feeAmount       Decimal?     // 수수료 금액
  settlementAmt   Decimal?     // 정산 금액

  notes           String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  items           OrderItem[]
  claims          Claim[]
}

model OrderItem {
  id          String   @id @default(cuid())
  orderId     String
  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId   String
  product     Product  @relation(fields: [productId], references: [id])
  quantity    Int
  unitPrice   Decimal  // 주문 시점 단가
  totalPrice  Decimal  // quantity * unitPrice
  createdAt   DateTime @default(now())
}

// ============================================
// 발주 (공급사)
// ============================================

enum PurchaseOrderStatus {
  DRAFT          // 작성중
  SENT           // 발주 전달됨
  CONFIRMED      // 공급사 확인
  SHIPPED        // 공급사 발송
  RECEIVED       // 입고 완료
}

model PurchaseOrder {
  id            String              @id @default(cuid())
  poNumber      String              @unique  // 발주번호
  supplierId    String
  supplier      Supplier            @relation(fields: [supplierId], references: [id])
  status        PurchaseOrderStatus @default(DRAFT)
  totalAmount   Decimal?
  sentAt        DateTime?           // 발주 전달 시점
  receivedAt    DateTime?           // 입고 시점
  notes         String?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  items         PurchaseOrderItem[]
}

model PurchaseOrderItem {
  id              String        @id @default(cuid())
  purchaseOrderId String
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  productId       String
  productName     String        // 스냅샷
  quantity        Int
  unitPrice       Decimal
  trackingNumber  String?       // 공급사 송장번호 (개별 상품별)
  relatedOrderIds Json?         // 연관 주문 ID 목록
  createdAt       DateTime      @default(now())
}

// ============================================
// 클레임 (반품/환불/교환)
// ============================================

enum ClaimType {
  RETURN         // 반품
  REFUND         // 환불
  EXCHANGE       // 교환
}

enum ClaimStatus {
  REQUESTED      // 요청됨
  APPROVED       // 승인
  PROCESSING     // 처리중
  COMPLETED      // 완료
  REJECTED       // 거절
}

model Claim {
  id              String      @id @default(cuid())
  orderId         String
  order           Order       @relation(fields: [orderId], references: [id])
  type            ClaimType
  status          ClaimStatus @default(REQUESTED)
  reason          String      // 사유
  amount          Decimal?    // 환불/차감 금액
  newTrackingNo   String?     // 교환 시 새 송장번호
  adminNote       String?     // 관리자 메모
  processedAt     DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

// ============================================
// 정산
// ============================================

enum SettlementStatus {
  PENDING        // 정산 대기
  CONFIRMED      // 확인됨
  PAID           // 지급 완료
}

model Settlement {
  id            String           @id @default(cuid())
  sellerId      String
  periodStart   DateTime         // 정산 기간 시작
  periodEnd     DateTime         // 정산 기간 종료
  totalSales    Decimal          // 총 매출
  totalFee      Decimal          // 총 수수료
  claimDeduct   Decimal          @default(0) // 클레임 차감
  netAmount     Decimal          // 정산 금액 (매출 - 수수료 - 차감)
  feeRate       Decimal          // 적용된 수수료율
  status        SettlementStatus @default(PENDING)
  paidAt        DateTime?
  notes         String?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
}

// ============================================
// 문의/게시판
// ============================================

enum InquiryStatus {
  OPEN           // 미답변
  ANSWERED       // 답변 완료
  CLOSED         // 종료
}

model Inquiry {
  id          String        @id @default(cuid())
  userId      String
  user        User          @relation(fields: [userId], references: [id])
  title       String
  content     String
  answer      String?
  status      InquiryStatus @default(OPEN)
  answeredAt  DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

// ============================================
// 공지사항
// ============================================

model Notice {
  id          String   @id @default(cuid())
  title       String
  content     String
  isImportant Boolean  @default(false)
  authorId    String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ============================================
// 알림
// ============================================

enum NotificationType {
  ORDER_NEW          // 새 주문
  TRACKING_UPDATED   // 송장 입력됨
  PRICE_CHANGED      // 가격 변동
  STOCK_LOW          // 재고 부족
  CLAIM_NEW          // 새 클레임
  SETTLEMENT_READY   // 정산 완료
  NOTICE             // 공지사항
  SYSTEM             // 시스템 알림
}

model Notification {
  id          String           @id @default(cuid())
  userId      String
  user        User             @relation(fields: [userId], references: [id])
  type        NotificationType
  title       String
  message     String
  data        Json?            // 추가 데이터 (주문ID 등)
  isRead      Boolean          @default(false)
  createdAt   DateTime         @default(now())
}

// ============================================
// 활동 로그
// ============================================

model ActivityLog {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  action      String   // "product.create", "order.update" 등
  target      String?  // 대상 ID
  details     Json?    // 변경 내역
  ipAddress   String?
  createdAt   DateTime @default(now())
}

// ============================================
// AI 채팅
// ============================================

enum ChatRole {
  USER
  ASSISTANT
  SYSTEM
}

model ChatMessage {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  sessionId   String   // 채팅 세션 ID
  role        ChatRole
  content     String
  fileUrl     String?  // 첨부파일 URL
  fileName    String?
  toolCalls   Json?    // AI가 실행한 기능 기록
  createdAt   DateTime @default(now())
}
```

---

## 3. API 설계

### 3.1 인증 API

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | 셀러 회원가입 신청 (사업자등록증 첨부) | - |
| POST | `/api/auth/login` | 로그인 | - |
| POST | `/api/auth/logout` | 로그아웃 | All |
| GET | `/api/auth/me` | 내 정보 조회 | All |

### 3.2 관리자 API

#### 회원 관리
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/sellers` | 셀러 목록 (필터: status, grade) |
| PATCH | `/api/admin/sellers/:id/approve` | 셀러 승인 |
| PATCH | `/api/admin/sellers/:id/reject` | 셀러 반려 |
| PATCH | `/api/admin/sellers/:id/grade` | 등급 변경 |
| PATCH | `/api/admin/sellers/:id/fee` | 개별 수수료 설정 |
| GET | `/api/admin/grades` | 등급 목록 |
| POST | `/api/admin/grades` | 등급 생성 |
| PATCH | `/api/admin/grades/:id` | 등급 수정 |
| DELETE | `/api/admin/grades/:id` | 등급 삭제 |

#### 상품 관리
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/products` | 상품 목록 |
| POST | `/api/admin/products` | 상품 등록 |
| PATCH | `/api/admin/products/:id` | 상품 수정 |
| DELETE | `/api/admin/products/:id` | 상품 삭제 |
| POST | `/api/admin/products/upload` | 엑셀 대량 등록 |
| PATCH | `/api/admin/products/bulk-price` | 가격 일괄 변경 |
| POST | `/api/admin/products/:id/grade-price` | 등급별 가격 설정 |
| POST | `/api/admin/products/:id/seller-price` | 셀러별 가격 설정 |

#### 주문 관리
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/orders` | 전체 주문 목록 |
| GET | `/api/admin/orders/:id` | 주문 상세 |
| PATCH | `/api/admin/orders/:id/status` | 상태 변경 |
| PATCH | `/api/admin/orders/:id/tracking` | 송장 입력 |
| POST | `/api/admin/orders/upload-tracking` | 송장 엑셀 업로드 |
| GET | `/api/admin/orders/aggregate` | 공급사별 주문 취합 |

#### 발주 관리
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/purchase-orders` | 발주 목록 |
| POST | `/api/admin/purchase-orders` | 발주 생성 |
| GET | `/api/admin/purchase-orders/:id/download` | 발주서 엑셀 다운로드 |
| POST | `/api/admin/purchase-orders/:id/upload-invoice` | 송장 엑셀 업로드 |
| PATCH | `/api/admin/purchase-orders/:id/status` | 상태 변경 |

#### 공급사 관리
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/suppliers` | 공급사 목록 |
| POST | `/api/admin/suppliers` | 공급사 등록 |
| PATCH | `/api/admin/suppliers/:id` | 공급사 수정 |
| POST | `/api/admin/suppliers/:id/template` | 발주 양식 등록 |

#### 정산
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/settlements` | 정산 목록 |
| POST | `/api/admin/settlements/generate` | 정산 생성 (기간별) |
| PATCH | `/api/admin/settlements/:id/confirm` | 정산 확인 |
| GET | `/api/admin/settlements/download` | 정산 엑셀 다운로드 |
| GET | `/api/admin/stats/sales` | 매출 통계 (일별/주별/월별, 총매출/순매출) |
| GET | `/api/admin/stats/products` | 상품별 판매량/매출 Top N |
| GET | `/api/admin/stats/sellers` | 셀러별 주문수/매출/수수료 |
| GET | `/api/admin/stats/orders` | 주문 상태별 현황 |
| GET | `/api/admin/stats/overview` | 대시보드 요약 (오늘 주문수/매출/신규셀러 등) |

#### 클레임
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/claims` | 클레임 목록 |
| PATCH | `/api/admin/claims/:id/approve` | 승인 |
| PATCH | `/api/admin/claims/:id/reject` | 거절 |
| PATCH | `/api/admin/claims/:id/complete` | 처리 완료 |

#### C/S
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/inquiries` | 문의 목록 |
| POST | `/api/admin/inquiries/:id/answer` | 답변 등록 |

#### 공지/알림
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/notices` | 공지 등록 |
| GET | `/api/admin/logs` | 활동 로그 조회 |

### 3.3 셀러 API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/seller/products` | 상품 조회 (등급별 가격 반영) |
| GET | `/api/seller/products/download` | 상품 엑셀 다운로드 |
| GET | `/api/seller/orders` | 내 주문 목록 |
| POST | `/api/seller/orders` | 주문 수동 등록 |
| POST | `/api/seller/orders/upload` | 주문 엑셀 업로드 |
| GET | `/api/seller/orders/:id` | 주문 상세 (송장 확인) |
| GET | `/api/seller/orders/search` | 주문 검색 (송장번호/고객명) |
| GET | `/api/seller/orders/tracking/download` | 송장 파일 다운로드 (기간/상태 필터) |
| POST | `/api/seller/claims` | 클레임 요청 |
| GET | `/api/seller/claims` | 내 클레임 목록 |
| GET | `/api/seller/settlements` | 내 정산 내역 |
| POST | `/api/seller/inquiries` | 문의 작성 |
| GET | `/api/seller/inquiries` | 내 문의 목록 |
| GET | `/api/seller/stats/sales` | 내 매출 통계 (일별/주별/월별) |
| GET | `/api/seller/stats/products` | 내 상품별 판매량/금액 |
| GET | `/api/seller/stats/orders` | 내 주문 상태별 현황 |
| GET | `/api/seller/stats/overview` | 내 대시보드 요약 (오늘 주문수/매출 등) |
| GET | `/api/seller/notifications` | 알림 목록 |

### 3.4 AI 채팅 API

| Method | Endpoint | Description |
|--------|----------|-------------|
| WS | `/api/chat/ws` | WebSocket 연결 |
| POST | `/api/chat/message` | 메시지 전송 (REST fallback) |
| POST | `/api/chat/upload` | 파일 업로드 (채팅 내) |
| GET | `/api/chat/history` | 채팅 이력 |

### 3.5 택배 API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/delivery/request` | 택배 집하 요청 |
| GET | `/api/delivery/track/:trackingNo` | 배송 추적 |

---

## 4. 페이지 구조 (라우팅)

```
app/
├── (auth)/                        # 인증 레이아웃
│   ├── login/page.tsx             # 로그인
│   └── register/page.tsx          # 셀러 회원가입
│
├── (admin)/                       # 관리자 레이아웃 (사이드바 + 채팅)
│   ├── layout.tsx                 # 좌: 대시보드 / 우: AI채팅
│   ├── dashboard/page.tsx         # 대시보드 홈 (요약)
│   ├── products/
│   │   ├── page.tsx               # 상품 목록
│   │   ├── new/page.tsx           # 상품 등록
│   │   └── [id]/page.tsx          # 상품 상세/수정
│   ├── orders/
│   │   ├── page.tsx               # 주문 목록
│   │   └── [id]/page.tsx          # 주문 상세
│   ├── purchase-orders/
│   │   ├── page.tsx               # 발주 목록
│   │   └── [id]/page.tsx          # 발주 상세
│   ├── suppliers/
│   │   ├── page.tsx               # 공급사 목록
│   │   └── [id]/page.tsx          # 공급사 상세
│   ├── sellers/
│   │   ├── page.tsx               # 셀러 목록
│   │   └── [id]/page.tsx          # 셀러 상세
│   ├── settlements/page.tsx       # 정산 관리
│   ├── claims/page.tsx            # 클레임 관리
│   ├── inquiries/page.tsx         # 문의 관리
│   ├── notices/page.tsx           # 공지 관리
│   ├── stats/page.tsx             # 통계
│   └── settings/page.tsx          # 설정 (등급, 수수료)
│
├── (seller)/                      # 셀러 레이아웃 (사이드바 + 채팅)
│   ├── layout.tsx                 # 좌: 대시보드 / 우: AI채팅 (셀러 권한)
│   ├── dashboard/page.tsx         # 셀러 대시보드
│   ├── products/page.tsx          # 상품 조회/다운로드
│   ├── orders/
│   │   ├── page.tsx               # 내 주문 목록
│   │   └── upload/page.tsx        # 주문 업로드
│   ├── claims/page.tsx            # 클레임 관리
│   ├── settlements/page.tsx       # 정산 내역
│   └── inquiries/page.tsx         # 문의
│
└── api/                           # API Routes
    ├── auth/
    ├── admin/
    ├── seller/
    ├── chat/
    └── delivery/
```

---

## 5. AI 채팅 엔진 설계

### 5.1 아키텍처

```
사용자 입력 (텍스트 + 파일)
    ↓
┌───────────────────────────┐
│   Intent Recognition      │  ← Claude API
│   (의도 파악)              │
│                           │
│   "송장 엑셀 올려줘"       │
│   → intent: UPLOAD_TRACKING│
│   → entity: file          │
└─────────┬─────────────────┘
          ↓
┌───────────────────────────┐
│   Tool Router              │
│   (기능 매핑)              │
│                           │
│   UPLOAD_TRACKING          │
│   → trackingService       │
│     .uploadExcel(file)    │
└─────────┬─────────────────┘
          ↓
┌───────────────────────────┐
│   Execute & Response       │
│   (실행 + 결과 포맷팅)     │
│                           │
│   "12건 매칭, 3건 불일치"  │
│   + 파일 다운로드 링크     │
└───────────────────────────┘
```

### 5.2 AI Tool 정의 (Claude Function Calling) - 역할별 권한

```typescript
// ── 관리자 + 셀러 공통 도구 ──
const commonTools = [
  { name: "search_products", description: "상품 검색/조회" },
  { name: "download_product_list", description: "상품 리스트 엑셀 다운로드" },
  { name: "get_my_orders", description: "주문 조회 (본인/전체)" },
  { name: "upload_order_excel", description: "주문 엑셀 업로드 (AI 컬럼 자동 인식)" },
  { name: "track_delivery", description: "배송 추적" },
  { name: "get_notifications", description: "알림 조회" },
];

// ── 관리자 전용 도구 ──
const adminOnlyTools = [
  // 상품
  { name: "create_product", description: "상품 등록" },
  { name: "update_product_price", description: "상품 가격 변경" },
  { name: "bulk_update_price", description: "가격 일괄 변경" },
  // 주문/송장
  { name: "get_all_orders", description: "전체 주문 조회" },
  { name: "upload_tracking_excel", description: "송장 엑셀 업로드" },
  { name: "input_tracking_number", description: "송장번호 직접 입력" },
  // 발주
  { name: "create_purchase_order", description: "발주서 생성" },
  { name: "download_purchase_order", description: "발주서 엑셀 다운로드" },
  // 정산/통계
  { name: "get_all_settlements", description: "전체 정산 조회" },
  { name: "get_stats", description: "전체 통계 조회 (매출/판매량/셀러별/상품별)" },
  // 클레임
  { name: "process_claim", description: "클레임 승인/처리/거절" },
  // 알림/공지
  { name: "send_notice", description: "전체 공지 발송" },
  // 회원
  { name: "manage_sellers", description: "셀러 관리 (승인/등급)" },
];

// ── 셀러 전용 도구 ──
const sellerOnlyTools = [
  { name: "get_my_settlements", description: "내 정산 내역 조회" },
  { name: "create_claim", description: "반품/환불/교환 요청" },
  { name: "get_my_claims", description: "내 클레임 조회" },
  { name: "create_inquiry", description: "문의 작성" },
  { name: "download_my_tracking", description: "내 주문 송장 파일 다운로드 (기간/상태 필터)" },
  { name: "search_my_order", description: "송장번호 또는 고객명으로 내 주문 검색" },
  { name: "get_my_stats", description: "내 통계 조회 (매출/판매량/주문현황)" },
];

// 역할에 따라 도구 조합
function getToolsForRole(role: UserRole) {
  if (role === "SUPER_ADMIN" || role === "ADMIN") {
    return [...commonTools, ...adminOnlyTools];
  }
  return [...commonTools, ...sellerOnlyTools];
}
```

### 5.3 AI 엑셀 자동 컬럼 인식

```
엑셀 업로드 시 처리 플로우:
    ↓
1. 엑셀 파싱 → 헤더 행 + 샘플 데이터 추출
    ↓
2. Claude API에 전달:
   "이 엑셀의 컬럼을 분석해줘:
    [주문번호, 수취인명, 연락처, 주소, 상품명, 수량, ...]
    샘플: [ORD-001, 홍길동, 010-1234-5678, ...]"
    ↓
3. AI가 매핑 추론:
   주문번호 → orderNumber
   수취인명 → recipientName
   연락처 → recipientPhone
   ...
    ↓
4. 사용자 확인: "이렇게 매핑했습니다. 맞나요?"
    ↓
5. 확인 후 DB에 등록
    ↓
6. 매핑 패턴 저장 (다음에 같은 양식이면 자동 적용)
```

### 5.4 자동 알림 플로우

```
이벤트 발생 (DB Trigger / API Hook)
    ↓
Notification Service
    ↓
  ┌─────────────┬──────────────┬───────────────┐
  │ 플랫폼 내    │ AI 채팅 푸시  │ 외부 알림     │
  │ Notification │ WebSocket    │ 카카오 알림톡  │
  └─────────────┴──────────────┴───────────────┘
```

---

## 6. 구현 순서 (Implementation Order)

### Step 1: 프로젝트 초기 세팅
- [ ] Next.js 15 프로젝트 생성 (TypeScript, App Router)
- [ ] Tailwind CSS + shadcn/ui 설치
- [ ] Prisma 설치 + PostgreSQL(Supabase) 연결
- [ ] DB 스키마 마이그레이션
- [ ] NextAuth.js 설정 (Credentials Provider)
- [ ] 기본 레이아웃 (관리자/셀러 분리)

### Step 2: 인증 & 회원 관리
- [ ] 로그인/로그아웃 페이지 + API
- [ ] 셀러 회원가입 신청 + 관리자 승인
- [ ] 등급 CRUD + 수수료 설정
- [ ] 역할 기반 접근 제어 (미들웨어)

### Step 3: 상품 관리
- [ ] 상품 CRUD API + 페이지
- [ ] 엑셀 업로드 (대량 등록)
- [ ] 엑셀 다운로드 (셀러용)
- [ ] 등급별 가격, 셀러별 가격 설정
- [ ] 재고 관리 + 부족 알림

### Step 4: 주문 관리
- [ ] 셀러 주문 업로드 (엑셀/수동)
- [ ] 관리자 주문 목록/상세
- [ ] 주문 상태 변경
- [ ] 송장 입력 (수동/엑셀)

### Step 5: 발주 관리
- [ ] 공급사 CRUD
- [ ] 발주 양식 템플릿 관리
- [ ] 주문 취합 → 발주서 생성
- [ ] 발주서 엑셀 다운로드
- [ ] 공급사 송장 엑셀 업로드 → 주문 매칭

### Step 6: 정산 & 클레임
- [ ] 클레임 요청/처리
- [ ] 정산 생성 (기간별)
- [ ] 수수료 계산 + 클레임 차감
- [ ] 통계 대시보드

### Step 7: AI 채팅
- [ ] 채팅 UI (대시보드 우측 패널)
- [ ] WebSocket 서버
- [ ] Claude API 연동 + Tool Calling
- [ ] 파일 업/다운로드 in 채팅
- [ ] 자동 알림 연동

### Step 8: 고급 기능 & 마무리
- [ ] 택배사 API 연동
- [ ] AI 엑셀 자동 매핑
- [ ] 이상 탐지
- [ ] 카카오 알림톡
- [ ] 보안 점검 + 배포

---

## 7. 주요 설계 결정

### 7.1 가격 시스템
- 기본가(basePrice) → 등급별 가격(ProductPrice) → 셀러별 가격(SellerPrice) 우선순위
- 셀러가 조회 시: SellerPrice > ProductPrice(등급) > basePrice 순으로 적용

### 7.2 엑셀 처리
- 업로드: xlsx 파싱 → 데이터 검증 → DB 저장
- 다운로드: DB 조회 → xlsx 생성 → 파일 응답
- AI 매핑: Claude API로 컬럼 추론 → 사용자 확인 → 매핑 저장

### 7.3 송장 매칭 로직
- 공급사 엑셀: 주문번호 or 상품코드+수취인 조합으로 매칭
- 매칭 실패 시 관리자에게 수동 매칭 요청

### 7.4 실시간 통신
- AI 채팅: WebSocket (양방향)
- 알림: WebSocket push + DB 저장 (오프라인 시 다음 접속 때 표시)
