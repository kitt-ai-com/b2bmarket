export const runtime = "nodejs";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = registerSchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: { code: "DUPLICATE_EMAIL", message: "이미 등록된 이메일입니다" } },
        { status: 409 }
      );
    }

    // 기본 등급 조회 (없으면 생성)
    let defaultGrade = await prisma.sellerGrade.findFirst({
      where: { name: "Basic" },
    });

    if (!defaultGrade) {
      defaultGrade = await prisma.sellerGrade.create({
        data: {
          name: "Basic",
          level: 1,
          feeRate: 10.0,
          description: "기본 등급",
        },
      });
    }

    const hashedPassword = await bcrypt.hash(validated.password, 12);

    const user = await prisma.user.create({
      data: {
        email: validated.email,
        password: hashedPassword,
        name: validated.name,
        phone: validated.phone,
        role: "SELLER",
        status: "PENDING",
        sellerProfile: {
          create: {
            businessName: validated.businessName,
            businessNumber: validated.businessNumber,
            bizLicenseUrl: validated.bizLicenseUrl,
            gradeId: defaultGrade.id,
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

    return NextResponse.json(
      { data: user, message: "회원가입 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다." },
      { status: 201 }
    );
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
