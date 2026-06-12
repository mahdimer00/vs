import { model, Schema } from "mongoose";

const affiliateSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, required: true },
    referralCode: { type: String, required: true, unique: true, uppercase: true },
    commissionRate: { type: Number, min: 1, max: 3, default: 1 },
    status: { type: String, enum: ["PENDING", "ACTIVE", "BLOCKED"], default: "PENDING" },
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
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
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

const withdrawalRequestSchema = new Schema(
  {
    affiliate: { type: Schema.Types.ObjectId, ref: "Affiliate", required: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, required: true },
    accountInfo: { type: String, required: true },
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED", "PAID"], default: "PENDING" },
  },
  { timestamps: true },
);

export const AffiliateModel = model("Affiliate", affiliateSchema);
export const AffiliateClickModel = model("AffiliateClick", affiliateClickSchema);
export const CommissionModel = model("Commission", commissionSchema);
export const CommissionLogModel = model("CommissionLog", commissionLogSchema);
export const WithdrawalRequestModel = model("WithdrawalRequest", withdrawalRequestSchema);
