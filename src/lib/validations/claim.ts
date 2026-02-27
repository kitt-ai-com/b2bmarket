import { z } from "zod";

export const claimCreateSchema = z.object({
  orderId: z.string().min(1, "주문을 선택해주세요"),
  type: z.enum(["RETURN", "REFUND", "EXCHANGE"]),
  reason: z.string().min(1, "사유를 입력해주세요"),
  amount: z.number().positive().optional(),
});

export const claimUpdateSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "PROCESSING", "COMPLETED"]),
  adminNote: z.string().optional(),
  amount: z.number().optional(),
  newTrackingNo: z.string().optional(),
});

export type ClaimCreateInput = z.infer<typeof claimCreateSchema>;
export type ClaimUpdateInput = z.infer<typeof claimUpdateSchema>;
