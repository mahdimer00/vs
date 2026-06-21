import { model, Schema } from "mongoose";

const affiliateSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, required: true },
    referralCode: { type: String, required: true, unique: true, uppercase: true },
    commissionRate: { type: Number, min: 1, max: 10, default: 3 },
    status: { type: String, enum: ["PENDING", "ACTIVE", "BLOCKED"], default: "PENDING" },
    level: { type: String, enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM"], default: "BRONZE" },
    referredBy: { type: Schema.Types.ObjectId, ref: "Affiliate" },
    referralBonusPaid: { type: Boolean, default: false },
    balancePending: { type: Number, default: 0 },
    balanceApproved: { type: Number, default: 0 },
    balancePaid: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const affiliateClickSchema = new Schema(
  {
    affiliate: { type: Schema.Types.ObjectId, ref: "Affiliate", required: true },
    referralCode: { type: String, required: true },
    ip: String,
    userAgent: String,
  },
  { timestamps: true },
);

const commissionSchema = new Schema(
  {
    affiliate: { type: Schema.Types.ObjectId, ref: "Affiliate", required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order" },
    type: { type: String, enum: ["SALE", "REFERRAL_BONUS"], default: "SALE" },
    sourceAffiliate: { type: Schema.Types.ObjectId, ref: "Affiliate" },
    rate: { type: Number, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED", "PAID"], default: "PENDING" },
    approvedAt: Date,
    paidAt: Date,
  },
  { timestamps: true },
);

const commissionLogSchema = new Schema(
  {
    commission: { type: Schema.Types.ObjectId, ref: "Commission", required: true },
    oldStatus: String,
    newStatus: String,
    note: String,
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

const couponRequestSchema = new Schema(
  {
    affiliate: { type: Schema.Types.ObjectId, ref: "Affiliate", required: true },
    type: { type: String, enum: ["PERCENTAGE", "FIXED", "FREE_SHIPPING"], required: true },
    value: { type: Number, required: true },
    desiredCode: { type: String, uppercase: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
    adminNote: String,
    promoCode: { type: Schema.Types.ObjectId, ref: "PromoCode" },
  },
  { timestamps: true },
);

const withdrawalRequestSchema = new Schema(
  {
    affiliate: { type: Schema.Types.ObjectId, ref: "Affiliate", required: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, required: true },
    accountInfo: { type: String, required: true },
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED", "PAID"], default: "PENDING" },
    voucherCode: String,
    voucherPin: String,
    voucherExpiresAt: Date,
  },
  { timestamps: true },
);

affiliateClickSchema.index({ affiliate: 1, createdAt: -1 });
affiliateClickSchema.index({ createdAt: -1 });
commissionSchema.index({ affiliate: 1, status: 1 });
commissionSchema.index({ order: 1 }, { sparse: true });
withdrawalRequestSchema.index({ affiliate: 1, status: 1 });
couponRequestSchema.index({ affiliate: 1, status: 1 });

export const AffiliateModel = model("Affiliate", affiliateSchema);
export const AffiliateClickModel = model("AffiliateClick", affiliateClickSchema);
export const CommissionModel = model("Commission", commissionSchema);
export const CommissionLogModel = model("CommissionLog", commissionLogSchema);
export const WithdrawalRequestModel = model("WithdrawalRequest", withdrawalRequestSchema);
export const CouponRequestModel = model("CouponRequest", couponRequestSchema);
