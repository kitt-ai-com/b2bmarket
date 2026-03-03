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

// PENDING 상태 직접 수정용
export const orderDirectEditSchema = z.object({
  recipientName: z.string().min(1).optional(),
  recipientPhone: z.string().min(1).optional(),
  recipientAddr: z.string().min(1).optional(),
  postalCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1)
    .optional(),
});

// PREPARING 상태 수정 요청용
export const orderModRequestSchema = z.object({
  changes: z.object({
    recipientName: z.string().min(1).optional(),
    recipientPhone: z.string().min(1).optional(),
    recipientAddr: z.string().min(1).optional(),
    postalCode: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          quantity: z.number().int().positive(),
        })
      )
      .min(1)
      .optional(),
  }),
  reason: z.string().min(1, "수정 사유를 입력해주세요"),
});

// 관리자 수정 요청 응답용
export const orderModResponseSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  adminNote: z.string().optional(),
});

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;
export type OrderDirectEditInput = z.infer<typeof orderDirectEditSchema>;
export type OrderModRequestInput = z.infer<typeof orderModRequestSchema>;
export type OrderModResponseInput = z.infer<typeof orderModResponseSchema>;
