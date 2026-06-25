import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { roleMiddleware } from "../../middleware/role.middleware.js";
import { permissionMiddleware } from "../../middleware/permission.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AffiliateModel, CommissionModel, CouponRequestModel, WithdrawalRequestModel } from "../../models/affiliate.model.js";
import { OrderModel, PromoCodeModel } from "../../models/orders.model.js";
import { ProductModel, WebsiteSettingModel } from "../../models/catalog.model.js";
import { UserModel } from "../../models/user.model.js";
import { syncCommissionForOrder } from "../../utils/commission.js";
import { hashPassword } from "../../utils/auth.js";
import { ADMIN_PERMISSIONS } from "../../constants/permissions.js";
import { AppError } from "../../utils/app-error.js";
import { validateObjectId } from "../../middleware/objectId.middleware.js";
import { addSseClient } from "../../utils/sse.js";
import { PhoneBlacklistModel } from "../../models/blacklist.model.js";

const router = Router();

const subAdminCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  permissions: z.array(z.enum(ADMIN_PERMISSIONS)).default([]),
});

const subAdminUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  password: z.string().min(8).optional(),
  permissions: z.array(z.enum(ADMIN_PERMISSIONS)).optional(),
  isActive: z.boolean().optional(),
});

router.get("/admin/admins", authMiddleware, roleMiddleware(["SUPER_ADMIN"]), asyncHandler(async (_req, res) => {
  return res.json(await UserModel.find({ role: "SUB_ADMIN" }).select("-passwordHash").sort({ createdAt: -1 }).lean());
}));

router.post("/admin/admins", authMiddleware, roleMiddleware(["SUPER_ADMIN"]), asyncHandler(async (req, res) => {
  const input = subAdminCreateSchema.parse(req.body);
  const exists = await UserModel.exists({ email: input.email.toLowerCase() });
  if (exists) {
    throw new AppError("Email already in use", 409);
  }

  const subAdmin = await UserModel.create({
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: await hashPassword(input.password),
    role: "SUB_ADMIN",
    permissions: input.permissions,
    isActive: true,
  });

  const { passwordHash, ...rest } = subAdmin.toObject();
  return res.status(201).json(rest);
}));

router.patch("/admin/admins/:id", authMiddleware, roleMiddleware(["SUPER_ADMIN"]), validateObjectId, asyncHandler(async (req, res) => {
  const input = subAdminUpdateSchema.parse(req.body);
  const subAdmin = await UserModel.findOne({ _id: req.params.id, role: "SUB_ADMIN" });
  if (!subAdmin) {
    return res.status(404).json({ message: "Sub-admin not found" });
  }

  if (input.name !== undefined) subAdmin.name = input.name;
  if (input.permissions !== undefined) subAdmin.permissions = input.permissions;
  if (input.isActive !== undefined) subAdmin.isActive = input.isActive;
  if (input.password) subAdmin.passwordHash = await hashPassword(input.password);

  await subAdmin.save();
  const { passwordHash, ...rest } = subAdmin.toObject();
  return res.json(rest);
}));

router.delete("/admin/admins/:id", authMiddleware, roleMiddleware(["SUPER_ADMIN"]), validateObjectId, asyncHandler(async (req, res) => {
  const subAdmin = await UserModel.findOneAndDelete({ _id: req.params.id, role: "SUB_ADMIN" });
  if (!subAdmin) {
    return res.status(404).json({ message: "Sub-admin not found" });
  }
  return res.json({ success: true });
}));

router.get("/admin/stats", authMiddleware, permissionMiddleware("dashboard"), asyncHandler(async (_req, res) => {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const abandonedThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [orders, promos, affiliates, products] = await Promise.all([
    OrderModel.find().lean(),
    PromoCodeModel.find().lean(),
    AffiliateModel.find().lean(),
    ProductModel.find().lean(),
  ]);

  const deliveredStatuses = new Set(["DELIVERED", "PICKED_UP"]);
  const cancelledStatuses = new Set(["CANCELLED", "RETURNED", "FAILED"]);

  const deliveredOrders = orders.filter((o) => deliveredStatuses.has(o.status));
  const todayOrders = orders.filter((o) => new Date(o.createdAt as Date) >= todayStart);
  const weekOrders = orders.filter((o) => new Date(o.createdAt as Date) >= weekStart);
  const abandonedOrders = orders.filter((o) =>
    o.status === "AWAITING_CALL_CONFIRMATION" && new Date(o.createdAt as Date) < abandonedThreshold
  );

  // Top products by actual order count (not just slice)
  const productOrderCount = new Map<string, number>();
  for (const order of deliveredOrders) {
    for (const item of order.items) {
      const pid = String(item.productId);
      productOrderCount.set(pid, (productOrderCount.get(pid) ?? 0) + item.quantity);
    }
  }
  const topProductsSorted = products
    .map((p) => ({ ...p, orderCount: productOrderCount.get(String(p._id)) ?? 0 }))
    .filter((p) => p.orderCount > 0)
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 5);

  return res.json({
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => o.status === "PENDING_AI_CONFIRMATION" || o.status === "AWAITING_CALL_CONFIRMATION").length,
    awaitingCallOrders: orders.filter((o) => o.status === "AWAITING_CALL_CONFIRMATION").length,
    deliveredOrders: deliveredOrders.length,
    cancelledOrders: orders.filter((o) => cancelledStatuses.has(o.status)).length,
    revenue: deliveredOrders.reduce((sum, o) => sum + o.total, 0),
    // Today
    todayOrders: todayOrders.length,
    todayRevenue: todayOrders.filter((o) => deliveredStatuses.has(o.status)).reduce((sum, o) => sum + o.total, 0),
    // This week
    weekOrders: weekOrders.length,
    weekRevenue: weekOrders.filter((o) => deliveredStatuses.has(o.status)).reduce((sum, o) => sum + o.total, 0),
    // Abandoned (waiting for call > 24h)
    abandonedOrders: abandonedOrders.length,
    abandonedOrderDetails: abandonedOrders.slice(0, 5).map((o) => ({
      _id: o._id, orderNumber: o.orderNumber,
      customerName: o.customer?.fullName, phone: o.customer?.phone,
      total: o.total, hoursAgo: Math.round((Date.now() - new Date(o.createdAt as Date).getTime()) / 3600000),
    })),
    // Real top products by order count
    topProducts: topProductsSorted,
    affiliateSales: affiliates.map((a) => ({ affiliate: a.name, total: a.balancePaid + a.balanceApproved })),
    promoUsage: promos.map((p) => ({ code: p.code, count: p.usedCount })),
    lowStockProducts: products.filter((p) => p.stock > 0 && p.stock <= 5 && !p.isSoldOut),
    outOfStockProducts: products.filter((p) => p.stock === 0 && !p.isSoldOut).length,
  });
}));

// WhatsApp Baileys status for dashboard widget
router.get("/admin/wa-status", authMiddleware, permissionMiddleware("dashboard"), asyncHandler(async (_req, res) => {
  try {
    const waUrl = process.env.BAILEYS_API_URL ?? "http://172.18.0.1:3010";
    const waKey = process.env.BAILEYS_API_KEY ?? "";
    const response = await fetch(`${waUrl}/health`, {
      headers: waKey ? { "X-Api-Key": waKey } : {},
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return res.json({ connected: false, error: "unreachable" });
    const data = await response.json() as Record<string, unknown>;
    return res.json({ connected: data.connected, warmingUp: data.warmingUp, pendingOtps: data.pendingOtps });
  } catch {
    return res.json({ connected: false, error: "offline" });
  }
}));

router.get("/admin/affiliates", authMiddleware, permissionMiddleware("affiliates"), asyncHandler(async (_req, res) => {
  return res.json(await AffiliateModel.find().select("-passwordHash").lean());
}));
const affiliateUpdateSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "BLOCKED"]).optional(),
  commissionRate: z.number().min(1).max(3).optional(),
  level: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]).optional(),
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
});

router.patch("/admin/affiliates/:id", authMiddleware, permissionMiddleware("affiliates"), asyncHandler(async (req, res) => {
  const input = affiliateUpdateSchema.parse(req.body);
  const affiliate = await AffiliateModel.findByIdAndUpdate(req.params.id, input, { new: true });
  if (!affiliate) {
    return res.status(404).json({ message: "Affiliate not found" });
  }
  return res.json(affiliate);
}));

router.get("/admin/commissions", authMiddleware, permissionMiddleware("commissions"), asyncHandler(async (_req, res) => {
  return res.json(
    await CommissionModel.find()
      .populate("affiliate", "-passwordHash")
      .populate({ path: "order", select: "-confirmationTokenHash" })
      .lean(),
  );
}));
router.patch("/admin/commissions/:id/pay", authMiddleware, permissionMiddleware("commissions"), asyncHandler(async (req, res) => {
  const commission = await CommissionModel.findById(String(req.params.id)).populate("affiliate", "-passwordHash");
  if (!commission) {
    return res.status(404).json({ message: "Commission not found" });
  }
  commission.status = "PAID";
  commission.paidAt = new Date();
  await commission.save();
  const affiliate = await AffiliateModel.findById(commission.affiliate);
  if (affiliate) {
    affiliate.balanceApproved = Math.max(0, affiliate.balanceApproved - commission.amount);
    affiliate.balancePaid += commission.amount;
    await affiliate.save();
  }
  return res.json(commission);
}));

const websiteSettingsSchema = z.object({
  storeName: z.string().min(1).max(100).optional(),
  logo: z.string().url().max(2048).optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  whatsapp: z.string().max(20).optional(),
  email: z.string().email().max(255).optional(),
  address: z.string().max(300).optional(),
  mapUrl: z.string().max(2048).optional(),
  socialLinks: z.record(z.string().max(50), z.string().max(2048)).optional(),
  defaultLanguage: z.enum(["ar", "fr", "en"]).optional(),
  currency: z.string().max(10).optional(),
  aiEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  promoCodeEnabled: z.boolean().optional(),
  directOrderMode: z.boolean().optional(),
  whatsappFloat: z.boolean().optional(),
  otpEnabled: z.boolean().optional(),
  otpWhatsappEnabled: z.boolean().optional(),
  otpEmailEnabled: z.boolean().optional(),
  affiliateLevels: z.record(
    z.string().max(20),
    z.object({ commissionRate: z.number().min(0).max(100), referralBonus: z.number().min(0) }),
  ).optional(),
});

router.get("/admin/settings", authMiddleware, permissionMiddleware("settings"), asyncHandler(async (_req, res) => {
  const settings = await WebsiteSettingModel.findOne();
  return res.json(settings);
}));
router.patch("/admin/settings", authMiddleware, permissionMiddleware("settings"), asyncHandler(async (req, res) => {
  const input = websiteSettingsSchema.parse(req.body);
  const settings = await WebsiteSettingModel.findOneAndUpdate({}, { $set: input }, { new: true, upsert: true });
  return res.json(settings);
}));

router.get("/admin/withdrawals", authMiddleware, permissionMiddleware("withdrawals"), asyncHandler(async (_req, res) => {
  return res.json(await WithdrawalRequestModel.find().populate("affiliate", "-passwordHash").sort({ createdAt: -1 }).lean());
}));

router.patch("/admin/withdrawals/:id", authMiddleware, permissionMiddleware("withdrawals"), asyncHandler(async (req, res) => {
  const input = z
    .object({
      status: z.enum(["PENDING", "APPROVED", "REJECTED", "PAID"]),
      voucherCode: z.string().trim().min(1).optional(),
      voucherPin: z.string().trim().min(1).optional(),
    })
    .parse(req.body);
  const withdrawal = await WithdrawalRequestModel.findById(req.params.id);
  if (!withdrawal) {
    return res.status(404).json({ message: "Withdrawal request not found" });
  }

  if (input.status === "PAID" && withdrawal.status !== "PAID") {
    const affiliate = await AffiliateModel.findById(withdrawal.affiliate);
    if (affiliate) {
      affiliate.balanceApproved = Math.max(0, affiliate.balanceApproved - withdrawal.amount);
      affiliate.balancePaid += withdrawal.amount;
      await affiliate.save();
    }
  }

  if (input.voucherCode || input.voucherPin) {
    withdrawal.voucherCode = input.voucherCode ?? withdrawal.voucherCode;
    withdrawal.voucherPin = input.voucherPin ?? withdrawal.voucherPin;
    withdrawal.voucherExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  withdrawal.status = input.status;
  await withdrawal.save();
  return res.json(await WithdrawalRequestModel.findById(withdrawal._id).populate("affiliate", "-passwordHash").lean());
}));

router.post("/admin/orders/:id/resync-commission", authMiddleware, permissionMiddleware("orders"), asyncHandler(async (req, res) => {
  return res.json(await syncCommissionForOrder(String(req.params.id), "admin"));
}));

router.get("/admin/notifications", authMiddleware, permissionMiddleware("dashboard", "affiliates", "withdrawals", "coupon-requests"), asyncHandler(async (_req, res) => {
  const [pendingAffiliates, pendingWithdrawals, pendingCouponRequests] = await Promise.all([
    AffiliateModel.countDocuments({ status: "PENDING" }),
    WithdrawalRequestModel.countDocuments({ status: "PENDING" }),
    CouponRequestModel.countDocuments({ status: "PENDING" }),
  ]);

  return res.json({ pendingAffiliates, pendingWithdrawals, pendingCouponRequests });
}));

router.get("/admin/coupon-requests", authMiddleware, permissionMiddleware("coupon-requests"), asyncHandler(async (_req, res) => {
  return res.json(await CouponRequestModel.find().populate("affiliate", "-passwordHash").populate("promoCode").sort({ createdAt: -1 }).lean());
}));

router.patch("/admin/coupon-requests/:id", authMiddleware, permissionMiddleware("coupon-requests"), asyncHandler(async (req, res) => {
  const input = z
    .object({
      status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
      adminNote: z.string().trim().max(500).optional(),
      code: z.string().trim().min(3).max(20).optional(),
    })
    .parse(req.body);

  const couponRequest = await CouponRequestModel.findById(req.params.id).populate("affiliate");
  if (!couponRequest) {
    return res.status(404).json({ message: "Coupon request not found" });
  }

  if (input.status === "APPROVED" && couponRequest.status !== "APPROVED") {
    const affiliate = couponRequest.affiliate as unknown as { _id: string; referralCode: string };
    const code = (input.code || couponRequest.desiredCode || `${affiliate.referralCode}${Math.floor(100 + Math.random() * 900)}`).toUpperCase();

    const exists = await PromoCodeModel.exists({ code });
    if (exists) {
      return res.status(409).json({ message: "Promo code already exists, choose another code" });
    }

    const promoCode = await PromoCodeModel.create({
      code,
      type: couponRequest.type,
      value: couponRequest.value,
      affiliate: affiliate._id,
      isActive: true,
      usedCount: 0,
      productRestrictions: [],
      categoryRestrictions: [],
      oneUsePerPhone: true,
    });

    couponRequest.promoCode = promoCode._id;
  }

  couponRequest.status = input.status;
  couponRequest.adminNote = input.adminNote ?? couponRequest.adminNote;
  await couponRequest.save();

  return res.json(await CouponRequestModel.findById(couponRequest._id).populate("affiliate", "-passwordHash").populate("promoCode").lean());
}));

// Server-Sent Events stream — admin dashboard listens for real-time order updates
// Token passed as query param because EventSource cannot set custom headers
router.get(
  "/admin/events",
  (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
    // Accept token from query param for SSE (EventSource can't set headers)
    if (req.query.token && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${String(req.query.token)}`;
    }
    next();
  },
  authMiddleware,
  permissionMiddleware("orders"),
  (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
    res.flushHeaders();
    res.write(": connected\n\n");
    addSseClient(res);
    // Heartbeat every 25s to keep connection alive through proxies
    const hb = setInterval(() => { try { res.write(": ping\n\n"); } catch { clearInterval(hb); } }, 25_000);
    req.on("close", () => clearInterval(hb));
  },
);

// ── Phone Blacklist ──────────────────────────────────────────────────────────
router.get("/admin/blacklist", authMiddleware, permissionMiddleware("orders"), asyncHandler(async (_req, res) => {
  return res.json(await PhoneBlacklistModel.find().sort({ createdAt: -1 }).lean());
}));

router.post("/admin/blacklist", authMiddleware, permissionMiddleware("orders"), asyncHandler(async (req, res) => {
  const input = z.object({
    phone: z.string().regex(/^(05|06|07)\d{8}$/, "رقم الهاتف يجب أن يبدأ بـ 05 أو 06 أو 07"),
    reason: z.string().max(200).optional(),
  }).parse(req.body);
  const existing = await PhoneBlacklistModel.findOne({ phone: input.phone });
  if (existing) return res.status(409).json({ message: "هذا الرقم محظور مسبقاً" });
  const entry = await PhoneBlacklistModel.create({ phone: input.phone, reason: input.reason || "" });
  return res.status(201).json(entry);
}));

router.delete("/admin/blacklist/:phone", authMiddleware, permissionMiddleware("orders"), asyncHandler(async (req, res) => {
  await PhoneBlacklistModel.deleteOne({ phone: req.params.phone });
  return res.json({ success: true });
}));

export default router;
