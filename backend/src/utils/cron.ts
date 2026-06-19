import { sendTelegramMessage } from "./telegram.js";
import { OrderModel } from "../models/orders.model.js";
import { ProductModel } from "../models/catalog.model.js";

const LOW_STOCK_THRESHOLD = 3;

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
      stock: { $lte: LOW_STOCK_THRESHOLD, $gt: 0 },
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

// Low stock alert: runs every hour
function scheduleLowStockCheck() {
  const run = () => void checkLowStock();
  run();
  setInterval(run, 60 * 60 * 1000);
}

const alertedProducts = new Set<string>();

async function checkLowStock() {
  try {
    const lowStock = await ProductModel.find({
      stock: { $lte: LOW_STOCK_THRESHOLD, $gt: 0 },
      status: "ACTIVE",
      localPickupOnly: { $ne: true },
    }).select("_id name stock").lean();

    for (const product of lowStock) {
      const id = String(product._id);
      if (!alertedProducts.has(id)) {
        alertedProducts.add(id);
        await sendTelegramMessage(
          `⚠️ *تنبيه مخزون منخفض*\n\n📦 ${product.name.ar || product.name.en}\nالمتبقي: *${product.stock} قطعة*`
        );
      }
    }

    // Clear alert set for products that are now restocked
    const outOfLow = await ProductModel.find({
      _id: { $in: [...alertedProducts] },
      stock: { $gt: LOW_STOCK_THRESHOLD },
    }).select("_id").lean();
    for (const p of outOfLow) alertedProducts.delete(String(p._id));
  } catch (err) {
    console.error("[Cron] low stock check error:", err);
  }
}

export function startCronJobs() {
  scheduleDailySummary();
  scheduleLowStockCheck();
  console.log("[Cron] daily summary + low stock alerts started");
}
