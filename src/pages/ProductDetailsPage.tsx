import { Bot, Clock, Heart, Minus, ShieldCheck, ShoppingCart, Sparkles, Truck, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ProductCard } from "@/components/ProductCard";
import { useApp } from "@/hooks/useApp";
import { aiService } from "@/services/ai.service";
import { productService } from "@/services/product.service";
import type { Product, ProductVariant } from "@/types";
import { buildVariantLabel, formatCurrency, formatLegacyDinarHint, getLocalizedText, hashSeed } from "@/utils/format";
import { translate } from "@/utils/i18n";

function getTimeUntilMidnight(): { hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = Math.max(0, midnight.getTime() - now.getTime());
  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function pickMatchingVariant(
  variants: ProductVariant[],
  next: { ram?: string; storage?: string; color?: string },
): ProductVariant | undefined {
  const exact = variants.find(
    (variant) =>
      (next.ram === undefined || variant.ram === next.ram) &&
      (next.storage === undefined || variant.storage === next.storage) &&
      (next.color === undefined || variant.color === next.color),
  );

  if (exact) {
    return exact;
  }

  return variants.find(
    (variant) =>
      (next.ram === undefined || variant.ram === next.ram) &&
      (next.storage === undefined || variant.storage === next.storage),
  );
}

export function ProductDetailsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { language, addToCart, toggleWishlist, isWishlisted } = useApp();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [countdown, setCountdown] = useState(getTimeUntilMidnight());

  useEffect(() => {
    const timer = window.setInterval(() => setCountdown(getTimeUntilMidnight()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!slug) {
      return;
    }

    void productService
      .getProduct(slug)
      .then((data) => {
        setProduct(data);
        const firstVariant = data.variants[0];
        setSelectedVariantId(firstVariant?._id ?? "");
        setSelectedImage(firstVariant?.images[0] || data.images[0] || "");
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load product");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (!product) {
      setRelatedProducts([]);
      return;
    }

    const categoryKey = (value: Product["category"]) => (typeof value === "string" ? value : value._id);
    const currentCategory = categoryKey(product.category);

    void productService
      .getProducts()
      .then((all) => {
        setRelatedProducts(
          all.filter((entry) => entry._id !== product._id && categoryKey(entry.category) === currentCategory).slice(0, 4),
        );
      })
      .catch(() => setRelatedProducts([]));
  }, [product]);

  const selectedVariant = useMemo<ProductVariant | undefined>(
    () => product?.variants.find((variant) => variant._id === selectedVariantId) ?? product?.variants[0],
    [product, selectedVariantId],
  );

  useEffect(() => {
    if (!selectedVariant) {
      return;
    }
    setSelectedImage(selectedVariant.images[0] || product?.images[0] || "");
    setQuantity((current) => Math.max(1, Math.min(selectedVariant.stock, current)));
  }, [product?.images, selectedVariant]);

  const ramOptions = useMemo(
    () => [...new Set((product?.variants || []).map((variant) => variant.ram).filter(Boolean))] as string[],
    [product?.variants],
  );
  const storageOptions = useMemo(
    () => [...new Set((product?.variants || []).map((variant) => variant.storage).filter(Boolean))] as string[],
    [product?.variants],
  );
  const colorOptions = useMemo(
    () => [...new Set((product?.variants || []).map((variant) => variant.color).filter(Boolean))] as string[],
    [product?.variants],
  );

  if (loading) {
    return <LoadingState label={translate(language, "loading")} />;
  }

  if (!product || !selectedVariant) {
    return (
      <EmptyState
        title={translate(language, "productOutOfStock")}
        description={errorMessage || translate(language, "dashboardNoData")}
      />
    );
  }

  const price = selectedVariant.price || product.discountPrice || product.basePrice;
  const legacyHint = formatLegacyDinarHint(price, language);
  const gallery = selectedVariant.images.length ? selectedVariant.images : product.images;
  const saving = Math.max(0, product.basePrice - price);
  const lowStock = selectedVariant.stock <= 5;
  const viewerCount = 8 + hashSeed(product._id);
  const boughtToday = 3 + hashSeed(product._id) % 12;
  const pad = (value: number) => String(value).padStart(2, "0");

  const selectVariantBy = (change: { ram?: string; storage?: string; color?: string }) => {
    const nextVariant = pickMatchingVariant(product.variants, {
      ram: change.ram ?? selectedVariant.ram,
      storage: change.storage ?? selectedVariant.storage,
      color: change.color ?? selectedVariant.color,
    });

    if (nextVariant) {
      setSelectedVariantId(nextVariant._id);
    }
  };

  const isOptionAvailable = (change: { ram?: string; storage?: string; color?: string }) =>
    Boolean(
      pickMatchingVariant(product.variants, {
        ram: change.ram ?? selectedVariant.ram,
        storage: change.storage ?? selectedVariant.storage,
        color: change.color ?? selectedVariant.color,
      }),
    );

  const handleAsk = async () => {
    if (!question.trim()) {
      return;
    }

    setAiLoading(true);
    setErrorMessage("");
    try {
      const response = await aiService.askProductQuestion({
        productId: product._id,
        message: question,
        language,
      });
      setAnswer(response.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to reach the AI assistant");
    } finally {
      setAiLoading(false);
    }
  };

  const renderOptionGroup = (
    label: string,
    options: string[],
    selected: string | undefined,
    keyName: "ram" | "storage" | "color",
  ) => {
    if (!options.length) {
      return null;
    }

    return (
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <label className="block text-sm font-semibold text-slate-700">{label}</label>
          {selected ? <span className="text-sm font-medium text-slate-500">{selected}</span> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          {options.map((option) => {
            const active = selected === option;
            const available = isOptionAvailable({ [keyName]: option });

            return (
              <button
                key={option}
                type="button"
                disabled={!available}
                onClick={() => selectVariantBy({ [keyName]: option })}
                className={`option-chip ${active ? "option-chip-active" : ""} ${!available ? "option-chip-disabled" : ""}`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const brandName = typeof product.brand === "string" ? product.brand : product.brand.name;
  const hasVariantOptions = ramOptions.length > 0 || storageOptions.length > 0 || colorOptions.length > 0;
  const discountPercent = product.basePrice > 0 ? Math.round((saving / product.basePrice) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="space-y-3 lg:sticky lg:top-24">
          <div className="surface-card overflow-hidden p-3">
            <div className="relative overflow-hidden rounded-[1.6rem] bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.2),_transparent_22%),linear-gradient(180deg,_#fff,_#f8fafc)]">
              <img src={selectedImage} alt="" className="aspect-square w-full object-contain p-4" />
              {saving > 0 ? (
                <div className="absolute start-4 top-4 rounded-full bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow-lg">
                  -{discountPercent}%
                </div>
              ) : null}
              {lowStock ? (
                <div className="absolute end-4 top-4 animate-pulse rounded-full bg-slate-950/85 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">
                  {translate(language, "productOnlyLeft")}
                </div>
              ) : null}
            </div>
          </div>
          {gallery.length > 1 ? (
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {gallery.map((image) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setSelectedImage(image)}
                  className={`overflow-hidden rounded-[1.35rem] border p-1 transition ${
                    selectedImage === image
                      ? "border-amber-400 bg-amber-50 shadow-[0_12px_28px_rgba(251,191,36,0.18)]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <img src={image} alt="" className="aspect-square w-full rounded-[1rem] bg-white object-contain p-1" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="surface-card p-5 sm:p-6 md:p-7">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold uppercase tracking-wide text-slate-600">{brandName}</span>
            <span
              className={`rounded-full px-3 py-1 font-semibold uppercase tracking-wide ${
                product.condition === "USED" ? "bg-orange-50 text-orange-700" : "bg-teal-50 text-teal-700"
              }`}
            >
              {translate(language, product.condition === "USED" ? "productConditionUsed" : "productConditionNew")}
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700">{translate(language, "productBestChoice")}</span>
          </div>

          <h1 className="mt-3 font-serif text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl md:text-4xl">
            {getLocalizedText(product.name, language)}
          </h1>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <span className="text-3xl font-bold text-slate-950 sm:text-4xl">{formatCurrency(price, language)}</span>
            {legacyHint ? <span className="text-sm font-normal text-slate-400">({legacyHint})</span> : null}
            {product.discountPrice ? (
              <span className="text-lg text-slate-400 line-through">{formatCurrency(product.basePrice, language)}</span>
            ) : null}
            {saving > 0 ? (
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600">
                -{discountPercent}% · {translate(language, "productSaveAmount")} {formatCurrency(saving, language)}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs sm:text-sm">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${
                selectedVariant.stock > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${selectedVariant.stock > 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
              {selectedVariant.stock > 0 ? translate(language, "productInStock") : translate(language, "productSoldOut")}
            </span>
            <span className="text-slate-500">
              👀 {viewerCount} {translate(language, "productViewingNow")}
            </span>
            <span className="text-slate-500">🔥 {translate(language, "productBoughtToday").replace("{count}", String(boughtToday))}</span>
          </div>

          {saving > 0 ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-gradient-to-r from-rose-50 to-amber-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
              <Clock className="h-3.5 w-3.5" />
              {translate(language, "productOfferEndsIn")} {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
            </div>
          ) : null}

          {product.adminNote ? (
            <div className="mt-4 whitespace-pre-line rounded-[1.4rem] border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
              <span className="font-semibold">⚠️ {translate(language, "productAdminNoteTitle")}: </span>
              {product.adminNote}
            </div>
          ) : null}

          <div className="my-5 h-px bg-slate-100" />

          {hasVariantOptions ? (
            <div className="space-y-5">
              {renderOptionGroup(translate(language, "productChooseRam"), ramOptions, selectedVariant.ram, "ram")}
              {renderOptionGroup(translate(language, "productChooseStorage"), storageOptions, selectedVariant.storage, "storage")}
              {renderOptionGroup(translate(language, "productChooseColor"), colorOptions, selectedVariant.color, "color")}
            </div>
          ) : null}

          {hasVariantOptions ? (
            <div className="mt-5 flex items-center justify-between rounded-[1.2rem] bg-slate-50 px-4 py-3 text-sm">
              <span className="text-slate-500">{translate(language, "productVariant")}</span>
              <span className="font-semibold text-slate-900">{buildVariantLabel(selectedVariant)}</span>
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-4">
            <label className="text-sm font-semibold text-slate-700">{translate(language, "productQuantity")}</label>
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                className="grid h-9 w-9 place-items-center rounded-full bg-slate-950 text-white transition hover:bg-slate-800"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="w-10 text-center text-lg font-semibold text-slate-950">{quantity}</div>
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.min(selectedVariant.stock, current + 1))}
                className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-500"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <button
              disabled={selectedVariant.stock <= 0}
              onClick={() => addToCart({ product, variant: selectedVariant, quantity })}
              className="primary-button gap-2 px-7 py-4 text-base disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingCart className="h-5 w-5" />
              {translate(language, "productAddToCart")}
            </button>
            <button
              type="button"
              onClick={() => toggleWishlist(product._id)}
              className={`inline-flex items-center justify-center gap-2 rounded-full border px-6 py-4 text-base font-semibold transition ${
                isWishlisted(product._id)
                  ? "border-rose-200 bg-rose-50 text-rose-600"
                  : "border-slate-200 bg-white text-slate-700 hover:border-rose-200 hover:text-rose-600"
              }`}
            >
              <Heart className={`h-5 w-5 ${isWishlisted(product._id) ? "fill-current" : ""}`} />
              <span className="sm:hidden">{translate(language, isWishlisted(product._id) ? "wishlistRemove" : "wishlistAdd")}</span>
            </button>
          </div>

          <button
            disabled={selectedVariant.stock <= 0}
            onClick={() => {
              addToCart({ product, variant: selectedVariant, quantity });
              navigate("/checkout");
            }}
            className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-7 py-4 text-base font-semibold text-white shadow-[0_16px_35px_rgba(16,185,129,0.24)] transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {translate(language, "productBuyNow")}
          </button>

          <div className="mt-5 grid grid-cols-2 gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2 rounded-[1.35rem] border border-slate-200 bg-slate-50/90 px-3 py-3 text-slate-700 sm:px-4">
              <ShieldCheck className="h-5 w-5 shrink-0 text-teal-700" />
              {translate(language, "trustQuality")}
            </div>
            <div className="flex items-center gap-2 rounded-[1.35rem] border border-slate-200 bg-slate-50/90 px-3 py-3 text-slate-700 sm:px-4">
              <Truck className="h-5 w-5 shrink-0 text-teal-700" />
              {translate(language, "trustDelivery")}
            </div>
          </div>
        </div>
      </div>

      <section className="surface-card p-6 md:p-7">
        <h2 className="text-lg font-semibold text-slate-950">{translate(language, "productDescriptionTitle")}</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-8 text-slate-600">{getLocalizedText(product.description, language)}</p>
      </section>

      <section className="surface-card p-6 md:p-7">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-700">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{translate(language, "productAskAi")}</h2>
            <p className="text-sm text-slate-600">{translate(language, "productAiDescription")}</p>
          </div>
        </div>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={4}
          className="field-textarea mt-4"
          placeholder={translate(language, "productAskPlaceholder")}
        />
        <button onClick={() => void handleAsk()} className="accent-button mt-3 gap-2">
          <Sparkles className="h-4 w-4" />
          {aiLoading ? translate(language, "productAiThinking") : translate(language, "productAskAi")}
        </button>
        {errorMessage ? <div className="mt-4 text-sm text-rose-600">{errorMessage}</div> : null}
        {answer ? <div className="mt-4 rounded-[1.5rem] bg-slate-100 p-4 text-sm leading-7 text-slate-700">{answer}</div> : null}
      </section>

      <section className="surface-card p-6 md:p-7">
        <h2 className="text-lg font-semibold text-slate-950">{translate(language, "productSpecifications")}</h2>
        <div className="mt-4 grid gap-3">
          {Object.entries(product.specifications ?? {}).map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-[1.35rem] border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm"
            >
              <span className="font-medium text-slate-500">{key}</span>
              <span className="font-semibold text-slate-900">{value}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-500">{translate(language, "productSupportNote")}</p>
      </section>

      {relatedProducts.length > 0 ? (
        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{translate(language, "relatedProductsEyebrow")}</div>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-slate-950">{translate(language, "relatedProductsTitle")}</h2>
            </div>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((entry) => (
              <ProductCard key={entry._id} product={entry} language={language} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
