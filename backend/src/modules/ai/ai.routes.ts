import { Router } from "express";
import { z } from "zod";
import { askOllama } from "../../config/ollama.js";
import { ProductModel, ProductVariantModel } from "../../models/catalog.model.js";
import { AiConversationModel, OrderModel } from "../../models/orders.model.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AppError } from "../../utils/app-error.js";

const router = Router();

const confirmWords = ["نعم", "oui", "yes", "confirm", "ok", "موافق"];

router.post(
  "/ai/product-question",
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

    const prompt = [
      {
        role: "system" as const,
        content:
          "Answer with real product data only. Never invent stock, price, or shipping. If information is missing, say support must confirm.",
      },
      {
        role: "user" as const,
        content: `Language: ${input.language}. Product: ${product.name.ar} / ${product.name.fr} / ${product.name.en}. Price from ${product.basePrice}. Variants: ${variants
          .map((variant) => `${variant.sku} ${variant.price} stock ${variant.stock}`)
          .join(", ")}. Customer question: ${input.message}`,
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

export default router;
