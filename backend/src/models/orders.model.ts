import { model, Schema } from "mongoose";
import { localizedTextSchema } from "./shared.js";

const orderItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    productName: { type: localizedTextSchema, required: true },
    productSlug: { type: String, required: true },
    variantId: { type: String, required: true },
    variantLabel: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
    image: String,
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    confirmationTokenHash: { type: String, required: true },
    customer: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      phone2: { type: String, default: null },
      wilaya: { type: Schema.Types.ObjectId, ref: "Wilaya", required: true },
      commune: { type: String, required: true },
      address: { type: String, required: true },
    },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    discount: { type: Number, required: true },
    shippingFee: { type: Number, required: true },
    total: { type: Number, required: true },
    deliveryType: { type: String, enum: ["HOME_DELIVERY", "DESK_PICKUP"], required: true },
    paymentMethod: { type: String, enum: ["COD"], default: "COD" },
    promoCode: String,
    affiliate: { type: Schema.Types.ObjectId, ref: "Affiliate" },
    status: {
      type: String,
      enum: [
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
      ],
      default: "AWAITING_CALL_CONFIRMATION",
    },
    aiConfirmed: { type: Boolean, default: false },
    stockReserved: { type: Boolean, default: false },
    zrParcelId: { type: String, default: null },
    zrTrackingNumber: { type: String, default: null },
    zrTerritoryId: { type: String, default: null },
    adminNote: { type: String, default: null },
  },
  { timestamps: true },
);

const promoCodeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    type: { type: String, enum: ["PERCENTAGE", "FIXED", "FREE_SHIPPING"], required: true },
    value: { type: Number, required: true },
    affiliate: { type: Schema.Types.ObjectId, ref: "Affiliate" },
    expiresAt: Date,
    usageLimit: Number,
    usedCount: { type: Number, default: 0 },
    minimumOrderAmount: Number,
    productRestrictions: [{ type: String }],
    categoryRestrictions: [{ type: String }],
    oneUsePerPhone: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const promoCodeUsageSchema = new Schema(
  {
    promoCode: { type: Schema.Types.ObjectId, ref: "PromoCode", required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    phone: { type: String, required: true },
    discountAmount: { type: Number, required: true },
  },
  { timestamps: true },
);

const aiConversationSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    customerPhone: { type: String, required: true },
    messages: [
      {
        role: { type: String, enum: ["user", "assistant"], required: true },
        content: { type: String, required: true },
      },
    ],
    language: { type: String, enum: ["ar", "fr", "en"], default: "ar" },
  },
  { timestamps: true },
);

// Indexes for common query patterns
orderSchema.index({ "customer.phone": 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ affiliate: 1, status: 1 });
orderSchema.index({ zrTrackingNumber: 1 }, { sparse: true });
orderSchema.index({ createdAt: -1 });
promoCodeUsageSchema.index({ phone: 1, promoCode: 1 });

export const OrderModel = model("Order", orderSchema);
export const PromoCodeModel = model("PromoCode", promoCodeSchema);
export const PromoCodeUsageModel = model("PromoCodeUsage", promoCodeUsageSchema);
export const AiConversationModel = model("AiConversation", aiConversationSchema);
