import { Router } from "express";
import { z } from "zod";
import { askOllama } from "../../config/ollama.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { ProductModel, ProductVariantModel } from "../../models/catalog.model.js";
import { AiConversationModel, OrderModel } from "../../models/orders.model.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AppError } from "../../utils/app-error.js";

const router = Router();

const confirmWords = ["نعم", "oui", "yes", "confirm", "ok", "موافق"];

router.post(
  "/ai/product-question",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        productId: z.string(),
        message: z.string().min(2),
        language: z.enum(["ar", "fr", "en"]).default("ar"),
      })
      .parse(req.body);

    const product = await ProductModel.findById(input.productId).populate("brand").lean();
    const variants = await ProductVariantModel.find({ productId: input.productId }).lean();
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const specsStr = product.specifications
      ? Object.entries(product.specifications as Record<string, string>)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" | ")
      : "";

    const langInstruction =
      input.language === "ar"
        ? "أجب باللغة العربية فقط، بأسلوب ودي ومختصر."
        : input.language === "fr"
          ? "Réponds en français uniquement, de façon amicale et concise."
          : "Reply in English only, friendly and concise.";

    const prompt = [
      {
        role: "system" as const,
        content:
          `${langInstruction} You are a helpful assistant for Visa Store, an Algerian electronics e-commerce shop. Answer ONLY using the real product data provided. Never invent specs, stock, price, shipping, or warranty. If information is missing, say the support team will confirm. Keep answers short (2-4 sentences max).`,
      },
      {
        role: "user" as const,
        content: `Product: ${product.name.ar || product.name.fr || product.name.en}. Price: ${product.basePrice} DZD${product.discountPrice ? ` (promo: ${product.discountPrice} DZD)` : ""}. Condition: ${product.condition}. Specs: ${specsStr || "not specified"}. Description: ${product.description?.ar || product.description?.fr || ""}. Variants: ${variants.map((v) => `${v.ram ? `RAM ${v.ram}` : ""} ${v.storage ? `Storage ${v.storage}` : ""} ${v.color || ""} — ${v.price} DZD — stock ${v.stock}`).join(" | ") || "no variants"}. Customer question: ${input.message}`,
      },
    ];

    let message = "";
    try {
      message = await askOllama(prompt);
    } catch {
      message = `المعلومة المتاحة حالياً: سعر المنتج يبدأ من ${product.basePrice} دج، والمخزون الفعلي يعتمد على النسخة المختارة. إذا احتجت تأكيداً إضافياً سيتواصل معك الدعم.`;
    }

    return res.json({ message });
  }),
);

router.post(
  "/ai/order-confirmation",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        orderId: z.string(),
        message: z.string().min(1),
        language: z.enum(["ar", "fr", "en"]).default("ar"),
      })
      .parse(req.body);

    const order = await OrderModel.findById(input.orderId).populate("customer.wilaya").lean();
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.status !== "PENDING_AI_CONFIRMATION") {
      throw new AppError("Order is no longer awaiting AI confirmation", 400);
    }

    const conversation =
      (await AiConversationModel.findOne({ order: order._id })) ||
      (await AiConversationModel.create({
        order: order._id,
        customerPhone: order.customer?.phone || "",
        messages: [],
        language: input.language,
      }));

    conversation.messages.push({ role: "user", content: input.message });
    const explicitConfirmation = confirmWords.some((word) =>
      input.message.toLowerCase().includes(word.toLowerCase()),
    );

    const numberFormatter = new Intl.NumberFormat("ar-DZ");
    const itemsSummary = order.items
      .map((item) => `${item.productName.ar || item.productName.en} × ${item.quantity}`)
      .join("، ");
    const customerInfo = order.customer;
    const deliveryInfo =
      order.deliveryType === "HOME_DELIVERY"
        ? `delivery to address: ${customerInfo?.address}, ${customerInfo?.commune}`
        : `pickup from delivery office in ${customerInfo?.commune}`;

    const prompt = [
      {
        role: "system" as const,
        content:
          "Reply in clear, friendly Arabic only — never mix in French or English words. Keep replies short (2-4 sentences), structured, and easy to scan. Confirm order and customer details (name, phone, address) using real order data only, and never invent stock, price, shipping, or contact info. If the customer asks to change their name, phone, or address, acknowledge the new value and say support will update it before the confirmation call. End every reply with one clear instruction: write 'نعم' to confirm, or describe what to change. If unsure about something, say support will verify it by phone.",
      },
      {
        role: "user" as const,
        content: `Order ${order.orderNumber}. Customer: ${customerInfo?.fullName}, phone ${customerInfo?.phone}, ${deliveryInfo}. Items: ${itemsSummary}. Total ${order.total} DZD. Shipping fee ${order.shippingFee} DZD. Customer message: ${input.message}`,
      },
    ];

    let message = "";
    try {
      message = await askOllama(prompt);
    } catch {
      message = explicitConfirmation
        ? `تم استلام تأكيدك ✅ سيتم تجهيز طلبك رقم ${order.orderNumber} وسيتصل بك فريقنا قريباً لتأكيد موعد التوصيل.`
        : `حسناً، إليك تفاصيل طلبك رقم ${order.orderNumber} مرة أخرى:

👤 الاسم: ${customerInfo?.fullName}
📞 الهاتف: ${customerInfo?.phone}
💰 المجموع: ${numberFormatter.format(order.total)} دج
🚚 رسوم التوصيل: ${numberFormatter.format(order.shippingFee)} دج

اكتب "نعم" لتأكيد الطلب كما هو، أو أخبرنا بما تريد تعديله.`;
    }

    conversation.messages.push({ role: "assistant", content: message });
    await conversation.save();

    return res.json({ message, confirmed: explicitConfirmation });
  }),
);

// Admin: suggest price in DZD based on product specs
router.post(
  "/ai/suggest-price",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        name: z.string().min(1),
        category: z.string().optional(),
        condition: z.string().optional(),
        specs: z.record(z.string(), z.string()).optional(),
      })
      .parse(req.body);

    const specsText = input.specs
      ? Object.entries(input.specs).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" | ")
      : "";
    const condText = input.condition === "USED" ? "used/refurbished" : "new";

    const prompt = [
      {
        role: "system" as const,
        content:
          "You are a pricing expert for an Algerian electronics reseller. Prices are in DZD (Algerian Dinar). Current exchange: 1 USD ≈ 135 DZD. Consider local market conditions and typical Algerian e-commerce prices. RESPOND ONLY WITH VALID JSON — no markdown, no extra text.",
      },
      {
        role: "user" as const,
        content: `Suggest a retail price in DZD for: ${input.name}. Condition: ${condText}. Category: ${input.category || "electronics"}. Specs: ${specsText || "not specified"}.\n\nRespond with this exact JSON:\n{"suggested":85000,"min":75000,"max":95000,"note_ar":"سبب التسعير في جملة واحدة"}`,
      },
    ];

    try {
      const raw = await askOllama(prompt);
      const jsonMatch = raw.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      const parsed = JSON.parse(jsonMatch[0]) as { suggested?: number; min?: number; max?: number; note_ar?: string };
      return res.json({
        suggested: parsed.suggested ?? 0,
        min: parsed.min ?? 0,
        max: parsed.max ?? 0,
        note_ar: parsed.note_ar ?? "",
      });
    } catch {
      return res.status(503).json({ error: "AI unavailable" });
    }
  }),
);

// Admin: AI insights summary from dashboard stats
router.post(
  "/ai/dashboard-insights",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        todayOrders: z.number(),
        weekOrders: z.number(),
        revenue: z.number(),
        deliveredOrders: z.number(),
        pendingOrders: z.number(),
        lowStockCount: z.number(),
        topProducts: z.array(z.object({ name: z.string(), sold: z.number() })).optional(),
      })
      .parse(req.body);

    const topStr = input.topProducts?.slice(0, 3).map((p) => `${p.name} (${p.sold} sold)`).join("، ") || "";

    const prompt = [
      {
        role: "system" as const,
        content:
          "أنت مستشار أعمال لمتجر إلكتروني جزائري. اكتب تحليلاً موجزاً وعملياً. RESPOND ONLY WITH VALID JSON — no markdown, no extra text.",
      },
      {
        role: "user" as const,
        content: `Stats: today ${input.todayOrders} orders, this week ${input.weekOrders}, total revenue ${input.revenue} DZD, delivered ${input.deliveredOrders}, pending ${input.pendingOrders}, low stock items ${input.lowStockCount}. Top products: ${topStr || "none"}.\n\nRespond with this exact JSON:\n{"insight":"paragraph in Arabic (3-5 sentences): summarize performance, highlight positives, warn about risks, give 1 concrete action tip"}`,
      },
    ];

    try {
      const raw = await askOllama(prompt);
      const jsonMatch = raw.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      const parsed = JSON.parse(jsonMatch[0]) as { insight?: string };
      return res.json({ insight: parsed.insight ?? raw.slice(0, 500) });
    } catch {
      return res.status(503).json({ error: "AI unavailable" });
    }
  }),
);

// Admin: bulk generate descriptions for products missing them
router.post(
  "/ai/bulk-describe",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const input = z
      .object({ productIds: z.array(z.string()).min(1).max(20) })
      .parse(req.body);

    const products = await ProductModel.find({ _id: { $in: input.productIds } }).lean();
    const results: Array<{ id: string; name: string; ok: boolean }> = [];

    for (const product of products) {
      const name = product.name.ar || product.name.fr || product.name.en || "";
      const specsText = product.specifications
        ? Object.entries(product.specifications as Record<string, string>)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" | ")
        : "";
      const condText = product.condition === "USED" ? "مستعمل بحالة ممتازة" : "جديد";

      const prompt = [
        {
          role: "system" as const,
          content:
            "You are a product copywriter for Visa Store Algeria. RESPOND ONLY WITH VALID JSON — no markdown fences, no extra words.",
        },
        {
          role: "user" as const,
          content: `Write product descriptions for: ${name}. Condition: ${condText}. Specs: ${specsText || "not specified"}.\nRespond:\n{"ar":"2-3 sentences in Arabic","fr":"2-3 sentences in French","en":"2-3 sentences in English"}`,
        },
      ];

      try {
        const raw = await askOllama(prompt);
        const jsonMatch = raw.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) throw new Error("no json");
        const parsed = JSON.parse(jsonMatch[0]) as { ar?: string; fr?: string; en?: string };
        await ProductModel.findByIdAndUpdate(product._id, {
          $set: {
            "description.ar": parsed.ar || "",
            "description.fr": parsed.fr || "",
            "description.en": parsed.en || "",
          },
        });
        results.push({ id: String(product._id), name, ok: true });
      } catch {
        results.push({ id: String(product._id), name, ok: false });
      }
    }

    return res.json({ results });
  }),
);

// Admin: generate product descriptions from specs
router.post(
  "/ai/generate-description",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        name: z.string().min(1),
        category: z.string().optional(),
        condition: z.string().optional(),
        specs: z.record(z.string(), z.string()).optional(),
      })
      .parse(req.body);

    const specsText = input.specs
      ? Object.entries(input.specs)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" | ")
      : "";
    const condText = input.condition === "USED" ? "مستعمل بحالة ممتازة" : "جديد";

    const prompt = [
      {
        role: "system" as const,
        content:
          "You are a professional product copywriter for an Algerian e-commerce store called Visa Store. Write appealing, honest descriptions that highlight key specs. Arabic should use Algerian Arabic style. RESPOND ONLY WITH VALID JSON — no markdown fences, no extra words before or after the JSON object.",
      },
      {
        role: "user" as const,
        content: `Write product descriptions in 3 languages for: ${input.name}. Condition: ${condText}. Specs: ${specsText || "not specified"}.\n\nRespond with this exact JSON (fill the values, keep keys exact):\n{"ar":"2-3 sentences in Arabic mentioning key specs and why it is a good buy","fr":"2-3 sentences in French","en":"2-3 sentences in English"}`,
      },
    ];

    try {
      const raw = await askOllama(prompt);
      const jsonMatch = raw.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      const parsed = JSON.parse(jsonMatch[0]) as { ar?: string; fr?: string; en?: string };
      return res.json({ ar: parsed.ar || "", fr: parsed.fr || "", en: parsed.en || "" });
    } catch {
      return res.status(503).json({ error: "AI unavailable" });
    }
  }),
);

export default router;
