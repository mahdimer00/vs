import { Heart, Monitor, ShieldCheck, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import type { Locale, Product } from "@/types";
import { formatCurrency, getLocalizedText } from "@/utils/format";
import { translate } from "@/utils/i18n";

function extractLaptopSpecs(product: Product): { cpu?: string; ram?: string; storage?: string; screen?: string } | null {
  const nameText = `${product.name.ar || ""} ${product.name.fr || ""} ${product.name.en || ""}`;
  const specs = (product.specifications as Record<string, string> | undefined) ?? {};

  // Pull screen from specs if present (handles 'الشاشة', 'Screen', 'Ecran', etc.)
  const specScreenEntry = Object.entries(specs).find(([k]) => /شاشة|screen|ecran|inch|بوصة/i.test(k));
  const specScreenText = specScreenEntry ? specScreenEntry[1] : "";

  // Pull CPU from specs if present
  const specCpuEntry = Object.entries(specs).find(([k]) => /معالج|cpu|processor/i.test(k));
  const specCpuText = specCpuEntry ? specCpuEntry[1] : "";

  // Pull RAM from specs
  const specRamEntry = Object.entries(specs).find(([k]) => /رام|ram|mémoire|memory/i.test(k));
  const specRamText = specRamEntry ? specRamEntry[1] : "";

  // Pull storage from specs
  const specStorageEntry = Object.entries(specs).find(([k]) => /تخزين|ssd|hdd|storage|disque/i.test(k));
  const specStorageText = specStorageEntry ? specStorageEntry[1] : "";

  // Full search text: name + all spec values
  const specValues = Object.values(specs).join(" ");
  const fullText = `${nameText} ${specValues}`;

  // ── CPU extraction ──
  let cpu: string | undefined;
  const cpuSourceText = specCpuText || nameText;
  const cpuMatch = cpuSourceText.match(/Ryzen\s*[3579](?:\s*Pro)?/i)
    || cpuSourceText.match(/Core\s*(i[3579])/i)
    || cpuSourceText.match(/\b(i[3579])\b/i);
  if (cpuMatch) {
    cpu = cpuMatch[0].replace(/Core\s*/i, "").trim();
    // Extract generation hint
    const genMatch = cpuSourceText.match(/(\d+)(?:e?m?e|th|ème|st|nd|rd)\s*(?:gén?|gen)?/i);
    if (genMatch) cpu += ` ${genMatch[1]}ᵉ`;
  }

  // ── RAM extraction ──
  let ram: string | undefined;
  const ramSourceText = specRamText || fullText;
  const ramMatch = ramSourceText.match(/(\d+)\s*(?:GB|Go)\s*(?:RAM|DDR|LPDDR)/i)
    || ramSourceText.match(/RAM\s*[:\s]*(\d+)/i)
    || ramSourceText.match(/(\d+)\s*(?:GB|Go)/i)
    || nameText.match(/(\d+)\/\d+/);
  if (ramMatch) {
    const val = parseInt(ramMatch[1]);
    if (val >= 2 && val <= 128) ram = `${val} GB`;
  }

  // ── Storage extraction ──
  let storage: string | undefined;
  const storageSourceText = specStorageText || fullText;
  // Prefer NVMe/SSD/HDD amounts; avoid picking RAM value
  const storageMatch = storageSourceText.match(/(\d+)\s*(?:GB|Go)\s*(?:NVMe|SSD|HDD)/i)
    || storageSourceText.match(/(?:NVMe|SSD|HDD)\s*(\d+)\s*(?:GB|Go|TB)/i)
    || nameText.match(/\d+\/(\d+)\s*(?:nvme|ssd|nvm|gb|go)/i)
    || nameText.match(/(?:SSD|NVMe|HDD)\s*(\d+)/i);
  if (storageMatch) {
    const val = parseInt(storageMatch[1]);
    if (val >= 32 && val <= 4096) {
      storage = val >= 1000 ? `${val / 1000} TB` : `${val} GB`;
    }
  }

  // ── Screen extraction ──
  let screen: string | undefined;
  const screenSourceText = specScreenText || nameText;
  const screenMatch = screenSourceText.match(/(\d+\.?\d*)\s*(?:["''"’]|inch|pouces|بوصة)/i)
    || screenSourceText.match(/(\d+\.?\d*)[""']/i);
  if (screenMatch) {
    const val = parseFloat(screenMatch[1]);
    if (val >= 10 && val <= 22) screen = `${val}"`;
  }

  if (!cpu && !ram && !storage && !screen) return null;
  return { cpu, ram, storage, screen };
}

export function ProductCard({ product, language }: { product: Product; language: Locale }) {
  const { isWishlisted, toggleWishlist } = useApp();
  const price = product.discountPrice ?? product.basePrice;
  const brandName = typeof product.brand === "string" ? product.brand : product.brand.name;
  const hasDiscount = typeof product.discountPrice === "number" && product.discountPrice < product.basePrice;
  const discountPercent = hasDiscount ? Math.round(((product.basePrice - price) / product.basePrice) * 100) : 0;
  const wishlisted = isWishlisted(product._id);
  const soldOut = product.stock <= 0 || !!product.isSoldOut;
  const lowStock = !soldOut && product.stock > 0 && product.stock <= 5;
  const isFeatured = product.isFeatured && !soldOut;

  const laptopSpecs = extractLaptopSpecs(product);

  return (
    <article className={`group relative flex flex-col overflow-hidden rounded-[1.6rem] border-2 transition duration-200 hover:-translate-y-0.5 ${
      isFeatured
        ? "border-orange-400 featured-glow bg-gradient-to-b from-orange-50/70 via-white to-white"
        : "border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.07)] hover:shadow-[0_8px_30px_rgba(15,23,42,0.13)]"
    }`}>
      {/* Featured top banner */}
      {isFeatured ? (
        <div className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-orange-500 to-rose-500 px-3 py-1.5 text-center text-[11px] font-extrabold uppercase tracking-widest text-white">
          🔥 {language === "ar" ? "عرض مميز اليوم" : language === "fr" ? "Offre spéciale" : "Hot Deal"}
        </div>
      ) : null}

      <Link
        to={`/products/${product.slug}`}
        onClick={(event) => { if (soldOut) event.preventDefault(); }}
        aria-disabled={soldOut}
        className="flex flex-1 flex-col"
      >
        {/* Image */}
        <div className={`relative aspect-square overflow-hidden bg-gradient-to-br from-slate-50 to-white${isFeatured ? " featured-shimmer" : ""}`}>
          <img
            src={product.images[0]}
            alt={getLocalizedText(product.name, language)}
            loading="lazy"
            className={`h-full w-full object-contain p-3 transition duration-500 group-hover:scale-105 ${soldOut ? "opacity-40 grayscale" : ""}`}
          />

          {/* Screen size badge — show over image if we have it */}
          {laptopSpecs?.screen && !soldOut && (
            <span className="absolute bottom-2.5 end-2.5 flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-sm backdrop-blur-sm">
              <Monitor className="h-3 w-3 text-slate-500" />
              {laptopSpecs.screen}
            </span>
          )}

          {/* Sold out overlay */}
          {soldOut ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-slate-900/85 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
                {translate(language, "productSoldOut")}
              </span>
            </div>
          ) : null}

          {/* Single top-start badge — priority: discount > low stock > featured fire */}
          {!soldOut && (hasDiscount ? (
            <span className="absolute start-2.5 top-2.5 flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-2.5 py-1 text-xs font-bold text-white shadow-md">
              🔥 -{discountPercent}%
            </span>
          ) : lowStock ? (
            <span className="absolute start-2.5 top-2.5 animate-pulse rounded-full bg-orange-500 px-2.5 py-1 text-xs font-bold text-white shadow-md">
              ⚡ {translate(language, "productOnlyLeft")} {product.stock}
            </span>
          ) : isFeatured ? (
            <span className="absolute start-2.5 top-2.5 flex animate-pulse items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-2.5 py-1 text-xs font-bold text-white shadow-md">
              🔥 {language === "ar" ? "عرض حار" : language === "fr" ? "Offre" : "Hot"}
            </span>
          ) : null)}

          {/* European origin badge */}
          {product.isEuropean && !soldOut && !laptopSpecs?.screen && (
            <span className="absolute bottom-2.5 start-2.5 flex items-center gap-1 rounded-full border border-blue-200 bg-white/95 px-2 py-0.5 text-[10px] font-bold text-blue-700 shadow-sm backdrop-blur-sm">
              🇪🇺 {language === "ar" ? "علامة أوروبية" : language === "fr" ? "Origine UE" : "EU Origin"}
            </span>
          )}

          {/* Wishlist */}
          <button
            type="button"
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleWishlist(product._id); }}
            aria-label={translate(language, wishlisted ? "wishlistRemove" : "wishlistAdd")}
            className={`absolute end-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full shadow-md transition ${
              wishlisted ? "bg-rose-500 text-white" : "bg-white/90 text-slate-500 hover:bg-white hover:text-rose-500"
            }`}
          >
            <Heart className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-2 p-3.5 sm:p-4">
          {/* Brand */}
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{brandName}</div>

          {/* Product name */}
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-950 sm:text-base">
            {getLocalizedText(product.name, language)}
          </h3>

          {/* Laptop spec chips */}
          {laptopSpecs && (
            <div className="flex flex-wrap gap-1">
              {laptopSpecs.cpu && (
                <span className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200">
                  {laptopSpecs.cpu}
                </span>
              )}
              {laptopSpecs.ram && (
                <span className="inline-flex items-center rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 ring-1 ring-sky-200">
                  {laptopSpecs.ram}
                </span>
              )}
              {laptopSpecs.storage && (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
                  {laptopSpecs.storage}
                </span>
              )}
              {laptopSpecs.screen && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200">
                  <Monitor className="h-2.5 w-2.5" />
                  {laptopSpecs.screen}
                </span>
              )}
            </div>
          )}

          {/* Real stock urgency — no fake numbers */}
          {product.stock === 1 ? (
            <div className="flex items-center gap-1 text-xs font-bold text-rose-600">
              🔴 {language === "ar" ? "آخر قطعة!" : language === "fr" ? "Dernière pièce!" : "Last one!"}
            </div>
          ) : product.stock === 2 ? (
            <div className="flex items-center gap-1 text-xs font-bold text-orange-600">
              🟠 {language === "ar" ? "قطعتان فقط" : language === "fr" ? "2 restantes" : "Only 2 left"}
            </div>
          ) : lowStock ? (
            <div className="flex items-center gap-1 text-xs font-bold text-amber-600">
              ⚡ {language === "ar" ? `${product.stock} قطع فقط` : language === "fr" ? `Plus que ${product.stock}` : `${product.stock} left`}
            </div>
          ) : null}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className={`text-lg font-extrabold sm:text-xl ${soldOut ? "text-slate-400" : "text-slate-950"}`}>
              {formatCurrency(price, language)}
            </span>
            {hasDiscount ? (
              <span className="text-xs text-slate-400 line-through sm:text-sm">{formatCurrency(product.basePrice, language)}</span>
            ) : null}
          </div>

          {/* Availability */}
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <ShieldCheck className={`h-3.5 w-3.5 ${soldOut ? "text-slate-300" : "text-teal-600"}`} />
            <span className={soldOut ? "text-slate-400" : "text-teal-700"}>
              {soldOut ? translate(language, "productSoldOut") : translate(language, "productInStock")}
            </span>
          </div>

          {/* CTA button */}
          <div
            className={`mt-1 flex w-full items-center justify-center gap-1.5 rounded-full py-3 text-sm font-bold text-white transition ${
              soldOut
                ? "bg-slate-200 text-slate-400"
                : isFeatured
                  ? "bg-gradient-to-r from-orange-500 to-rose-500 shadow-[0_4px_14px_rgba(251,146,60,0.4)] group-hover:from-orange-400 group-hover:to-rose-400 group-hover:shadow-[0_6px_20px_rgba(251,146,60,0.5)]"
                  : "bg-gradient-to-r from-teal-600 to-emerald-600 shadow-[0_4px_14px_rgba(20,184,166,0.35)] group-hover:from-teal-500 group-hover:to-emerald-500 group-hover:shadow-[0_6px_20px_rgba(20,184,166,0.45)]"
            }`}
          >
            {!soldOut ? <Zap className="h-4 w-4 fill-current" /> : null}
            {soldOut
              ? translate(language, "productSoldOut")
              : translate(language, "productBuyNow")}
          </div>
        </div>
      </Link>
    </article>
  );
}
