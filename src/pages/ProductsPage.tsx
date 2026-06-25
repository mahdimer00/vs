import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ProductCard } from "@/components/ProductCard";
import { ProductFilters, type ProductFilterState, DEFAULT_FILTERS } from "@/components/ProductFilters";
import { Seo } from "@/components/Seo";
import { useApp } from "@/hooks/useApp";
import { adminService } from "@/services/admin.service";
import { productService } from "@/services/product.service";
import type { Category, Product } from "@/types";
import { getLocalizedText } from "@/utils/format";
import { translate } from "@/utils/i18n";
import { ttqSearch } from "@/utils/tiktok";

export function ProductsPage() {
  const { language } = useApp();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filters, setFilters] = useState<ProductFilterState>({
    ...DEFAULT_FILTERS,
    search: searchParams.get("q") || "",
    category: searchParams.get("category") || "all",
    brand: searchParams.get("brand") || "all",
  });
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    void Promise.all([productService.getProducts(), adminService.getCategories()])
      .then(([productData, categoryData]) => {
        setProducts(productData);
        setCategories(categoryData.filter((category) => category.isActive));
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load products");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = filters.search.trim();
    if (!q) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => { ttqSearch(q); }, 800);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [filters.search]);

  const filtered = useMemo(() => {
    const list = products.filter((product) => {
      if (product.isSoldOut) return false;
      const productCategory = typeof product.category === "string" ? product.category : product.category.slug;
      const productBrand = typeof product.brand === "string" ? product.brand : product.brand.name;
      const localizedName = `${product.name.ar} ${product.name.fr} ${product.name.en} ${productBrand}`.toLowerCase();
      const price = product.discountPrice ?? product.basePrice;
      if (filters.inStockOnly && product.stock <= 0) return false;
      if (filters.onSaleOnly && !product.discountPrice) return false;
      if (filters.condition !== "all" && product.condition !== filters.condition) return false;
      return (
        (filters.category === "all" || productCategory === filters.category) &&
        (filters.brand === "all" || productBrand === filters.brand) &&
        localizedName.includes(filters.search.toLowerCase()) &&
        price <= filters.maxPrice
      );
    });

    // Apply sort
    switch (filters.sort) {
      case "price_asc": return [...list].sort((a, b) => (a.discountPrice ?? a.basePrice) - (b.discountPrice ?? b.basePrice));
      case "price_desc": return [...list].sort((a, b) => (b.discountPrice ?? b.basePrice) - (a.discountPrice ?? a.basePrice));
      case "newest": return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "name": return [...list].sort((a, b) => (a.name.ar || a.name.fr || "").localeCompare(b.name.ar || b.name.fr || ""));
      default: return list;
    }
  }, [filters, products]);

  const soldOutProducts = useMemo(() => products.filter((p) => p.isSoldOut), [products]);

  if (loading) {
    return <LoadingState label={translate(language, "loading")} />;
  }

  if (errorMessage) {
    return <EmptyState title={translate(language, "noProductsTitle")} description={errorMessage} />;
  }

  return (
    <div className="space-y-6">
      <Seo title={translate(language, "productsTitle")} description={translate(language, "categoryDescription")} path="/products" />
      {/* Mobile: slim single-line header */}
      <section className="surface-card overflow-hidden p-3.5 sm:p-5 md:p-8">
        <div className="flex items-center justify-between gap-3 md:hidden">
          <h1 className="font-serif text-lg font-semibold text-slate-950">{translate(language, "productsTitle")}</h1>
          <span className="shrink-0 rounded-full bg-slate-950 px-3 py-1 text-sm font-semibold text-white">{filtered.length}</span>
        </div>
        {/* Desktop: full layout */}
        <div className="hidden md:flex md:flex-wrap md:items-end md:justify-between md:gap-6">
          <div>
            <p className="section-eyebrow">{translate(language, "productsEyebrow")}</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-slate-950 md:text-4xl">{translate(language, "productsTitle")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{translate(language, "categoryDescription")}</p>
          </div>
          <div className="shrink-0 rounded-[1.5rem] bg-slate-950 px-5 py-4 text-white">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-300">{translate(language, "productsResults")}</div>
            <div className="mt-1 text-2xl font-semibold">{filtered.length}</div>
          </div>
        </div>
      </section>

      <ProductFilters
        categories={categories.map((category) => ({
          value: category.slug,
          label: getLocalizedText(category.name, language),
        }))}
        brands={[...new Set(products.map((product) => (typeof product.brand === "string" ? product.brand : product.brand.name)))]}
        state={filters}
        language={language}
        onChange={setFilters}
      />

      {filtered.length === 0 ? (
        <EmptyState title={translate(language, "noProductsTitle")} description={translate(language, "noProductsDescription")} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6 xl:grid-cols-3">
            {filtered.slice(0, visibleCount).map((product) => (
              <ProductCard key={product._id} product={product} language={language} />
            ))}
          </div>
          {visibleCount < filtered.length && (
            <div className="flex flex-col items-center gap-2">
              <button type="button" onClick={() => setVisibleCount((v) => v + 20)}
                className="primary-button px-8 py-3">
                {language === "ar" ? `تحميل المزيد (${filtered.length - visibleCount} متبقية)` : language === "fr" ? `Voir plus (${filtered.length - visibleCount} restants)` : `Load more (${filtered.length - visibleCount} remaining)`}
              </button>
              <p className="text-xs text-slate-400">{language === "ar" ? `عرض ${Math.min(visibleCount, filtered.length)} من ${filtered.length}` : `Showing ${Math.min(visibleCount, filtered.length)} of ${filtered.length}`}</p>
            </div>
          )}
        </div>
      )}

      {soldOutProducts.length > 0 ? (
        <section className="space-y-4 rounded-[2rem] border border-slate-100 bg-slate-50/60 p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-500">
              {language === "ar" ? "مباع بالكامل" : language === "fr" ? "Épuisé" : "Sold Out"}
            </p>
            <h2 className="mt-1 font-serif text-lg font-semibold text-slate-900">
              {language === "ar" ? "منتجات تم بيعها — دليل على ثقتكم" : language === "fr" ? "Produits précédemment vendus" : "Previously Sold — Proof of Trust"}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {soldOutProducts.map((product) => (
              <div key={product._id} className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
                <div className="aspect-square overflow-hidden bg-slate-50 p-2">
                  <img src={product.images[0]} alt={getLocalizedText(product.name, language)} className="h-full w-full object-contain opacity-40 grayscale" loading="lazy" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20">
                  <span className="rounded-full bg-slate-950/80 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-sm">
                    {language === "ar" ? "نفذ" : "Sold Out"}
                  </span>
                </div>
                <div className="p-2.5">
                  <div className="line-clamp-2 text-xs font-medium leading-snug text-slate-500">{getLocalizedText(product.name, language)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
