import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function requireAdmin() {
  const session = await auth();

  if (!session?.user) {
    return { error: NextResponse.json({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다" } }, { status: 401 }), session: null };
  }

  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return { error: NextResponse.json({ error: { code: "FORBIDDEN", message: "관리자 권한이 필요합니다" } }, { status: 403 }), session: null };
  }

  return { error: null, session };
}

export async function requireSuperAdmin() {
  const session = await auth();

  if (!session?.user) {
    return { error: NextResponse.json({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다" } }, { status: 401 }), session: null };
  }

  const role = (session.user as any).role;
  if (role !== "SUPER_ADMIN") {
    return { error: NextResponse.json({ error: { code: "FORBIDDEN", message: "슈퍼 관리자 권한이 필요합니다" } }, { status: 403 }), session: null };
  }

  return { error: null, session };
}
