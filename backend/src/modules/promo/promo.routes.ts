import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { roleMiddleware } from "../../middleware/role.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { PromoCodeModel } from "../../models/orders.model.js";
import { validatePromoCode } from "../../utils/order.js";

const router = Router();

const promoSchema = z.object({
  code: z.string(),
  type: z.enum(["PERCENTAGE", "FIXED", "FREE_SHIPPING"]),
  value: z.number(),
  affiliate: z.string().optional(),
  expiresAt: z.string().optional(),
  usageLimit: z.number().optional(),
  minimumOrderAmount: z.number().optional(),
  productRestrictions: z.array(z.string()).default([]),
  categoryRestrictions: z.array(z.string()).default([]),
  oneUsePerPhone: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

router.post("/promo/validate", asyncHandler(async (req, res) => {
  const input = z.object({
    code: z.string(),
    phone: z.string().default(""),
    subtotal: z.number(),
    productIds: z.array(z.string()).default([]),
    categoryIds: z.array(z.string()).default([]),
    shippingFee: z.number().default(0),
  }).parse(req.body);
  const { promo, discount } = await validatePromoCode(input);
  return res.json({
    valid: true,
    discount,
    affiliateId: promo.affiliate ? String(promo.affiliate) : undefined,
    promo: { code: promo.code },
    finalTotal: Math.max(0, input.subtotal + input.shippingFee - discount),
  });
}));

router.get("/admin/promo-codes", authMiddleware, roleMiddleware(["SUPER_ADMIN", "ADMIN"]), asyncHandler(async (_req, res) => {
  return res.json(await PromoCodeModel.find().lean());
}));
router.post("/admin/promo-codes", authMiddleware, roleMiddleware(["SUPER_ADMIN", "ADMIN"]), asyncHandler(async (req, res) => {
  const input = promoSchema.parse(req.body);
  return res.status(201).json(await PromoCodeModel.create({ ...input, code: input.code.toUpperCase(), expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined }));
}));
router.patch("/admin/promo-codes/:id", authMiddleware, roleMiddleware(["SUPER_ADMIN", "ADMIN"]), asyncHandler(async (req, res) => {
  const input = promoSchema.partial().parse(req.body);
  const promoCode = await PromoCodeModel.findByIdAndUpdate(req.params.id, input, { new: true });
  if (!promoCode) {
    return res.status(404).json({ message: "Promo code not found" });
  }
  return res.json(promoCode);
}));
router.delete("/admin/promo-codes/:id", authMiddleware, roleMiddleware(["SUPER_ADMIN", "ADMIN"]), asyncHandler(async (req, res) => {
  await PromoCodeModel.findByIdAndDelete(req.params.id);
  return res.json({ success: true });
}));

export default router;
