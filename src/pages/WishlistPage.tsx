import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ProductCard } from "@/components/ProductCard";
import { useApp } from "@/hooks/useApp";
import { productService } from "@/services/product.service";
import type { Product } from "@/types";
import { translate } from "@/utils/i18n";

export function WishlistPage() {
  const { language, wishlist } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void productService
      .getProducts()
      .then((all) => setProducts(all))
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : "Unable to load products"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingState label={translate(language, "loading")} />;
  }

  if (errorMessage) {
    return <EmptyState title={translate(language, "wishlistTitle")} description={errorMessage} />;
  }

  const saved = products.filter((product) => wishlist.includes(product._id));

  return (
    <div className="space-y-6">
      <section className="surface-card overflow-hidden p-6 md:p-8">
        <p className="section-eyebrow">{translate(language, "wishlist")}</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-slate-950">{translate(language, "wishlistTitle")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{translate(language, "wishlistDescription")}</p>
      </section>

      {saved.length === 0 ? (
        <EmptyState
          title={translate(language, "wishlistEmptyTitle")}
          description={translate(language, "wishlistEmptyDescription")}
          action={
            <Link to="/products" className="primary-button">
              {translate(language, "heroPrimary")}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {saved.map((product) => (
            <ProductCard key={product._id} product={product} language={language} />
          ))}
        </div>
      )}
    </div>
  );
}
