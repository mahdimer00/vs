import { AffiliateModel, CommissionLogModel, CommissionModel } from "../models/affiliate.model.js";
import { ProductModel, WebsiteSettingModel } from "../models/catalog.model.js";
import { OrderModel } from "../models/orders.model.js";
import { sendTelegramMessage } from "./telegram.js";

const LEVEL_CAPS: Record<string, number> = {
  BRONZE: 500,
  SILVER: 700,
  GOLD: 900,
  PLATINUM: 1200,
};

async function calculateOrderCommissionAmount(
  order: { items: { productId: string; quantity: number; lineTotal: number }[] },
  level?: string,
) {
  const products = await ProductModel.find({ _id: { $in: order.items.map((item) => item.productId) } });
  const productsById = new Map(products.map((product) => [String(product._id), product]));

  let amount = 0;
  for (const item of order.items) {
    const product = productsById.get(item.productId);
    if (!product || !product.affiliateEnabled) {
      continue;
    }

    amount +=
      product.commissionType === "FIXED"
        ? product.commissionValue * item.quantity
        : Math.round((item.lineTotal * product.commissionValue) / 100);
  }

  const cap = level ? (LEVEL_CAPS[level] ?? 700) : 700;
  return Math.min(amount, cap);
}

async function maybeAwardReferralBonus(affiliate: InstanceType<typeof AffiliateModel>) {
  if (affiliate.referralBonusPaid || !affiliate.referredBy) {
    return;
  }

  const approvedSalesCount = await CommissionModel.countDocuments({
    affiliate: affiliate._id,
    type: "SALE",
    status: { $in: ["APPROVED", "PAID"] },
  });
  if (approvedSalesCount !== 1) {
    return;
  }

  const referrer = await AffiliateModel.findById(affiliate.referredBy);
  if (!referrer) {
    return;
  }

  const settings = await WebsiteSettingModel.findOne();
  const levels = settings?.affiliateLevels as Record<string, { commissionRate: number; referralBonus: number }> | undefined;
  const bonus = levels?.[referrer.level]?.referralBonus ?? 0;

  if (bonus > 0) {
    await CommissionModel.create({
      affiliate: referrer._id,
      type: "REFERRAL_BONUS",
      sourceAffiliate: affiliate._id,
      rate: 0,
      amount: bonus,
      status: "APPROVED",
      approvedAt: new Date(),
    });
    referrer.balanceApproved += bonus;
    await referrer.save();

    void sendTelegramMessage(
      `🎁 <b>Referral bonus awarded</b>\n` +
        `To: ${referrer.name}\n` +
        `For referring: ${affiliate.name}\n` +
        `Amount: ${bonus} DZD`,
    );
  }

  affiliate.referralBonusPaid = true;
  await affiliate.save();
}

// When affiliate B (referredBy A) earns a sale commission, A gets 10% of it
async function maybeAwardReferralSaleCommission(
  affiliate: InstanceType<typeof AffiliateModel>,
  saleCommissionAmount: number,
  orderId: string,
) {
  if (!affiliate.referredBy || saleCommissionAmount <= 0) return;

  // Check referrer already got a referral-sale commission for this order
  const alreadyPaid = await CommissionModel.findOne({
    order: orderId,
    type: "REFERRAL_BONUS",
    sourceAffiliate: affiliate._id,
  });
  if (alreadyPaid) return;

  const referrer = await AffiliateModel.findById(affiliate.referredBy);
  if (!referrer || referrer.status !== "ACTIVE") return;

  const referralCut = Math.round(saleCommissionAmount * 0.1); // 10% of B's commission
  if (referralCut < 1) return;

  await CommissionModel.create({
    affiliate: referrer._id,
    order: orderId,
    type: "REFERRAL_BONUS",
    sourceAffiliate: affiliate._id,
    rate: 10,
    amount: referralCut,
    status: "APPROVED",
    approvedAt: new Date(),
  });
  referrer.balanceApproved += referralCut;
  await referrer.save();
}

export async function syncCommissionForOrder(orderId: string, createdBy = "system") {
  const order = await OrderModel.findById(orderId);
  if (!order || !order.affiliate) {
    return null;
  }

  const affiliate = await AffiliateModel.findById(order.affiliate);
  if (!affiliate) {
    return null;
  }

  let commission = await CommissionModel.findOne({ order: order._id });
  const eligible = order.status === "DELIVERED" || order.status === "PICKED_UP";
  const rejected = ["CANCELLED", "RETURNED", "FAILED"].includes(order.status);

  if (eligible) {
    const amount = await calculateOrderCommissionAmount(order, affiliate.level);
    if (!commission) {
      commission = await CommissionModel.create({
        affiliate: affiliate._id,
        order: order._id,
        type: "SALE",
        rate: affiliate.commissionRate,
        amount,
        status: "APPROVED",
        approvedAt: new Date(),
      });
      affiliate.balanceApproved += amount;
      await affiliate.save();
      await maybeAwardReferralBonus(affiliate);
      // Ongoing referral commission: if affiliate was referred by someone, referrer gets 10% of this commission
      await maybeAwardReferralSaleCommission(affiliate, amount, String(order._id));
    } else if (commission.status !== "PAID" && commission.status !== "APPROVED") {
      const previous = commission.status;
      commission.status = "APPROVED";
      commission.amount = amount;
      commission.approvedAt = new Date();
      await commission.save();
      affiliate.balanceApproved += amount;
      await affiliate.save();
      await CommissionLogModel.create({ commission: commission._id, oldStatus: previous, newStatus: "APPROVED", createdBy });
      await maybeAwardReferralBonus(affiliate);
      await maybeAwardReferralSaleCommission(affiliate, amount, String(order._id));
    }
  } else if (rejected) {
    if (!commission) {
      commission = await CommissionModel.create({
        affiliate: affiliate._id,
        order: order._id,
        type: "SALE",
        rate: affiliate.commissionRate,
        amount: 0,
        status: "REJECTED",
      });
    } else if (commission.status !== "PAID" && commission.status !== "REJECTED") {
      const previous = commission.status;
      if (commission.status === "APPROVED") {
        affiliate.balanceApproved = Math.max(0, affiliate.balanceApproved - commission.amount);
        await affiliate.save();
      }
      commission.amount = 0;
      commission.status = "REJECTED";
      await commission.save();
      await CommissionLogModel.create({ commission: commission._id, oldStatus: previous, newStatus: "REJECTED", createdBy });
    }
  }

  return commission;
}
