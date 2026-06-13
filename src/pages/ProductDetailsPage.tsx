import { Bot, CheckCircle2, Heart, Minus, ShieldCheck, ShoppingCart, Sparkles, Truck, Plus } from "lucide-react";
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

  return (
    <div className="space-y-10">
    <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr]">
      <div className="space-y-5">
        <div className="surface-card overflow-hidden p-3">
          <div className="relative overflow-hidden rounded-[1.6rem] bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.2),_transparent_22%),linear-gradient(180deg,_#fff,_#f8fafc)]">
            <img src={selectedImage} alt="" className="aspect-[4/3] w-full object-cover" />
            {saving > 0 ? (
              <div className="absolute left-4 top-4 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg">
                {translate(language, "productSaveAmount")} {formatCurrency(saving, language)}
              </div>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
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
              <img src={image} alt="" className="aspect-square w-full rounded-[1rem] object-cover" />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="surface-card overflow-hidden p-0">
          <div className="bg-[linear-gradient(135deg,_#fff7ed,_#ffffff_38%,_#eff6ff)] p-6 md:p-7">
            <div className="flex flex-wrap items-center gap-3 text-sm uppercase tracking-[0.24em] text-slate-400">
              <span>{typeof product.brand === "string" ? product.brand : product.brand.name}</span>
              <span>•</span>
              <span className="text-emerald-600">{translate(language, "productInStock")}</span>
              <span>•</span>
              <span className="text-amber-600">{translate(language, "productBestChoice")}</span>
              <span>•</span>
              <span className={product.condition === "USED" ? "text-orange-600" : "text-teal-600"}>
                {translate(language, product.condition === "USED" ? "productConditionUsed" : "productConditionNew")}
              </span>
            </div>
            <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-slate-950">
              {getLocalizedText(product.name, language)}
            </h1>
            <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-8 text-slate-600">{getLocalizedText(product.description, language)}</p>

            {product.adminNote ? (
              <div className="mt-4 whitespace-pre-line rounded-[1.4rem] border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
                <span className="font-semibold">⚠️ {translate(language, "productAdminNoteTitle")}: </span>
                {product.adminNote}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-end gap-4">
              <div className="text-4xl font-bold text-slate-950">
                {formatCurrency(price, language)}
                {legacyHint ? <span className="ml-2 text-sm font-normal text-slate-400">({legacyHint})</span> : null}
              </div>
              {product.discountPrice ? (
                <div className="text-lg text-slate-400 line-through">{formatCurrency(product.basePrice, language)}</div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="mr-2 inline h-4 w-4" />
                {translate(language, "productFastDecision")}
              </div>
              {lowStock ? (
                <div className="rounded-full bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 animate-pulse">
                  {translate(language, "productOnlyLeft")}
                </div>
              ) : null}
              <div className="rounded-full bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700">
                👀 {viewerCount} {translate(language, "productViewingNow")}
              </div>
              <div className="rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
                🔥 {translate(language, "productBoughtToday").replace("{count}", String(boughtToday))}
              </div>
            </div>

            {saving > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[1.4rem] border border-rose-200 bg-gradient-to-r from-rose-50 to-amber-50 px-4 py-3">
                <span className="rounded-full bg-rose-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  {translate(language, "productHotDeal")}
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  {translate(language, "productOfferEndsIn")} {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
                </span>
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.4rem] border border-teal-100 bg-white/80 px-4 py-4 text-sm shadow-sm">
                <div className="text-slate-500">{translate(language, "productStock")}</div>
                <div className={`mt-2 font-semibold ${selectedVariant.stock > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {selectedVariant.stock > 0 ? translate(language, "productInStock") : translate(language, "productSoldOut")}
                </div>
              </div>
              <div className="rounded-[1.4rem] border border-sky-100 bg-white/80 px-4 py-4 text-sm shadow-sm">
                <div className="text-slate-500">{translate(language, "deliveryType")}</div>
                <div className="mt-2 font-semibold text-slate-950">{translate(language, "trustDelivery")}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="space-y-5">
            {renderOptionGroup(translate(language, "productChooseRam"), ramOptions, selectedVariant.ram, "ram")}
            {renderOptionGroup(
              translate(language, "productChooseStorage"),
              storageOptions,
              selectedVariant.storage,
              "storage",
            )}
            {renderOptionGroup(
              translate(language, "productChooseColor"),
              colorOptions,
              selectedVariant.color,
              "color",
            )}
          </div>

          <div className="mt-6 rounded-[1.6rem] border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4">
            <div className="text-sm text-slate-500">{translate(language, "productVariant")}</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{buildVariantLabel(selectedVariant)}</div>
          </div>

          <div className="mt-6">
            <label className="mb-3 block text-sm font-semibold text-slate-700">{translate(language, "productQuantity")}</label>
            <div className="flex w-full items-center justify-between rounded-[1.4rem] border border-teal-200 bg-white p-2 shadow-sm">
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-white transition hover:bg-slate-800"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="text-2xl font-semibold text-slate-950">{quantity}</div>
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.min(selectedVariant.stock, current + 1))}
                className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-500"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              disabled={selectedVariant.stock <= 0}
              onClick={() => addToCart({ product, variant: selectedVariant, quantity })}
              className="primary-button min-w-48 gap-2 px-7 py-4 text-base disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingCart className="h-5 w-5" />
              {translate(language, "productAddToCart")}
            </button>
            <button
              disabled={selectedVariant.stock <= 0}
              onClick={() => {
                addToCart({ product, variant: selectedVariant, quantity });
                navigate("/checkout");
              }}
              className="inline-flex min-w-40 items-center justify-center rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-7 py-4 text-base font-semibold text-white shadow-[0_16px_35px_rgba(16,185,129,0.24)] transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {translate(language, "productBuyNow")}
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
              {translate(language, isWishlisted(product._id) ? "wishlistRemove" : "wishlistAdd")}
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/90 px-4 py-4 text-sm text-slate-700">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-teal-700" />
                {translate(language, "trustQuality")}
              </div>
            </div>
            <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/90 px-4 py-4 text-sm text-slate-700">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-teal-700" />
                {translate(language, "trustDelivery")}
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card p-6">
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
          {answer ? (
            <div className="mt-4 rounded-[1.5rem] bg-slate-100 p-4 text-sm leading-7 text-slate-700">{answer}</div>
          ) : null}
        </div>

        <div className="surface-card p-6">
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
        </div>
      </div>
    </div>

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
