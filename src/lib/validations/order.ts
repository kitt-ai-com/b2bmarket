import { z } from "zod";

export const orderCreateSchema = z.object({
  recipientName: z.string().min(1, "수령자 이름을 입력해주세요"),
  recipientPhone: z.string().min(1, "수령자 전화번호를 입력해주세요"),
  recipientAddr: z.string().min(1, "수령자 주소를 입력해주세요"),
  postalCode: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive("수량은 1 이상이어야 합니다"),
      })
    )
    .min(1, "상품을 1개 이상 선택해주세요"),
});

export const orderStatusUpdateSchema = z.object({
  status: z.enum(["PENDING", "PREPARING", "SHIPPING", "DELIVERED", "CANCELLED", "RETURNED", "EXCHANGED"]),
  courier: z.string().optional(),
  trackingNumber: z.string().optional(),
});

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;
