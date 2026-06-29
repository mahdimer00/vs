import { model, Schema } from "mongoose";

// Tracks who claimed a coupon code from the campaign
const couponClaimSchema = new Schema(
  {
    phone: { type: String, required: true, index: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    promoCodeId: { type: Schema.Types.ObjectId, ref: "PromoCode" },
    usedAt: { type: Date, default: null },
    source: { type: String, default: "" }, // tiktok, facebook, instagram, direct
  },
  { timestamps: true },
);

couponClaimSchema.index({ createdAt: -1 });

export const CouponClaimModel = model("CouponClaim", couponClaimSchema);
