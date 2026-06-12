import { Router } from "express";
import { z } from "zod";
import { authMiddleware, type AuthedRequest } from "../../middleware/auth.middleware.js";
import { roleMiddleware } from "../../middleware/role.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AffiliateClickModel, AffiliateModel, CommissionModel, WithdrawalRequestModel } from "../../models/affiliate.model.js";
import { OrderModel } from "../../models/orders.model.js";
import { env } from "../../config/env.js";

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
  return res.json({
    affiliate,
    clicksCount,
    ordersCount,
    referralLink: `${env.FRONTEND_URL}?ref=${affiliate.referralCode}`,
    promoCodes: [],
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
  return res.json({
    referralLink: `${env.FRONTEND_URL}?ref=${affiliate.referralCode}`,
    promoCodes: [],
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
  return res.json({ success: true });
}));

export default router;
