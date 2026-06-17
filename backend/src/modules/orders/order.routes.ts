import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { permissionMiddleware } from "../../middleware/permission.middleware.js";
import { orderCreateRateLimitMiddleware, orderTrackRateLimitMiddleware } from "../../middleware/rateLimit.middleware.js";
import { OrderModel, PromoCodeUsageModel } from "../../models/orders.model.js";
import { ProductVariantModel } from "../../models/catalog.model.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AppError } from "../../utils/app-error.js";
import { syncCommissionForOrder } from "../../utils/commission.js";
import { buildOrderItems, resolveAffiliate, resolveShippingFee, validatePromoCode } from "../../utils/order.js";
import { sendTelegramMessage } from "../../utils/telegram.js";
import { sendCapiEvent } from "../../utils/capi.js";

const router = Router();

const createOrderSchema = z.object({
  customer: z.object({
    fullName: z.string().min(2),
    phone: z.string().regex(/^(05|06|07)\d{8}$/),
    wilayaCode: z.string(),
    commune: z.string().min(2),
    address: z.string().min(5),
  }),
  items: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string(),
        quantity: z.number().min(1),
      }),
    )
    .min(1),
  deliveryType: z.enum(["HOME_DELIVERY", "DESK_PICKUP"]),
  promoCode: z.string().optional(),
  affiliateRef: z.string().optional(),
  // CAPI deduplication fields — not stored in DB
  capiEventId: z.string().max(64).optional(),
  fbp: z.string().max(256).optional(),
  fbc: z.string().max(256).optional(),
  clientUserAgent: z.string().max(512).optional(),
});

function createOrderNumber() {
  return `VS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function createConfirmationToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashConfirmationToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hasValidConfirmationToken(order: { confirmationTokenHash: string }, token: string) {
  const providedHash = hashConfirmationToken(token);
  return crypto.timingSafeEqual(Buffer.from(order.confirmationTokenHash, "hex"), Buffer.from(providedHash, "hex"));
}

function maskPhone(phone: string) {
  return phone.length >= 4 ? `${phone.slice(0, 2)}******${phone.slice(-2)}` : phone;
}

function serializeTrackedOrder(order: any) {
  if (!order?.customer) {
    return null;
  }

  return {
    _id: String(order._id),
    orderNumber: order.orderNumber,
    customer: {
      fullName: order.customer.fullName,
      phone: maskPhone(order.customer.phone),
      wilaya: order.customer.wilaya,
      commune: order.customer.commune,
      address: "",
    },
    items: order.items,
    subtotal: order.subtotal,
    discount: order.discount,
    shippingFee: order.shippingFee,
    total: order.total,
    deliveryType: order.deliveryType,
    paymentMethod: order.paymentMethod,
    promoCode: order.promoCode,
    status: order.status,
    aiConfirmed: order.aiConfirmed,
    createdAt: order.createdAt,
  };
}

router.post(
  "/orders",
  orderCreateRateLimitMiddleware,
  asyncHandler(async (req, res) => {
    const input = createOrderSchema.parse(req.body);
    const confirmationToken = createConfirmationToken();
    const { items, subtotal, categoryIds } = await buildOrderItems(input.items);
    const { wilaya, fee } = await resolveShippingFee(input.customer.wilayaCode, input.deliveryType);

    let discount = 0;
    let promoAffiliateId: string | undefined;
    let promoDocumentId: string | undefined;

    if (input.promoCode) {
      const promoResult = await validatePromoCode({
        code: input.promoCode,
        phone: input.customer.phone,
        subtotal,
        productIds: input.items.map((item) => item.productId),
        categoryIds,
        shippingFee: fee,
      });

      discount = promoResult.discount;
      promoAffiliateId = promoResult.promo.affiliate ? String(promoResult.promo.affiliate) : undefined;
      promoDocumentId = String(promoResult.promo._id);
      promoResult.promo.usedCount += 1;
      await promoResult.promo.save();
    }

    const affiliate = await resolveAffiliate(input.affiliateRef, promoAffiliateId);
    const order = await OrderModel.create({
      orderNumber: createOrderNumber(),
      confirmationTokenHash: hashConfirmationToken(confirmationToken),
      customer: {
        fullName: input.customer.fullName,
        phone: input.customer.phone,
        wilaya: wilaya._id,
        commune: input.customer.commune,
        address: input.customer.address,
      },
      items,
      subtotal,
      discount,
      shippingFee: fee,
      total: Math.max(0, subtotal + fee - discount),
      deliveryType: input.deliveryType,
      paymentMethod: "COD",
      promoCode: input.promoCode?.toUpperCase(),
      affiliate: affiliate?._id,
      status: "PENDING_AI_CONFIRMATION",
      aiConfirmed: false,
    });

    if (promoDocumentId) {
      await PromoCodeUsageModel.create({
        promoCode: promoDocumentId,
        order: order._id,
        phone: input.customer.phone,
        discountAmount: discount,
      });
    }

    const populatedOrder = await OrderModel.findById(order._id)
      .select("-confirmationTokenHash")
      .populate("customer.wilaya")
      .populate("affiliate", "-passwordHash")
      .lean();
    const customer = populatedOrder?.customer;

    const wilayaName =
      customer && typeof customer.wilaya !== "string" && "name" in customer.wilaya
        ? (customer.wilaya as { name: { en: string } }).name.en
        : "";
    const itemsList = order.items.map((item) => `- ${item.productName.en} (${item.variantLabel}) x${item.quantity}`).join("\n");
    void sendTelegramMessage(
      `🛒 <b>New order received</b>\n` +
        `Order: ${order.orderNumber}\n` +
        `Customer: ${customer?.fullName}\n` +
        `Phone: ${customer?.phone}\n` +
        `Wilaya: ${wilayaName}, ${customer?.commune}\n` +
        `Delivery: ${order.deliveryType}\n` +
        `Items:\n${itemsList}\n` +
        `Total: ${order.total} DZD`,
    );

    // Server-side Meta Conversions API — fires alongside the browser Pixel for better signal quality.
    // capiEventId deduplicates with the browser-side Pixel event so Meta only counts it once.
    const nameParts = input.customer.fullName.trim().split(/\s+/);
    const capiBase = {
      phone: input.customer.phone,
      firstName: nameParts[0] ?? "",
      lastName: nameParts.slice(1).join(" "),
      city: input.customer.commune,
      state: wilayaName,
      country: "dz",
      clientIp: req.ip,
      clientUserAgent: input.clientUserAgent ?? String(req.headers["user-agent"] ?? ""),
      fbp: input.fbp,
      fbc: input.fbc,
      currency: "DZD",
      value: order.total,
      contentIds: [String(order._id)],
      sourceUrl: `${process.env.FRONTEND_URL ?? ""}/checkout`,
    };

    void sendCapiEvent({ eventName: "Lead", eventId: input.capiEventId, ...capiBase });
    void sendCapiEvent({
      eventName: "Purchase",
      eventId: input.capiEventId ? `${input.capiEventId}_purchase` : undefined,
      ...capiBase,
    });

    return res.status(201).json({
      ...populatedOrder,
      confirmationToken,
    });
  }),
);

router.post(
  "/orders/:id/confirm",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        confirmationToken: z.string().regex(/^[0-9a-f]{64}$/i, "Invalid confirmation token"),
      })
      .parse(req.body);
    const order = await OrderModel.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (!hasValidConfirmationToken(order, input.confirmationToken)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (order.status === "AWAITING_CALL_CONFIRMATION" && order.aiConfirmed) {
      return res.json(
        await OrderModel.findById(order._id)
          .select("-confirmationTokenHash")
          .populate("customer.wilaya")
          .populate("affiliate", "-passwordHash")
          .lean(),
      );
    }

    if (order.status !== "PENDING_AI_CONFIRMATION") {
      throw new AppError("Order is not awaiting AI confirmation", 400);
    }

    for (const item of order.items) {
      const variant = await ProductVariantModel.findById(item.variantId);
      if (!variant || variant.stock < item.quantity) {
        throw new AppError(`Stock changed for ${item.productName.en}`, 400);
      }
    }

    for (const item of order.items) {
      await ProductVariantModel.findByIdAndUpdate(item.variantId, { $inc: { stock: -item.quantity } });
    }

    order.aiConfirmed = true;
    order.status = "AWAITING_CALL_CONFIRMATION";
    await order.save();

    return res.json(
      await OrderModel.findById(order._id)
        .select("-confirmationTokenHash")
        .populate("customer.wilaya")
        .populate("affiliate", "-passwordHash")
        .lean(),
    );
  }),
);

router.post(
  "/orders/:id/ai-confirm",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        confirmationToken: z.string().regex(/^[0-9a-f]{64}$/i, "Invalid confirmation token"),
      })
      .parse(req.body);
    const order = await OrderModel.findById(req.params.id).populate("customer.wilaya").lean();
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (!hasValidConfirmationToken(order, input.confirmationToken)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (order.status !== "PENDING_AI_CONFIRMATION") {
      throw new AppError("Order is no longer awaiting AI confirmation", 400);
    }

    const customer = order.customer;
    const populatedWilaya =
      customer && typeof customer.wilaya !== "string" && "name" in customer.wilaya
        ? (customer.wilaya as { name: { ar: string } })
        : null;
    const wilayaName = populatedWilaya ? populatedWilaya.name.ar : "الولاية المحددة";
    const numberFormatter = new Intl.NumberFormat("ar-DZ");
    const itemsList = order.items
      .map((item) => `• ${item.productName.ar || item.productName.en} × ${item.quantity}`)
      .join("\n");
    const deliveryLine =
      order.deliveryType === "HOME_DELIVERY"
        ? `📍 العنوان: ${customer?.address}, ${customer?.commune}, ${wilayaName}`
        : `📍 الاستلام من: مكتب التوصيل في ${wilayaName} (${customer?.commune})`;

    return res.json({
      message: `مرحباً 👋 إليك ملخص طلبك رقم ${order.orderNumber}:

👤 الاسم: ${customer?.fullName}
📞 الهاتف: ${customer?.phone}
${deliveryLine}

${itemsList}

💰 المجموع الكلي: ${numberFormatter.format(order.total)} دج
🚚 رسوم التوصيل: ${numberFormatter.format(order.shippingFee)} دج

إذا كانت هذه المعلومات صحيحة، اكتب "نعم" لتأكيد الطلب.
وإذا أردت تعديل أي تفاصيل (الاسم، الهاتف، العنوان، الكمية...)، أخبرنا بذلك وسنساعدك فوراً.`,
    });
  }),
);

router.get(
  "/orders/track-by-phone/:phone",
  orderTrackRateLimitMiddleware,
  asyncHandler(async (req, res) => {
    const input = z.object({
      phone: z.string().regex(/^(05|06|07)\d{8}$/),
    }).parse(req.params);

    const orders = await OrderModel.find({ "customer.phone": input.phone })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("customer.wilaya")
      .lean();

    return res.json(orders.map((order) => serializeTrackedOrder(order)));
  }),
);

router.get(
  "/admin/orders",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (_req, res) => {
    return res.json(
      await OrderModel.find()
        .select("-confirmationTokenHash")
        .sort({ createdAt: -1 })
        .populate("customer.wilaya")
        .populate("affiliate", "-passwordHash")
        .lean(),
    );
  }),
);

const RESTOCKABLE_STATUSES = ["CANCELLED", "RETURNED", "FAILED"];

router.patch(
  "/admin/orders/:id/status",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (req, res) => {
    const input = z.object({
      status: z.enum([
        "PENDING_AI_CONFIRMATION",
        "AWAITING_CALL_CONFIRMATION",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "PICKED_UP",
        "CANCELLED",
        "RETURNED",
        "FAILED",
      ]),
    }).parse(req.body);

    const existing = await OrderModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Order not found" });
    }

    const wasRestockable = RESTOCKABLE_STATUSES.includes(existing.status);
    const willBeRestockable = RESTOCKABLE_STATUSES.includes(input.status);

    if (existing.aiConfirmed && willBeRestockable && !wasRestockable) {
      for (const item of existing.items) {
        await ProductVariantModel.findByIdAndUpdate(item.variantId, { $inc: { stock: item.quantity } });
      }
    } else if (existing.aiConfirmed && !willBeRestockable && wasRestockable) {
      for (const item of existing.items) {
        await ProductVariantModel.findByIdAndUpdate(item.variantId, { $inc: { stock: -item.quantity } });
      }
    }

    const order = await OrderModel.findByIdAndUpdate(req.params.id, { status: input.status }, { new: true })
      .select("-confirmationTokenHash")
      .populate("customer.wilaya")
      .populate("affiliate", "-passwordHash");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    await syncCommissionForOrder(String(order._id), "admin");
    return res.json(order);
  }),
);

router.delete(
  "/admin/orders/:id",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (req, res) => {
    const existing = await OrderModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (existing.aiConfirmed && !RESTOCKABLE_STATUSES.includes(existing.status)) {
      for (const item of existing.items) {
        await ProductVariantModel.findByIdAndUpdate(item.variantId, { $inc: { stock: item.quantity } });
      }
    }

    await OrderModel.findByIdAndDelete(req.params.id);
    return res.json({ success: true });
  }),
);

export default router;
