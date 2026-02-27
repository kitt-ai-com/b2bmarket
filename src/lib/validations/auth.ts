import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("유효한 이메일을 입력해주세요"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
  name: z.string().min(2, "이름은 2자 이상이어야 합니다"),
  phone: z.string().optional(),
  businessName: z.string().min(1, "상호명을 입력해주세요"),
  businessNumber: z.string().min(10, "사업자번호를 입력해주세요"),
  bizLicenseUrl: z.string().min(1, "사업자등록증을 업로드해주세요"),
});

export const loginSchema = z.object({
  email: z.string().email("유효한 이메일을 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
