import { ArrowUpRight, BadgePercent, Headphones, ShieldCheck, Truck, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ProductCard } from "@/components/ProductCard";
import { PromoSlider } from "@/components/PromoSlider";
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

  if (loading) {
    return <LoadingState label={translate(language, "loading")} />;
  }

  if (errorMessage) {
    return <EmptyState title={translate(language, "homeLoadErrorTitle")} description={errorMessage} />;
  }

  const trustItems = [
    { icon: WalletCards, label: translate(language, "trustCod") },
    { icon: Truck, label: translate(language, "trustDelivery") },
    { icon: ShieldCheck, label: translate(language, "trustQuality") },
    { icon: Headphones, label: translate(language, "trustSupport") },
  ];

  return (
    <div className="space-y-10">
      <PromoSlider banners={banners} language={language} />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {trustItems.map((item) => (
          <div key={item.label} className="surface-card px-4 py-5 sm:px-5">
            <item.icon className="h-5 w-5 text-teal-700" />
            <div className="mt-3 text-sm font-semibold text-slate-950 sm:text-base">{item.label}</div>
          </div>
        ))}
      </section>

      <section className="surface-card-dark relative flex flex-col gap-6 overflow-hidden p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-amber-400/30 to-rose-500/20 blur-3xl" />
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/10">
            <BadgePercent className="h-7 w-7 text-amber-300" />
          </div>
          <div>
            <span className="inline-flex items-center rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-amber-300">
              {translate(language, "earnMoneyBadge")}
            </span>
            <h2 className="mt-3 font-serif text-2xl font-semibold text-white md:text-3xl">{translate(language, "homeAffiliatePromoTitle")}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{translate(language, "homeAffiliatePromoDescription")}</p>
          </div>
        </div>
        <Link to="/earn-money" className="primary-button w-full shrink-0 text-center sm:w-auto">
          {translate(language, "homeAffiliatePromoCta")}
        </Link>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-eyebrow">{translate(language, "categoryEyebrow")}</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-slate-950">{translate(language, "categoryTitle")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{translate(language, "categoryDescription")}</p>
          </div>
          <Link to="/categories" className="ghost-button">
            {translate(language, "viewAll")}
          </Link>
        </div>
        <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category._id}
              to={`/products?category=${category.slug}`}
              className="surface-card group relative aspect-[4/3] overflow-hidden p-0 transition hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(15,23,42,0.1)] sm:aspect-square md:aspect-[4/3]"
            >
              {category.image ? (
                <img
                  src={category.image}
                  alt={getLocalizedText(category.name, language)}
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-teal-50" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 sm:p-5">
                <div className="line-clamp-2 text-base font-semibold text-white sm:text-xl">{getLocalizedText(category.name, language)}</div>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-white transition group-hover:bg-white/25 sm:h-9 sm:w-9">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-eyebrow">{translate(language, "featuredEyebrow")}</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-slate-950">{translate(language, "featuredTitle")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{translate(language, "featuredDescription")}</p>
          </div>
          <Link to="/products" className="ghost-button">
            {translate(language, "viewAll")}
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} language={language} />
          ))}
        </div>
      </section>

      {brands.length ? (
        <section className="space-y-6">
          <div>
            <p className="section-eyebrow">{translate(language, "brandsEyebrow")}</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-slate-950">{translate(language, "brandsTitle")}</h2>
          </div>
          <div className="surface-card grid grid-cols-3 gap-4 p-6 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
            {brands.map((brand) => (
              <Link
                key={brand._id}
                to={`/products?brand=${encodeURIComponent(brand.name)}`}
                className="flex aspect-square items-center justify-center rounded-2xl border border-slate-100 bg-white p-3 transition hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
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
