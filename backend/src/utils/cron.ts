import { sendTelegramMessage } from "./telegram.js";
import { OrderModel } from "../models/orders.model.js";
import { ProductModel } from "../models/catalog.model.js";
import { WebsiteSettingModel } from "../models/catalog.model.js";
import { isWhatsAppConfigured, sendWhatsAppMessage } from "./otp.js";
import { ExpenseModel, StockPurchaseModel } from "../models/finance.model.js";

// Daily summary: runs every day at 8:00 AM Algeria time (UTC+1 = 07:00 UTC)
function scheduleDailySummary() {
  function msUntilNext7UTC() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(7, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
  }

  const runAndReschedule = () => {
    void sendDailySummary();
    setTimeout(runAndReschedule, msUntilNext7UTC());
  };

  setTimeout(runAndReschedule, msUntilNext7UTC());
}

async function sendDailySummary() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [orders, revenue] = await Promise.all([
      OrderModel.find({ createdAt: { $gte: yesterday, $lt: todayStart } }).lean(),
      OrderModel.aggregate([
        { $match: { createdAt: { $gte: yesterday, $lt: todayStart }, status: { $in: ["DELIVERED", "PICKED_UP"] } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const o of orders) {
      statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
    }

    const statusAr: Record<string, string> = {
      CONFIRMED: "مؤكد", PROCESSING: "جاري المعالجة", SHIPPED: "مشحون",
      DELIVERED: "مسلّم", PICKED_UP: "استلم", CANCELLED: "ملغي",
      RETURNED: "مرجوع", FAILED: "فاشل",
      PENDING_AI_CONFIRMATION: "في الانتظار", AWAITING_CALL_CONFIRMATION: "ينتظر تأكيد",
    };

    const statusLines = Object.entries(statusCounts)
      .map(([s, c]) => `  • ${statusAr[s] ?? s}: ${c}`)
      .join("\n");

    const totalRevenue = (revenue[0] as { total?: number } | undefined)?.total ?? 0;

    const lowStock = await ProductModel.find({
      stock: { $lte: 3, $gt: 0 },
      status: "ACTIVE",
      localPickupOnly: { $ne: true },
    }).select("name stock").lean();

    const lowStockLines = lowStock.length > 0
      ? "\n\n⚠️ *مخزون منخفض:*\n" + lowStock.map((p) => `  • ${p.name.ar || p.name.en}: ${p.stock} قطعة`).join("\n")
      : "";

    const msg = [
      `📊 *تقرير اليوم — ${yesterday.toLocaleDateString("ar-DZ")}*`,
      ``,
      `📦 إجمالي الطلبات: *${orders.length}*`,
      statusLines,
      ``,
      `💰 الإيرادات المحصلة: *${totalRevenue.toLocaleString("ar-DZ")} دج*`,
      lowStockLines,
    ].join("\n");

    await sendTelegramMessage(msg);
  } catch (err) {
    console.error("[Cron] daily summary error:", err);
  }
}

// Abandoned cart recovery: runs every 30 minutes
const sentAbandonedCartMessages = new Set<string>();

function scheduleAbandonedCartCheck() {
  const run = () => void checkAbandonedCarts();
  run();
  setInterval(run, 30 * 60 * 1000);
}

async function checkAbandonedCarts() {
  if (!isWhatsAppConfigured()) return;
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const pendingOrders = await OrderModel.find({
      status: "AWAITING_CALL_CONFIRMATION",
      createdAt: { $gte: twentyFourHoursAgo, $lt: oneHourAgo },
    }).lean();

    const settings = await WebsiteSettingModel.findOne().select("storeName").lean().catch(() => null);
    const storeName = settings?.storeName || "المتجر";

    for (const order of pendingOrders) {
      const orderId = String(order._id);
      if (sentAbandonedCartMessages.has(orderId)) continue;
      if (!order.customer?.phone) continue;

      sentAbandonedCartMessages.add(orderId);

      const message = [
        `🛍️ *${storeName}*`,
        ``,
        `مرحباً ${order.customer.fullName}!`,
        ``,
        `لديك طلب بانتظار التأكيد 📦`,
        `رقم الطلب: *${order.orderNumber}*`,
        ``,
        `يرجى تأكيد طلبك عبر الرابط:`,
        `https://visadz.store/confirm-order/${(order as { confirmationToken?: string }).confirmationToken ?? ""}`,
        ``,
        `أو تواصل معنا مباشرة ✓`,
      ].join("\n");

      try {
        await sendWhatsAppMessage(order.customer.phone, message);
      } catch (err) {
        console.error(`[Cron] Abandoned cart WhatsApp failed for ${order.orderNumber}:`, err);
        // remove from sent set so we retry next time
        sentAbandonedCartMessages.delete(orderId);
      }
    }
  } catch (err) {
    console.error("[Cron] abandoned cart check error:", err);
  }
}

// Weekly P&L summary: every Monday at 8:00 AM Algeria time (07:00 UTC)
function scheduleWeeklySummary() {
  function msUntilNextMonday7UTC() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(7, 0, 0, 0);
    // advance day by day until we land on a future Monday
    while (next.getUTCDay() !== 1 || next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next.getTime() - now.getTime();
  }

  const runAndReschedule = () => {
    void sendWeeklySummary();
    setTimeout(runAndReschedule, msUntilNextMonday7UTC());
  };

  setTimeout(runAndReschedule, msUntilNextMonday7UTC());
}

async function sendWeeklySummary() {
  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const [weekOrders, products, weekStockPurchases, weekExpenses] = await Promise.all([
      OrderModel.find({ createdAt: { $gte: weekStart } }).lean(),
      ProductModel.find().lean(),
      StockPurchaseModel.find({ date: { $gte: weekStart } }).lean(),
      ExpenseModel.find({ date: { $gte: weekStart } }).lean(),
    ]);

    const deliveredStatuses = new Set(["DELIVERED", "PICKED_UP"]);
    const delivered = weekOrders.filter((o) => deliveredStatuses.has(o.status));
    const cancelled = weekOrders.filter((o) => ["CANCELLED", "RETURNED", "FAILED"].includes(o.status));
    const revenue = delivered.reduce((s, o) => s + o.total, 0);

    const costMap = new Map(
      products.filter((p) => p.purchasePrice).map((p) => [String(p._id), p.purchasePrice as number]),
    );
    const grossProfit = delivered.reduce((sum, o) =>
      sum + o.items.reduce((s, item) => {
        const cost = costMap.get(String(item.productId));
        return s + (cost != null ? (item.unitPrice - cost) * (item.quantity ?? 1) : 0);
      }, 0), 0);

    const weekExpensesTotal = weekExpenses.reduce((s, e) => s + (e.amount as number), 0);
    const weekStockCost = weekStockPurchases.filter((sp) => !sp.fundedByRevenue).reduce((s, sp) => s + (sp.totalCost as number), 0);
    const netProfit = grossProfit - weekExpensesTotal;

    // Top product this week
    const topMap = new Map<string, { name: string; count: number; profit: number }>();
    for (const o of delivered) {
      for (const item of o.items) {
        const key = String(item.productId);
        const cost = costMap.get(key);
        const p = cost != null ? (item.unitPrice - cost) * (item.quantity ?? 1) : 0;
        const ex = topMap.get(key) ?? { name: (item.productName as { ar?: string })?.ar || "?", count: 0, profit: 0 };
        topMap.set(key, { name: ex.name, count: ex.count + (item.quantity ?? 1), profit: ex.profit + p });
      }
    }
    const topProduct = [...topMap.values()].sort((a, b) => b.profit - a.profit)[0];

    const fmt = (n: number) => n.toLocaleString("ar-DZ");
    const lines = [
      `📊 *تقرير الأسبوع*`,
      ``,
      `📦 إجمالي الطلبات: *${weekOrders.length}*`,
      `  ✅ مُسلَّم: *${delivered.length}*  |  ❌ ملغي/مُرجع: *${cancelled.length}*`,
      ``,
      `💰 الإيرادات: *${fmt(revenue)} دج*`,
    ];
    if (grossProfit > 0) lines.push(`📈 ربح إجمالي: *${fmt(grossProfit)} دج*`);
    if (weekExpensesTotal > 0) lines.push(`🔴 مصاريف: *${fmt(weekExpensesTotal)} دج*`);
    if (grossProfit > 0 && weekExpensesTotal > 0) lines.push(`💎 صافي الربح: *${fmt(netProfit)} دج*`);
    if (weekStockCost > 0) lines.push(`📦 مشتريات مخزن: *${fmt(weekStockCost)} دج*`);
    if (topProduct) lines.push(`\n🏆 أربح منتج: *${topProduct.name}* — ${fmt(topProduct.profit)} دج`);

    await sendTelegramMessage(lines.join("\n"));
  } catch (err) {
    console.error("[Cron] weekly summary error:", err);
  }
}

export function startCronJobs() {
  scheduleDailySummary();
  scheduleWeeklySummary();
  scheduleAbandonedCartCheck();
  console.log("[Cron] daily summary + weekly P&L + abandoned cart recovery started");
}
