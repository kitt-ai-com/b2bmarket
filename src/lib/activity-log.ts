import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * 활동 로그 기록 유틸리티
 */
export async function logActivity(params: {
  action: string;
  target?: string;
  details?: Record<string, unknown>;
  userId?: string;
}) {
  let userId = params.userId;

  if (!userId) {
    try {
      const session = await auth();
      userId = session?.user?.id;
    } catch {
      // auth 실패 시 무시
    }
  }

  if (!userId) return null;

  return prisma.activityLog.create({
    data: {
      userId,
      action: params.action,
      target: params.target,
      details: params.details,
    },
  });
}
