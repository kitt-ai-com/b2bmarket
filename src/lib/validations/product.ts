import { z } from "zod";

export const categoryCreateSchema = z.object({
  name: z.string().min(1, "카테고리 이름을 입력해주세요"),
  parentId: z.string().nullable().optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const productCreateSchema = z.object({
  name: z.string().min(1, "상품명을 입력해주세요"),
  code: z.string().min(1, "상품 코드를 입력해주세요"),
  description: z.string().optional(),
  basePrice: z.number().min(0, "기본 가격은 0 이상이어야 합니다"),
  costPrice: z.number().min(0).optional(),
  unit: z.string().default("EA"),
  stock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(10),
  shippingFee: z.number().min(0).default(0),
  status: z.enum(["ACTIVE", "OUT_OF_STOCK", "DISCONTINUED"]).default("ACTIVE"),
  source: z.enum(["SELF", "SUPPLIER"]),
  categoryId: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  images: z.array(z.string()).optional(),
  gradePrices: z
    .array(
      z.object({
        gradeId: z.string(),
        price: z.number().min(0),
      })
    )
    .optional(),
});

export const productUpdateSchema = productCreateSchema.partial().omit({ code: true });

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
