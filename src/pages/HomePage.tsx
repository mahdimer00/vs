import { ArrowUpRight, Headphones, Package, ShieldCheck, Truck, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
import { getLocalizedText } from "@/utils/format";
import { translate } from "@/utils/i18n";

export function HomePage() {
  const { language } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void Promise.all([productService.getProducts(), adminService.getCategories(), bannerService.getBanners(), adminService.getBrands()])
      .then(([productData, categoryData, bannerData, brandData]) => {
        setProducts(productData.filter((product) => product.isFeatured).slice(0, 6));
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
    </div>
  );
}
