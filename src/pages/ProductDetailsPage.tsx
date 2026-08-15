import { AlertTriangle, ArrowRight, BadgePercent, Battery, ChevronLeft, ChevronRight, Clock, Cpu, Database, Facebook, HardDrive, Heart, MessageCircle, Minus, Monitor, Phone, Play, Settings, ShieldCheck, ShoppingCart, Truck, Plus, Zap } from "lucide-react";
import { TikTokIcon } from "@/components/TikTokIcon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ProductCard } from "@/components/ProductCard";
import { Seo } from "@/components/Seo";
import { useApp } from "@/hooks/useApp";
import { productService } from "@/services/product.service";
import type { Product, ProductVariant } from "@/types";
import { buildVariantLabel, formatCurrency, getLocalizedText } from "@/utils/format";
import { DirectOrderForm } from "@/components/DirectOrderForm";
import { translate } from "@/utils/i18n";
import { pixelViewContent } from "@/utils/pixel";
import { ttqAddToWishlist, ttqViewContent } from "@/utils/tiktok";
import { trackEvent } from "@/utils/tracking";
import { addRecentlyViewed } from "@/utils/recentlyViewed";

function computePcScore(specs: [string, string][]): number {
  let score = 0;
  const find = (keys: string[]) => specs.find(([k]) => keys.some((key) => k.toLowerCase().includes(key)))?.[1] ?? "";

  // CPU (40 pts)
  const cpuText = (find(["معالج", "cpu"]) + " " + find(["جيل", "gen"])).toLowerCase();
  const genMatch = cpuText.match(/(\d+)ᵉ|(\d+)ème|(\d+)th|(\d+)e gen|gen\s*(\d+)/i);
  const gen = genMatch ? parseInt(genMatch.slice(1).find((m) => m && /^\d+$/.test(m)) ?? "0") : 0;
  if (gen >= 12) score += 38; else if (gen >= 10) score += 33; else if (gen >= 8) score += 28;
  else if (gen >= 6) score += 22; else if (gen >= 4) score += 17; else if (gen >= 2) score += 12;
  else if (gen >= 1) score += 8; else if (cpuText.includes("amd") || cpuText.includes("intel")) score += 10;
  if (cpuText.includes("i7") || cpuText.includes("ryzen 7")) score += gen ? 5 : 24;
  else if (cpuText.includes("i5") || cpuText.includes("ryzen 5")) score += gen ? 2 : 18;
  else if (cpuText.includes("i3") || cpuText.includes("ryzen 3")) score += gen ? 0 : 13;
  else if (cpuText.includes("pentium") || cpuText.includes("athlon") || /\bamd\s*a\d/i.test(cpuText)) score += 9;
  else if (cpuText.includes("celeron")) score += 6;

  // RAM (30 pts)
  const ramText = find(["رام", "ram", "mémoire"]);
  const ram = parseInt(ramText.match(/(\d+)/)?.[1] ?? "0");
  if (ram >= 32) score += 30; else if (ram >= 16) score += 26; else if (ram >= 12) score += 22;
  else if (ram >= 8) score += 18; else if (ram >= 6) score += 14; else if (ram >= 4) score += 10;
  else if (ram >= 2) score += 5;

  // Storage (20 pts)
  const storageText = find(["تخزين", "ssd", "hdd", "stockage"]).toLowerCase();
  if (storageText.includes("nvme")) score += 20;
  else if (storageText.includes("ssd")) score += 16;
  else if (storageText) score += 8;

  // GPU (10 pts)
  const gpuText = find(["كرت", "gpu", "graphique"]).toLowerCase();
  if (gpuText && !gpuText.includes("intel hd") && !gpuText.includes("intel uhd") && !gpuText.includes("iris")) {
    if (gpuText.includes("rtx") || gpuText.includes("rx 6") || gpuText.includes("rx 7")) score += 10;
    else if (gpuText.includes("gtx") || gpuText.includes("geforce") || gpuText.includes("nvidia") || gpuText.includes("radeon") || gpuText.includes("mx") || gpuText.includes("quadro")) score += 7;
    else score += 4;
  } else if (gpuText) {
    score += 2;
  }

  return Math.min(100, score);
}

function extractImportantProductNotes(product: Product, description: string, specs: [string, string][]): string[] {
  const notes: string[] = [];
  const risky = /ملاحظة|تنبيه|مشكل|مشكلة|عيب|كسر|مكسور|خدش|لا\s*تشحن|لا\s*يعمل|لاش|لاشة|لش|ضعيف|متوسط|بدون|faible|moyen(?:ne)?|lache|l[aâ]che|bat(?:t)?er(?:y|ie|i|ire)?|dead|sans|problem|issue|broken|crack|scratch|defaut|défaut|cass[eé]|rayure/i;
  if (product.adminNote?.trim()) notes.push(product.adminNote.trim());

  description
    .split(/\n|\.|؛|;/)
    .map((line) => line.trim())
    .filter((line) => line.length > 4 && risky.test(line))
    .forEach((line) => notes.push(line));

  specs
    .filter(([key, value]) => risky.test(`${key} ${value}`))
    .forEach(([key, value]) => notes.push(`${key}: ${value}`));

  return [...new Set(notes)].slice(0, 4);
}

function getPcScoreStyle(score: number) {
  if (score >= 80) return { label: { ar: "أداء عالٍ", fr: "Haute performance" }, bar: "from-emerald-500 to-emerald-400", badge: "bg-emerald-100 text-emerald-800", tag: "bg-emerald-50 border-emerald-200 text-emerald-700", uses: { ar: ["تحرير الفيديو", "الألعاب الثقيلة", "برامج التصميم", "المهام المتعددة"], fr: ["Montage vidéo", "Jeux lourds", "Design", "Multitâche"] }, equiv: { ar: "مستوى Core i7 / Ryzen 7 حديث", fr: "Équivalent Core i7 / Ryzen 7 récent" } };
  if (score >= 65) return { label: { ar: "أداء جيد", fr: "Bonne performance" }, bar: "from-teal-500 to-teal-400", badge: "bg-teal-100 text-teal-800", tag: "bg-teal-50 border-teal-200 text-teal-700", uses: { ar: ["الألعاب الخفيفة", "التصميم البسيط", "البرمجة", "العمل"], fr: ["Jeux légers", "Design", "Programmation", "Travail"] }, equiv: { ar: "مستوى Core i5 جيل 8 فما فوق", fr: "Équivalent Core i5 Gen 8+" } };
  if (score >= 50) return { label: { ar: "أداء متوسط", fr: "Performance moyenne" }, bar: "from-blue-500 to-blue-400", badge: "bg-blue-100 text-blue-800", tag: "bg-blue-50 border-blue-200 text-blue-700", uses: { ar: ["المكتب", "التصفح", "يوتيوب", "الدراسة"], fr: ["Bureautique", "Navigation", "YouTube", "Études"] }, equiv: { ar: "مستوى Core i5 قديم أو Core i3 حديث", fr: "Équivalent Core i5 ancien / Core i3 récent" } };
  if (score >= 35) return { label: { ar: "استخدام يومي", fr: "Usage quotidien" }, bar: "from-amber-500 to-amber-400", badge: "bg-amber-100 text-amber-800", tag: "bg-amber-50 border-amber-200 text-amber-700", uses: { ar: ["التصفح", "يوتيوب", "البريد الإلكتروني", "الوثائق"], fr: ["Navigation", "YouTube", "Email", "Documents"] }, equiv: { ar: "مستوى Core i3 / Pentium", fr: "Équivalent Core i3 / Pentium" } };
  return { label: { ar: "استخدام أساسي", fr: "Usage basique" }, bar: "from-slate-400 to-slate-300", badge: "bg-slate-100 text-slate-700", tag: "bg-slate-50 border-slate-200 text-slate-600", uses: { ar: ["تصفح الإنترنت", "المهام البسيطة"], fr: ["Navigation web", "Tâches simples"] }, equiv: { ar: "مستوى Celeron / Atom", fr: "Équivalent Celeron / Atom" } };
}

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
  const { language, addToCart, toggleWishlist, isWishlisted, siteSettings } = useApp();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [countdown, setCountdown] = useState(getTimeUntilMidnight());
  const [activeTab, setActiveTab] = useState<"description" | "specs">("description");
  const [descExpanded, setDescExpanded] = useState(false);
  const [showDirectForm, setShowDirectForm] = useState(false);
  const [showRequestPc, setShowRequestPc] = useState(false);
  const [requestPcForm, setRequestPcForm] = useState({ name: "", phone: "", wilaya: "", brand: "", cpu: "", ram: "", screen: "", storage: "", budget: "", notes: "" });
  const [requestPcStatus, setRequestPcStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const autoSlideTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => setCountdown(getTimeUntilMidnight()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Gallery: computed early so hooks can use it before early return
  const galleryForHooks = useMemo(() => {
    if (!product) return [] as string[];
    const v = product.variants.find((variant) => variant._id === selectedVariantId);
    return v && v.images.length ? v.images : product.images;
  }, [product, selectedVariantId]);

  const goTo = useCallback((index: number) => {
    const g = galleryForHooks;
    if (!g.length) return;
    const next = ((index % g.length) + g.length) % g.length;
    setSelectedImage(g[next] ?? g[0] ?? "");
    if (autoSlideTimer.current) clearInterval(autoSlideTimer.current);
    if (g.length > 1) {
      autoSlideTimer.current = setInterval(() => {
        setSelectedImage((prev) => {
          const cur = g.indexOf(prev);
          return g[(cur + 1) % g.length] ?? prev;
        });
      }, 4000);
    }
  }, [galleryForHooks]);

  useEffect(() => {
    if (galleryForHooks.length <= 1) return;
    autoSlideTimer.current = setInterval(() => {
      setSelectedImage((prev) => {
        const cur = galleryForHooks.indexOf(prev);
        return galleryForHooks[(cur + 1) % galleryForHooks.length] ?? prev;
      });
    }, 4000);
    return () => { if (autoSlideTimer.current) clearInterval(autoSlideTimer.current); };
  }, [galleryForHooks]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]!.clientX;
    touchStartY.current = e.touches[0]!.clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0]!.clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0]!.clientY - touchStartY.current);
    if (Math.abs(dx) > 40 && Math.abs(dx) > dy) {
      const g = galleryForHooks;
      const cur = g.indexOf(selectedImage);
      if (dx < 0) goTo(cur + 1); else goTo(cur - 1);
    }
  }, [galleryForHooks, selectedImage, goTo]);

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

        // Track product view for Meta Pixel and internal analytics
        const productName = data.name.en || data.name.ar || data.name.fr;
        const price = firstVariant?.price ?? data.discountPrice ?? data.basePrice;
        pixelViewContent({ productId: data._id, productName, value: price });
        ttqViewContent(data._id, productName, price);
        trackEvent({ eventType: "product_view", productId: data._id });
        addRecentlyViewed({
          id: data._id,
          slug: data.slug,
          nameAr: data.name.ar,
          nameFr: data.name.fr,
          nameEn: data.name.en,
          image: firstVariant?.images[0] || data.images[0] || "",
          price,
        });
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
          all
            .filter((entry) => entry._id !== product._id && categoryKey(entry.category) === currentCategory && !entry.isSoldOut && entry.stock > 0 && entry.status === "ACTIVE")
            .slice(0, 4),
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

  if (errorMessage && !product) {
    return (
      <EmptyState
        title={translate(language, "homeLoadErrorTitle")}
        description={errorMessage}
      />
    );
  }

  if (!product || !selectedVariant) {
    return (
      <EmptyState
        title={translate(language, "productOutOfStock")}
        description={translate(language, "dashboardNoData")}
      />
    );
  }

  const price = selectedVariant.price || product.discountPrice || product.basePrice;
  const gallery = selectedVariant.images.length ? selectedVariant.images : product.images;
  const saving = Math.max(0, product.basePrice - price);
  const adminSoldOut = !!product.isSoldOut;
  const localPickupOnly = !!product.localPickupOnly;
  const stock = selectedVariant.stock;
  const lowStock = !adminSoldOut && stock > 0 && stock <= 5;
  const pad = (value: number) => String(value).padStart(2, "0");

  const selectVariantBy = (change: { ram?: string; storage?: string; color?: string }) => {
    const nextVariant = pickMatchingVariant(product.variants, {
      ram: change.ram ?? selectedVariant.ram,
      storage: change.storage ?? selectedVariant.storage,
      color: change.color ?? selectedVariant.color,
    });

    if (nextVariant) {
      setSelectedVariantId(nextVariant._id);
      setShowDirectForm(false); // reset form visibility when variant changes
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

  const renderOptionGroup = (
    label: string,
    options: string[],
    selected: string | undefined,
    keyName: "ram" | "storage" | "color",
  ) => {
    if (!options.length) return null;
    // Single option — already auto-selected, no need to show a selector
    if (options.length === 1) return null;

    return (
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <label className="text-sm font-bold text-slate-800">{label}</label>
          {selected ? (
            <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-bold text-teal-800">✓ {selected}</span>
          ) : (
            <span className="animate-pulse rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              {language === "ar" ? "← اختر" : language === "fr" ? "← Choisir" : "← Choose"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const active = selected === option;
            const available = isOptionAvailable({ [keyName]: option });
            const variantForOption = product.variants.find((v) =>
              keyName === "ram" ? v.ram === option :
              keyName === "storage" ? v.storage === option :
              v.color === option
            );
            const optionPrice = variantForOption?.price;
            const showPrice = optionPrice && optionPrice !== price;

            return (
              <button
                key={option}
                type="button"
                disabled={!available}
                onClick={() => selectVariantBy({ [keyName]: option })}
                aria-pressed={active}
                className={`relative flex min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-4 py-3 text-sm font-bold transition active:scale-95 ${
                  active
                    ? "border-teal-500 bg-teal-50 text-teal-900 shadow-[0_0_0_3px_rgba(20,184,166,0.15)]"
                    : available
                      ? "border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50/50"
                      : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                }`}
              >
                {active && (
                  <span className="absolute -end-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-teal-500 text-[10px] text-white">✓</span>
                )}
                <span>{option}</span>
                {showPrice ? (
                  <span className={`text-[10px] font-semibold ${active ? "text-teal-700" : "text-slate-400"}`}>
                    {optionPrice.toLocaleString("ar-DZ")} دج
                  </span>
                ) : null}
                {!available ? (
                  <span className="text-[10px] font-normal text-rose-400">
                    {language === "ar" ? "نفد" : language === "fr" ? "Épuisé" : "Out"}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const brandName = typeof product.brand === "string" ? product.brand : product.brand.name;
  const category = typeof product.category === "string" ? null : product.category;
  const hasVariantOptions = ramOptions.length > 0 || storageOptions.length > 0 || colorOptions.length > 0;
  const discountPercent = product.basePrice > 0 ? Math.round((saving / product.basePrice) * 100) : 0;
  const productName = getLocalizedText(product.name, language);
  const productDescription = getLocalizedText(product.description, language);
  const specifications = Object.entries(product.specifications ?? {});
  const importantNotes = extractImportantProductNotes(product, productDescription, specifications);
  const hasImportantNotes = importantNotes.length > 0;

  return (
    <div className="w-full min-w-0 space-y-8 pb-24 lg:pb-0">
      <Seo
        title={productName}
        description={
          productDescription
            ? `${productDescription.slice(0, 155).trim()}…`
            : `${productName} — ${price.toLocaleString("ar-DZ")} دج. ${product.condition === "NEW" ? "جديد" : "مستعمل"}. توصيل لجميع ولايات الجزائر، دفع عند الاستلام.`
        }
        image={gallery[0] || undefined}
        path={`/products/${product.slug}`}
        type="product"
        keywords={[
          productName,
          brandName,
          category ? getLocalizedText(category.name, "ar") : "",
          category ? getLocalizedText(category.name, "fr") : "",
          product.condition === "NEW" ? "جديد" : "مستعمل بحالة ممتازة",
          selectedVariant.ram, selectedVariant.storage, selectedVariant.color,
          "شراء أون لاين الجزائر", "توصيل لجميع الولايات", "دفع عند الاستلام",
          "achat en ligne algérie", "livraison algérie",
        ].filter(Boolean).join(", ")}
        breadcrumbs={[
          { name: "الرئيسية", url: "https://visadz.store/" },
          { name: "المنتجات", url: "https://visadz.store/products" },
          ...(category ? [{ name: getLocalizedText(category.name, language), url: `https://visadz.store/products?category=${category.slug}` }] : []),
          { name: productName, url: `https://visadz.store/products/${product.slug}` },
        ]}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: productName,
          description: productDescription || undefined,
          image: gallery,
          brand: { "@type": "Brand", name: brandName },
          sku: product._id,
          mpn: product._id,
          itemCondition: product.condition === "NEW"
            ? "https://schema.org/NewCondition"
            : "https://schema.org/UsedCondition",
          ...(specifications.length > 0 ? {
            additionalProperty: specifications.map(([name, value]) => ({
              "@type": "PropertyValue",
              name,
              value,
            })),
          } : {}),
          offers: {
            "@type": "Offer",
            price: price.toFixed(2),
            priceCurrency: "DZD",
            availability: !adminSoldOut && selectedVariant.stock > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            url: `https://visadz.store/products/${product.slug}`,
            seller: { "@type": "Organization", name: "VisaStore" },
            shippingDetails: {
              "@type": "OfferShippingDetails",
              shippingRate: { "@type": "MonetaryAmount", currency: "DZD" },
              shippingDestination: { "@type": "DefinedRegion", addressCountry: "DZ" },
            },
            hasMerchantReturnPolicy: {
              "@type": "MerchantReturnPolicy",
              returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
              merchantReturnLink: "https://visadz.store/return-policy",
            },
          },
        }}
      />
      <nav className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-xs text-slate-500 sm:text-sm">
        <Link to="/" className="shrink-0 transition hover:text-slate-900">
          {translate(language, "home")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
        <Link to="/products" className="shrink-0 transition hover:text-slate-900">
          {translate(language, "products")}
        </Link>
        {category ? (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
            <Link to={`/products?category=${category.slug}`} className="shrink-0 transition hover:text-slate-900">
              {getLocalizedText(category.name, language)}
            </Link>
          </>
        ) : null}
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
        <span className="truncate font-medium text-slate-900">{productName}</span>
      </nav>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="min-w-0 space-y-3 lg:sticky lg:top-24">
          {(() => {
            const safeIndex = Math.max(0, Math.min(gallery.indexOf(selectedImage), gallery.length - 1));
            return (
              <>
                <div className="flex w-full min-w-0 gap-3">
                  {/* Desktop: vertical thumbnails */}
                  {gallery.length > 1 ? (
                    <div className="hidden flex-col gap-2 lg:flex">
                      {gallery.map((image, index) => (
                        <button
                          key={image}
                          type="button"
                          onClick={() => goTo(index)}
                          aria-label={`${productName} ${index + 1}`}
                          aria-pressed={selectedImage === image}
                          className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition ${
                            selectedImage === image ? "border-teal-500 shadow-[0_0_0_3px_rgba(20,184,166,0.15)]" : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <img src={image} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {/* Main image — sliding strip */}
                  <div className="surface-card flex-1 overflow-hidden p-3">
                    <div
                      className="relative rounded-[1.6rem] bg-slate-50"
                      style={{ overflow: "hidden", contain: "paint" }}
                      onTouchStart={handleTouchStart}
                      onTouchEnd={handleTouchEnd}
                    >
                      {/* Sliding strip: all images in a row */}
                      <div
                        className="flex"
                        dir="ltr"
                        style={{
                          transform: `translateX(-${safeIndex * 100}%)`,
                          transition: "transform 0.38s cubic-bezier(0.25,0.46,0.45,0.94)",
                          willChange: "transform",
                          width: "100%",
                        }}
                      >
                        {gallery.map((image, index) => (
                          <div key={image} className="aspect-square w-full shrink-0">
                            <img
                              src={image}
                              alt={`${productName} ${index + 1}`}
                              loading={index === 0 ? "eager" : "lazy"}
                              className="h-full w-full object-contain p-4"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Discount badge */}
                      {saving > 0 ? (
                        <div className="absolute start-4 top-4 rounded-full bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow-lg">
                          -{discountPercent}%
                        </div>
                      ) : null}

                      {/* Low stock badge */}
                      {lowStock ? (
                        <div className="absolute end-4 top-4 animate-pulse rounded-full bg-slate-950/85 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">
                          {translate(language, "productOnlyLeft")}
                        </div>
                      ) : null}

                      {/* Image counter */}
                      {gallery.length > 1 ? (
                        <div className="absolute bottom-4 end-4 rounded-full bg-slate-950/60 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                          {safeIndex + 1} / {gallery.length}
                        </div>
                      ) : null}

                      {/* Arrow buttons — always visible */}
                      {gallery.length > 1 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => goTo(safeIndex - 1)}
                            aria-label="الصورة السابقة"
                            className="absolute start-2 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-white/90 shadow-lg transition hover:bg-white active:scale-90"
                          >
                            <ChevronLeft className="h-6 w-6 text-slate-700" />
                          </button>
                          <button
                            type="button"
                            onClick={() => goTo(safeIndex + 1)}
                            aria-label="الصورة التالية"
                            className="absolute end-2 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-white/90 shadow-lg transition hover:bg-white active:scale-90"
                          >
                            <ChevronRight className="h-6 w-6 text-slate-700" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Mobile: dot indicators + thumbnail strip */}
                {gallery.length > 1 ? (
                  <div className="w-full overflow-hidden lg:hidden">
                    {/* Progress dots — wrap so they never overflow */}
                    <div className="flex flex-wrap justify-center gap-1.5 pb-1">
                      {gallery.map((image, index) => (
                        <button
                          key={image}
                          type="button"
                          onClick={() => goTo(index)}
                          aria-label={`صورة ${index + 1}`}
                          className={`h-2 shrink-0 rounded-full transition-all duration-300 ${
                            selectedImage === image ? "w-7 bg-teal-600" : "w-2 bg-slate-300"
                          }`}
                        />
                      ))}
                    </div>
                    {/* Thumbnail strip: outer bounds the viewport, inner scrolls */}
                    <div className="w-full overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                      <div className="flex gap-2" style={{ minWidth: "max-content" }}>
                        {gallery.map((image, index) => (
                          <button
                            key={image}
                            type="button"
                            onClick={() => goTo(index)}
                            aria-label={`${productName} ${index + 1}`}
                            aria-pressed={selectedImage === image}
                            className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition ${
                              selectedImage === image ? "border-teal-500 shadow-[0_0_0_2px_rgba(20,184,166,0.2)]" : "border-slate-200"
                            }`}
                          >
                            <img src={image} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            );
          })()}
        </div>

        <div className="surface-card min-w-0 p-5 sm:p-6 md:p-7">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold uppercase tracking-wide text-slate-600">{brandName}</span>
            <span
              className={`rounded-full px-3 py-1 font-semibold uppercase tracking-wide ${
                product.condition === "USED" ? "bg-amber-50 text-amber-800" : "bg-teal-50 text-teal-700"
              }`}
            >
              {translate(language, product.condition === "USED" ? "productConditionUsed" : "productConditionNew")}
            </span>
            {product.isEuropean && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                🇪🇺 {language === "ar" ? "علامة أوروبية" : language === "fr" ? "Origine UE" : "EU Origin"}
              </span>
            )}
          </div>

          <h1 className="mt-3 text-xl font-semibold leading-tight text-slate-950 sm:text-2xl md:text-3xl">
            {productName}
          </h1>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <span className="text-3xl font-bold text-slate-950 sm:text-4xl">{formatCurrency(price, language)}</span>
            {product.discountPrice ? (
              <span className="text-lg text-slate-400 line-through">{formatCurrency(product.basePrice, language)}</span>
            ) : null}
            {saving > 0 ? (
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600">
                -{discountPercent}% · {translate(language, "productSaveAmount")} {formatCurrency(saving, language)}
              </span>
            ) : null}
          </div>

          {/* Stock progress bar */}
          {!adminSoldOut && stock > 0 && stock <= 20 && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{language === "ar" ? "المخزون المتبقي" : "Stock remaining"}</span>
                <span className={`font-bold ${stock <= 3 ? "text-rose-600" : stock <= 8 ? "text-amber-600" : "text-slate-700"}`}>
                  {stock} {language === "ar" ? "قطعة" : "units"}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full transition-all ${stock <= 3 ? "bg-rose-500" : stock <= 8 ? "bg-amber-400" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, (stock / 20) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs sm:text-sm">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${
                !adminSoldOut && selectedVariant.stock > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${!adminSoldOut && selectedVariant.stock > 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
              {!adminSoldOut && selectedVariant.stock > 0 ? translate(language, "productInStock") : translate(language, "productSoldOut")}
            </span>
            {localPickupOnly ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700">
                🏪 {language === "ar" ? "متوفر في المتجر فقط" : language === "fr" ? "En magasin uniquement" : "In-store only"}
              </span>
            ) : null}
            {/* Real stock urgency — only shows when stock is genuinely low */}
            {stock === 1 ? (
              <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
                🔴 {language === "ar" ? "آخر قطعة!" : language === "fr" ? "Dernière pièce !" : "Last one!"}
              </span>
            ) : stock === 2 ? (
              <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-orange-300 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                🟠 {language === "ar" ? "قطعتان فقط" : language === "fr" ? "2 pièces restantes" : "Only 2 left"}
              </span>
            ) : stock <= 5 && stock > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                ⚡ {language === "ar" ? `${stock} قطع فقط` : language === "fr" ? `Plus que ${stock}` : `Only ${stock} left`}
              </span>
            ) : null}
          </div>

          {saving > 0 ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-gradient-to-r from-rose-50 to-amber-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
              <Clock className="h-3.5 w-3.5" />
              {translate(language, "productOfferEndsIn")} {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
            </div>
          ) : null}

          {importantNotes.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-2xl border-2 border-amber-300 bg-white shadow-[0_14px_34px_rgba(245,158,11,0.18)]">
              <div className="flex items-center gap-3 bg-amber-500 px-4 py-3 text-white">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-base font-black">
                    {language === "ar" ? "ملاحظة مهمة قبل الطلب" : language === "fr" ? "Note importante avant commande" : "Important note before ordering"}
                  </div>
                  <div className="text-xs font-semibold text-white/85">
                    {language === "ar" ? "اقرأ هذه النقطة حتى تعرف حالة الجهاز بوضوح" : language === "fr" ? "À lire pour bien comprendre l’état du produit" : "Read this so the product condition is clear"}
                  </div>
                </div>
              </div>
              <div className="space-y-2 px-4 py-3">
                {importantNotes.map((note) => (
                  <div key={note} className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold leading-7 text-amber-950">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                    <span className="break-words whitespace-pre-line">{note}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {product.videoUrl ? (
            <a
              href={product.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex items-center gap-3 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50 px-4 py-3 transition hover:border-rose-300 hover:from-rose-100"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-600 shadow">
                <Play className="h-4 w-4 fill-white text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-rose-800">
                  {language === "ar" ? "شاهد فيديو المنتج" : language === "fr" ? "Voir la vidéo" : "Watch product video"}
                </div>
                <div className="text-xs text-rose-500 truncate">{product.videoUrl.includes("tiktok") ? "TikTok" : product.videoUrl.includes("facebook") || product.videoUrl.includes("fb.") ? "Facebook" : language === "ar" ? "اضغط للمشاهدة" : "Tap to watch"}</div>
              </div>
              <Play className="h-4 w-4 shrink-0 text-rose-400" />
            </a>
          ) : null}

          {/* Shipping info */}
          {!localPickupOnly && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { icon: "🚚", text: language === "ar" ? "توصيل لجميع الولايات" : "All 58 wilayas" },
                { icon: "💵", text: language === "ar" ? "دفع عند الاستلام" : "Cash on delivery" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <span>{item.icon}</span>
                  <span className="font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Specs — professional tiered layout */}
          {specifications.length > 0 && (() => {
            const specsMap = Object.fromEntries(specifications);

            // Color scheme + Lucide icon per primary spec
            const specStyle: Record<string, { border: string; bg: string; iconBg: string; iconCls: string; label: string; accent: string; Icon: React.ElementType }> = {
              "المعالج":  { border: "border-blue-200",   bg: "bg-blue-50",    iconBg: "bg-blue-100",    iconCls: "text-blue-600",   label: "text-blue-600",   accent: "text-blue-900",    Icon: Cpu },
              "الرام":    { border: "border-emerald-200", bg: "bg-emerald-50", iconBg: "bg-emerald-100", iconCls: "text-emerald-600", label: "text-emerald-600", accent: "text-emerald-900", Icon: Database },
              "التخزين":  { border: "border-orange-200",  bg: "bg-orange-50",  iconBg: "bg-orange-100",  iconCls: "text-orange-600",  label: "text-orange-600",  accent: "text-orange-900",  Icon: HardDrive },
              "الشاشة":   { border: "border-violet-200",  bg: "bg-violet-50",  iconBg: "bg-violet-100",  iconCls: "text-violet-600",  label: "text-violet-600",  accent: "text-violet-900",  Icon: Monitor },
            };

            const primary: Array<{ key: string }> = [
              { key: "المعالج" },
              { key: "الرام" },
              { key: "التخزين" },
              { key: "الشاشة" },
            ].filter((s) => specsMap[s.key]);

            const secondary: Array<{ key: string; icon: string; chipCls: string }> = [
              { key: "الجيل",          icon: "📅", chipCls: "border-slate-200 bg-slate-50 text-slate-700" },
              { key: "كرت الشاشة",    icon: "🎮", chipCls: "border-purple-200 bg-purple-50 text-purple-800" },
              { key: "نظام التشغيل",  icon: "🪟", chipCls: "border-blue-200 bg-blue-50 text-blue-800" },
              { key: "اللون",          icon: "🎨", chipCls: "border-pink-200 bg-pink-50 text-pink-800" },
            ].filter((s) => specsMap[s.key]);

            const batVal  = specsMap["البطارية"] ?? "";
            const condVal = specsMap["الحالة"]  ?? "";
            const isBatDead = /لاش|لاشة|لش|لا تشحن|dead|sans|بدون/i.test(batVal);
            const isBatWarn = !isBatDead && /ضعيف|faible|lache|l[aâ]che|moyen|medium/i.test(batVal);
            const isBatGood = /bonne|good|جيد/i.test(batVal);
            const batDisplay = isBatDead ? "لا تشحن — 0٪" : batVal;

            // Parse condition score e.g. "مستعمل — 8/10" → 8
            const condScoreMatch = condVal.match(/(\d+)\s*\/\s*10/);
            const condScore = condScoreMatch ? parseInt(condScoreMatch[1]) : null;
            const condColor = condScore !== null
              ? condScore >= 8 ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : condScore >= 6 ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
              : "border-amber-200 bg-amber-50 text-amber-800";

            const knownKeys = new Set(["المعالج","الرام","التخزين","الشاشة","الجيل","كرت الشاشة","نظام التشغيل","اللون","البطارية","الحالة"]);
            const extras = specifications.filter(([k]) => !knownKeys.has(k));

            if (primary.length === 0 && secondary.length === 0 && !batVal && !condVal) return null;

            return (
              <div className="mt-4 space-y-3">
                {/* Primary grid — color-coded per spec type */}
                {primary.length > 0 && (
                  <div className={`grid gap-2 ${primary.length >= 4 ? "grid-cols-2" : primary.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                    {primary.map(({ key }) => {
                      const s = specStyle[key] ?? { border: "border-slate-200", bg: "bg-slate-50", iconBg: "bg-slate-100", iconCls: "text-slate-500", label: "text-slate-500", accent: "text-slate-900", Icon: Settings };
                      return (
                        <div key={key} className={`flex flex-col gap-1 rounded-2xl border ${s.border} ${s.bg} p-3`}>
                          <div className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${s.iconBg}`}>
                            <s.Icon className={`h-4 w-4 ${s.iconCls}`} />
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${s.label}`}>{key}</span>
                          <span className={`text-[13px] font-bold leading-tight ${s.accent}`}>{specsMap[key]}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Secondary chips */}
                {(secondary.length > 0 || extras.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {secondary.map(({ key, icon, chipCls }) => (
                      <span key={key} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${chipCls}`}>
                        <span>{icon}</span>
                        <span className="opacity-60">{key}:</span>
                        <span className="font-bold">{specsMap[key]}</span>
                      </span>
                    ))}
                    {extras.map(([k, v]) => (
                      <span key={k} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                        <span className="opacity-50">{k}:</span>
                        <span className="font-bold">{v}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Status row — battery + condition */}
                {(batVal || condVal) && (
                  <div className="flex flex-wrap gap-2">
                    {batVal && (
                      <div className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${
                        isBatDead ? "border-rose-300 bg-rose-100 text-rose-800"
                        : isBatWarn ? "border-amber-200 bg-amber-50 text-amber-800"
                        : isBatGood ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}>
                        <span>{isBatDead ? "🪫" : isBatGood ? "🔋" : "🔋"}</span>
                        <span className="opacity-70">{language === "ar" ? "البطارية:" : "Batterie:"}</span>
                        <span>{batDisplay}</span>
                      </div>
                    )}
                    {condVal && (
                      <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold ${condColor}`}>
                        <span>⭐</span>
                        <span className="opacity-70">{language === "ar" ? "الحالة:" : "État:"}</span>
                        <span>{condVal}</span>
                        {condScore !== null && (
                          <span className="ms-0.5 flex gap-px">
                            {[1,2,3,4,5].map((s) => (
                              <span key={s} className={`text-[10px] ${s <= Math.round(condScore / 2) ? "opacity-100" : "opacity-25"}`}>★</span>
                            ))}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* PC Performance — visual checklist for simple users */}
          {specifications.length > 0 && (() => {
            const score = computePcScore(specifications);
            if (score === 0) return null;
            const style = getPcScoreStyle(score);
            const label = language === "fr" ? style.label.fr : style.label.ar;
            const stars = score >= 80 ? 5 : score >= 65 ? 4 : score >= 50 ? 3 : score >= 35 ? 2 : 1;
            const levelEmoji = score >= 80 ? "🚀" : score >= 65 ? "💪" : score >= 50 ? "👍" : score >= 35 ? "✋" : "📖";
            const headerGrad = score >= 80 ? "from-emerald-500 to-emerald-600" : score >= 65 ? "from-teal-500 to-teal-600" : score >= 50 ? "from-blue-500 to-blue-600" : score >= 35 ? "from-amber-500 to-amber-600" : "from-slate-400 to-slate-500";
            const borderColor = score >= 80 ? "border-emerald-200" : score >= 65 ? "border-teal-200" : score >= 50 ? "border-blue-200" : score >= 35 ? "border-amber-200" : "border-slate-200";

            const tasks = [
              { ar: "واتساب وفيسبوك وإنستغرام", fr: "WhatsApp, Facebook, Instagram", icon: "📱", pass: true },
              { ar: "يوتيوب وأفلام بجودة عالية", fr: "YouTube & films HD", icon: "▶️", pass: true },
              { ar: "الدراسة (Word, Excel, PowerPoint)", fr: "Études & bureautique", icon: "📚", pass: true },
              { ar: "زوم وميتينغات أونلاين", fr: "Zoom & réunions en ligne", icon: "🎥", pass: true },
              { ar: "ألعاب كازوال وبسيطة", fr: "Jeux casual & simples", icon: "🃏", pass: score >= 10 },
              { ar: "الألعاب الخفيفة (FIFA, Minecraft)", fr: "Jeux légers (FIFA, Minecraft)", icon: "🎮", pass: score >= 25 },
              { ar: "الفوتوشوب والتصميم", fr: "Photoshop & design", icon: "🎨", pass: score >= 45 },
              { ar: "الألعاب الثقيلة (GTA V, Warzone)", fr: "Jeux lourds (GTA V, Warzone)", icon: "🕹️", pass: score >= 65 },
              { ar: "تحرير الفيديو (Premiere, DaVinci)", fr: "Montage vidéo professionnel", icon: "🎬", pass: score >= 80 },
            ];

            const passCount = tasks.filter((t) => t.pass).length;

            return (
              <div className={`mt-4 overflow-hidden rounded-2xl border ${borderColor}`}>
                {/* Colored header */}
                <div className={`flex items-center gap-3 bg-gradient-to-r ${headerGrad} px-4 py-3`}>
                  <span className="text-3xl leading-none">{levelEmoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                      {language === "ar" ? "قوة هذا اللاب توب" : "Niveau de performance"}
                    </div>
                    <div className="text-base font-extrabold leading-tight text-white">{label}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-2xl font-extrabold leading-none text-white">{score}<span className="text-sm font-medium opacity-70">/100</span></div>
                    <div className="mt-1 flex justify-end gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} className={`text-sm leading-none ${s <= stars ? "text-yellow-300" : "text-white/25"}`}>★</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="bg-white px-4 pt-3 pb-1">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full bg-gradient-to-r ${style.bar}`} style={{ width: `${score}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                    <span>{language === "ar" ? "أساسي" : "Basique"}</span>
                    <span>{language === "ar" ? "محترف" : "Pro"}</span>
                  </div>
                </div>

                {/* Task checklist */}
                <div className="bg-white px-4 pt-2 pb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      {language === "ar" ? "واش يقدر يدير؟" : "Ce PC peut faire :"}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700">
                      {Math.min(passCount, 3)} {language === "ar" ? "استعمالات مناسبة" : "usages adaptés"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tasks.filter((t) => t.pass).slice(0, 3).map((task) => (
                      <span key={task.ar} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-900">
                        <span className="text-base leading-none">{task.icon}</span>
                        <span>{language === "fr" ? task.fr : task.ar}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="my-5 h-px bg-slate-100" />

          {(ramOptions.length > 1 || storageOptions.length > 1 || colorOptions.length > 1) ? (
            <div className="space-y-5">
              {renderOptionGroup(translate(language, "productChooseRam"), ramOptions, selectedVariant.ram, "ram")}
              {renderOptionGroup(translate(language, "productChooseStorage"), storageOptions, selectedVariant.storage, "storage")}
              {renderOptionGroup(translate(language, "productChooseColor"), colorOptions, selectedVariant.color, "color")}
            </div>
          ) : null}

          {/* Show selected-option summary only when there's a real multi-option choice */}
          {(ramOptions.length > 1 || storageOptions.length > 1 || colorOptions.length > 1) ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 px-4 py-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-500 text-white text-sm font-bold">✓</div>
              <div>
                <div className="text-xs font-semibold text-teal-700 uppercase tracking-wide">
                  {language === "ar" ? "الخيار المحدد" : language === "fr" ? "Option choisie" : "Selected option"}
                </div>
                <div className="mt-0.5 font-bold text-slate-900">{buildVariantLabel(selectedVariant)}</div>
              </div>
              <div className="ms-auto text-lg font-extrabold text-teal-700">{price.toLocaleString("ar-DZ")} <span className="text-sm font-semibold">دج</span></div>
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-4">
            <label className="text-sm font-semibold text-slate-700">{translate(language, "productQuantity")}</label>
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                aria-label={translate(language, "productQuantityDecrease")}
                className="grid h-9 w-9 place-items-center rounded-full bg-slate-950 text-white transition hover:bg-slate-800"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="w-10 text-center text-lg font-semibold text-slate-950">{quantity}</div>
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.min(selectedVariant.stock, current + 1))}
                aria-label={translate(language, "productQuantityIncrease")}
                className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-500"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {hasImportantNotes ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-black text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {language === "ar" ? "ملاحظة على حالة الجهاز" : language === "fr" ? "Note sur l'état du produit" : "Product condition note"}
              </div>
              <div className="space-y-1.5">
                {importantNotes.slice(0, 2).map((note) => (
                  <div key={note} className="rounded-xl bg-white/85 px-3 py-2 text-sm font-bold leading-7 text-amber-950">
                    {note}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {localPickupOnly ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center">
              <div className="text-2xl">🏪</div>
              <div className="mt-1 text-sm font-semibold text-amber-800">
                {language === "ar" ? "هذا المنتج متوفر في المتجر فقط" : language === "fr" ? "Disponible en magasin uniquement" : "Available in-store only"}
              </div>
              <div className="mt-1 text-xs text-amber-700">
                {language === "ar" ? "تواصل معنا لمعرفة طريقة الحصول عليه" : "Contact us for more details"}
              </div>
            </div>
          ) : siteSettings?.directOrderMode ? (
            /* DIRECT ORDER MODE — show button first, reveal form on click */
            !adminSoldOut && selectedVariant.stock > 0 ? (
              <div id="direct-order-form">
                {!showDirectForm ? (
                  /* Big CTA button — reveals form on click */
                  <button
                    type="button"
                    onClick={() => {
                      setShowDirectForm(true);
                      setTimeout(() => {
                        document.getElementById("direct-order-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 100);
                    }}
                    className="relative mt-5 flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-5 text-base font-bold text-white shadow-[0_10px_30px_rgba(20,184,166,0.4)] transition hover:from-teal-500 hover:to-emerald-500 active:scale-[0.98] before:absolute before:inset-0 before:rounded-2xl before:shadow-[0_0_0_4px_rgba(20,184,166,0.3)] before:animate-ping before:pointer-events-none"
                  >
                    <span className="flex items-center gap-2.5">
                      <ShieldCheck className="h-6 w-6" />
                      <span>
                        {language === "ar" ? "أطلب الآن — دفع عند الاستلام" : language === "fr" ? "Commander maintenant" : "Order now — Pay on delivery"}
                      </span>
                    </span>
                    <span className="rounded-xl bg-white/20 px-3 py-1.5 text-sm font-extrabold">
                      {formatCurrency(price, language)}
                    </span>
                  </button>
                ) : (
                  <DirectOrderForm
                    product={product}
                    variant={selectedVariant}
                    quantity={quantity}
                    shippingFee={0}
                    importantNotes={importantNotes}
                  />
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-slate-100 px-5 py-4 text-center text-sm font-semibold text-slate-400">
                {translate(language, "productSoldOut")}
              </div>
            )
          ) : (
          <button
            disabled={adminSoldOut || selectedVariant.stock <= 0}
            onClick={() => {
              addToCart({ product, variant: selectedVariant, quantity });
              navigate("/checkout");
            }}
            className="mt-5 inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-7 py-4 text-base font-semibold text-white shadow-[0_16px_40px_rgba(16,185,129,0.3)] transition hover:from-emerald-500 hover:to-teal-500 hover:shadow-[0_20px_50px_rgba(16,185,129,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Zap className="h-5 w-5 fill-current" />
            {adminSoldOut ? translate(language, "productSoldOut") : translate(language, "productBuyNow")}
          </button>
          )}

          {/* Add to cart — hidden in direct order mode */}
          {!siteSettings?.directOrderMode ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <button
              disabled={adminSoldOut || localPickupOnly || selectedVariant.stock <= 0}
              onClick={() => {
                addToCart({ product, variant: selectedVariant, quantity });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-4 text-base font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingCart className="h-5 w-5" />
              {translate(language, "productAddToCart")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isWishlisted(product._id)) {
                  const name = product.name.en || product.name.ar || product.name.fr;
                  ttqAddToWishlist(product._id, name, selectedVariant?.price ?? product.discountPrice ?? product.basePrice ?? 0);
                }
                toggleWishlist(product._id);
              }}
              aria-label={translate(language, isWishlisted(product._id) ? "wishlistRemove" : "wishlistAdd")}
              aria-pressed={isWishlisted(product._id)}
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
          ) : null /* end !directOrderMode */}

          {/* Affiliate earnings hint — computed from commissionTiers for consistent display */}
          {product.affiliateEnabled ? (() => {
            type Tier = { maxPrice: number | null; amount: number };
            const tiers = siteSettings?.commissionTiers as Tier[] | undefined;
            let displayCommission: string | null = null;
            if (product.commissionType === "PERCENTAGE" && product.commissionValue > 0) {
              displayCommission = product.commissionValue + "%";
            } else if (tiers && tiers.length > 0) {
              const tier = tiers.find((t) => t.maxPrice === null || t.maxPrice >= price) ?? tiers[tiers.length - 1]!;
              displayCommission = formatCurrency(tier.amount, language);
            } else if (product.commissionValue > 0) {
              displayCommission = formatCurrency(product.commissionValue, language);
            }
            if (!displayCommission) return null;
            return (
              <div className="mt-4 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
                <div className="flex items-start gap-3 p-4">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-400 text-slate-900">
                    <BadgePercent className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-amber-900 text-sm">
                      {language === "ar" ? "اربح من مشاركة هذا المنتج 💰" : language === "fr" ? "Gagnez en partageant ce produit 💰" : "Earn by sharing this product 💰"}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-amber-700">
                      {language === "ar"
                        ? `شارك رابطك الخاص لهذا المنتج — تكسب ${displayCommission} على كل طلب يكتمل عبر رابطك.`
                        : `Share your affiliate link for this product — earn ${displayCommission} on every completed order.`}
                    </p>
                    <Link to="/earn-money" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-900 underline underline-offset-2">
                      {language === "ar" ? "انضم مجاناً وابدأ الكسب" : "Join free and start earning"}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })() : null}

          {(siteSettings?.whatsapp || siteSettings?.phone || siteSettings?.socialLinks?.facebook || siteSettings?.socialLinks?.tiktok) ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <div className="border-b border-slate-200 px-4 py-2.5">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {language === "ar" ? "تواصل معنا" : language === "fr" ? "Nous contacter" : "Contact us"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-200">
                {siteSettings?.whatsapp ? (
                  <a
                    href={`https://wa.me/${(() => { const d = siteSettings.whatsapp.replace(/[^0-9]/g, ""); return d.startsWith("213") ? d : d.startsWith("0") ? `213${d.slice(1)}` : d; })()}?text=${encodeURIComponent(language === "ar" ? `مرحبا، أريد الاستفسار عن: ${productName}` : `Hello, I want to ask about: ${productName}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center gap-1.5 bg-white px-3 py-3.5 text-center transition hover:bg-emerald-50"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-[#25D366]">
                      <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </div>
                    <span className="text-xs font-semibold text-slate-700">WhatsApp</span>
                  </a>
                ) : null}
                {siteSettings?.phone ? (
                  <a
                    href={`tel:${siteSettings.phone}`}
                    className="flex flex-col items-center gap-1.5 bg-white px-3 py-3.5 text-center transition hover:bg-blue-50"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-600">
                      <Phone className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{language === "ar" ? "اتصل بنا" : language === "fr" ? "Appel" : "Call us"}</span>
                  </a>
                ) : null}
                {siteSettings?.socialLinks?.facebook ? (
                  <a
                    href={siteSettings.socialLinks.facebook}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center gap-1.5 bg-white px-3 py-3.5 text-center transition hover:bg-blue-50"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-[#1877F2]">
                      <Facebook className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700">Facebook</span>
                  </a>
                ) : null}
                {siteSettings?.socialLinks?.tiktok ? (
                  <a
                    href={siteSettings.socialLinks.tiktok}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center gap-1.5 bg-white px-3 py-3.5 text-center transition hover:bg-slate-100"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-black">
                      <TikTokIcon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700">TikTok</span>
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

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

      <section className="surface-card overflow-hidden p-0">
        <div className="flex border-b border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab("description")}
            aria-pressed={activeTab === "description"}
            className={`flex-1 px-4 py-4 text-sm font-semibold transition sm:flex-none sm:px-8 ${
              activeTab === "description" ? "border-b-2 border-slate-950 text-slate-950" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {translate(language, "productDescriptionTitle")}
          </button>
          {specifications.length > 0 ? (
            <button
              type="button"
              onClick={() => setActiveTab("specs")}
              aria-pressed={activeTab === "specs"}
              className={`flex-1 px-4 py-4 text-sm font-semibold transition sm:flex-none sm:px-8 ${
                activeTab === "specs" ? "border-b-2 border-slate-950 text-slate-950" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {translate(language, "productSpecifications")}
            </button>
          ) : null}
        </div>

        {activeTab === "description" ? (
          <div className="p-6 md:p-7">
            {productDescription ? (() => {
              // Parse "مناسب لـ:" line from description to show as visual chips
              const useLine = productDescription.match(/مناسب\s*لـ?\s*[:：]?\s*([^\n]+)/i)?.[1];
              const useTags = useLine ? useLine.split(/[,،\/\|]/).map((t) => t.trim()).filter(Boolean) : [];
              const cleanDesc = productDescription.replace(/مناسب\s*لـ?\s*[:：]?\s*[^\n]+\n?/i, "").trim();
              const isLong = cleanDesc.length > 300;
              const visibleDesc = isLong && !descExpanded ? cleanDesc.slice(0, 300) + "…" : cleanDesc;

              const tagIcons: Record<string, string> = {
                "الدراسة": "📚", "الألعاب": "🎮", "العمل": "💼", "المكتب": "💼",
                "البرمجة": "💻", "التصفح": "🌐", "يوتيوب": "▶️", "الفيديو": "🎬",
                "التصميم": "🎨", "المهام": "⚡", "البريد": "📧",
              };
              const getTagIcon = (t: string) => Object.entries(tagIcons).find(([k]) => t.includes(k))?.[1] ?? "✓";

              return (
                <div className="space-y-4">
                  {useTags.length > 0 && (
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        {language === "ar" ? "مناسب لـ" : "Idéal pour"}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {useTags.map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                            <span>{getTagIcon(t)}</span>{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="whitespace-pre-line break-words text-sm leading-8 text-slate-600">{visibleDesc}</p>
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => setDescExpanded((v) => !v)}
                        className="mt-2 text-xs font-semibold text-teal-600 hover:text-teal-500"
                      >
                        {descExpanded
                          ? (language === "ar" ? "▲ عرض أقل" : "▲ Voir moins")
                          : (language === "ar" ? "▼ اقرأ المزيد" : "▼ Lire plus")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })() : (
              <p className="text-sm text-slate-400 italic">{language === "ar" ? "لا يوجد وصف" : "Aucune description"}</p>
            )}
          </div>
        ) : (
          <div className="p-6 md:p-7 space-y-5">
            {/* PC Performance Score — specs tab version */}
            {(() => {
              const score = computePcScore(specifications);
              if (score < 5) return null;
              const st = getPcScoreStyle(score);
              const label = language === "fr" ? st.label.fr : st.label.ar;
              const stars = score >= 80 ? 5 : score >= 65 ? 4 : score >= 50 ? 3 : score >= 35 ? 2 : 1;
              const levelEmoji = score >= 80 ? "🚀" : score >= 65 ? "💪" : score >= 50 ? "👍" : score >= 35 ? "✋" : "📖";
              const headerGrad = score >= 80 ? "from-emerald-500 to-emerald-600" : score >= 65 ? "from-teal-500 to-teal-600" : score >= 50 ? "from-blue-500 to-blue-600" : score >= 35 ? "from-amber-500 to-amber-600" : "from-slate-400 to-slate-500";
              const borderColor = score >= 80 ? "border-emerald-200" : score >= 65 ? "border-teal-200" : score >= 50 ? "border-blue-200" : score >= 35 ? "border-amber-200" : "border-slate-200";
              const tasks = [
                { ar: "واتساب وفيسبوك وتصفح الإنترنت", fr: "WhatsApp, Facebook, navigation", icon: "📱", pass: true },
                { ar: "يوتيوب وأفلام HD", fr: "YouTube & films HD", icon: "▶️", pass: true },
                { ar: "الدراسة والوثائق (Word, Excel)", fr: "Études & bureautique", icon: "📚", pass: true },
                { ar: "الألعاب الخفيفة (FIFA, Minecraft)", fr: "Jeux légers (FIFA, Minecraft)", icon: "🎮", pass: score >= 35 },
                { ar: "الفوتوشوب والتصميم", fr: "Photoshop & design", icon: "🎨", pass: score >= 50 },
                { ar: "الألعاب الثقيلة (GTA V, Warzone)", fr: "Jeux lourds (GTA V, Warzone)", icon: "🕹️", pass: score >= 65 },
                { ar: "تحرير الفيديو (Premiere, DaVinci)", fr: "Montage vidéo professionnel", icon: "🎬", pass: score >= 80 },
              ];
              return (
                <div className={`overflow-hidden rounded-2xl border ${borderColor}`}>
                  <div className={`flex items-center gap-3 bg-gradient-to-r ${headerGrad} px-4 py-3`}>
                    <span className="text-3xl leading-none">{levelEmoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                        {language === "ar" ? "قوة هذا اللاب توب" : "Niveau de performance"}
                      </div>
                      <div className="text-base font-extrabold leading-tight text-white">{label}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-2xl font-extrabold leading-none text-white">{score}<span className="text-sm font-medium opacity-70">/100</span></div>
                      <div className="mt-1 flex justify-end gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span key={s} className={`text-sm leading-none ${s <= stars ? "text-yellow-300" : "text-white/25"}`}>★</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white px-4 pt-3 pb-1">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full bg-gradient-to-r ${st.bar}`} style={{ width: `${score}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                      <span>{language === "ar" ? "أساسي" : "Basique"}</span>
                      <span>{language === "ar" ? "محترف" : "Pro"}</span>
                    </div>
                  </div>
                  <div className="bg-white px-4 pt-2 pb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        {language === "ar" ? "واش يقدر يدير؟" : "Ce PC peut faire :"}
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700">
                        {Math.min(tasks.filter((t) => t.pass).length, 3)} {language === "ar" ? "استعمالات مناسبة" : "usages adaptés"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tasks.filter((t) => t.pass).slice(0, 3).map((task) => (
                        <span key={task.ar} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-900">
                          <span className="text-base leading-none">{task.icon}</span>
                          <span>{language === "fr" ? task.fr : task.ar}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Specifications grid */}
            <div className="grid gap-2.5 sm:grid-cols-2">
              {specifications.map(([key, value]) => {
                const k = key.toLowerCase();
                const isBatKey = k.includes("بطار");
                const isBatteryDead = isBatKey && /لاش|لاشة|لش|لا تشحن|dead|sans|بدون/i.test(value);
                const isBatteryWarn = isBatKey && !isBatteryDead && /ضعيف|faible|lache|l[aâ]che|moyen|medium/i.test(value);
                const isBatteryGood = isBatKey && /bonne|good|جيد/i.test(value);
                const displayValue = isBatteryDead ? "لا تشحن (0٪)" : value;
                const Icon = k.includes("معالج") || k.includes("cpu") ? Cpu
                  : k.includes("رام") || k.includes("ram") || k.includes("mémoire") ? Database
                  : k.includes("تخزين") || k.includes("ssd") || k.includes("hdd") || k.includes("stockage") ? HardDrive
                  : k.includes("شاشة") || k.includes("écran") || k.includes("screen") ? Monitor
                  : k.includes("بطار") || k.includes("batter") ? Battery
                  : k.includes("كرت") || k.includes("gpu") || k.includes("graphique") ? Zap
                  : k.includes("نظام") || k.includes("os") || k.includes("système") ? Settings
                  : null;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
                      isBatteryDead
                        ? "border-rose-300 bg-rose-100"
                        : isBatteryWarn
                          ? "border-rose-200 bg-rose-50"
                          : isBatteryGood
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-slate-100 bg-slate-50/80"
                    }`}
                  >
                    {Icon && (
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        isBatteryDead ? "bg-rose-200 text-rose-700"
                        : isBatteryWarn ? "bg-rose-100 text-rose-600"
                        : isBatteryGood ? "bg-emerald-100 text-emerald-600"
                        : "bg-slate-200 text-slate-600"
                      }`}>
                        <Icon className="h-4 w-4" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{key}</div>
                      <div className={`mt-0.5 font-bold leading-snug ${
                        isBatteryDead ? "text-rose-800"
                        : isBatteryWarn ? "text-rose-700"
                        : isBatteryGood ? "text-emerald-700"
                        : "text-slate-900"
                      }`}>{displayValue}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-sm leading-7 text-slate-500">{translate(language, "productSupportNote")}</p>

            {/* Request PC — inline form */}
            <div className="rounded-2xl border border-dashed border-teal-300 bg-teal-50/40 overflow-hidden">
              <button
                type="button"
                onClick={() => { setShowRequestPc((v) => !v); setRequestPcStatus("idle"); }}
                className="flex w-full items-center gap-3 px-4 py-3.5 transition hover:bg-teal-50/60"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-600 text-white text-lg">🔍</div>
                <div className="min-w-0 flex-1 text-start">
                  <div className="text-sm font-bold text-slate-800">
                    {language === "ar" ? "لم تجد اللابتوب المناسب؟" : language === "fr" ? "Pas trouvé ce que vous cherchez?" : "Didn't find the right laptop?"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {language === "ar" ? "اطلب بمواصفاتك وسنبحث لك" : language === "fr" ? "Demandez par specs, on cherche pour vous" : "Request by specs and we'll find it"}
                  </div>
                </div>
                <ArrowRight className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${showRequestPc ? "rotate-90" : ""}`} />
              </button>

              {showRequestPc ? (
                requestPcStatus === "sent" ? (
                  <div className="border-t border-teal-200 bg-emerald-50 px-5 py-5 text-center">
                    <div className="text-2xl">✅</div>
                    <div className="mt-2 font-bold text-emerald-800">
                      {language === "ar" ? "تم إرسال طلبك بنجاح!" : "Demande envoyée avec succès!"}
                    </div>
                    <div className="mt-1 text-xs text-emerald-600">
                      {language === "ar" ? "سيتواصل معك فريقنا في أقرب وقت ممكن" : "Notre équipe vous contactera dès que possible"}
                    </div>
                  </div>
                ) : (() => {
                    const sel = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:bg-white";
                    const inp = sel;
                    const wilayas = ["01 - أدرار","02 - الشلف","03 - الأغواط","04 - أم البواقي","05 - باتنة","06 - بجاية","07 - بسكرة","08 - بشار","09 - البليدة","10 - البويرة","11 - تمنراست","12 - تبسة","13 - تلمسان","14 - تيارت","15 - تيزي وزو","16 - الجزائر","17 - الجلفة","18 - جيجل","19 - سطيف","20 - سعيدة","21 - سكيكدة","22 - سيدي بلعباس","23 - عنابة","24 - قالمة","25 - قسنطينة","26 - المدية","27 - مستغانم","28 - المسيلة","29 - معسكر","30 - ورقلة","31 - وهران","32 - البيض","33 - إليزي","34 - برج بوعريريج","35 - بومرداس","36 - الطارف","37 - تندوف","38 - تيسمسيلت","39 - الوادي","40 - خنشلة","41 - سوق أهراس","42 - تيبازة","43 - ميلة","44 - عين الدفلى","45 - النعامة","46 - عين تموشنت","47 - غرداية","48 - غليزان","49 - تيميمون","50 - برج باجي مختار","51 - أولاد جلال","52 - بني عباس","53 - عين صالح","54 - عين قزام","55 - تقرت","56 - جانت","57 - المغير","58 - المنيعة"];
                    const uniqueWilayas = wilayas;
                    const canSubmit = (requestPcForm.brand || requestPcForm.cpu || requestPcForm.ram || requestPcForm.notes.trim()) && requestPcStatus !== "sending";
                    return (
                      <div className="border-t border-teal-200 bg-white px-4 py-4 space-y-3">
                        {/* Contact */}
                        <div className="grid gap-2 grid-cols-2">
                          <input type="text" placeholder={language === "ar" ? "الاسم (اختياري)" : "Nom"} value={requestPcForm.name} onChange={(e) => setRequestPcForm((f) => ({ ...f, name: e.target.value }))} className={inp} />
                          <input type="tel" placeholder={language === "ar" ? "الهاتف (اختياري)" : "Téléphone"} value={requestPcForm.phone} onChange={(e) => setRequestPcForm((f) => ({ ...f, phone: e.target.value }))} className={inp} />
                        </div>
                        {/* Wilaya */}
                        <select value={requestPcForm.wilaya} onChange={(e) => setRequestPcForm((f) => ({ ...f, wilaya: e.target.value }))} className={sel}>
                          <option value="">{language === "ar" ? "اختر الولاية" : "Choisir la wilaya"}</option>
                          {uniqueWilayas.map((w) => <option key={w} value={w}>{w}</option>)}
                        </select>
                        {/* Specs row 1 */}
                        <div className="grid gap-2 grid-cols-2">
                          <select value={requestPcForm.brand} onChange={(e) => setRequestPcForm((f) => ({ ...f, brand: e.target.value }))} className={sel}>
                            <option value="">{language === "ar" ? "العلامة التجارية" : "Marque"}</option>
                            {["HP","Dell","Lenovo","Asus","Acer","Toshiba","Sony","Samsung","MSI","Apple","Huawei"].map((b) => <option key={b} value={b}>{b}</option>)}
                            <option value="أخرى">{language === "ar" ? "أخرى" : "Autre"}</option>
                          </select>
                          <select value={requestPcForm.cpu} onChange={(e) => setRequestPcForm((f) => ({ ...f, cpu: e.target.value }))} className={sel}>
                            <option value="">{language === "ar" ? "نوع المعالج" : "Processeur"}</option>
                            {["Intel Core i3","Intel Core i5","Intel Core i7","Intel Core i9","Intel Pentium","Intel Celeron","AMD Ryzen 3","AMD Ryzen 5","AMD Ryzen 7","AMD A-Series"].map((c) => <option key={c} value={c}>{c}</option>)}
                            <option value="أخرى">{language === "ar" ? "أخرى" : "Autre"}</option>
                          </select>
                        </div>
                        {/* Specs row 2 */}
                        <div className="grid gap-2 grid-cols-2">
                          <select value={requestPcForm.ram} onChange={(e) => setRequestPcForm((f) => ({ ...f, ram: e.target.value }))} className={sel}>
                            <option value="">{language === "ar" ? "الرام" : "RAM"}</option>
                            {["4 GB","6 GB","8 GB","12 GB","16 GB","32 GB"].map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <select value={requestPcForm.screen} onChange={(e) => setRequestPcForm((f) => ({ ...f, screen: e.target.value }))} className={sel}>
                            <option value="">{language === "ar" ? "حجم الشاشة" : "Taille écran"}</option>
                            {['11"','12"','13"','14"','15.6"','17.3"'].map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        {/* Specs row 3 */}
                        <div className="grid gap-2 grid-cols-2">
                          <select value={requestPcForm.storage} onChange={(e) => setRequestPcForm((f) => ({ ...f, storage: e.target.value }))} className={sel}>
                            <option value="">{language === "ar" ? "نوع التخزين" : "Stockage"}</option>
                            {["SSD 128 GB","SSD 256 GB","SSD 512 GB","SSD 1 TB","HDD 250 GB","HDD 500 GB","HDD 1 TB"].map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <input type="text" placeholder={language === "ar" ? "الميزانية بالدج" : "Budget DZD"} value={requestPcForm.budget} onChange={(e) => setRequestPcForm((f) => ({ ...f, budget: e.target.value }))} className={inp} />
                        </div>
                        {/* Notes */}
                        <textarea rows={2} placeholder={language === "ar" ? "ملاحظات إضافية (الجيل، الاستخدام، الحالة...)" : "Remarques (génération, usage, état...)"} value={requestPcForm.notes} onChange={(e) => setRequestPcForm((f) => ({ ...f, notes: e.target.value }))} className={"w-full resize-none " + inp} />
                        {requestPcStatus === "error" && <p className="text-xs text-rose-600">{language === "ar" ? "حدث خطأ، حاول مرة أخرى" : "Erreur, réessayez"}</p>}
                        <button
                          type="button"
                          disabled={!canSubmit}
                          onClick={async () => {
                            setRequestPcStatus("sending");
                            try {
                              await productService.requestPc(requestPcForm);
                              setRequestPcStatus("sent");
                            } catch { setRequestPcStatus("error"); }
                          }}
                          className="w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {requestPcStatus === "sending" ? (language === "ar" ? "جارٍ الإرسال..." : "Envoi...") : (language === "ar" ? "إرسال الطلب" : language === "fr" ? "Envoyer" : "Send")}
                        </button>
                      </div>
                    );
                  })()
              ) : null}
            </div>
          </div>
        )}
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

      {/* Mobile sticky buy bar */}
      {!adminSoldOut && !localPickupOnly && selectedVariant.stock > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/80 bg-white/96 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-950">{productName}</div>
              <div className="text-base font-bold text-teal-600">{formatCurrency(price, language)}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (siteSettings?.directOrderMode) {
                  if (!showDirectForm) {
                    setShowDirectForm(true);
                    setTimeout(() => {
                      document.getElementById("direct-order-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 100);
                  } else {
                    const submitBtn = document.getElementById("dof-submit-btn") as HTMLButtonElement | null;
                    if (submitBtn && !submitBtn.disabled) {
                      submitBtn.click();
                    } else {
                      document.getElementById("direct-order-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }
                } else {
                  addToCart({ product, variant: selectedVariant, quantity });
                  navigate("/checkout");
                }
              }}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(16,185,129,0.35)] transition active:scale-95"
            >
              <Zap className="h-4 w-4 fill-current" />
              {siteSettings?.directOrderMode
                ? (language === "ar" ? "أتمم الطلب" : language === "fr" ? "Commander" : "Order now")
                : translate(language, "productBuyNow")}
            </button>
          </div>
        </div>
      ) : null}

    </div>
  );
}
