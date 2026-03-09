import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const adminRegisterSchema = z.object({
  registerType: z.literal("ADMIN"),
  email: z.string().email("유효한 이메일을 입력해주세요"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
  name: z.string().min(2, "이름은 2자 이상이어야 합니다"),
  phone: z.string().optional(),
  businessName: z.string().min(1, "업체명을 입력해주세요"),
  slug: z
    .string()
    .min(3, "URL 슬러그는 3자 이상이어야 합니다")
    .max(40, "URL 슬러그는 40자 이하여야 합니다")
    .regex(slugRegex, "영문 소문자, 숫자, 하이픈만 사용 가능합니다"),
});

export const sellerRegisterSchema = z.object({
  registerType: z.literal("SELLER"),
  email: z.string().email("유효한 이메일을 입력해주세요"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
  name: z.string().min(2, "이름은 2자 이상이어야 합니다"),
  phone: z.string().optional(),
  businessName: z.string().min(1, "상호명을 입력해주세요"),
  businessNumber: z.string().min(10, "사업자번호를 입력해주세요"),
  bizLicenseUrl: z.string().min(1, "사업자등록증을 업로드해주세요"),
  inviteCode: z.string().min(1, "초대 코드를 입력해주세요"),
});

export const registerSchema = z.discriminatedUnion("registerType", [
  adminRegisterSchema,
  sellerRegisterSchema,
]);

export type AdminRegisterInput = z.infer<typeof adminRegisterSchema>;
export type SellerRegisterInput = z.infer<typeof sellerRegisterSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("유효한 이메일을 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

export type LoginInput = z.infer<typeof loginSchema>;
