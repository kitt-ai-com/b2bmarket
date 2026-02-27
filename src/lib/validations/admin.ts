import { z } from "zod";

export const gradeCreateSchema = z.object({
  name: z.string().min(1, "등급 이름을 입력해주세요"),
  level: z.number().int().min(1, "레벨은 1 이상이어야 합니다"),
  feeRate: z.number().min(0, "수수료율은 0 이상이어야 합니다").max(100, "수수료율은 100 이하여야 합니다"),
  description: z.string().optional(),
});

export const gradeUpdateSchema = gradeCreateSchema.partial();

export const sellerUpdateSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"]).optional(),
  gradeId: z.string().optional(),
  customFeeRate: z.number().min(0).max(100).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "변경할 항목을 선택해주세요" });

export type GradeCreateInput = z.infer<typeof gradeCreateSchema>;
export type GradeUpdateInput = z.infer<typeof gradeUpdateSchema>;
export type SellerUpdateInput = z.infer<typeof sellerUpdateSchema>;
