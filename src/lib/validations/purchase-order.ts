import { z } from "zod";

export const purchaseOrderCreateSchema = z.object({
  supplierId: z.string().min(1, "공급사를 선택해주세요"),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        productName: z.string().min(1),
        quantity: z.number().int().positive("수량은 1 이상이어야 합니다"),
        unitPrice: z.number().nonnegative("단가는 0 이상이어야 합니다"),
      })
    )
    .min(1, "상품을 1개 이상 추가해주세요"),
});

export const purchaseOrderStatusSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "CONFIRMED", "SHIPPED", "RECEIVED"]),
});

export type PurchaseOrderCreateInput = z.infer<typeof purchaseOrderCreateSchema>;
export type PurchaseOrderStatusInput = z.infer<typeof purchaseOrderStatusSchema>;
