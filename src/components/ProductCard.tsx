import { BadgePercent, Flame, Heart, ShieldCheck, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import type { Locale, Product } from "@/types";
import { formatCurrency, formatLegacyDinarHint, getLocalizedText, hashSeed } from "@/utils/format";
import { translate } from "@/utils/i18n";

export function ProductCard({ product, language }: { product: Product; language: Locale }) {
  const { isWishlisted, toggleWishlist } = useApp();
  const price = product.discountPrice ?? product.basePrice;
  const brandName = typeof product.brand === "string" ? product.brand : product.brand.name;
  const hasDiscount = typeof product.discountPrice === "number" && product.discountPrice < product.basePrice;
  const discountPercent = hasDiscount ? Math.round(((product.basePrice - price) / product.basePrice) * 100) : 0;
  const wishlisted = isWishlisted(product._id);
  const legacyHint = formatLegacyDinarHint(price, language);
  const soldOut = product.stock <= 0;
  const lowStock = !soldOut && product.stock <= 5;
  const boughtToday = 3 + hashSeed(product._id) % 12;

  return (
    <article className="group overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 shadow-[0_18px_55px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(15,23,42,0.13)]">
      <Link
        to={`/products/${product.slug}`}
        onClick={(event) => {
          if (soldOut) event.preventDefault();
        }}
        aria-disabled={soldOut}
        className={`block ${soldOut ? "cursor-not-allowed" : ""}`}
      >
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
          <img
            src={product.images[0]}
            alt={getLocalizedText(product.name, language)}
            loading="lazy"
            className={`h-full w-full object-contain p-4 transition duration-500 group-hover:scale-105 ${soldOut ? "opacity-50 grayscale" : ""}`}
          />
          {soldOut ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/30 backdrop-blur-sm">
              <span className="rounded-full bg-slate-950 px-5 py-2 text-sm font-bold uppercase tracking-[0.2em] text-white">
                {translate(language, "productSoldOut")}
              </span>
            </div>
          ) : null}

          {/* Top badges row */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
            <span className="rounded-full bg-slate-950/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {brandName}
            </span>
            <div className="flex items-center gap-2">
              {hasDiscount ? (
                <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-gradient-to-r from-rose-600 to-orange-500 px-2.5 py-1 text-xs font-bold text-white shadow-md shadow-rose-500/30">
                  <BadgePercent className="h-3 w-3" />
                  -{discountPercent}%
                </span>
              ) : null}
              {lowStock ? (
                <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow-md shadow-rose-500/30">
                  <Flame className="h-3 w-3" />
                  {translate(language, "productOnlyLeft")}
                </span>
              ) : null}
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleWishlist(product._id);
                }}
                aria-label={translate(language, wishlisted ? "wishlistRemove" : "wishlistAdd")}
                className={`grid h-9 w-9 place-items-center rounded-full shadow-sm backdrop-blur transition ${
                  wishlisted ? "bg-rose-500 text-white" : "bg-white/90 text-slate-600 hover:bg-white hover:text-rose-500"
                }`}
              >
                <Heart className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3 p-5">
          <div>
            <h3 className="line-clamp-2 text-base font-semibold leading-snug text-slate-950 sm:text-lg">
              {getLocalizedText(product.name, language)}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">
              {getLocalizedText(product.description, language)}
            </p>
          </div>

          <div className="muted-card flex items-center justify-between px-3 py-2.5 text-xs sm:px-4 sm:text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
              <ShieldCheck className="h-4 w-4 text-teal-600" />
              {translate(language, "trustQuality")}
            </span>
            <span className={`font-semibold ${soldOut ? "text-rose-600" : "text-emerald-600"}`}>
              {translate(language, soldOut ? "productSoldOut" : "productInStock")}
            </span>
          </div>

          {!soldOut ? (
            <p className="text-xs font-medium text-amber-600">
              🔥 {translate(language, "productBoughtToday").replace("{count}", String(boughtToday))}
            </p>
          ) : null}

          {/* Price + CTA */}
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xl font-bold text-slate-950 sm:text-2xl">
                {formatCurrency(price, language)}
                {legacyHint ? <span className="ms-1 text-xs font-normal text-slate-400">({legacyHint})</span> : null}
              </div>
              {hasDiscount ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-400 line-through sm:text-sm">{formatCurrency(product.basePrice, language)}</span>
                  <span className="text-xs font-bold text-rose-600">{translate(language, "productSaveAmount")} {formatCurrency(product.basePrice - price, language)}</span>
                </div>
              ) : null}
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-white transition sm:px-4 sm:text-sm ${
              soldOut
                ? "bg-slate-400"
                : "bg-gradient-to-r from-teal-600 to-emerald-600 shadow-[0_6px_18px_rgba(20,184,166,0.3)] group-hover:from-teal-500 group-hover:to-emerald-500"
            }`}>
              <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{translate(language, "productView")}</span>
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
