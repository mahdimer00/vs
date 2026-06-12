import { AffiliateModel, CommissionLogModel, CommissionModel } from "../models/affiliate.model.js";
import { ProductModel } from "../models/catalog.model.js";
import { OrderModel } from "../models/orders.model.js";

async function calculateOrderCommissionAmount(order: { items: { productId: string; quantity: number; lineTotal: number }[] }) {
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

  return amount;
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
    const amount = await calculateOrderCommissionAmount(order);
    if (!commission) {
      commission = await CommissionModel.create({
        affiliate: affiliate._id,
        order: order._id,
        rate: affiliate.commissionRate,
        amount,
        status: "APPROVED",
        approvedAt: new Date(),
      });
      affiliate.balanceApproved += amount;
      await affiliate.save();
    } else if (commission.status !== "PAID" && commission.status !== "APPROVED") {
      const previous = commission.status;
      commission.status = "APPROVED";
      commission.amount = amount;
      commission.approvedAt = new Date();
      await commission.save();
      affiliate.balanceApproved += amount;
      await affiliate.save();
      await CommissionLogModel.create({ commission: commission._id, oldStatus: previous, newStatus: "APPROVED", createdBy });
    }
  } else if (rejected) {
    if (!commission) {
      commission = await CommissionModel.create({
        affiliate: affiliate._id,
        order: order._id,
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
