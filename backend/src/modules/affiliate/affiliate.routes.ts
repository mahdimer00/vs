import { Router } from "express";
import { z } from "zod";
import { authMiddleware, type AuthedRequest } from "../../middleware/auth.middleware.js";
import { roleMiddleware } from "../../middleware/role.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AffiliateClickModel, AffiliateModel, CommissionModel, CouponRequestModel, WithdrawalRequestModel } from "../../models/affiliate.model.js";
import { OrderModel, PromoCodeModel } from "../../models/orders.model.js";
import { WebsiteSettingModel } from "../../models/catalog.model.js";
import { env } from "../../config/env.js";
import { sendTelegramMessage } from "../../utils/telegram.js";

const router = Router();

router.post("/affiliate/track-click/:referralCode", asyncHandler(async (req, res) => {
  const referralCode = String(req.params.referralCode).toUpperCase();
  const affiliate = await AffiliateModel.findOne({ referralCode });
  if (!affiliate) {
    return res.status(404).json({ message: "Affiliate not found" });
  }

  await AffiliateClickModel.create({
    affiliate: affiliate._id,
    referralCode: affiliate.referralCode,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  return res.json({ success: true });
}));

router.get("/affiliate/dashboard", authMiddleware, roleMiddleware(["AFFILIATE"]), asyncHandler(async (req: AuthedRequest, res) => {
  const affiliate = await AffiliateModel.findById(req.user?.sub);
  if (!affiliate) {
    return res.status(404).json({ message: "Affiliate not found" });
  }

  const clicksCount = await AffiliateClickModel.countDocuments({ affiliate: affiliate._id });
  const ordersCount = await OrderModel.countDocuments({ affiliate: affiliate._id });
  const promoCodes = await PromoCodeModel.find({ affiliate: affiliate._id }).lean();
  const teamCount = await AffiliateModel.countDocuments({ referredBy: affiliate._id });
  const settings = await WebsiteSettingModel.findOne();
  const levels = settings?.affiliateLevels as Record<string, { commissionRate: number; referralBonus: number }> | undefined;

  return res.json({
    affiliate,
    clicksCount,
    ordersCount,
    teamCount,
    referralBonusAmount: levels?.[affiliate.level]?.referralBonus ?? 0,
    referralLink: `${env.FRONTEND_URL}?ref=${affiliate.referralCode}`,
    inviteLink: `${env.FRONTEND_URL}/affiliate/register?ref=${affiliate.referralCode}`,
    promoCodes,
  });
}));

router.get("/affiliate/orders", authMiddleware, roleMiddleware(["AFFILIATE"]), asyncHandler(async (req: AuthedRequest, res) => {
  return res.json(await OrderModel.find({ affiliate: req.user?.sub }).populate("customer.wilaya").lean());
}));

router.get("/affiliate/commissions", authMiddleware, roleMiddleware(["AFFILIATE"]), asyncHandler(async (req: AuthedRequest, res) => {
  return res.json(await CommissionModel.find({ affiliate: req.user?.sub }).populate("order").lean());
}));

router.get("/affiliate/referral-link", authMiddleware, roleMiddleware(["AFFILIATE"]), asyncHandler(async (req: AuthedRequest, res) => {
  const affiliate = await AffiliateModel.findById(req.user?.sub);
  if (!affiliate) {
    return res.status(404).json({ message: "Affiliate not found" });
  }
  const promoCodes = await PromoCodeModel.find({ affiliate: affiliate._id }).lean();
  return res.json({
    referralLink: `${env.FRONTEND_URL}?ref=${affiliate.referralCode}`,
    promoCodes,
  });
}));

router.post("/affiliate/withdrawals", authMiddleware, roleMiddleware(["AFFILIATE"]), asyncHandler(async (req: AuthedRequest, res) => {
  const input = z
    .object({
      amount: z.number().min(500, "Minimum withdrawal amount is 500 DA"),
      method: z.enum(["RIP", "CARDLESS_ID_PIN"]),
      accountInfo: z.string().min(3),
    })
    .parse(req.body);
  const affiliate = await AffiliateModel.findById(req.user?.sub);
  if (!affiliate) {
    return res.status(404).json({ message: "Affiliate not found" });
  }
  if (input.amount > affiliate.balanceApproved) {
    return res.status(400).json({ message: "Insufficient approved balance" });
  }
  await WithdrawalRequestModel.create({ affiliate: affiliate._id, ...input });

  void sendTelegramMessage(
    `💰 <b>New withdrawal request</b>\n` +
      `Affiliate: ${affiliate.name}\n` +
      `Amount: ${input.amount} DZD\n` +
      `Method: ${input.method}`,
  );

  return res.json({ success: true });
}));

router.get("/affiliate/withdrawals", authMiddleware, roleMiddleware(["AFFILIATE"]), asyncHandler(async (req: AuthedRequest, res) => {
  return res.json(await WithdrawalRequestModel.find({ affiliate: req.user?.sub }).sort({ createdAt: -1 }).lean());
}));

router.get("/affiliate/team", authMiddleware, roleMiddleware(["AFFILIATE"]), asyncHandler(async (req: AuthedRequest, res) => {
  const team = await AffiliateModel.find({ referredBy: req.user?.sub })
    .select("name email status level createdAt referralCode")
    .sort({ createdAt: -1 })
    .lean();
  return res.json(team);
}));

router.post("/affiliate/coupon-requests", authMiddleware, roleMiddleware(["AFFILIATE"]), asyncHandler(async (req: AuthedRequest, res) => {
  const input = z
    .object({
      type: z.enum(["PERCENTAGE", "FIXED", "FREE_SHIPPING"]),
      value: z.number().min(0),
      desiredCode: z.string().trim().min(3).max(20).optional(),
      reason: z.string().trim().min(3).max(500),
    })
    .parse(req.body);

  const affiliate = await AffiliateModel.findById(req.user?.sub);
  if (!affiliate) {
    return res.status(404).json({ message: "Affiliate not found" });
  }

  const couponRequest = await CouponRequestModel.create({
    affiliate: affiliate._id,
    ...input,
  });

  void sendTelegramMessage(
    `🎫 <b>New coupon request</b>\n` +
      `Affiliate: ${affiliate.name}\n` +
      `Type: ${input.type}\n` +
      `Value: ${input.value}\n` +
      (input.desiredCode ? `Desired code: ${input.desiredCode}\n` : "") +
      `Reason: ${input.reason}`,
  );

  return res.status(201).json(couponRequest);
}));

router.get("/affiliate/coupon-requests", authMiddleware, roleMiddleware(["AFFILIATE"]), asyncHandler(async (req: AuthedRequest, res) => {
  return res.json(await CouponRequestModel.find({ affiliate: req.user?.sub }).populate("promoCode").sort({ createdAt: -1 }).lean());
}));

export default router;
