import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { permissionMiddleware } from "../../middleware/permission.middleware.js";
import { validateObjectId } from "../../middleware/objectId.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { requestPcRateLimitMiddleware } from "../../middleware/rateLimit.middleware.js";
import { BannerModel, BrandModel, CategoryModel, ProductModel, ProductVariantModel, WebsiteSettingModel } from "../../models/catalog.model.js";

const router = Router();

const productSchema = z.object({
  name: z.object({ ar: z.string(), fr: z.string(), en: z.string() }),
  description: z.object({ ar: z.string(), fr: z.string(), en: z.string() }),
  slug: z.string().min(2),
  category: z.string(),
  brand: z.string(),
  images: z.array(z.string()).min(1),
  basePrice: z.number().nonnegative(),
  discountPrice: z.number().nonnegative().optional(),
  purchasePrice: z.number().nonnegative().optional(),
  videoUrl: z.string().optional(),
  specifications: z.record(z.string(), z.string()).default({}),
  stock: z.number().nonnegative(),
  condition: z.enum(["NEW", "USED"]).default("NEW"),
  adminNote: z.string().optional(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).default("ACTIVE"),
  isFeatured: z.boolean().default(false),
  isSoldOut: z.boolean().default(false),
  localPickupOnly: z.boolean().default(false),
  affiliateEnabled: z.boolean().default(false),
  isEuropean: z.boolean().default(false),
  excludeFromProfits: z.boolean().default(false),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]).default("PERCENTAGE"),
  commissionValue: z.number().nonnegative().default(0),
  variants: z.array(
    z.object({
      sku: z.string(),
      ram: z.string().optional(),
      storage: z.string().optional(),
      color: z.string().optional(),
      price: z.number(),
      stock: z.number(),
      images: z.array(z.string()).default([]),
    }),
  ),
});

const categorySchema = z.object({
  name: z.object({ ar: z.string(), fr: z.string(), en: z.string() }),
  slug: z.string(),
  image: z.string().optional(),
  isActive: z.boolean().default(true),
});

const brandSchema = z.object({
  name: z.string(),
  logo: z.string().optional(),
  isActive: z.boolean().default(true),
});

const bannerSchema = z.object({
  title: z.object({ ar: z.string(), fr: z.string(), en: z.string() }),
  image: z.string().min(1),
  link: z.string().optional(),
  priority: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

async function serializeProduct(productId: string) {
  const product = await ProductModel.findById(productId).populate("category").populate("brand").lean();
  const variants = await ProductVariantModel.find({ productId: productId }).lean();
  return { ...product, variants };
}

router.get(
  "/banners",
  asyncHandler(async (_req, res) => {
    const banners = await BannerModel.find({ isActive: true }).sort({ priority: 1, createdAt: -1 }).lean();
    return res.json(banners);
  }),
);

router.get(
  "/products",
  asyncHandler(async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    const products = await ProductModel.find({
      status: "ACTIVE",
      isSoldOut: { $ne: true },
    }).select("-purchasePrice").sort({ _id: -1 }).populate("category").populate("brand").lean();
    const variants = await ProductVariantModel.find({ productId: { $in: products.map((product) => product._id) } }).lean();
    return res.json(
      products
        .map((product) => {
          const productVariants = variants.filter((variant) => String(variant.productId) === String(product._id));
          const stock = productVariants.reduce((sum, variant) => sum + variant.stock, 0);
          return { ...product, variants: productVariants, stock, isSoldOut: product.isSoldOut || stock <= 0 };
        })
        .filter((product) => !product.isSoldOut && product.stock > 0),
    );
  }),
);

router.get(
  "/products/:slug",
  asyncHandler(async (req, res) => {
    const product = await ProductModel.findOne({ slug: req.params.slug }).select("-purchasePrice").populate("category").populate("brand").lean();
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (product.status !== "ACTIVE") {
      return res.status(404).json({ message: "Product not found" });
    }
    const variants = await ProductVariantModel.find({ productId: product._id }).lean();
    const stock = variants.reduce((sum, variant) => sum + variant.stock, 0);
    return res.json({ ...product, variants, stock, isSoldOut: product.isSoldOut || stock <= 0 });
  }),
);

router.get(
  "/admin/products",
  authMiddleware,
  permissionMiddleware("products"),
  asyncHandler(async (_req, res) => {
    const products = await ProductModel.find()
      .sort({ _id: -1 })
      .populate("category")
      .populate("brand")
      .lean();
    const variants = await ProductVariantModel.find({ productId: { $in: products.map((product) => product._id) } }).lean();
    return res.json(
      products.map((product) => {
        const productVariants = variants.filter((variant) => String(variant.productId) === String(product._id));
        const stock = productVariants.reduce((sum, variant) => sum + variant.stock, 0);
        return { ...product, variants: productVariants, stock, isSoldOut: product.isSoldOut || stock <= 0 };
      }),
    );
  }),
);

router.post(
  "/admin/products",
  authMiddleware,
  permissionMiddleware("products"),
  asyncHandler(async (req, res) => {
    const input = productSchema.parse(req.body);
    const product = await ProductModel.create({ ...input, stock: input.stock });
    await ProductVariantModel.insertMany(input.variants.map((variant) => ({ ...variant, productId: product._id })));
    return res.status(201).json(await serializeProduct(String(product._id)));
  }),
);

router.patch(
  "/admin/products/:id",
  authMiddleware,
  permissionMiddleware("products"),
  validateObjectId,
  asyncHandler(async (req, res) => {
    const input = productSchema.partial().parse(req.body);
    if (input.purchasePrice === undefined) {
      delete input.purchasePrice;
    }

    const forceSoldOut = input.isSoldOut === true || (typeof input.stock === "number" && input.stock <= 0);

    // Keep product and variant stock in sync when admin marks a product sold out.
    if (forceSoldOut) {
      input.isSoldOut = true;
      input.stock = 0;
      if (input.variants !== undefined) {
        input.variants = input.variants.map((variant) => ({ ...variant, stock: 0 }));
      }
    } else if (input.variants !== undefined && input.variants.length > 0 && input.variants.every((v) => v.stock <= 0)) {
      input.isSoldOut = true;
      input.stock = 0;
    }

    const product = await ProductModel.findByIdAndUpdate(req.params.id, input, { new: true });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (input.variants) {
      await ProductVariantModel.deleteMany({ productId: product._id });
      await ProductVariantModel.insertMany(input.variants.map((variant) => ({ ...variant, productId: product._id })));
    } else if (forceSoldOut) {
      await ProductVariantModel.updateMany({ productId: product._id }, { stock: 0 });
    }

    return res.json(await serializeProduct(String(product._id)));
  }),
);

router.delete(
  "/admin/products/:id",
  authMiddleware,
  permissionMiddleware("products"),
  validateObjectId,
  asyncHandler(async (req, res) => {
    await ProductModel.findByIdAndDelete(req.params.id);
    await ProductVariantModel.deleteMany({ productId: req.params.id });
    return res.json({ success: true });
  }),
);

router.get("/categories", asyncHandler(async (_req, res) => res.json(await CategoryModel.find().lean())));
router.get("/brands", asyncHandler(async (_req, res) => res.json(await BrandModel.find().lean())));
router.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    const settings = await WebsiteSettingModel.findOne()
      .select("storeName logo phone whatsapp socialLinks defaultLanguage currency maintenanceMode promoCodeEnabled directOrderMode whatsappFloat otpEnabled otpWhatsappEnabled otpEmailEnabled couponCampaignEnabled couponDiscountType couponDiscountValue couponExpiryDays couponMinOrder couponConditionText couponSocialLinks commissionTiers")
      .lean();
    return res.json(settings);
  }),
);
router.get("/admin/banners", authMiddleware, permissionMiddleware("settings"), asyncHandler(async (_req, res) => {
  return res.json(await BannerModel.find().sort({ priority: 1, createdAt: -1 }).lean());
}));

router.post("/admin/categories", authMiddleware, permissionMiddleware("categories"), asyncHandler(async (req, res) => {
  const category = await CategoryModel.create(categorySchema.parse(req.body));
  return res.status(201).json(category);
}));
router.patch("/admin/categories/:id", authMiddleware, permissionMiddleware("categories"), asyncHandler(async (req, res) => {
  const category = await CategoryModel.findByIdAndUpdate(req.params.id, categorySchema.partial().parse(req.body), { new: true });
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }
  return res.json(category);
}));
router.delete("/admin/categories/:id", authMiddleware, permissionMiddleware("categories"), asyncHandler(async (req, res) => {
  await CategoryModel.findByIdAndDelete(req.params.id);
  return res.json({ success: true });
}));

router.post("/admin/brands", authMiddleware, permissionMiddleware("brands"), asyncHandler(async (req, res) => {
  const brand = await BrandModel.create(brandSchema.parse(req.body));
  return res.status(201).json(brand);
}));
router.patch("/admin/brands/:id", authMiddleware, permissionMiddleware("brands"), asyncHandler(async (req, res) => {
  const brand = await BrandModel.findByIdAndUpdate(req.params.id, brandSchema.partial().parse(req.body), { new: true });
  if (!brand) {
    return res.status(404).json({ message: "Brand not found" });
  }
  return res.json(brand);
}));
router.delete("/admin/brands/:id", authMiddleware, permissionMiddleware("brands"), asyncHandler(async (req, res) => {
  await BrandModel.findByIdAndDelete(req.params.id);
  return res.json({ success: true });
}));

router.post("/admin/banners", authMiddleware, permissionMiddleware("settings"), asyncHandler(async (req, res) => {
  const banner = await BannerModel.create(bannerSchema.parse(req.body));
  return res.status(201).json(banner);
}));

router.patch("/admin/banners/:id", authMiddleware, permissionMiddleware("settings"), asyncHandler(async (req, res) => {
  const banner = await BannerModel.findByIdAndUpdate(req.params.id, bannerSchema.partial().parse(req.body), { new: true });
  if (!banner) {
    return res.status(404).json({ message: "Banner not found" });
  }
  return res.json(banner);
}));

router.delete("/admin/banners/:id", authMiddleware, permissionMiddleware("settings"), asyncHandler(async (req, res) => {
  await BannerModel.findByIdAndDelete(req.params.id);
  return res.json({ success: true });
}));

// Geo-check — frontend calls this on mount to verify visitor country
router.get("/geo/check", asyncHandler(async (req, res) => {
  const { isIpAllowed } = await import("../../utils/geoip.js");
  const ip = String(req.ip ?? req.headers["x-forwarded-for"] ?? "");
  const result = await isIpAllowed(ip);
  return res.json({ allowed: result.allowed, country: result.country });
}));

// PC request — visitor submits desired PC specs, admin gets Telegram alert
router.post("/request-pc", requestPcRateLimitMiddleware, asyncHandler(async (req, res) => {
  const raw = req.body as Record<string, string>;
  const clean = (value?: string) =>
    String(value ?? "")
      .trim()
      .slice(0, 500)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const name = clean(raw.name);
  const phone = clean(raw.phone);
  const wilaya = clean(raw.wilaya);
  const brand = clean(raw.brand);
  const cpu = clean(raw.cpu);
  const ram = clean(raw.ram);
  const screen = clean(raw.screen);
  const storage = clean(raw.storage);
  const budget = clean(raw.budget);
  const usage = clean(raw.usage);
  const battery = clean(raw.battery);
  const notes = clean(raw.notes);

  const hasSpec = brand || cpu || ram || screen || storage || budget || usage || battery || notes;
  if (!hasSpec) {
    return res.status(400).json({ message: "يرجى تحديد المواصفات المطلوبة" });
  }
  const { sendTelegramMessage } = await import("../../utils/telegram.js");
  const lines = [
    "🖥️ <b>طلب لابتوب جديد</b>",
    "",
    ...(name ? [`👤 الاسم: ${name}`] : []),
    ...(phone ? [`📞 الهاتف: ${phone}`] : []),
    ...(wilaya ? [`📍 الولاية: ${wilaya}`] : []),
    "",
    "📋 <b>المواصفات المطلوبة:</b>",
    ...(brand ? [`• العلامة: ${brand}`] : []),
    ...(cpu ? [`• المعالج: ${cpu}`] : []),
    ...(ram ? [`• الرام: ${ram}`] : []),
    ...(screen ? [`• الشاشة: ${screen}`] : []),
    ...(storage ? [`• التخزين: ${storage}`] : []),
    ...(budget ? [`• الميزانية: ${budget} دج`] : []),
    ...(notes ? [`• ملاحظات: ${notes}`] : []),
    "",
    `⏰ ${new Date().toLocaleString("fr-DZ")}`,
  ];
  await sendTelegramMessage(lines.join("\n"));
  return res.json({ success: true });
}));

router.post("/request-software", asyncHandler(async (req, res) => {
  const { name, phone, wilaya, businessType, softwareNeed, devices, printer, budget, notes } = req.body as Record<string, string>;
  if (!phone?.trim() || phone.replace(/\D/g, "").length < 9) {
    return res.status(400).json({ message: "رقم الهاتف مطلوب" });
  }

  const clean = (value?: string) =>
    String(value ?? "")
      .trim()
      .slice(0, 500)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const { sendTelegramMessage } = await import("../../utils/telegram.js");
  const lines = [
    "💼 <b>طلب برنامج تسيير جديد</b>",
    "",
    ...(clean(name) ? [`👤 الاسم: ${clean(name)}`] : []),
    `📞 الهاتف: ${clean(phone)}`,
    ...(clean(wilaya) ? [`📍 الولاية: ${clean(wilaya)}`] : []),
    "",
    "📋 <b>معلومات النشاط:</b>",
    ...(clean(businessType) ? [`• النشاط: ${clean(businessType)}`] : []),
    ...(clean(softwareNeed) ? [`• المطلوب: ${clean(softwareNeed)}`] : []),
    ...(clean(devices) ? [`• الأجهزة: ${clean(devices)}`] : []),
    ...(clean(printer) ? [`• الطابعة: ${clean(printer)}`] : []),
    ...(clean(budget) ? [`• الميزانية: ${clean(budget)} DA`] : []),
    ...(clean(notes) ? [`• ملاحظات: ${clean(notes)}`] : []),
    "",
    `⏰ ${new Date().toLocaleString("fr-DZ")}`,
  ];
  await sendTelegramMessage(lines.join("\n"));
  return res.json({ success: true });
}));

export default router;
