import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { useApp } from "@/hooks/useApp";
import { adminService } from "@/services/admin.service";
import { productService } from "@/services/product.service";
import type { Category, Product } from "@/types";
import { getLocalizedText } from "@/utils/format";
import { translate } from "@/utils/i18n";

export function CategoriesPage() {
  const { language } = useApp();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void Promise.all([adminService.getCategories(), productService.getProducts()])
      .then(([categoryData, productData]) => {
        setCategories(categoryData.filter((category) => category.isActive));
        setProducts(productData);
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

  if (!categories.length) {
    return (
      <EmptyState
        title={translate(language, "categories")}
        description={translate(language, "dashboardNoData")}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="surface-card p-6 md:p-8">
        <p className="section-eyebrow">{translate(language, "categoryEyebrow")}</p>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-slate-950 sm:text-3xl md:text-4xl">{translate(language, "categoryTitle")}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{translate(language, "categoryDescription")}</p>
      </section>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => {
          const count = products.filter((product) => {
            const productCategory = typeof product.category === "string" ? product.category : product.category.slug;
            return productCategory === category.slug;
          }).length;

          return (
            <Link
              key={category._id}
              to={`/products?category=${category.slug}`}
              className="surface-card group overflow-hidden p-0 transition hover:-translate-y-1 hover:shadow-[0_24px_65px_rgba(15,23,42,0.12)]"
            >
              <div className="aspect-[16/10] w-full overflow-hidden bg-slate-100">
                {category.image ? (
                  <img
                    src={category.image}
                    alt={getLocalizedText(category.name, language)}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-50 via-white to-teal-50 text-3xl font-bold text-slate-200">
                    {getLocalizedText(category.name, language).charAt(0)}
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="text-sm uppercase tracking-[0.25em] text-slate-400">{count} {translate(language, "productsResults")}</div>
                <h2 className="mt-4 text-2xl font-semibold text-slate-950">{getLocalizedText(category.name, language)}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{translate(language, "categoryDescription")}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">
                  {translate(language, "browseCategory")}
                  <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
