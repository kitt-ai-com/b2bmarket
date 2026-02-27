import { z } from "zod";

export const settlementGenerateSchema = z.object({
  sellerId: z.string().min(1, "셀러를 선택해주세요"),
  periodStart: z.string().min(1, "시작일을 입력해주세요"),
  periodEnd: z.string().min(1, "종료일을 입력해주세요"),
});

export const settlementUpdateSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "PAID"]),
  notes: z.string().optional(),
});
