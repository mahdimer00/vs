import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { permissionMiddleware } from "../../middleware/permission.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AnalyticsEventModel } from "../../models/analytics.model.js";
import { OrderModel } from "../../models/orders.model.js";
import { ProductModel } from "../../models/catalog.model.js";

const router = Router();

const eventSchema = z.object({
  eventType: z.enum(["page_view", "product_view", "add_to_cart", "checkout_start", "order_submit", "purchase"]),
  productId: z.string().max(128).optional(),
  orderId: z.string().max(128).optional(),
  pageUrl: z.string().max(2048).default(""),
  referrer: z.string().max(2048).default(""),
});

// Public — log a frontend analytics event. No auth, fire-and-forget.
router.post("/analytics/event", asyncHandler(async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(204).end();
  }

  const userAgent = String(req.headers["user-agent"] ?? "").slice(0, 512);

  await AnalyticsEventModel.create({
    eventType: parsed.data.eventType,
    productId: parsed.data.productId,
    orderId: parsed.data.orderId,
    pageUrl: parsed.data.pageUrl,
    referrer: parsed.data.referrer,
    userAgent,
  });

  return res.status(204).end();
}));

// Admin — aggregated analytics summary with period filter
router.get("/admin/analytics", authMiddleware, permissionMiddleware("dashboard"), asyncHandler(async (req, res) => {
  const period = String(req.query.period || "7d");
  const fromParam = req.query.from as string | undefined;
  const toParam = req.query.to as string | undefined;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let fromDate: Date;
  let toDate: Date = new Date();
  toDate.setHours(23, 59, 59, 999);

  if (fromParam && toParam) {
    fromDate = new Date(fromParam);
    toDate = new Date(toParam);
    toDate.setHours(23, 59, 59, 999);
  } else if (period === "today") {
    fromDate = new Date(todayStart);
  } else if (period === "30d") {
    fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  } else {
    // default 7d
    fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }

  const dateFilter = { $gte: fromDate, $lte: toDate };

  const [events, todayPageViews, orders, todayOrders] = await Promise.all([
    AnalyticsEventModel.find({ createdAt: dateFilter }).lean(),
    AnalyticsEventModel.countDocuments({ eventType: "page_view", createdAt: { $gte: todayStart } }),
    OrderModel.find({ createdAt: dateFilter }).lean(),
    OrderModel.find({ createdAt: { $gte: todayStart } }).lean(),
  ]);

  const totalVisitors = events.filter((e) => e.eventType === "page_view").length;
  const productViews = events.filter((e) => e.eventType === "product_view").length;
  const ordersCount = orders.length;
  const conversionRate = totalVisitors > 0 ? Math.round((ordersCount / totalVisitors) * 1000) / 10 : 0;

  const deliveredStatuses = new Set(["DELIVERED", "PICKED_UP"]);

  const revenueTotal = orders
    .filter((o) => deliveredStatuses.has(o.status))
    .reduce((sum, o) => sum + o.total, 0);

  const revenueToday = todayOrders
    .filter((o) => deliveredStatuses.has(o.status))
    .reduce((sum, o) => sum + o.total, 0);

  // Orders by status breakdown
  const ordersByStatus: Record<string, number> = {};
  for (const order of orders) {
    ordersByStatus[order.status] = (ordersByStatus[order.status] ?? 0) + 1;
  }

  // Most viewed products — count product_view events per productId
  const viewCounts: Record<string, number> = {};
  for (const event of events) {
    if (event.eventType === "product_view" && event.productId) {
      viewCounts[event.productId] = (viewCounts[event.productId] ?? 0) + 1;
    }
  }
  const topViewedIds = Object.entries(viewCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  const viewedProductDocs = await ProductModel.find({ _id: { $in: topViewedIds } })
    .select("_id name")
    .lean();
  const viewedNameMap = Object.fromEntries(viewedProductDocs.map((p) => [String(p._id), p.name]));

  const mostViewedProducts = topViewedIds.map((id) => ({
    productId: id,
    productName: viewedNameMap[id] ?? { ar: "", fr: "", en: id },
    count: viewCounts[id] ?? 0,
  }));

  // Best selling products — count from delivered order items
  const sellMap: Record<string, { count: number; revenue: number }> = {};
  for (const order of orders) {
    if (!deliveredStatuses.has(order.status)) continue;
    for (const item of order.items) {
      const entry = sellMap[item.productId] ?? { count: 0, revenue: 0 };
      entry.count += item.quantity;
      entry.revenue += item.lineTotal;
      sellMap[item.productId] = entry;
    }
  }
  const topSellerIds = Object.entries(sellMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 10)
    .map(([id]) => id);

  const sellerProductDocs = await ProductModel.find({ _id: { $in: topSellerIds } })
    .select("_id name")
    .lean();
  const sellerNameMap = Object.fromEntries(sellerProductDocs.map((p) => [String(p._id), p.name]));

  const bestSellingProducts = topSellerIds.map((id) => ({
    productId: id,
    productName: sellerNameMap[id] ?? { ar: "", fr: "", en: id },
    count: sellMap[id]?.count ?? 0,
    revenue: sellMap[id]?.revenue ?? 0,
  }));

  // Determine number of days to fill for charts
  const dayCount =
    fromParam && toParam
      ? Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1)
      : period === "today"
        ? 1
        : period === "30d"
          ? 30
          : 7;

  // Visitors per day
  const visitDayMap: Record<string, number> = {};
  for (const event of events) {
    if (event.eventType === "page_view") {
      const day = new Date(event.createdAt).toISOString().slice(0, 10);
      visitDayMap[day] = (visitDayMap[day] ?? 0) + 1;
    }
  }

  const visitorsByDay = Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(fromDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return { date: d, count: visitDayMap[d] ?? 0 };
  });

  // Sales per day
  const salesDayMap: Record<string, { revenue: number; orders: number }> = {};
  for (const order of orders) {
    const day = new Date(order.createdAt).toISOString().slice(0, 10);
    const entry = salesDayMap[day] ?? { revenue: 0, orders: 0 };
    entry.orders += 1;
    if (deliveredStatuses.has(order.status)) {
      entry.revenue += order.total;
    }
    salesDayMap[day] = entry;
  }

  const salesByDay = Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(fromDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return { date: d, ...(salesDayMap[d] ?? { revenue: 0, orders: 0 }) };
  });

  return res.json({
    totalVisitors,
    todayVisitors: todayPageViews,
    productViews,
    ordersCount,
    conversionRate,
    mostViewedProducts,
    bestSellingProducts,
    revenueTotal,
    revenueToday,
    ordersByStatus,
    visitorsByDay,
    salesByDay,
  });
}));

export default router;
