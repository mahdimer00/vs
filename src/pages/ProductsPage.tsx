import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ProductCard } from "@/components/ProductCard";
import { ProductFilters, type ProductFilterState } from "@/components/ProductFilters";
import { useApp } from "@/hooks/useApp";
import { adminService } from "@/services/admin.service";
import { productService } from "@/services/product.service";
import type { Category, Product } from "@/types";
import { getLocalizedText } from "@/utils/format";
import { translate } from "@/utils/i18n";

export function ProductsPage() {
  const { language } = useApp();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [filters, setFilters] = useState<ProductFilterState>({
    search: "",
    category: searchParams.get("category") || "all",
    brand: searchParams.get("brand") || "all",
    maxPrice: 500000,
  });

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

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const productCategory = typeof product.category === "string" ? product.category : product.category.slug;
      const productBrand = typeof product.brand === "string" ? product.brand : product.brand.name;
      const localizedName = `${product.name.ar} ${product.name.fr} ${product.name.en} ${productBrand}`.toLowerCase();
      const price = product.discountPrice ?? product.basePrice;

      return (
        (filters.category === "all" || productCategory === filters.category) &&
        (filters.brand === "all" || productBrand === filters.brand) &&
        localizedName.includes(filters.search.toLowerCase()) &&
        price <= filters.maxPrice
      );
    });
  }, [filters, products]);

  if (loading) {
    return <LoadingState label={translate(language, "loading")} />;
  }

  if (errorMessage) {
    return <EmptyState title={translate(language, "noProductsTitle")} description={errorMessage} />;
  }

  return (
    <div className="space-y-6">
      <section className="surface-card overflow-hidden p-5 sm:p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="section-eyebrow">{translate(language, "productsEyebrow")}</p>
            <h1 className="mt-2 font-serif text-2xl font-semibold text-slate-950 sm:text-3xl md:text-4xl">{translate(language, "productsTitle")}</h1>
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
        <EmptyState
          title={translate(language, "noProductsTitle")}
          description={translate(language, "noProductsDescription")}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard key={product._id} product={product} language={language} />
          ))}
        </div>
      )}
    </div>
  );
}
