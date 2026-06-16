import { Schema, model } from "mongoose";

export type AnalyticsEventType =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "checkout_start"
  | "order_submit"
  | "purchase";

interface IAnalyticsEvent {
  eventType: AnalyticsEventType;
  productId?: string;
  orderId?: string;
  pageUrl: string;
  referrer: string;
  userAgent: string;
  createdAt: Date;
}

const schema = new Schema<IAnalyticsEvent>(
  {
    eventType: {
      type: String,
      enum: ["page_view", "product_view", "add_to_cart", "checkout_start", "order_submit", "purchase"],
      required: true,
    },
    productId: { type: String },
    orderId: { type: String },
    pageUrl: { type: String, required: true, maxlength: 2048 },
    referrer: { type: String, default: "", maxlength: 2048 },
    userAgent: { type: String, default: "", maxlength: 512 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Compound index for time-range queries per event type
schema.index({ eventType: 1, createdAt: -1 });
// Index for product-level analytics
schema.index({ productId: 1, eventType: 1 });

export const AnalyticsEventModel = model<IAnalyticsEvent>("AnalyticsEvent", schema);
