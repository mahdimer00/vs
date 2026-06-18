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
import { createZRParcel, generateZRLabelPdf, isZRConfigured } from "../../utils/zrexpress.js";

const router = Router();

const ORDER_STATUS_VALUES = [
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
] as const;

const LEGACY_PENDING_STATUS = "PENDING_AI_CONFIRMATION";
const PHONE_CONFIRMATION_STATUS = "AWAITING_CALL_CONFIRMATION";
const STOCK_RESERVED_STATUSES = new Set(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "PICKED_UP"]);
const RESTOCKABLE_STATUSES = new Set(["CANCELLED", "RETURNED", "FAILED"]);

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

function hasReservedStock(order: { stockReserved?: boolean; aiConfirmed?: boolean }) {
  return Boolean(order.stockReserved || order.aiConfirmed);
}

function maskPhone(phone: string) {
  return phone.length >= 4 ? `${phone.slice(0, 2)}******${phone.slice(-2)}` : phone;
}

async function loadOrderResponse(orderId: string) {
  return OrderModel.findById(orderId)
    .select("-confirmationTokenHash")
    .populate("customer.wilaya")
    .populate("affiliate", "-passwordHash")
    .lean();
}

async function reserveStockForOrder(order: {
  items: Array<{ variantId: string; quantity: number; productName: { en: string } }>;
}) {
  for (const item of order.items) {
    const variant = await ProductVariantModel.findById(item.variantId);
    if (!variant || variant.stock < item.quantity) {
      throw new AppError(`Stock changed for ${item.productName.en}`, 400);
    }
  }

  for (const item of order.items) {
    await ProductVariantModel.findByIdAndUpdate(item.variantId, { $inc: { stock: -item.quantity } });
  }
}

async function releaseStockForOrder(order: { items: Array<{ variantId: string; quantity: number }> }) {
  for (const item of order.items) {
    await ProductVariantModel.findByIdAndUpdate(item.variantId, { $inc: { stock: item.quantity } });
  }
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
    stockReserved: order.stockReserved,
    zrTrackingNumber: order.zrTrackingNumber ?? null,
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
      status: PHONE_CONFIRMATION_STATUS,
      aiConfirmed: false,
      stockReserved: false,
    });

    if (promoDocumentId) {
      await PromoCodeUsageModel.create({
        promoCode: promoDocumentId,
        order: order._id,
        phone: input.customer.phone,
        discountAmount: discount,
      });
    }

    const populatedOrder = await loadOrderResponse(String(order._id));
    if (!populatedOrder) {
      throw new AppError("Unable to load created order", 500);
    }
    const customer = populatedOrder?.customer;
    const wilayaName =
      customer && typeof customer.wilaya !== "string" && "name" in customer.wilaya
        ? (customer.wilaya as { name: { en: string } }).name.en
        : "";
    const itemsList = order.items.map((item) => `- ${item.productName.en} (${item.variantLabel}) x${item.quantity}`).join("\n");

    void sendTelegramMessage(
      [
        `🛒 <b>New order received</b>`,
        `Order: ${order.orderNumber}`,
        `Customer: ${customer?.fullName}`,
        `Phone: ${customer?.phone}`,
        `Wilaya: ${wilayaName}, ${customer?.commune}`,
        `Delivery: ${order.deliveryType}`,
        `Items:\n${itemsList}`,
        `Total: ${order.total} DZD`,
        `Status: Awaiting phone confirmation`,
        `Action: Call customer before processing`,
      ].join("\n"),
    );

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

    if (order.status === PHONE_CONFIRMATION_STATUS && hasReservedStock(order)) {
      return res.json(await loadOrderResponse(String(order._id)));
    }

    if (order.status !== LEGACY_PENDING_STATUS) {
      throw new AppError("Order is not awaiting AI confirmation", 400);
    }

    await reserveStockForOrder(order);
    order.aiConfirmed = true;
    order.stockReserved = true;
    order.status = PHONE_CONFIRMATION_STATUS;
    await order.save();

    return res.json(await loadOrderResponse(String(order._id)));
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
    if (order.status !== LEGACY_PENDING_STATUS) {
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
وإذا أردت تعديل أي تفاصيل، أخبرنا بذلك وسنساعدك فوراً.`,
    });
  }),
);

router.get(
  "/orders/track-by-phone/:phone",
  orderTrackRateLimitMiddleware,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        phone: z.string().regex(/^(05|06|07)\d{8}$/),
      })
      .parse(req.params);

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

router.patch(
  "/admin/orders/:id/status",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        status: z.enum(ORDER_STATUS_VALUES),
      })
      .parse(req.body);

    const existing = await OrderModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Order not found" });
    }

    const wasReserved = hasReservedStock(existing);
    const willBeReserved = STOCK_RESERVED_STATUSES.has(input.status);

    if (!wasReserved && willBeReserved) {
      await reserveStockForOrder(existing);
    } else if (wasReserved && !willBeReserved) {
      await releaseStockForOrder(existing);
    }

    existing.status = input.status;
    existing.stockReserved = willBeReserved;

    // Auto-create ZR Express parcel when moving to PROCESSING
    if (input.status === "PROCESSING" && !existing.zrParcelId && isZRConfigured()) {
      try {
        const populated = await OrderModel.findById(req.params.id).populate("customer.wilaya").lean();
        if (populated?.customer) {
          const { parcelId, trackingNumber } = await createZRParcel({
            orderNumber: populated.orderNumber,
            total: populated.total,
            deliveryType: populated.deliveryType as "HOME_DELIVERY" | "DESK_PICKUP",
            customer: {
              fullName: populated.customer.fullName,
              phone: populated.customer.phone,
              commune: populated.customer.commune,
              address: populated.customer.address,
            },
            items: populated.items,
          });
          existing.zrParcelId = parcelId;
          existing.zrTrackingNumber = trackingNumber;
        }
      } catch (err) {
        console.error("[ZR Express] Parcel creation failed:", err);
      }
    }

    await existing.save();

    const order = await loadOrderResponse(String(req.params.id));
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

    if (hasReservedStock(existing) && !RESTOCKABLE_STATUSES.has(existing.status)) {
      await releaseStockForOrder(existing);
    }

    await OrderModel.findByIdAndDelete(req.params.id);
    return res.json({ success: true });
  }),
);

router.get(
  "/admin/orders/:id/label",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (req, res) => {
    const order = await OrderModel.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!order.zrTrackingNumber) return res.status(400).json({ message: "No ZR Express tracking number for this order" });

    const pdf = await generateZRLabelPdf([order.zrTrackingNumber]);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="label-${order.orderNumber}.pdf"`);
    return res.send(pdf);
  }),
);

// Public webhook — ZR Express calls this with parcel state updates
router.post(
  "/webhooks/zrexpress",
  asyncHandler(async (req, res) => {
    const payload = req.body as {
      trackingNumber?: string;
      parcelId?: string;
      state?: { name?: string };
    };

    const trackingNumber = payload.trackingNumber;
    if (!trackingNumber) return res.json({ ok: true });

    const order = await OrderModel.findOne({ zrTrackingNumber: trackingNumber });
    if (!order) return res.json({ ok: true });

    const stateName = payload.state?.name?.toLowerCase() ?? "";

    let newStatus: string | null = null;
    if (stateName.includes("livr") || stateName.includes("delivered")) newStatus = "DELIVERED";
    else if (stateName.includes("retour") || stateName.includes("return")) newStatus = "RETURNED";
    else if (stateName.includes("transit") || stateName.includes("sort") || stateName.includes("ship")) newStatus = "SHIPPED";

    if (newStatus && order.status !== newStatus) {
      order.status = newStatus as typeof order.status;
      await order.save();
      await syncCommissionForOrder(String(order._id), "admin");
    }

    return res.json({ ok: true });
  }),
);

export default router;
