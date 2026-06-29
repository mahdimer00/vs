import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { asyncHandler } from "../../utils/async-handler.js";
import { AppError } from "../../utils/app-error.js";
import { CouponClaimModel } from "../../models/coupon-claim.model.js";
import { PromoCodeModel } from "../../models/orders.model.js";
import { WebsiteSettingModel } from "../../models/catalog.model.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { permissionMiddleware } from "../../middleware/permission.middleware.js";

const router = Router();

function generateCouponCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return `VS-${code}`;
}

// Public — get campaign settings (for the landing page)
router.get("/coupon-campaign/settings", asyncHandler(async (_req, res) => {
  const settings = await WebsiteSettingModel.findOne()
    .select("storeName couponCampaignEnabled couponDiscountType couponDiscountValue couponExpiryDays couponMinOrder couponConditionText couponSocialLinks")
    .lean();
  if (!settings?.couponCampaignEnabled) {
    return res.json({ enabled: false });
  }
  return res.json({ enabled: true, settings });
}));

// Public — claim a coupon
router.post("/coupon-campaign/claim", asyncHandler(async (req, res) => {
  const input = z.object({
    phone: z.string().regex(/^(05|06|07)\d{8}$/, "رقم الهاتف غير صحيح"),
    source: z.string().max(50).optional(),
  }).parse(req.body);

  const settings = await WebsiteSettingModel.findOne().lean();
  if (!settings?.couponCampaignEnabled) {
    throw new AppError("الحملة غير متاحة حالياً", 400);
  }

  // Check if phone already claimed
  const existing = await CouponClaimModel.findOne({ phone: input.phone });
  if (existing) {
    // Return their existing code instead of blocking
    return res.json({
      success: true,
      code: existing.code,
      alreadyClaimed: true,
      discountType: settings.couponDiscountType,
      discountValue: settings.couponDiscountValue,
    });
  }

  // Generate unique code
  let code = generateCouponCode();
  let attempts = 0;
  while (await PromoCodeModel.exists({ code }) && attempts < 20) {
    code = generateCouponCode();
    attempts++;
  }

  // Create real promo code in DB
  const expiresAt = settings.couponExpiryDays
    ? new Date(Date.now() + settings.couponExpiryDays * 24 * 60 * 60 * 1000)
    : undefined;

  const promo = await PromoCodeModel.create({
    code,
    type: settings.couponDiscountType as "PERCENTAGE" | "FIXED",
    value: settings.couponDiscountValue ?? 10,
    minimumOrderAmount: settings.couponMinOrder ?? 0,
    expiresAt,
    usageLimit: 1,
    usedCount: 0,
    oneUsePerPhone: true,
    isActive: true,
    productRestrictions: [],
    categoryRestrictions: [],
  });

  await CouponClaimModel.create({
    phone: input.phone,
    code,
    promoCodeId: promo._id,
    source: input.source ?? "direct",
  });

  return res.json({
    success: true,
    code,
    alreadyClaimed: false,
    discountType: settings.couponDiscountType,
    discountValue: settings.couponDiscountValue,
    expiresAt: expiresAt?.toISOString(),
  });
}));

// Admin — list all claims
router.get("/admin/coupon-claims", authMiddleware, permissionMiddleware("settings"), asyncHandler(async (_req, res) => {
  const claims = await CouponClaimModel.find().sort({ createdAt: -1 }).limit(200).lean();
  const total = await CouponClaimModel.countDocuments();
  const used = await CouponClaimModel.countDocuments({ usedAt: { $ne: null } });
  return res.json({ claims, total, used });
}));

export default router;
