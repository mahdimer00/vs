import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { permissionMiddleware } from "../../middleware/permission.middleware.js";
import { orderCreateRateLimitMiddleware, orderTrackRateLimitMiddleware } from "../../middleware/rateLimit.middleware.js";
import { OrderModel, PromoCodeUsageModel } from "../../models/orders.model.js";
import { ProductModel, ProductVariantModel } from "../../models/catalog.model.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AppError } from "../../utils/app-error.js";
import { syncCommissionForOrder } from "../../utils/commission.js";
import { buildOrderItems, resolveAffiliate, resolveShippingFee, validatePromoCode } from "../../utils/order.js";
import { sendTelegramMessage } from "../../utils/telegram.js";
import { sendCapiEvent } from "../../utils/capi.js";
import { sendTikTokEvent } from "../../utils/tiktokEvents.js";
import { env } from "../../config/env.js";
import { cancelZRParcel, createZRParcel, generateZRBulkLabelPdf, generateZRLabelPdf, getZRParcel, getZRParcelHistory, getZRTerritories, isZRConfigured, listZRWebhooks, registerZRWebhook, setZRParcelState, ZR_SUPPLIER_STATES } from "../../utils/zrexpress.js";
import { isWhatsAppConfigured, sendWhatsAppOrderCreated, sendWhatsAppStatusUpdate, verifyVerificationToken } from "../../utils/otp.js";
import { emitOrderUpdate } from "../../utils/sse.js";

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
    fullName: z.string().min(4).refine(
      (v) => v.trim().split(/\s+/).filter(Boolean).length >= 2,
      "يجب إدخال الاسم واللقب معاً (مثال: أحمد محمد)",
    ),
    phone: z.string().regex(/^(05|06|07)\d{8}$/),
    phone2: z.string().regex(/^(05|06|07)\d{8}$/).optional(),
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
  phoneVerificationToken: z.string().optional(),
  zrTerritoryId: z.string().uuid().optional(),
  manualConfirm: z.boolean().optional(),
});

function isOtpEnforced(): boolean {
  return isWhatsAppConfigured();
}

function createOrderNumber() {
  const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
  return `VS-${code}`;
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

    // Verify phone OTP token when OTP is enforced (skip if customer chose manual phone-call confirmation)
    if (isOtpEnforced() && !input.manualConfirm) {
      if (!input.phoneVerificationToken) {
        throw new AppError("يجب التحقق من رقم هاتفك أولاً", 400);
      }
      if (!verifyVerificationToken(input.phoneVerificationToken, input.customer.phone)) {
        throw new AppError("رمز التحقق منتهي الصلاحية أو غير صحيح. أعد التحقق.", 400);
      }
    }

    const confirmationToken = createConfirmationToken();
    const { items, subtotal, categoryIds } = await buildOrderItems(input.items);
    const { wilaya, fee } = await resolveShippingFee(input.customer.wilayaCode, input.deliveryType, input.zrTerritoryId);

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
        phone2: input.customer.phone2 ?? null,
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
      zrTerritoryId: input.zrTerritoryId ?? null,
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

    const ttqContents = order.items.map((item) => ({
      content_id: String(item.productId),
      content_type: "product" as const,
      content_name: item.productName.en || item.productName.ar || item.productName.fr || "",
      price: item.unitPrice,
      quantity: item.quantity,
    }));
    const ttqBase = {
      phone: input.customer.phone,
      clientIp: req.ip,
      clientUserAgent: input.clientUserAgent ?? String(req.headers["user-agent"] ?? ""),
      sourceUrl: `${env.FRONTEND_URL}/checkout`,
      value: order.total,
      currency: "DZD",
      contents: ttqContents,
    };
    void sendTikTokEvent({ event: "PlaceAnOrder", eventId: input.capiEventId, ...ttqBase });
    void sendTikTokEvent({ event: "Purchase", eventId: input.capiEventId ? `${input.capiEventId}_ttq_purchase` : undefined, ...ttqBase });

    // Send WhatsApp confirmation to customer (best-effort, includes product summary)
    if (isWhatsAppConfigured()) {
      const storeSettings = await import("../../models/catalog.model.js").then(
        (m) => m.WebsiteSettingModel.findOne().select("storeName").lean().catch(() => null),
      );
      void sendWhatsAppOrderCreated({
        customer: { fullName: input.customer.fullName, phone: input.customer.phone },
        orderNumber: order.orderNumber,
        items: order.items,
        total: order.total,
        deliveryType: order.deliveryType,
        storeName: storeSettings?.storeName || "VisaStore",
      }).catch((err) => console.error("[WhatsApp] Order notification failed:", err));
    }

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

// Public: ZR Express territories with delivery prices (cached, used for checkout commune selector)
router.get(
  "/zr-territories",
  asyncHandler(async (_req, res) => {
    const territories = await getZRTerritories();
    return res.json(territories);
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

// Public: get live ZR tracking timeline for a specific order number
router.get(
  "/orders/:orderNumber/zr-tracking",
  orderTrackRateLimitMiddleware,
  asyncHandler(async (req, res) => {
    const { orderNumber } = req.params;
    const order = await OrderModel.findOne({ orderNumber }).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!order.zrParcelId) return res.json({ tracking: [], trackingNumber: null });

    const history = await getZRParcelHistory(order.zrParcelId);
    return res.json({ tracking: history, trackingNumber: order.zrTrackingNumber ?? null });
  }),
);

router.get(
  "/admin/orders",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const skip = Number(req.query.skip) || 0;
    const statusFilter = typeof req.query.status === "string" && req.query.status ? req.query.status : null;

    const query = statusFilter ? { status: statusFilter } : {};
    const [orders, total] = await Promise.all([
      OrderModel.find(query)
        .select("-confirmationTokenHash")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("customer.wilaya")
        .populate("affiliate", "-passwordHash")
        .lean(),
      OrderModel.countDocuments(query),
    ]);

    return res.json({ orders, total, limit, skip });
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

    // Cancel ZR Express parcel when order is cancelled / returned / failed
    const ZR_CANCEL_STATUSES = new Set(["CANCELLED", "RETURNED", "FAILED"]);
    if (ZR_CANCEL_STATUSES.has(input.status) && existing.zrParcelId) {
      void cancelZRParcel(existing.zrParcelId);
    }

    // Auto-create ZR Express parcel when moving to CONFIRMED, PROCESSING, or SHIPPED
    if ((input.status === "CONFIRMED" || input.status === "PROCESSING" || input.status === "SHIPPED") && !existing.zrParcelId && isZRConfigured()) {
      try {
        const populated = await OrderModel.findById(req.params.id).populate("customer.wilaya").lean();
        if (populated?.customer) {
          const { parcelId, trackingNumber } = await createZRParcel({
            orderNumber: populated.orderNumber,
            total: populated.total,
            deliveryType: populated.deliveryType as "HOME_DELIVERY" | "DESK_PICKUP",
            zrTerritoryId: populated.zrTerritoryId as string | undefined,
            customer: {
              fullName: populated.customer.fullName,
              phone: populated.customer.phone,
              phone2: populated.customer.phone2 as string | undefined,
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
    emitOrderUpdate(String(order._id), input.status);

    // Send WhatsApp notification to customer on key status changes
    const WA_NOTIFY_STATUSES = new Set(["SHIPPED", "DELIVERED", "PICKED_UP", "CANCELLED", "RETURNED"]);
    if (WA_NOTIFY_STATUSES.has(input.status) && isWhatsAppConfigured() && existing.customer?.phone) {
      void sendWhatsAppStatusUpdate(
        existing.customer.phone,
        existing.orderNumber,
        existing.zrTrackingNumber ?? "",
        input.status,
      );
    }

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

// Admin: send ZR waybill label to Telegram
router.post(
  "/admin/orders/:id/label-telegram",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (req, res) => {
    const order = await OrderModel.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!order.zrTrackingNumber) return res.status(400).json({ message: "No ZR Express tracking number for this order" });

    const { sendTelegramDocument } = await import("../../utils/telegram.js");
    const pdf = await generateZRLabelPdf([order.zrTrackingNumber]);
    const filename = `waybill-${order.orderNumber}.pdf`;
    const caption = `📦 Waybill — ${order.orderNumber}\n🔍 Tracking: ${order.zrTrackingNumber}\n👤 ${order.customer?.fullName ?? ""} · ${order.customer?.phone ?? ""}`;
    await sendTelegramDocument(pdf, filename, caption);
    return res.json({ success: true });
  }),
);

// Admin: get ZR parcel tracking history
router.get(
  "/admin/orders/:id/zr-history",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (req, res) => {
    const order = await OrderModel.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!order.zrParcelId) return res.status(400).json({ message: "No ZR parcel for this order" });
    const history = await getZRParcelHistory(order.zrParcelId);
    return res.json(history);
  }),
);

// Admin: refresh ZR parcel status from ZR API and sync to order
router.post(
  "/admin/orders/:id/zr-sync",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (req, res) => {
    const order = await OrderModel.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!order.zrParcelId) return res.status(400).json({ message: "No ZR parcel for this order" });

    const parcel = await getZRParcel(order.zrParcelId);
    if (!parcel) return res.status(502).json({ message: "Could not reach ZR Express" });

    const stateName = (parcel.state?.name ?? "").toLowerCase();
    let newStatus: (typeof ORDER_STATUS_VALUES)[number] | null = null;
    if (stateName.includes("livr") || stateName.includes("delivered")) newStatus = "DELIVERED";
    else if (stateName.includes("ramass") || stateName.includes("picked up") || stateName.includes("enlev")) newStatus = "PICKED_UP";
    else if (stateName.includes("retour") || stateName.includes("return")) newStatus = "RETURNED";
    else if (stateName.includes("annul") || stateName.includes("cancel")) newStatus = "CANCELLED";
    else if (stateName.includes("echec") || stateName.includes("failed")) newStatus = "FAILED";
    else if (stateName.includes("transit") || stateName.includes("sort") || stateName.includes("ship") || stateName.includes("en cours")) newStatus = "SHIPPED";
    else if (stateName.includes("pris en charge") || stateName.includes("accept")) newStatus = "PROCESSING";

    const statusRank: Record<string, number> = {
      PENDING_AI_CONFIRMATION: 0, AWAITING_CALL_CONFIRMATION: 1,
      CONFIRMED: 2, PROCESSING: 3, SHIPPED: 4,
      DELIVERED: 5, PICKED_UP: 5, FAILED: 6, RETURNED: 6, CANCELLED: 6,
    };
    const currentRank = statusRank[order.status] ?? 0;
    const newRank = newStatus ? (statusRank[newStatus] ?? 0) : -1;
    if (newStatus && newStatus !== order.status && newRank > currentRank) {
      const wasReserved = hasReservedStock(order);
      const willBeReserved = STOCK_RESERVED_STATUSES.has(newStatus);
      if (wasReserved && !willBeReserved) await releaseStockForOrder(order);
      order.status = newStatus;
      order.stockReserved = willBeReserved;
      await order.save();
      await syncCommissionForOrder(String(order._id), "admin");
      // Push real-time update to connected admin dashboard clients
      emitOrderUpdate(String(order._id), newStatus);

      // Send WhatsApp notification to customer (ZR-triggered)
      const ZR_WA_STATUSES = new Set(["SHIPPED", "DELIVERED", "PICKED_UP", "CANCELLED", "RETURNED"]);
      if (ZR_WA_STATUSES.has(newStatus) && isWhatsAppConfigured() && order.customer?.phone) {
        void sendWhatsAppStatusUpdate(
          order.customer.phone,
          order.orderNumber,
          order.zrTrackingNumber ?? "",
          newStatus,
        );
      }

      // Auto-restock on RETURNED (zr-sync)
      if (newStatus === "RETURNED") {
        for (const item of order.items) {
          if (item.variantId) {
            await ProductVariantModel.findByIdAndUpdate(item.variantId, { $inc: { stock: item.quantity } });
          }
          await ProductModel.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
        }
      }
    }

    return res.json({ zrState: parcel.state?.name ?? "", orderStatus: order.status });
  }),
);

// Admin: get available ZR states that supplier can set
router.get(
  "/admin/zr/states",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (_req, res) => {
    return res.json(ZR_SUPPLIER_STATES);
  }),
);

// Admin: change ZR parcel state directly from the site
router.post(
  "/admin/orders/:id/zr-set-state",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (req, res) => {
    const { stateId } = z.object({ stateId: z.string().uuid() }).parse(req.body);
    const validIds = ZR_SUPPLIER_STATES.map((s) => s.id);
    if (!validIds.includes(stateId as typeof validIds[number])) {
      return res.status(400).json({ message: "Invalid ZR state ID" });
    }
    const order = await OrderModel.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!order.zrParcelId) return res.status(400).json({ message: "No ZR parcel for this order" });

    const result = await setZRParcelState(order.zrParcelId, stateId);
    const stateLabel = ZR_SUPPLIER_STATES.find((s) => s.id === stateId)?.label ?? result.newStateName;
    return res.json({ ok: true, newStateName: result.newStateName, stateLabel });
  }),
);

// Admin: bulk print ZR labels for filtered orders (up to 50)
router.post(
  "/admin/zr/bulk-labels",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (req, res) => {
    const { orderIds } = z.object({ orderIds: z.array(z.string()).min(1).max(50) }).parse(req.body);
    const orders = await OrderModel.find({ _id: { $in: orderIds }, zrTrackingNumber: { $ne: null } }).lean();
    const trackingNumbers = orders.map((o) => o.zrTrackingNumber).filter((tn): tn is string => Boolean(tn));
    if (trackingNumbers.length === 0) return res.status(400).json({ message: "No ZR tracking numbers found" });

    const pdf = await generateZRBulkLabelPdf(trackingNumbers);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="zr-labels-bulk.pdf"`);
    return res.send(pdf);
  }),
);

// Status rank — webhook only moves FORWARD (never downgrade via ZR webhook)
const ZR_STATUS_RANK: Record<string, number> = {
  PENDING_AI_CONFIRMATION: 0,
  AWAITING_CALL_CONFIRMATION: 1,
  CONFIRMED: 2,
  PROCESSING: 3,
  SHIPPED: 4,
  DELIVERED: 5,
  PICKED_UP: 5,
  FAILED: 6,
  RETURNED: 6,
  CANCELLED: 6,
};

// Public webhook — ZR Express calls this with parcel state updates
router.post(
  "/webhooks/zrexpress",
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    console.log("[ZR Webhook] received:", JSON.stringify(body).slice(0, 800));

    const eventType = ((body.eventType ?? body.type) as string | undefined) ?? "";
    const data = (body.data as Record<string, unknown> | undefined) ?? body;

    // trackingNumber may be at data.trackingNumber or data.parcel.trackingNumber
    const parcelObj = data.parcel as Record<string, unknown> | undefined;
    const trackingNumber = (data.trackingNumber ?? parcelObj?.trackingNumber) as string | undefined;
    if (!trackingNumber) {
      console.log("[ZR Webhook] no trackingNumber found, keys:", Object.keys(data).join(","));
      return res.json({ ok: true });
    }

    const order = await OrderModel.findOne({ zrTrackingNumber: trackingNumber });
    if (!order) {
      console.log("[ZR Webhook] no order for tracking:", trackingNumber);
      return res.json({ ok: true });
    }

    // state may be at data.state or data.parcel.state or data.newState
    const stateObj = (data.state ?? parcelObj?.state ?? data.newState) as Record<string, unknown> | undefined;
    const stateName = ((stateObj?.name as string | undefined) ?? (stateObj?.description as string | undefined) ?? "").toLowerCase();
    console.log("[ZR Webhook] order:", order.orderNumber, "event:", eventType, "state:", stateName);
    const isReturn = Boolean(data.isReturn ?? parcelObj?.isReturn);

    let newStatus: string | null = null;

    if (eventType === "parcel.isReturn.updated" && isReturn) {
      newStatus = "RETURNED";
    } else if (stateName.includes("delivered") || stateName.includes("livré") || stateName.includes("livr")) {
      newStatus = "DELIVERED";
    } else if (stateName.includes("collected") || stateName.includes("ramass") || stateName.includes("picked up") || stateName.includes("enlev")) {
      newStatus = "PICKED_UP";
    } else if (stateName.includes("retour") || stateName.includes("return") || stateName.includes("recovered")) {
      newStatus = "RETURNED";
    } else if (stateName.includes("annul") || stateName.includes("cancel")) {
      newStatus = "CANCELLED";
    } else if (stateName.includes("echec") || stateName.includes("failed") || stateName.includes("failure")) {
      newStatus = "FAILED";
    } else if (
      // English names
      stateName.includes("out for delivery") || stateName.includes("ready to ship") ||
      stateName.includes("confirmed at office") || stateName.includes("dispatch") ||
      stateName.includes("to region") || stateName.includes("in transit") ||
      // French slugs (ZR internal keys)
      stateName.includes("pret_a_expedier") || stateName.includes("prêt") || stateName.includes("pret") ||
      stateName.includes("confirme_au_bureau") || stateName.includes("vers_wilaya") ||
      stateName.includes("en_livraison") || stateName.includes("sortie_en_livraison") ||
      stateName.includes("transit") || stateName.includes("sort") ||
      stateName.includes("en cours de livraison")
    ) {
      newStatus = "SHIPPED";
    } else if (
      // English names
      stateName.includes("order received") || stateName.includes("order in process") ||
      stateName.includes("order confirmed") || stateName.includes("confirmation call") ||
      // French slugs
      stateName.includes("commande_recue") || stateName.includes("en_cours_de_traitement") ||
      stateName.includes("appel_de_confirmation") || stateName.includes("commande_confirmee") ||
      stateName.includes("pris en charge") || stateName.includes("accept") ||
      stateName.includes("en cours de traitement")
    ) {
      newStatus = "PROCESSING";
    }

    // Only update if the new status is HIGHER rank than current (never downgrade via webhook)
    const currentRank = ZR_STATUS_RANK[order.status] ?? 0;
    const newRank = newStatus ? (ZR_STATUS_RANK[newStatus] ?? 0) : -1;

    if (newStatus && newStatus !== order.status && newRank > currentRank) {
      const resolvedStatus = newStatus;
      order.status = resolvedStatus as typeof order.status;
      const wasReserved = hasReservedStock(order);
      const willBeReserved = STOCK_RESERVED_STATUSES.has(resolvedStatus as (typeof ORDER_STATUS_VALUES)[number]);
      if (wasReserved && !willBeReserved) await releaseStockForOrder(order);
      order.stockReserved = willBeReserved;
      await order.save();
      await syncCommissionForOrder(String(order._id), "admin");

      // Auto-restock on RETURNED (webhook)
      if (resolvedStatus === "RETURNED") {
        for (const item of order.items) {
          if (item.variantId) {
            await ProductVariantModel.findByIdAndUpdate(item.variantId, { $inc: { stock: item.quantity } });
          }
          await ProductModel.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
        }
      }

      // Notify customer via WhatsApp (best-effort)
      if (order.customer?.phone) {
        void sendWhatsAppStatusUpdate(order.customer.phone, order.orderNumber, trackingNumber ?? "", resolvedStatus);
      }
    }

    return res.json({ ok: true });
  }),
);

// Admin: manually create ZR parcel (retry when auto-create failed)
router.post(
  "/admin/orders/:id/zr-parcel",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (req, res) => {
    const order = await OrderModel.findById(req.params.id).populate("customer.wilaya").lean();
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.zrParcelId) return res.status(409).json({ message: "ZR parcel already exists for this order" });
    if (!isZRConfigured()) return res.status(400).json({ message: "ZR Express credentials not configured" });

    if (!order.customer) throw new AppError("Order has no customer data", 400);

    const { parcelId, trackingNumber } = await createZRParcel({
      orderNumber: order.orderNumber,
      total: order.total,
      deliveryType: order.deliveryType as "HOME_DELIVERY" | "DESK_PICKUP",
      zrTerritoryId: order.zrTerritoryId as string | undefined,
      customer: {
        fullName: order.customer.fullName,
        phone: order.customer.phone,
        phone2: order.customer.phone2 as string | undefined,
        commune: order.customer.commune,
        address: order.customer.address,
      },
      items: order.items,
    });

    await OrderModel.findByIdAndUpdate(req.params.id, { zrParcelId: parcelId, zrTrackingNumber: trackingNumber });
    return res.json({ parcelId, trackingNumber });
  }),
);

// Admin: cancel ZR parcel from site
router.post(
  "/admin/orders/:id/zr-cancel",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (req, res) => {
    const order = await OrderModel.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!order.zrParcelId) return res.status(400).json({ message: "No ZR parcel for this order" });
    await cancelZRParcel(order.zrParcelId);
    order.zrParcelId = null;
    order.zrTrackingNumber = null;
    await order.save();
    return res.json({ ok: true });
  }),
);

// Admin: save note on order
router.patch(
  "/admin/orders/:id/note",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (req, res) => {
    const { note } = z.object({ note: z.string().max(500) }).parse(req.body);
    const order = await OrderModel.findByIdAndUpdate(req.params.id, { adminNote: note || null }, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.json({ ok: true, adminNote: order.adminNote });
  }),
);

// Admin: get ZR Express connection status + registered webhook list
router.get(
  "/admin/zr/status",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (_req, res) => {
    const configured = isZRConfigured();
    const webhooks = await listZRWebhooks();
    const webhookUrl = `${env.BACKEND_URL}/api/webhooks/zrexpress`;
    return res.json({ configured, webhookUrl, webhooks });
  }),
);

// Admin: register webhook URL with ZR Express
router.post(
  "/admin/zr/webhook",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (req, res) => {
    const { url } = z.object({ url: z.string().url() }).parse(req.body);
    const result = await registerZRWebhook(url);
    return res.json(result);
  }),
);

// Admin: bulk set ZR parcels to "جاهز للشحن" (ready to ship)
router.post(
  "/admin/orders/zr-bulk-ready",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (req, res) => {
    const { orderIds } = z.object({ orderIds: z.array(z.string()).min(1).max(50) }).parse(req.body);
    const READY_STATE_ID = "8a948c66-1ab7-4433-aeb0-94219125d134";
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const orderId of orderIds) {
      const order = await OrderModel.findById(orderId).lean();
      if (!order?.zrParcelId) {
        failed.push(orderId);
        continue;
      }
      try {
        await setZRParcelState(order.zrParcelId, READY_STATE_ID);
        succeeded.push(orderId);
      } catch (err) {
        console.error(`[ZR Bulk Ready] failed for ${orderId}:`, err);
        failed.push(orderId);
      }
    }

    return res.json({ succeeded, failed });
  }),
);

// Admin: customer database — aggregate from orders
router.get(
  "/admin/customers",
  authMiddleware,
  permissionMiddleware("orders"),
  asyncHandler(async (_req, res) => {
    const results = await OrderModel.aggregate([
      {
        $group: {
          _id: "$customer.phone",
          fullName: { $last: "$customer.fullName" },
          phone: { $first: "$customer.phone" },
          orderCount: { $sum: 1 },
          totalSpent: { $sum: "$total" },
          lastOrderDate: { $max: "$createdAt" },
          statuses: { $addToSet: "$status" },
        },
      },
      { $sort: { lastOrderDate: -1 } },
    ]);
    return res.json(results);
  }),
);

export default router;
