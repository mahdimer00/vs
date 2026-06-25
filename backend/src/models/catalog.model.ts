import { model, Schema } from "mongoose";
import { localizedTextSchema } from "./shared.js";

const categorySchema = new Schema(
  {
    name: { type: localizedTextSchema, required: true },
    slug: { type: String, required: true, unique: true },
    image: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const brandSchema = new Schema(
  {
    name: { type: String, required: true },
    logo: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const productSchema = new Schema(
  {
    name: { type: localizedTextSchema, required: true },
    description: { type: localizedTextSchema, required: true },
    slug: { type: String, required: true, unique: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    brand: { type: Schema.Types.ObjectId, ref: "Brand", required: true },
    images: [{ type: String }],
    basePrice: { type: Number, required: true },
    discountPrice: Number,
    specifications: { type: Schema.Types.Mixed, default: {} },
    stock: { type: Number, required: true },
    condition: { type: String, enum: ["NEW", "USED"], default: "NEW" },
    adminNote: String,
    status: { type: String, enum: ["ACTIVE", "DRAFT", "ARCHIVED"], default: "ACTIVE" },
    isFeatured: { type: Boolean, default: false },
    isSoldOut: { type: Boolean, default: false },
    localPickupOnly: { type: Boolean, default: false },
    affiliateEnabled: { type: Boolean, default: false },
    commissionType: { type: String, enum: ["PERCENTAGE", "FIXED"], default: "PERCENTAGE" },
    commissionValue: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const productVariantSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    ram: String,
    storage: String,
    color: String,
    sku: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, required: true },
    images: [{ type: String }],
  },
  { timestamps: true },
);

const websiteSettingSchema = new Schema(
  {
    storeName: { type: String, required: true },
    logo: String,
    phone: { type: String, required: true },
    whatsapp: String,
    email: String,
    address: String,
    mapUrl: String,
    socialLinks: { type: Schema.Types.Mixed, default: {} },
    defaultLanguage: { type: String, enum: ["ar", "fr", "en"], default: "ar" },
    currency: { type: String, default: "DZD" },
    aiEnabled: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    promoCodeEnabled: { type: Boolean, default: true },
    directOrderMode: { type: Boolean, default: false },
    whatsappFloat: { type: Boolean, default: true },
    otpEnabled: { type: Boolean, default: true },
    otpWhatsappEnabled: { type: Boolean, default: true },
    otpEmailEnabled: { type: Boolean, default: true },
    affiliateLevels: {
      type: Schema.Types.Mixed,
      default: {
        BRONZE: { commissionRate: 1, referralBonus: 0 },
        SILVER: { commissionRate: 1.5, referralBonus: 500 },
        GOLD: { commissionRate: 2, referralBonus: 1000 },
        PLATINUM: { commissionRate: 3, referralBonus: 2000 },
      },
    },
  },
  { timestamps: true },
);

const bannerSchema = new Schema(
  {
    title: { type: localizedTextSchema, required: true },
    image: { type: String, required: true },
    link: String,
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const CategoryModel = model("Category", categorySchema);
export const BrandModel = model("Brand", brandSchema);
export const ProductModel = model("Product", productSchema);
export const ProductVariantModel = model("ProductVariant", productVariantSchema);
export const WebsiteSettingModel = model("WebsiteSetting", websiteSettingSchema);
export const BannerModel = model("Banner", bannerSchema);
