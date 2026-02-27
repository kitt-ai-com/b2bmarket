import { z } from "zod";

export const depositTransactionSchema = z.object({
  type: z.enum(["CHARGE", "DEDUCT", "REFUND"]),
  amount: z.number().positive("금액은 0보다 커야 합니다"),
  description: z.string().optional(),
});

export type DepositTransactionInput = z.infer<typeof depositTransactionSchema>;

export const depositRequestSchema = z.object({
  amount: z.number().positive("금액은 0보다 커야 합니다"),
  depositorName: z.string().min(1, "입금자명을 입력해주세요"),
});

export type DepositRequestInput = z.infer<typeof depositRequestSchema>;
