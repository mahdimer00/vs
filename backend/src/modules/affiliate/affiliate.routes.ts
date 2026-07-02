import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authMiddleware, type AuthedRequest } from "../../middleware/auth.middleware.js";
import { roleMiddleware } from "../../middleware/role.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AffiliateClickModel, AffiliateModel, CommissionModel, CouponRequestModel, WithdrawalRequestModel } from "../../models/affiliate.model.js";
import { OrderModel, PromoCodeModel } from "../../models/orders.model.js";
import { WebsiteSettingModel } from "../../models/catalog.model.js";
import { env } from "../../config/env.js";
import { sendTelegramMessage } from "../../utils/telegram.js";

const router = Router();

const affiliateTrackClickSchema = z.object({
  visitorId: z.string().min(8).max(128).optional(),
  landingPath: z.string().max(500).optional(),
  referrer: z.string().max(1000).optional(),
  shortCode: z.string().max(100).optional(),
});

router.post("/affiliate/track-click/:referralCode", asyncHandler(async (req, res) => {
  const referralCode = String(req.params.referralCode).toUpperCase();
  const affiliate = await AffiliateModel.findOne({ referralCode });
  if (!affiliate) {
    return res.status(404).json({ message: "Affiliate not found" });
  }

  const input = affiliateTrackClickSchema.safeParse(req.body);
  const payload = input.success ? input.data : {};

  await AffiliateClickModel.create({
    affiliate: affiliate._id,
    referralCode: affiliate.referralCode,
    visitorId: payload.visitorId,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    landingPath: payload.landingPath,
    referrer: payload.referrer,
    shortCode: payload.shortCode,
  });

  return res.json({ success: true });
}));

router.get("/affiliate/dashboard", authMiddleware, roleMiddleware(["AFFILIATE"]), asyncHandler(async (req: AuthedRequest, res) => {
  const affiliate = await AffiliateModel.findById(req.user?.sub);
  if (!affiliate) {
    return res.status(404).json({ message: "Affiliate not found" });
  }

  const clicksCount = await AffiliateClickModel.countDocuments({ affiliate: affiliate._id });
  const visitorAggregation = await AffiliateClickModel.aggregate([
    { $match: { affiliate: affiliate._id } },
    {
      $addFields: {
        visitorKey: {
          $ifNull: [
            "$visitorId",
            {
              $cond: [
                { $and: [{ $ne: ["$ip", null] }, { $ne: ["$ip", ""] }] },
                { $concat: ["ip:", "$ip"] },
                { $concat: ["anon:", { $toString: "$_id" }] },
              ],
            },
          ],
        },
      },
    },
    {
      $facet: {
        totals: [{ $group: { _id: "$visitorKey" } }, { $count: "count" }],
        recent: [
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: "$visitorKey",
              lastVisitedAt: { $first: "$createdAt" },
              landingPath: { $first: "$landingPath" },
              referrer: { $first: "$referrer" },
              shortCode: { $first: "$shortCode" },
              visits: { $sum: 1 },
            },
          },
          { $sort: { lastVisitedAt: -1 } },
          { $limit: 12 },
        ],
      },
    },
  ]);
  const ordersCount = await OrderModel.countDocuments({ affiliate: affiliate._id });
  const promoCodes = await PromoCodeModel.find({ affiliate: affiliate._id }).lean();
  const teamCount = await AffiliateModel.countDocuments({ referredBy: affiliate._id });
  const settings = await WebsiteSettingModel.findOne();
  const levels = settings?.affiliateLevels as Record<string, { commissionRate: number; referralBonus: number }> | undefined;
  const visitorsCount = visitorAggregation[0]?.totals?.[0]?.count ?? 0;
  const shortBase = `${env.FRONTEND_URL}/r/${affiliate.referralCode}`;

  const { passwordHash: _ph, ...safeAffiliate } = affiliate.toObject();
  return res.json({
    affiliate: safeAffiliate,
    clicksCount,
    visitorsCount,
    ordersCount,
    teamCount,
    referralBonusAmount: levels?.[String(affiliate.level)]?.referralBonus ?? 0,
    referralLink: `${env.FRONTEND_URL}?ref=${affiliate.referralCode}`,
    shortReferralLink: shortBase,
    inviteLink: `${env.FRONTEND_URL}/affiliate/register?ref=${affiliate.referralCode}`,
    shortInviteLink: `${shortBase}/affiliate/register`,
    promoCodes,
    recentVisitors: (visitorAggregation[0]?.recent ?? []).map((entry: {
      _id: string;
      lastVisitedAt: Date | string;
      landingPath?: string;
      referrer?: string;
      shortCode?: string;
      visits: number;
    }) => ({
      visitorKey: entry._id,
      lastVisitedAt: entry.lastVisitedAt,
      landingPath: entry.landingPath ?? "",
      referrer: entry.referrer ?? "",
      shortCode: entry.shortCode ?? "",
      visits: entry.visits,
    })),
  });
}));

router.get("/affiliate/orders", authMiddleware, roleMiddleware(["AFFILIATE"]), asyncHandler(async (req: AuthedRequest, res) => {
  return res.json(
    await OrderModel.find({ affiliate: req.user?.sub })
      .select("-confirmationTokenHash")
      .populate("customer.wilaya")
      .lean(),
  );
}));

router.get("/affiliate/commissions", authMiddleware, roleMiddleware(["AFFILIATE"]), asyncHandler(async (req: AuthedRequest, res) => {
  return res.json(
    await CommissionModel.find({ affiliate: req.user?.sub })
      .populate({ path: "order", select: "-confirmationTokenHash" })
      .lean(),
  );
}));

router.get("/affiliate/referral-link", authMiddleware, roleMiddleware(["AFFILIATE"]), asyncHandler(async (req: AuthedRequest, res) => {
  const affiliate = await AffiliateModel.findById(req.user?.sub);
  if (!affiliate) {
    return res.status(404).json({ message: "Affiliate not found" });
  }
  const promoCodes = await PromoCodeModel.find({ affiliate: affiliate._id }).lean();
  const shortBase = `${env.FRONTEND_URL}/r/${affiliate.referralCode}`;
  return res.json({
    referralLink: `${env.FRONTEND_URL}?ref=${affiliate.referralCode}`,
    shortReferralLink: shortBase,
    shortInviteLink: `${shortBase}/affiliate/register`,
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
    .select("name email status level createdAt referralCode shareMethod")
    .sort({ createdAt: -1 })
    .lean();

  // For each team member, get their order count + total sales + commission earned for me
  const teamWithStats = await Promise.all(
    team.map(async (member) => {
      const ordersCount = await OrderModel.countDocuments({ affiliate: member._id });
      const deliveredOrders = await OrderModel.countDocuments({
        affiliate: member._id,
        status: { $in: ["DELIVERED", "PICKED_UP"] },
      });
      const myEarnings = await CommissionModel.aggregate([
        { $match: { affiliate: req.user?.sub as unknown, sourceAffiliate: member._id, type: "REFERRAL_BONUS", status: { $in: ["APPROVED", "PAID"] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      return {
        ...member,
        ordersCount,
        deliveredOrders,
        myEarningsFromThem: myEarnings[0]?.total ?? 0,
      };
    }),
  );

  return res.json(teamWithStats);
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

router.patch("/affiliate/profile", authMiddleware, roleMiddleware(["AFFILIATE"]), asyncHandler(async (req: AuthedRequest, res) => {
  const input = z.object({
    name: z.string().min(2).optional(),
    phone: z.string().regex(/^(05|06|07)\d{8}$/).optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8).optional(),
  }).parse(req.body);

  const affiliate = await AffiliateModel.findById(req.user?.sub);
  if (!affiliate) return res.status(404).json({ message: "Affiliate not found" });

  if (input.name) affiliate.name = input.name;
  if (input.phone) affiliate.phone = input.phone;

  if (input.newPassword) {
    if (!input.currentPassword) return res.status(400).json({ message: "كلمة المرور الحالية مطلوبة" });
    const valid = await bcrypt.compare(input.currentPassword, affiliate.passwordHash);
    if (!valid) return res.status(400).json({ message: "كلمة المرور الحالية غير صحيحة" });
    affiliate.passwordHash = await bcrypt.hash(input.newPassword, 10);
  }

  await affiliate.save();
  const { passwordHash: _ph, ...safe } = affiliate.toObject();
  return res.json(safe);
}));

export default router;
