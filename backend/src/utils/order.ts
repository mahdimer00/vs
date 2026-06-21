import { PromoCodeModel, PromoCodeUsageModel } from "../models/orders.model.js";
import { AffiliateModel } from "../models/affiliate.model.js";
import { ProductModel, ProductVariantModel } from "../models/catalog.model.js";
import { WilayaModel } from "../models/shipping.model.js";
import type { DeliveryType } from "../types/index.js";
import { AppError } from "./app-error.js";
import { getZRTerritories } from "./zrexpress.js";

export async function resolveShippingFee(wilayaCode: string, deliveryType: DeliveryType, zrTerritoryId?: string | null) {
  const wilaya = await WilayaModel.findOne({ code: wilayaCode, isActive: true });
  if (!wilaya) {
    throw new AppError("Wilaya not found", 404);
  }

  if (zrTerritoryId) {
    const territory = (await getZRTerritories()).find((item) => item.id === zrTerritoryId);
    if (!territory) {
      throw new AppError("ZR territory not found", 400);
    }

    const territoryFee = deliveryType === "HOME_DELIVERY" ? territory.homePrice : territory.pickupPrice;
    if (territoryFee > 0) {
      return {
        wilaya,
        fee: territoryFee,
      };
    }
  }

  return {
    wilaya,
    fee: deliveryType === "HOME_DELIVERY" ? wilaya.homeDeliveryFee : wilaya.deskPickupFee,
  };
}

export async function validatePromoCode(input: {
  code: string;
  phone: string;
  subtotal: number;
  productIds: string[];
  categoryIds: string[];
  shippingFee: number;
}) {
  const promo = await PromoCodeModel.findOne({ code: input.code.toUpperCase() }).populate("affiliate");
  if (!promo || !promo.isActive) {
    throw new AppError("الرمز الترويجي غير صالح | Code promo invalide | Promo code is invalid", 400);
  }

  if (promo.expiresAt && promo.expiresAt < new Date()) {
    throw new AppError("انتهت صلاحية الرمز الترويجي | Code promo expiré | Promo code has expired", 400);
  }

  if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
    throw new AppError("وصل الرمز الترويجي للحد الأقصى من الاستخدامات | Limite d'utilisation atteinte | Promo code usage limit reached", 400);
  }

  if (promo.minimumOrderAmount && input.subtotal < promo.minimumOrderAmount) {
    throw new AppError(
      `المبلغ الأدنى للطلب هو ${promo.minimumOrderAmount} دج | Montant minimum ${promo.minimumOrderAmount} DA | Minimum order is ${promo.minimumOrderAmount} DZD`,
      400,
    );
  }

  if (promo.productRestrictions.length && !input.productIds.some((id) => promo.productRestrictions.includes(id))) {
    throw new AppError("هذا الرمز لا ينطبق على منتجاتك | Ce code ne s'applique pas à vos articles | Promo code doesn't apply to your items", 400);
  }

  if (promo.categoryRestrictions.length && !input.categoryIds.some((id) => promo.categoryRestrictions.includes(id))) {
    throw new AppError("هذا الرمز لا ينطبق على هذه الفئة | Ce code ne s'applique pas à cette catégorie | Promo code doesn't apply to this category", 400);
  }

  if (promo.oneUsePerPhone) {
    const existingUsage = await PromoCodeUsageModel.findOne({ promoCode: promo._id, phone: input.phone });
    if (existingUsage) {
      throw new AppError("استُخدم هذا الرمز مسبقاً من هذا الرقم | Code déjà utilisé pour ce numéro | Promo code already used for this phone", 400);
    }
  }

  let discount = 0;
  if (promo.type === "FIXED") {
    discount = promo.value;
  } else if (promo.type === "PERCENTAGE") {
    discount = Math.round((input.subtotal * promo.value) / 100);
  } else {
    discount = input.shippingFee;
  }

  return { promo, discount: Math.max(0, Math.min(discount, input.subtotal + input.shippingFee)) };
}

export async function buildOrderItems(items: Array<{ productId: string; variantId: string; quantity: number }>) {
  const output = [];
  let subtotal = 0;
  const categoryIds = new Set<string>();

  for (const item of items) {
    const product = await ProductModel.findById(item.productId).populate("category").populate("brand");
    const variant = await ProductVariantModel.findById(item.variantId);

    if (!product) {
      throw new AppError("One of the products in your cart is no longer available", 400);
    }
    if (!variant) {
      throw new AppError(`The selected option for ${product.name.en} is no longer available`, 400);
    }
    if (String(variant.productId) !== String(product._id)) {
      throw new AppError(`The selected option does not match ${product.name.en}`, 400);
    }

    if (variant.stock < item.quantity) {
      throw new AppError(`Insufficient stock for ${product.name.en}`, 400);
    }

    const lineTotal = variant.price * item.quantity;
    subtotal += lineTotal;
    categoryIds.add(typeof product.category === "string" ? product.category : String((product.category as { _id?: unknown })._id ?? product.category));

    output.push({
      productId: String(product._id),
      productName: product.name,
      productSlug: product.slug,
      variantId: String(variant._id),
      variantLabel: [variant.ram, variant.storage, variant.color].filter(Boolean).join(" / ") || variant.sku,
      quantity: item.quantity,
      unitPrice: variant.price,
      lineTotal,
      image: variant.images[0] || product.images[0],
    });
  }

  return { items: output, subtotal, categoryIds: [...categoryIds] };
}

export async function resolveAffiliate(referralCode?: string | null, affiliateId?: string | null) {
  if (affiliateId) {
    return AffiliateModel.findById(affiliateId);
  }

  if (!referralCode) {
    return null;
  }

  return AffiliateModel.findOne({ referralCode: referralCode.toUpperCase() });
}
