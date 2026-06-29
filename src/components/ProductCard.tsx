import { Heart, ShieldCheck, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import type { Locale, Product } from "@/types";
import { formatCurrency, getLocalizedText } from "@/utils/format";
import { translate } from "@/utils/i18n";

export function ProductCard({ product, language }: { product: Product; language: Locale }) {
  const { isWishlisted, toggleWishlist } = useApp();
  const price = product.discountPrice ?? product.basePrice;
  const brandName = typeof product.brand === "string" ? product.brand : product.brand.name;
  const hasDiscount = typeof product.discountPrice === "number" && product.discountPrice < product.basePrice;
  const discountPercent = hasDiscount ? Math.round(((product.basePrice - price) / product.basePrice) * 100) : 0;
  const wishlisted = isWishlisted(product._id);
  const soldOut = product.stock <= 0 || !!product.isSoldOut;
  const lowStock = !soldOut && product.stock > 0 && product.stock <= 5;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[1.6rem] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.07)] border border-slate-100 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(15,23,42,0.13)]">
      <Link
        to={`/products/${product.slug}`}
        onClick={(event) => { if (soldOut) event.preventDefault(); }}
        aria-disabled={soldOut}
        className="flex flex-1 flex-col"
      >
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-slate-50 to-white">
          <img
            src={product.images[0]}
            alt={getLocalizedText(product.name, language)}
            loading="lazy"
            className={`h-full w-full object-contain p-3 transition duration-500 group-hover:scale-105 ${soldOut ? "opacity-40 grayscale" : ""}`}
          />

          {/* Sold out overlay */}
          {soldOut ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-slate-900/85 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
                {translate(language, "productSoldOut")}
              </span>
            </div>
          ) : null}

          {/* Discount badge */}
          {hasDiscount && !soldOut ? (
            <span className="absolute start-2.5 top-2.5 rounded-full bg-rose-500 px-2.5 py-1 text-xs font-bold text-white shadow-md">
              -{discountPercent}%
            </span>
          ) : null}

          {/* Low stock urgency */}
          {lowStock ? (
            <span className="absolute start-2.5 top-2.5 animate-pulse rounded-full bg-orange-500 px-2.5 py-1 text-xs font-bold text-white shadow-md">
              ⚡ {translate(language, "productOnlyLeft")} {product.stock}
            </span>
          ) : null}

          {/* European origin badge */}
          {product.isEuropean && !soldOut && (
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
        <div className="flex flex-1 flex-col gap-2.5 p-3.5 sm:p-4">
          {/* Brand */}
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{brandName}</div>

          {/* Product name */}
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-950 sm:text-base">
            {getLocalizedText(product.name, language)}
          </h3>

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
          <div className="flex items-center gap-2">
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
