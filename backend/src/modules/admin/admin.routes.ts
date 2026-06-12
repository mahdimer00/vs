import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { roleMiddleware } from "../../middleware/role.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AffiliateModel, CommissionModel, WithdrawalRequestModel } from "../../models/affiliate.model.js";
import { OrderModel, PromoCodeModel } from "../../models/orders.model.js";
import { ProductModel, WebsiteSettingModel } from "../../models/catalog.model.js";
import { syncCommissionForOrder } from "../../utils/commission.js";

const router = Router();

router.get("/admin/stats", authMiddleware, roleMiddleware(["SUPER_ADMIN", "ADMIN", "ORDER_MANAGER"]), asyncHandler(async (_req, res) => {
  const [orders, promos, affiliates, products] = await Promise.all([
    OrderModel.find().lean(),
    PromoCodeModel.find().lean(),
    AffiliateModel.find().lean(),
    ProductModel.find().lean(),
  ]);

  const deliveredStatuses = new Set(["DELIVERED", "PICKED_UP"]);
  const cancelledStatuses = new Set(["CANCELLED", "RETURNED", "FAILED"]);

  return res.json({
    totalOrders: orders.length,
    pendingOrders: orders.filter((order) => order.status === "PENDING_AI_CONFIRMATION").length,
    deliveredOrders: orders.filter((order) => deliveredStatuses.has(order.status)).length,
    cancelledOrders: orders.filter((order) => cancelledStatuses.has(order.status)).length,
    revenue: orders.filter((order) => deliveredStatuses.has(order.status)).reduce((sum, order) => sum + order.total, 0),
    topProducts: products.slice(0, 5),
    affiliateSales: affiliates.map((affiliate) => ({ affiliate: affiliate.name, total: affiliate.balancePaid + affiliate.balanceApproved })),
    promoUsage: promos.map((promo) => ({ code: promo.code, count: promo.usedCount })),
    lowStockProducts: products.filter((product) => product.stock <= 5),
  });
}));

router.get("/admin/affiliates", authMiddleware, roleMiddleware(["SUPER_ADMIN", "ADMIN"]), asyncHandler(async (_req, res) => {
  return res.json(await AffiliateModel.find().lean());
}));
const affiliateUpdateSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "BLOCKED"]).optional(),
  commissionRate: z.number().min(1).max(3).optional(),
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
});

router.patch("/admin/affiliates/:id", authMiddleware, roleMiddleware(["SUPER_ADMIN", "ADMIN"]), asyncHandler(async (req, res) => {
  const input = affiliateUpdateSchema.parse(req.body);
  const affiliate = await AffiliateModel.findByIdAndUpdate(req.params.id, input, { new: true });
  if (!affiliate) {
    return res.status(404).json({ message: "Affiliate not found" });
  }
  return res.json(affiliate);
}));

router.get("/admin/commissions", authMiddleware, roleMiddleware(["SUPER_ADMIN", "ADMIN"]), asyncHandler(async (_req, res) => {
  return res.json(await CommissionModel.find().populate("affiliate").populate("order").lean());
}));
router.patch("/admin/commissions/:id/pay", authMiddleware, roleMiddleware(["SUPER_ADMIN", "ADMIN"]), asyncHandler(async (req, res) => {
  const commission = await CommissionModel.findById(String(req.params.id)).populate("affiliate");
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

router.get("/admin/settings", authMiddleware, roleMiddleware(["SUPER_ADMIN", "ADMIN"]), asyncHandler(async (_req, res) => {
  const settings = await WebsiteSettingModel.findOne();
  return res.json(settings);
}));
router.patch("/admin/settings", authMiddleware, roleMiddleware(["SUPER_ADMIN", "ADMIN"]), asyncHandler(async (req, res) => {
  const settings = await WebsiteSettingModel.findOneAndUpdate({}, req.body, { new: true, upsert: true });
  return res.json(settings);
}));

router.get("/admin/withdrawals", authMiddleware, roleMiddleware(["SUPER_ADMIN", "ADMIN"]), asyncHandler(async (_req, res) => {
  return res.json(await WithdrawalRequestModel.find().populate("affiliate").lean());
}));

router.post("/admin/orders/:id/resync-commission", authMiddleware, roleMiddleware(["SUPER_ADMIN", "ADMIN"]), asyncHandler(async (req, res) => {
  return res.json(await syncCommissionForOrder(String(req.params.id), "admin"));
}));

export default router;
