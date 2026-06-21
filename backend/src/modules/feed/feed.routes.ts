import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { CategoryModel, ProductModel, ProductVariantModel, WebsiteSettingModel } from "../../models/catalog.model.js";
import { env } from "../../config/env.js";

const router = Router();

const STORE_URL = (env.FRONTEND_URL ?? "https://visadz.store").replace(/\/$/, "");
const BACKEND_URL = (env.BACKEND_URL ?? "").replace(/\/$/, "");

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolveImageUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${BACKEND_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Google Merchant Center RSS 2.0 feed
router.get(
  "/feed/products.xml",
  asyncHandler(async (_req, res) => {
    const [products, variants, categories, settings] = await Promise.all([
      ProductModel.find({ status: "ACTIVE", isSoldOut: false })
        .populate("brand", "name")
        .populate("category", "name slug")
        .lean(),
      ProductVariantModel.find().lean(),
      CategoryModel.find({ isActive: true }).lean(),
      WebsiteSettingModel.findOne().select("storeName").lean(),
    ]);

    const storeName = settings?.storeName ?? "VisaDZ";
    const variantsByProduct = new Map<string, typeof variants>();
    for (const v of variants) {
      const pid = String(v.productId);
      if (!variantsByProduct.has(pid)) variantsByProduct.set(pid, []);
      variantsByProduct.get(pid)!.push(v);
    }

    const categoryMap = new Map(categories.map((c) => [String(c._id), c]));

    const items: string[] = [];

    for (const product of products) {
      const pvs = variantsByProduct.get(String(product._id)) ?? [];
      const activeVariants = pvs.filter((v) => v.stock > 0);
      if (activeVariants.length === 0 && product.stock === 0) continue;

      const price = product.discountPrice ?? product.basePrice;
      const image = product.images[0] ?? activeVariants[0]?.images[0] ?? "";
      const availability = product.stock > 0 || activeVariants.some((v) => v.stock > 0) ? "in_stock" : "out_of_stock";
      const condition = product.condition === "NEW" ? "new" : "used";
      const cat = typeof product.category === "object" && product.category !== null && "_id" in product.category
        ? categoryMap.get(String((product.category as { _id: unknown })._id))
        : null;
      const brandName = typeof product.brand === "object" && product.brand !== null && "name" in product.brand
        ? String((product.brand as { name: unknown }).name)
        : "";
      const catName = cat?.name?.fr ?? cat?.name?.en ?? "";
      const productUrl = `${STORE_URL}/products/${escapeXml(product.slug)}`;
      const imageUrl = escapeXml(resolveImageUrl(image));

      // One item per product (Google also supports item_group_id for variants)
      const rawTitle = (product.name.fr || product.name.ar || product.name.en || "").trim();
      const title = escapeXml(rawTitle.length > 150 ? rawTitle.slice(0, 147) + "..." : rawTitle);
      const description = escapeXml(
        (product.description.fr || product.description.ar || product.description.en || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 5000),
      );

      const hasDiscount = Boolean(product.discountPrice && product.discountPrice < product.basePrice);

      items.push(`    <item>
      <g:id>${escapeXml(String(product._id))}</g:id>
      <g:title>${title}</g:title>
      <g:description>${description}</g:description>
      <g:link>${productUrl}</g:link>
      <g:image_link>${imageUrl}</g:image_link>
      <g:availability>${availability}</g:availability>
      <g:price>${hasDiscount ? product.basePrice.toFixed(2) : price.toFixed(2)} DZD</g:price>
      ${hasDiscount ? `<g:sale_price>${product.discountPrice!.toFixed(2)} DZD</g:sale_price>` : ""}
      <g:condition>${condition}</g:condition>
      ${brandName ? `<g:brand>${escapeXml(brandName)}</g:brand>` : ""}
      ${catName ? `<g:product_type>${escapeXml(catName)}</g:product_type>` : ""}
      <g:google_product_category>Electronics</g:google_product_category>
    </item>`);

      // Additional images as extra entries (optional)
      for (const extraImg of product.images.slice(1, 10)) {
        const existingItem = items[items.length - 1];
        if (extraImg && existingItem) {
          items[items.length - 1] = existingItem.replace(
            "</item>",
            `\n      <g:additional_image_link>${escapeXml(resolveImageUrl(extraImg))}</g:additional_image_link>\n    </item>`,
          );
        }
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(storeName)}</title>
    <link>${STORE_URL}</link>
    <description>${escapeXml(storeName)} — متجر إلكتروني جزائري</description>
${items.join("\n")}
  </channel>
</rss>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(xml);
  }),
);

// TSV feed (Google Merchant Center alternative format)
router.get(
  "/feed/products.tsv",
  asyncHandler(async (_req, res) => {
    const [products, variants] = await Promise.all([
      ProductModel.find({ status: "ACTIVE", isSoldOut: false })
        .populate("brand", "name")
        .populate("category", "name")
        .lean(),
      ProductVariantModel.find().lean(),
    ]);

    const variantsByProduct = new Map<string, typeof variants>();
    for (const v of variants) {
      const pid = String(v.productId);
      if (!variantsByProduct.has(pid)) variantsByProduct.set(pid, []);
      variantsByProduct.get(pid)!.push(v);
    }

    const header = ["id", "title", "description", "link", "image_link", "availability", "price", "condition", "brand"].join("\t");
    const rows: string[] = [header];

    for (const product of products) {
      const pvs = variantsByProduct.get(String(product._id)) ?? [];
      if (product.stock === 0 && !pvs.some((v) => v.stock > 0)) continue;

      const price = product.discountPrice ?? product.basePrice;
      const image = resolveImageUrl(product.images[0] ?? pvs[0]?.images[0] ?? "");
      const availability = product.stock > 0 || pvs.some((v) => v.stock > 0) ? "in_stock" : "out_of_stock";
      const brandName = typeof product.brand === "object" && product.brand !== null && "name" in product.brand
        ? String((product.brand as { name: unknown }).name) : "";

      rows.push([
        String(product._id),
        product.name.fr || product.name.ar || product.name.en,
        (product.description.fr || product.description.ar || product.description.en || "").replace(/\t|\n/g, " ").slice(0, 500),
        `${STORE_URL}/products/${product.slug}`,
        image,
        availability,
        `${price.toFixed(2)} DZD`,
        product.condition === "NEW" ? "new" : "used",
        brandName,
      ].join("\t"));
    }

    res.setHeader("Content-Type", "text/tab-separated-values; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"products.tsv\"");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(rows.join("\n"));
  }),
);

// Dynamic sitemap — includes all active product pages
router.get(
  "/sitemap.xml",
  asyncHandler(async (_req, res) => {
    const [products, settings] = await Promise.all([
      ProductModel.find({ status: "ACTIVE" }).select("slug updatedAt").lean(),
      WebsiteSettingModel.findOne().select("storeName").lean(),
    ]);

    const storeUrl = (env.FRONTEND_URL ?? "https://visadz.store").replace(/\/$/, "");
    const now = new Date().toISOString().split("T")[0];

    const staticUrls = [
      { loc: storeUrl, priority: "1.0", changefreq: "daily" },
      { loc: `${storeUrl}/products`, priority: "0.9", changefreq: "hourly" },
      { loc: `${storeUrl}/categories`, priority: "0.8", changefreq: "weekly" },
      { loc: `${storeUrl}/earn-money`, priority: "0.6", changefreq: "monthly" },
      { loc: `${storeUrl}/track-order`, priority: "0.5", changefreq: "monthly" },
      { loc: `${storeUrl}/contact`, priority: "0.5", changefreq: "monthly" },
      { loc: `${storeUrl}/privacy-policy`, priority: "0.3", changefreq: "monthly" },
      { loc: `${storeUrl}/terms`, priority: "0.3", changefreq: "monthly" },
      { loc: `${storeUrl}/return-policy`, priority: "0.3", changefreq: "monthly" },
    ];

    const productUrls = products.map((p) => ({
      loc: `${storeUrl}/products/${p.slug}`,
      lastmod: p.updatedAt ? new Date(p.updatedAt as Date).toISOString().split("T")[0] : now,
      priority: "0.8",
      changefreq: "weekly",
    }));

    const allUrls: Array<{ loc: string; priority: string; changefreq: string; lastmod?: string }> = [
      ...staticUrls.map((u) => ({ ...u, lastmod: now })),
      ...productUrls,
    ];

    const urlEntries = allUrls
      .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod ?? now}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`)
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(xml);
  }),
);

export default router;
