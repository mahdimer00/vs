import { ArrowUpRight, BadgePercent, Heart, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import type { Locale, Product } from "@/types";
import { formatCurrency, formatLegacyDinarHint, getLocalizedText } from "@/utils/format";
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

  return (
    <article className="group overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 shadow-[0_18px_55px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_65px_rgba(15,23,42,0.12)]">
      <Link
        to={`/products/${product.slug}`}
        onClick={(event) => {
          if (soldOut) {
            event.preventDefault();
          }
        }}
        aria-disabled={soldOut}
        className={`block ${soldOut ? "cursor-not-allowed" : ""}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
          <img
            src={product.images[0]}
            alt={getLocalizedText(product.name, language)}
            className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${soldOut ? "opacity-60 grayscale" : ""}`}
          />
          {soldOut ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/30">
              <span className="rounded-full bg-slate-950 px-5 py-2 text-sm font-bold uppercase tracking-[0.2em] text-white">
                {translate(language, "productSoldOut")}
              </span>
            </div>
          ) : null}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
            <span className="rounded-full bg-slate-950/85 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {brandName}
            </span>
            <div className="flex items-center gap-2">
              {hasDiscount ? (
                <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-gradient-to-r from-rose-600 to-orange-500 px-3 py-1 text-xs font-bold text-white shadow-md shadow-rose-500/40">
                  <BadgePercent className="h-3.5 w-3.5" />
                  -{discountPercent}%
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
                className={`grid h-9 w-9 place-items-center rounded-full backdrop-blur transition ${
                  wishlisted ? "bg-rose-500 text-white" : "bg-white/85 text-slate-700 hover:bg-white"
                }`}
              >
                <Heart className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`} />
              </button>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <h3 className="line-clamp-2 text-xl font-semibold text-slate-950">{getLocalizedText(product.name, language)}</h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
              {getLocalizedText(product.description, language)}
            </p>
          </div>
          <div className="muted-card flex items-center justify-between px-4 py-3 text-sm">
            <span className="inline-flex items-center gap-2 font-medium text-slate-700">
              <ShieldCheck className="h-4 w-4 text-teal-700" />
              {translate(language, "trustQuality")}
            </span>
            <span className={`font-semibold ${soldOut ? "text-rose-600" : "text-emerald-700"}`}>
              {translate(language, soldOut ? "productSoldOut" : "productInStock")}
            </span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl font-bold text-slate-950">
                {formatCurrency(price, language)}
                {legacyHint ? <span className="ml-1.5 text-xs font-normal text-slate-400">({legacyHint})</span> : null}
              </div>
              {hasDiscount ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400 line-through">{formatCurrency(product.basePrice, language)}</span>
                  <span className="text-xs font-bold text-rose-600">{translate(language, "productSaveAmount")} {formatCurrency(product.basePrice - price, language)}</span>
                </div>
              ) : null}
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white">
              {translate(language, "productView")}
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
