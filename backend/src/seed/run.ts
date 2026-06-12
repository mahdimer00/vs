import { env } from "../config/env.js";
import { hashPassword } from "../utils/auth.js";
import { UserModel } from "../models/user.model.js";
import { AffiliateModel } from "../models/affiliate.model.js";
import { BannerModel, BrandModel, CategoryModel, WebsiteSettingModel } from "../models/catalog.model.js";
import { WilayaModel } from "../models/shipping.model.js";
import { bannerSeed, categorySeed, brandSeed, wilayaSeed } from "./data.js";
import { communesByWilaya } from "./communes.js";

export async function runSeed() {
  const existingAdmin = await UserModel.findOne({ email: env.ADMIN_EMAIL.toLowerCase() });
  if (!existingAdmin) {
    await UserModel.create({
      name: "VisaStore Super Admin",
      email: env.ADMIN_EMAIL.toLowerCase(),
      passwordHash: await hashPassword(env.ADMIN_PASSWORD),
      role: "SUPER_ADMIN",
      isActive: true,
    });
  }

  for (const [code, name, homeDeliveryFee, deskPickupFee] of wilayaSeed) {
    await WilayaModel.findOneAndUpdate(
      { code },
      {
        code,
        name: { ar: name, fr: name, en: name },
        communes: communesByWilaya[code] ?? [`${name} Centre`],
        homeDeliveryFee,
        deskPickupFee,
        isActive: true,
      },
      { upsert: true, new: true },
    );
  }

  for (const category of categorySeed) {
    await CategoryModel.findOneAndUpdate({ slug: category.slug }, { ...category, isActive: true }, { upsert: true, new: true });
  }

  for (const brand of brandSeed) {
    await BrandModel.findOneAndUpdate({ name: brand.name }, { name: brand.name, logo: brand.logo, isActive: true }, { upsert: true, new: true });
  }

  await WebsiteSettingModel.findOneAndUpdate(
    {},
    {
      storeName: "VisaStore",
      phone: "+213555000000",
      whatsapp: "+213770000000",
      socialLinks: { instagram: "https://instagram.com/visastore" },
      defaultLanguage: "ar",
      currency: "DZD",
      aiEnabled: true,
      maintenanceMode: false,
    },
    { upsert: true, new: true },
  );

  const hasBanners = (await BannerModel.countDocuments()) > 0;
  if (!hasBanners) {
    for (const banner of bannerSeed) {
      await BannerModel.findOneAndUpdate(
        { priority: banner.priority },
        banner,
        { upsert: true, new: true },
      );
    }
  }

  const existingAffiliate = await AffiliateModel.findOne({ email: env.AFFILIATE_EMAIL.toLowerCase() });
  if (!existingAffiliate) {
    await AffiliateModel.create({
      name: "VisaStore Partner",
      email: env.AFFILIATE_EMAIL.toLowerCase(),
      phone: "0555123456",
      passwordHash: await hashPassword(env.AFFILIATE_PASSWORD),
      referralCode: "VISA100",
      commissionRate: 2,
      status: "ACTIVE",
      balancePending: 0,
      balanceApproved: 0,
      balancePaid: 0,
    });
  }
}

if (process.argv[1]?.endsWith("run.ts")) {
  import("../config/db.js")
    .then(({ connectDatabase }) => connectDatabase())
    .then(() => runSeed())
    .then(() => {
      console.log("Seed completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
