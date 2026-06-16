import { ArrowUpRight, Clock, Headphones, Package, Search, ShieldCheck, Truck, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ProductCard } from "@/components/ProductCard";
import { PromoSlider } from "@/components/PromoSlider";
import { Seo } from "@/components/Seo";
import { useApp } from "@/hooks/useApp";
import { adminService } from "@/services/admin.service";
import { bannerService } from "@/services/banner.service";
import { productService } from "@/services/product.service";
import type { Banner, Brand, Category, Product } from "@/types";
import { formatCurrency, getLocalizedText } from "@/utils/format";
import { translate } from "@/utils/i18n";
import { getRecentlyViewed, type RecentlyViewedItem } from "@/utils/recentlyViewed";

export function HomePage() {
  const { language } = useApp();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [soldOutProducts, setSoldOutProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    setRecentlyViewed(getRecentlyViewed());
  }, []);

  useEffect(() => {
    void Promise.all([productService.getProducts(), adminService.getCategories(), bannerService.getBanners(), adminService.getBrands()])
      .then(([productData, categoryData, bannerData, brandData]) => {
        setProducts(productData.filter((product) => product.isFeatured && !product.isSoldOut).slice(0, 6));
        setSoldOutProducts(productData.filter((product) => product.isSoldOut).slice(0, 6));
        setCategories(categoryData.filter((category) => category.isActive).slice(0, 4));
        setBanners(bannerData);
        setBrands(brandData.filter((brand) => brand.isActive && brand.logo));
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : translate(language, "homeLoadErrorDescription"));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState label={translate(language, "loading")} />;
  if (errorMessage) return <EmptyState title={translate(language, "homeLoadErrorTitle")} description={errorMessage} />;

  const trustItems = [
    { icon: WalletCards, label: translate(language, "trustCod"), color: "text-amber-600", bg: "bg-amber-50" },
    { icon: Truck, label: translate(language, "trustDelivery"), color: "text-teal-600", bg: "bg-teal-50" },
    { icon: ShieldCheck, label: translate(language, "trustQuality"), color: "text-emerald-600", bg: "bg-emerald-50" },
    { icon: Headphones, label: translate(language, "trustSupport"), color: "text-blue-600", bg: "bg-blue-50" },
  ];

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/products");
    }
  };

  return (
    <div className="space-y-12">
      <Seo
        title={translate(language, "heroBadge")}
        description={translate(language, "heroDescription")}
        path="/"
        type="website"
        jsonLd={[
          { "@context": "https://schema.org", "@type": "Organization", name: "VisaStore", url: "https://visadz.store", logo: "https://visadz.store/og-image.png" },
          { "@context": "https://schema.org", "@type": "WebSite", name: "VisaStore", url: "https://visadz.store" },
        ]}
      />

      <PromoSlider banners={banners} language={language} />

      {/* Search bar */}
      <section>
        <form onSubmit={handleSearch} className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={translate(language, "search") || "ابحث عن منتج..."}
              className="w-full rounded-full border border-slate-200 bg-white py-3.5 pe-5 ps-12 text-sm shadow-sm outline-none ring-0 transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:from-teal-500 hover:to-emerald-500"
          >
            {translate(language, "search") || "بحث"}
          </button>
        </form>
      </section>

      {/* Trust bar */}
      <section className="surface-card grid grid-cols-2 gap-0 overflow-hidden p-0 sm:grid-cols-4">
        {trustItems.map((item, index) => (
          <div
            key={item.label}
            className={`flex flex-col items-center gap-2 px-4 py-5 text-center sm:flex-row sm:gap-3 sm:text-start ${
              index < trustItems.length - 1 ? "border-b border-slate-100 sm:border-b-0 sm:border-e sm:border-slate-100" : ""
            } ${index % 2 === 0 && index < 2 ? "border-e border-slate-100 sm:border-e-0" : ""}`}
          >
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${item.bg}`}>
              <item.icon className={`h-5 w-5 ${item.color}`} />
            </div>
            <div className="text-xs font-semibold text-slate-700 sm:text-sm">{item.label}</div>
          </div>
        ))}
      </section>

      {/* Categories */}
      <section className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-eyebrow">{translate(language, "categoryEyebrow")}</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-slate-950 sm:text-3xl">{translate(language, "categoryTitle")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{translate(language, "categoryDescription")}</p>
          </div>
          <Link to="/categories" className="ghost-button self-start sm:self-auto">
            {translate(language, "viewAll")}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category._id}
              to={`/products?category=${category.slug}`}
              className="group relative aspect-[3/4] overflow-hidden rounded-[1.75rem] shadow-[0_12px_35px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(15,23,42,0.14)] sm:aspect-[4/3] md:aspect-square"
            >
              {category.image ? (
                <img
                  src={category.image}
                  alt={getLocalizedText(category.name, language)}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-amber-100 via-white to-teal-100" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <div className="line-clamp-2 text-sm font-bold leading-snug text-white sm:text-base md:text-lg">
                  {getLocalizedText(category.name, language)}
                </div>
                <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white/70 transition group-hover:text-white">
                  {translate(language, "viewAll")}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-eyebrow">{translate(language, "featuredEyebrow")}</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-slate-950 sm:text-3xl">{translate(language, "featuredTitle")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{translate(language, "featuredDescription")}</p>
          </div>
          <Link to="/products" className="ghost-button self-start sm:self-auto">
            {translate(language, "viewAll")}
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} language={language} />
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950 px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -end-20 -top-20 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -start-20 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-400">
              <Package className="h-3.5 w-3.5" />
              {translate(language, "trustDelivery")}
            </div>
            <h2 className="mt-3 font-serif text-2xl font-bold text-white sm:text-3xl">
              {translate(language, "featuredTitle")}
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-7 text-slate-400">
              {translate(language, "featuredDescription")}
            </p>
          </div>
          <Link
            to="/products"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-[0_12px_30px_rgba(251,191,36,0.3)] transition hover:from-amber-300 hover:to-orange-300"
          >
            {translate(language, "viewAll")}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Brands */}
      {brands.length ? (
        <section className="space-y-6">
          <div>
            <p className="section-eyebrow">{translate(language, "brandsEyebrow")}</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-slate-950 sm:text-3xl">{translate(language, "brandsTitle")}</h2>
          </div>
          <div className="surface-card grid grid-cols-3 gap-3 p-5 sm:grid-cols-4 sm:gap-4 sm:p-6 md:grid-cols-6 xl:grid-cols-8">
            {brands.map((brand) => (
              <Link
                key={brand._id}
                to={`/products?brand=${encodeURIComponent(brand.name)}`}
                className="flex aspect-square items-center justify-center rounded-2xl border border-slate-100 bg-white p-3 transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
                title={brand.name}
              >
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className="h-8 w-8 object-contain sm:h-10 sm:w-10 md:h-12 md:w-12"
                  loading="lazy"
                />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Recently Viewed */}
      {recentlyViewed.length > 0 ? (
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-100">
              <Clock className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="section-eyebrow">{language === "ar" ? "سجل المشاهدة" : language === "fr" ? "Récemment vus" : "Recently Viewed"}</p>
              <h2 className="font-serif text-xl font-semibold text-slate-950">{language === "ar" ? "المنتجات التي شاهدتها" : language === "fr" ? "Produits vus récemment" : "Your Recent Views"}</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {recentlyViewed.map((item) => (
              <Link
                key={item.id}
                to={`/products/${item.slug}`}
                className="group flex flex-col overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="aspect-square overflow-hidden bg-slate-50 p-2">
                  <img src={item.image} alt={language === "ar" ? item.nameAr : language === "fr" ? item.nameFr : item.nameEn} className="h-full w-full object-contain transition duration-300 group-hover:scale-105" loading="lazy" />
                </div>
                <div className="p-3">
                  <div className="line-clamp-2 text-xs font-semibold leading-snug text-slate-800 sm:text-sm">
                    {language === "ar" ? item.nameAr : language === "fr" ? item.nameFr : item.nameEn}
                  </div>
                  <div className="mt-1.5 text-sm font-bold text-teal-700">{formatCurrency(item.price, language)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Sold Out / Previous Sales — social proof */}
      {soldOutProducts.length > 0 ? (
        <section className="space-y-5 rounded-[2rem] border border-slate-100 bg-slate-50/60 p-6">
          <div>
            <p className="section-eyebrow text-rose-500">
              {language === "ar" ? "مباع بالكامل" : language === "fr" ? "Épuisé" : "Sold Out"}
            </p>
            <h2 className="mt-1 font-serif text-xl font-semibold text-slate-950 sm:text-2xl">
              {language === "ar" ? "منتجات تم بيعها — إثبات الثقة" : language === "fr" ? "Produits précédemment vendus" : "Previously Sold Products"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {language === "ar" ? "هذه المنتجات تم بيعها بالكامل، شكراً لثقتكم" : language === "fr" ? "Ces produits ont été complètement vendus, merci pour votre confiance" : "These products are completely sold out, thank you for your trust"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {soldOutProducts.map((product) => (
              <div key={product._id} className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
                <div className="aspect-square overflow-hidden bg-slate-50 p-2">
                  <img src={product.images[0]} alt={getLocalizedText(product.name, language)} className="h-full w-full object-contain opacity-50 grayscale" loading="lazy" />
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-950/25">
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
