export const runtime = "nodejs";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = registerSchema.parse(body);

    // 이메일 중복 체크
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: { code: "DUPLICATE_EMAIL", message: "이미 등록된 이메일입니다" } },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(validated.password, 12);

    if (validated.registerType === "ADMIN") {
      return handleAdminRegister(validated, hashedPassword);
    } else {
      return handleSellerRegister(validated, hashedPassword);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해주세요", details: error } },
        { status: 400 }
      );
    }
    console.error("Register error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}

async function handleAdminRegister(
  validated: { email: string; password: string; name: string; phone?: string; businessName: string; slug: string },
  hashedPassword: string
) {
  // slug 중복 체크
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: validated.slug },
  });

  if (existingTenant) {
    return NextResponse.json(
      { error: { code: "DUPLICATE_SLUG", message: "이미 사용 중인 URL입니다. 다른 URL을 입력해주세요." } },
      { status: 409 }
    );
  }

  // FREE 플랜 조회
  const freePlan = await prisma.plan.findFirst({
    where: { name: "FREE" },
  });

  if (!freePlan) {
    return NextResponse.json(
      { error: { code: "PLAN_NOT_FOUND", message: "기본 플랜을 찾을 수 없습니다. 관리자에게 문의해주세요." } },
      { status: 500 }
    );
  }

  // 트랜잭션으로 User + Tenant + SellerGrade 생성
  const result = await prisma.$transaction(async (tx) => {
    // 1. User 생성 (ADMIN, 즉시 ACTIVE)
    const user = await tx.user.create({
      data: {
        email: validated.email,
        password: hashedPassword,
        name: validated.name,
        phone: validated.phone,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

    // 2. Tenant 생성
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    const tenant = await tx.tenant.create({
      data: {
        name: validated.businessName,
        slug: validated.slug,
        ownerId: user.id,
        planId: freePlan.id,
        trialEndsAt,
      },
    });

    // 3. User에 tenantId 연결
    await tx.user.update({
      where: { id: user.id },
      data: { tenantId: tenant.id },
    });

    // 4. 기본 SellerGrade 생성
    await tx.sellerGrade.create({
      data: {
        name: "Basic",
        level: 1,
        feeRate: 10.0,
        description: "기본 등급",
        tenantId: tenant.id,
      },
    });

    return { id: user.id, email: user.email, name: user.name, status: user.status };
  });

  return NextResponse.json(
    { data: result, message: "업체 등록이 완료되었습니다. 바로 이용 가능합니다." },
    { status: 201 }
  );
}

async function handleSellerRegister(
  validated: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    businessName: string;
    businessNumber: string;
    bizLicenseUrl: string;
    inviteCode: string;
  },
  hashedPassword: string
) {
  // 초대 코드 검증 (대소문자 구분 없이)
  const inviteLink = await prisma.inviteLink.findFirst({
    where: { code: validated.inviteCode.toLowerCase() },
  });

  if (!inviteLink) {
    return NextResponse.json(
      { error: { code: "INVALID_INVITE", message: "유효하지 않은 초대 코드입니다." } },
      { status: 400 }
    );
  }

  if (!inviteLink.isActive) {
    return NextResponse.json(
      { error: { code: "INVITE_INACTIVE", message: "비활성화된 초대 코드입니다." } },
      { status: 400 }
    );
  }

  if (inviteLink.expiresAt && inviteLink.expiresAt < new Date()) {
    return NextResponse.json(
      { error: { code: "INVITE_EXPIRED", message: "만료된 초대 코드입니다." } },
      { status: 400 }
    );
  }

  if (inviteLink.maxUses > 0 && inviteLink.currentUses >= inviteLink.maxUses) {
    return NextResponse.json(
      { error: { code: "INVITE_EXHAUSTED", message: "초대 코드 사용 횟수가 초과되었습니다." } },
      { status: 400 }
    );
  }

  const tenantId = inviteLink.tenantId;

  // 해당 테넌트의 기본 등급 조회 (없으면 생성)
  let defaultGrade = await prisma.sellerGrade.findFirst({
    where: { tenantId, name: "Basic" },
  });

  if (!defaultGrade) {
    defaultGrade = await prisma.sellerGrade.create({
      data: {
        name: "Basic",
        level: 1,
        feeRate: 10.0,
        description: "기본 등급",
        tenantId,
      },
    });
  }

  // 트랜잭션으로 User + SellerProfile 생성 + InviteLink 사용 횟수 증가
  const result = await prisma.$transaction(async (tx) => {
    // 1. User 생성 (SELLER, PENDING)
    const user = await tx.user.create({
      data: {
        email: validated.email,
        password: hashedPassword,
        name: validated.name,
        phone: validated.phone,
        role: "SELLER",
        status: "PENDING",
        tenantId,
        sellerProfile: {
          create: {
            businessName: validated.businessName,
            businessNumber: validated.businessNumber,
            bizLicenseUrl: validated.bizLicenseUrl,
            gradeId: defaultGrade!.id,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
      },
    });

    // 2. InviteLink 사용 횟수 증가
    await tx.inviteLink.update({
      where: { id: inviteLink.id },
      data: { currentUses: { increment: 1 } },
    });

    return user;
  });

  return NextResponse.json(
    { data: result, message: "회원가입 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다." },
    { status: 201 }
  );
}
