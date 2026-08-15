import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

const BATCH_SIZE = 24;
import { CheckCircle2, MessageCircle, Search, Send, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ProductCard } from "@/components/ProductCard";
import { ProductFilters, type LaptopOptionCounts, type ProductFilterState, DEFAULT_FILTERS } from "@/components/ProductFilters";
import { Seo } from "@/components/Seo";
import { useApp } from "@/hooks/useApp";
import { adminService } from "@/services/admin.service";
import { productService } from "@/services/product.service";
import type { Category, Locale, Product } from "@/types";
import { getLocalizedText } from "@/utils/format";
import { translate } from "@/utils/i18n";
import { ttqSearch } from "@/utils/tiktok";

const CPU_PATTERNS: Record<string, RegExp> = {
  intel: /intel|\bcore\b|\bi[3579]\b|pentium|celeron/i,
  amd: /\bamd\b|ryzen|athlon|\ba\d\b|\ba\d-|e1|e2/i,
  i3: /\bi3\b/i,
  i5: /\bi5\b/i,
  i7: /\bi7\b/i,
  i9: /\bi9\b/i,
  pentium: /pentium/i,
  celeron: /celeron/i,
  ryzen: /ryzen/i,
  ryzen3: /ryzen\s*3/i,
  ryzen5: /ryzen\s*5/i,
  ryzen7: /ryzen\s*7/i,
  ryzen9: /ryzen\s*9/i,
};

const SCREEN_PATTERNS: Record<string, RegExp> = {
  "13": /1[23]\.?[0-9]?["'''"pouces\s]|1[23]\s*inch/i,
  "14": /14\.?[0-9]?["'''"pouces\s]|14\s*inch|14\s*بوصة/i,
  "15": /15\.?[0-9]?["'''"pouces\s]|15\s*inch|15\s*بوصة/i,
  "17": /17\.?[0-9]?["'''"pouces\s]|17\s*inch|17\s*بوصة/i,
};

function laptopSearchText(product: Product): string {
  const specs = Object.entries((product.specifications as Record<string, string> | undefined) ?? {})
    .map(([key, value]) => `${key} ${value}`)
    .join(" ");
  const variants = product.variants.map((variant) => `${variant.sku ?? ""} ${variant.ram ?? ""} ${variant.storage ?? ""} ${variant.color ?? ""} ${variant.images?.join(" ") ?? ""}`).join(" ");
  const brand = typeof product.brand === "string" ? product.brand : product.brand.name;
  const category = typeof product.category === "string" ? product.category : `${product.category.slug} ${product.category.name.ar} ${product.category.name.fr} ${product.category.name.en}`;
  const images = product.images.join(" ");
  return `${product.slug} ${brand} ${category} ${product.name.ar} ${product.name.fr} ${product.name.en} ${product.description.ar} ${product.description.fr} ${product.description.en} ${product.adminNote ?? ""} ${specs} ${variants} ${images}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasWeakBattery(product: Product): boolean {
  const text = laptopSearchText(product);
  return /بطارية\s*(?:ضعيفة|متوسطة|لاشة|لاش|لش|ميتة)|بدون\s*بطارية|sans\s+batterie|sans\s+battery|faible\s+batterie|battery\s*(?:lache|l[aâ]che|faible|weak|dead|moyen(?:ne)?|medium)|bat(?:t)?er(?:y|ie|i|ire)?\s*(?:lache|l[aâ]che|faible|weak|dead|moyen(?:ne)?|medium)|(?:lache|l[aâ]che|faible|weak|dead|moyen(?:ne)?|medium)\s*(?:battery|batery|batterie|batterie|battrire)/i.test(text);
}

function hasGoodBattery(product: Product): boolean {
  return !hasWeakBattery(product);
}

function hasDoubleGraphics(product: Product): boolean {
  const text = laptopSearchText(product);
  const hasDedicated = /nvidia|geforce|radeon\s+(?:hd\s*)?\d{3,4}|ati\s+mobility\s+radeon/i.test(text);
  const hasIntegratedIntel = /intel|core\s+i[3579]|pentium|celeron|intel\s+(hd|uhd|iris)/i.test(text);
  return hasDedicated && hasIntegratedIntel;
}

function laptopCpuTier(product: Product): number {
  const text = laptopSearchText(product);
  if (/i7|ryzen\s*7/i.test(text)) return 7;
  if (/i5|ryzen\s*5/i.test(text)) return 5;
  if (/i3|ryzen\s*3|athlon|a10|a9|a8|a6/i.test(text)) return 3;
  if (/pentium/i.test(text)) return 2;
  if (/celeron|dual-core|e1|e2/i.test(text)) return 1;
  return 0;
}

function laptopCpuScore(product: Product): number {
  const text = laptopSearchText(product);
  if (/i7[-\s]?(11|10)\d{2}|i5[-\s]?11\d{2}|ryzen\s*5\s*(4|5|7)\d{3}/i.test(text)) return 98;
  if (/i5[-\s]?(8|10)\d{2}|i3[-\s]?11\d{2}|ryzen\s*5\s*3500/i.test(text)) return 86;
  if (/i5[-\s]?(7|6)\d{2}|i7[-\s]?5\d{2}|i3[-\s]?10\d{2}/i.test(text)) return 74;
  if (/i7[-\s]?(3|4)\d{2}|i5[-\s]?(4|5)\d{2}|i3[-\s]?(4|5)\d{2}|ryzen\s*3|a9|a10/i.test(text)) return 62;
  if (/i5[-\s]?(2|3)\d{2}|i7[-\s]?2\d{2}|i3[-\s]?3\d{2}|a6|athlon/i.test(text)) return 52;
  if (/i3[-\s]?2\d{2}|pentium\s+(?:b|p|dual-core|t)\d+|pentium/i.test(text)) return 34;
  if (/celeron|core\s*2\s*duo|centrino|dual-core|e1|e2/i.test(text)) return 20;
  return laptopCpuTier(product) * 10;
}

function laptopRamGb(product: Product): number {
  const text = laptopSearchText(product);
  const matches = [
    ...text.matchAll(/(?:ram|ddr|lpddr|memory|memoire|m[eé]moire|الرام)[^\d]{0,12}(\d{1,2})/gi),
    ...text.matchAll(/(\d{1,2})\s*(?:gb|go)\s*(?:ram|ddr|lpddr)/gi),
  ];
  return Math.max(0, ...matches.map((match) => Number(match[1])).filter((value) => value >= 2 && value <= 64));
}

function laptopStorageScore(product: Product): number {
  const text = laptopSearchText(product);
  const isNvme = /\bnvme\b|\bnvm\b/i.test(text);
  const isSsd = isNvme || /\bssd\b/i.test(text);
  const isHdd = /\bhdd\b|disque dur/i.test(text);
  const storageMatches = [
    ...text.matchAll(/(\d+(?:\.\d+)?)\s*(tb|to|gb|go)?\s*(nvme|nvm|ssd|hdd)/gi),
    ...text.matchAll(/(nvme|nvm|ssd|hdd)\s*(\d+(?:\.\d+)?)\s*(tb|to|gb|go)?/gi),
  ];
  const sizes = storageMatches.map((match) => {
    const first = match[1];
    const second = match[2];
    const third = match[3];
    const amount = /nvme|nvm|ssd|hdd/i.test(first) ? Number(second) : Number(first);
    const unit = /nvme|nvm|ssd|hdd/i.test(first) ? third : second;
    if (!Number.isFinite(amount)) return 0;
    return /tb|to/i.test(unit ?? "") || amount >= 1000 ? amount * (amount >= 1000 ? 1 : 1000) : amount;
  });
  const gb = Math.max(0, ...sizes);

  if (isNvme) return 42 + (gb >= 256 ? 5 : 0);
  if (isSsd) return 35 + (gb >= 256 ? 5 : 0);
  if (isHdd) {
    if (gb >= 1000) return 16;
    if (gb >= 500) return 12;
    if (gb >= 250) return 8;
    return 4;
  }
  return 0;
}

function hasSsd(product: Product): boolean {
  return /\bssd\b|nvme/i.test(laptopSearchText(product));
}

function hasLargeScreen(product: Product): boolean {
  const text = laptopSearchText(product);
  return SCREEN_PATTERNS["17"].test(text);
}

function laptopValueScore(product: Product): number {
  const price = productPrice(product);
  const cpuScore = laptopCpuScore(product);
  const ram = laptopRamGb(product);
  const weakBattery = hasWeakBattery(product);
  const discountRatio = typeof product.discountPrice === "number" && product.discountPrice < product.basePrice
    ? (product.basePrice - product.discountPrice) / product.basePrice
    : 0;

  let score = cpuScore;
  score += ram >= 16 ? 28 : ram >= 8 ? 20 : ram >= 6 ? 12 : ram >= 4 ? 7 : 0;
  score += laptopStorageScore(product);
  if (hasDoubleGraphics(product)) score += 20;
  if (hasLargeScreen(product)) score += 8;
  if (product.isFeatured) score += 7;
  if (product.isEuropean) score += 4;
  score += Math.min(18, Math.round(discountRatio * 55));

  if (weakBattery) {
    score += cpuScore >= 55 || hasDoubleGraphics(product) || hasSsd(product) ? 7 : -8;
  } else {
    score += 10;
  }

  score += price <= 25000 ? 16 : price <= 35000 ? 12 : price <= 45000 ? 8 : price <= 55000 ? 4 : 0;
  score -= Math.max(0, price - 30000) / 3500;
  return score;
}

function compareLaptopValue(a: Product, b: Product): number {
  const scoreDelta = laptopValueScore(b) - laptopValueScore(a);
  if (Math.abs(scoreDelta) > 3) return scoreDelta;
  return productPrice(a) - productPrice(b);
}

function matchesDealFilter(product: Product, filters: ProductFilterState): boolean {
  switch (filters.deal) {
    case "budget":
      return productPrice(product) <= 25000;
    case "fast":
      return hasSsd(product);
    case "powerDeal":
      return hasWeakBattery(product) && (laptopCpuTier(product) >= 5 || hasDoubleGraphics(product));
    case "bestValue":
      return laptopValueScore(product) >= 95;
    default:
      return true;
  }
}

function hasTactile(product: Product): boolean {
  const specs = product.specifications as Record<string, string> | undefined;
  const arabicScreenOrTypeKey = new RegExp("\\u0627?\\u0644?\\u0634\\u0627\\u0634\\u0629|\\u0634\\u0627\\u0634\\u0647|\\u0646\\u0648\\u0639");
  const specText = Object.entries(specs ?? {})
    .filter(([key]) => /screen|ecran|type/i.test(key.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) || arabicScreenOrTypeKey.test(key))
    .map(([key, value]) => `${key} ${value}`)
    .join(" ");
  const latinTouchPattern = /\btactile\b|\btactil\b|\btouch\s*screen\b|\btouchscreen\b|ecran\s+(?:tactile|touch)|screen\s+touch|dalle\s+tactile|afficheur\s+tactile|\bx360\b|360\s*(?:°|deg|degree|degre)|2\s*[- ]?(?:in|en)\s*[- ]?1|\bconvertible\b|\byoga\b/i;
  const arabicTouchPattern = new RegExp("\\u062a\\u0639\\u0645\\u0644\\s+\\u0628\\u0627\\u0644\\u0644\\u0645\\u0633|\\u0634\\u0627\\u0634\\u0629[^.\\n|]{0,50}(?:\\u0644\\u0645\\u0633|\\u062a\\u0627\\u062a\\u0634)|\\u0627\\u0644\\u0634\\u0627\\u0634\\u0629[^.\\n|]{0,50}(?:\\u0644\\u0645\\u0633|\\u062a\\u0627\\u062a\\u0634)|\\u062a\\u0627\\u062a\\u0634", "i");

  if (latinTouchPattern.test(specText.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) || arabicTouchPattern.test(specText)) return true;

  const touchpadArabic = new RegExp("\\u0644\\u0648\\u062d\\u0629\\s+\\u0627\\u0644\\u0644\\u0645\\u0633", "gi");
  const text = laptopSearchText(product)
    .replace(/\btouch\s*pad\b|\btouchpad\b/gi, " ")
    .replace(touchpadArabic, " ");
  return latinTouchPattern.test(text) || arabicTouchPattern.test(text);
}

function matchesLaptopFilters(product: Product, filters: ProductFilterState): boolean {
  const searchText = laptopSearchText(product);

  if (filters.cpu !== "all") {
    const re = CPU_PATTERNS[filters.cpu];
    if (re && !re.test(searchText)) return false;
  }

  if (filters.ram !== "all") {
    const ramRe = new RegExp(`\\b${filters.ram}\\s*(?:gb|go)\\b`, "i");
    if (!ramRe.test(searchText)) return false;
  }

  if (filters.screen !== "all") {
    const re = SCREEN_PATTERNS[filters.screen];
    if (re && !re.test(searchText)) return false;
  }

  if (filters.storage === "SSD" && !/\bssd\b|nvme/i.test(searchText)) return false;
  if (filters.storage === "HDD" && !/\bhdd\b|disque dur/i.test(searchText)) return false;

  if (filters.battery === "weak" && !hasWeakBattery(product)) return false;
  if (filters.battery === "good" && !hasGoodBattery(product)) return false;
  if (filters.doubleGraphics && !hasDoubleGraphics(product)) return false;
  if (filters.tactile && !hasTactile(product)) return false;
  if (!matchesDealFilter(product, filters)) return false;

  return true;
}

function productPrice(product: Product): number {
  return product.discountPrice ?? product.basePrice;
}

function matchesPrice(product: Product, filters: ProductFilterState): boolean {
  const price = productPrice(product);
  return price >= filters.minPrice && price <= filters.maxPrice;
}

function pricePresetKey(min: number, max: number): string {
  return `${min}-${max}`;
}

type LaptopFilterGroup = "price" | "battery" | "storage" | "screen" | "processor" | "brand" | "ram" | "graphics" | "touch" | "deal";

function matchesProductsPageFilters(
  product: Product,
  filters: ProductFilterState,
  showLaptopFilters: boolean,
  ignoreLaptopGroup?: LaptopFilterGroup,
): boolean {
  if (product.isSoldOut || product.status !== "ACTIVE") return false;

  const productCategory = typeof product.category === "string" ? product.category : product.category.slug;
  const productBrand = typeof product.brand === "string" ? product.brand : product.brand.name;
  const localizedName = `${product.name.ar} ${product.name.fr} ${product.name.en} ${productBrand}`.toLowerCase();

  if (filters.inStockOnly && product.stock <= 0) return false;
  if (filters.onSaleOnly && !product.discountPrice) return false;
  if (filters.condition !== "all" && product.condition !== filters.condition) return false;
  if (filters.category !== "all" && productCategory !== filters.category) return false;
  if (ignoreLaptopGroup !== "brand" && filters.brand !== "all" && productBrand !== filters.brand) return false;
  if (!localizedName.includes(filters.search.toLowerCase())) return false;
  if (ignoreLaptopGroup !== "price" && !matchesPrice(product, filters)) return false;

  if (showLaptopFilters) {
    const laptopFilters = {
      ...filters,
      ...(ignoreLaptopGroup === "battery" ? { battery: "all" as const } : {}),
      ...(ignoreLaptopGroup === "storage" ? { storage: "all" as const } : {}),
      ...(ignoreLaptopGroup === "screen" ? { screen: "all" } : {}),
      ...(ignoreLaptopGroup === "processor" ? { cpu: "all" } : {}),
      ...(ignoreLaptopGroup === "ram" ? { ram: "all" } : {}),
      ...(ignoreLaptopGroup === "graphics" ? { doubleGraphics: false } : {}),
      ...(ignoreLaptopGroup === "touch" ? { tactile: false } : {}),
      ...(ignoreLaptopGroup === "deal" ? { deal: "all" as const } : {}),
    };
    if (!matchesLaptopFilters(product, laptopFilters)) return false;
  }

  return true;
}

const LAPTOP_CATEGORY_SLUGS = new Set(["Laptop", "laptop", "pcs", "PC", "ordinateurs"]);
const BATTERY_FILTER_VALUES = new Set<ProductFilterState["battery"]>(["all", "good", "weak"]);
const DEAL_FILTER_VALUES = new Set<ProductFilterState["deal"]>(["all", "bestValue", "powerDeal", "budget", "fast"]);

type LaptopRequestForm = {
  name: string;
  phone: string;
  wilaya: string;
  brand: string;
  cpu: string;
  ram: string;
  screen: string;
  storage: string;
  budget: string;
  usage: string;
  battery: string;
  notes: string;
};

const LAPTOP_REQUEST_INITIAL: LaptopRequestForm = {
  name: "",
  phone: "",
  wilaya: "",
  brand: "",
  cpu: "",
  ram: "",
  screen: "",
  storage: "",
  budget: "",
  usage: "",
  battery: "",
  notes: "",
};

function LaptopRequestCard({ language, compact = false }: { language: Locale; compact?: boolean }) {
  const { pushToast, siteSettings } = useApp();
  const [form, setForm] = useState<LaptopRequestForm>(LAPTOP_REQUEST_INITIAL);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [compactOpen, setCompactOpen] = useState(false);
  const isAr = language === "ar";
  const isFr = language === "fr";
  const update = (patch: Partial<LaptopRequestForm>) => {
    setStatus("idle");
    setForm((current) => ({ ...current, ...patch }));
  };

  const cleanPhone = form.phone.replace(/\D/g, "");
  const hasNeed = Boolean(form.budget.trim() || form.usage || form.cpu || form.screen || form.storage || form.notes.trim());
  const canSubmit = cleanPhone.length >= 9 && hasNeed && status !== "sending";
  const whatsappDigits = siteSettings?.whatsapp?.replace(/\D/g, "") ?? "";
  const normalizedWhatsapp = whatsappDigits.startsWith("213")
    ? whatsappDigits
    : whatsappDigits.startsWith("0")
      ? `213${whatsappDigits.slice(1)}`
      : whatsappDigits;

  const text = {
    title: isAr ? "لم تجد الحاسوب المناسب؟" : isFr ? "Vous n'avez pas trouve le bon PC ?" : "Didn't find your PC?",
    subtitle: isAr
      ? "أرسل طلبك: الميزانية والاستعمال، ونقترح عليك أقرب جهاز متوفر."
      : isFr
        ? "Envoyez votre budget et votre usage, on vous propose le meilleur choix disponible."
        : "Send your budget and usage, and we'll suggest the closest available laptop.",
    name: isAr ? "الاسم (اختياري)" : isFr ? "Nom (optionnel)" : "Name (optional)",
    phone: isAr ? "رقم الهاتف / واتساب" : isFr ? "Telephone / WhatsApp" : "Phone / WhatsApp",
    wilaya: isAr ? "الولاية" : isFr ? "Wilaya" : "Wilaya",
    budget: isAr ? "الميزانية بالدج" : isFr ? "Budget en DA" : "Budget in DA",
    usage: isAr ? "ماذا ستفعل به؟" : isFr ? "Usage principal" : "Main usage",
    screen: isAr ? "حجم الشاشة" : isFr ? "Taille ecran" : "Screen size",
    storage: isAr ? "التخزين" : isFr ? "Stockage" : "Storage",
    battery: isAr ? "البطارية" : isFr ? "Batterie" : "Battery",
    cpu: isAr ? "المعالج إن كنت تعرفه" : isFr ? "CPU si vous savez" : "CPU if you know",
    ram: isAr ? "RAM" : "RAM",
    brand: isAr ? "الماركة المفضلة" : isFr ? "Marque preferee" : "Preferred brand",
    notes: isAr ? "ملاحظات قصيرة: ألعاب، برامج، شاشة كبيرة، وزن خفيف..." : isFr ? "Notes: jeux, logiciels, grand ecran, poids..." : "Notes: games, apps, big screen, light weight...",
    button: status === "sending" ? (isAr ? "جار الإرسال..." : isFr ? "Envoi..." : "Sending...") : (isAr ? "أرسل الطلب" : isFr ? "Envoyer la demande" : "Send request"),
    sentTitle: isAr ? "تم إرسال الطلب" : isFr ? "Demande envoyee" : "Request sent",
    sentBody: isAr ? "سنراجع الطلب ونتواصل معك عند توفر اختيار مناسب." : isFr ? "Nous allons verifier et vous contacter." : "We'll review it and contact you with a suitable option.",
    whatsapp: isAr ? "واتساب مباشر" : isFr ? "WhatsApp direct" : "Direct WhatsApp",
    hint: isAr ? "اكتب ما تعرفه فقط. رقم الهاتف ضروري حتى نرد عليك." : isFr ? "Remplissez seulement ce que vous savez. Le telephone est obligatoire." : "Fill only what you know. Phone is required so we can reply.",
  };

  const submit = async () => {
    if (!canSubmit) {
      pushToast(isAr ? "أدخل رقم الهاتف والميزانية أو الاستعمال" : "Add phone and budget or usage", "error");
      return;
    }

    setStatus("sending");
    try {
      await productService.requestPc({
        ...form,
        phone: form.phone.trim(),
        notes: [
          form.notes.trim(),
          form.usage ? `${isAr ? "الاستعمال" : "Usage"}: ${form.usage}` : "",
          form.battery ? `${isAr ? "البطارية" : "Battery"}: ${form.battery}` : "",
        ].filter(Boolean).join(" | "),
      });
      setStatus("sent");
      setForm(LAPTOP_REQUEST_INITIAL);
      pushToast(isAr ? "تم إرسال طلب الحاسوب" : "PC request sent", "success");
    } catch {
      setStatus("error");
      pushToast(isAr ? "لم يتم الإرسال، حاول مرة أخرى" : "Could not send request", "error");
    }
  };

  const field = "h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100";
  const select = `${field} appearance-none`;

  if (compact) {
    const compactField = "h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-[12px] font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100";

    return (
      <>
      <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-orange-300 bg-gradient-to-b from-orange-50 via-white to-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="relative aspect-[1.18/1] overflow-hidden bg-gradient-to-br from-orange-50 via-white to-slate-50 p-3 text-slate-950">
          <div className="absolute start-2 top-2 rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-extrabold text-white shadow-sm">
            {isAr ? "طلب خاص" : isFr ? "Demande" : "Request"}
          </div>
          <div className="flex h-full flex-col justify-end">
            <div className="absolute end-2 top-2 grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-orange-300 shadow-sm">
              <Search className="h-5 w-5" />
            </div>
            <div className="max-w-[96%]">
              <h3 className="text-base font-black leading-6">{text.title}</h3>
              <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-4 text-slate-500">{text.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          {status === "sent" ? (
            <div className="grid flex-1 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-center">
              <div>
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                <div className="mt-2 text-sm font-black text-emerald-950">{text.sentTitle}</div>
                <p className="mt-1 text-[11px] font-bold leading-5 text-emerald-700">{text.sentBody}</p>
              </div>
            </div>
          ) : (
            <>
              <input className={`hidden ${compactField}`} value={form.phone} onChange={(event) => update({ phone: event.target.value })} placeholder={text.phone} inputMode="tel" />
              <input className={`hidden ${compactField}`} value={form.budget} onChange={(event) => update({ budget: event.target.value })} placeholder={text.budget} inputMode="numeric" />
              <select className={`hidden ${compactField} appearance-none`} value={form.usage} onChange={(event) => update({ usage: event.target.value })}>
                <option value="">{text.usage}</option>
                {["دراسة وبيت", "عمل يومي", "برمجة", "تصميم", "ألعاب خفيفة", "شاشة كبيرة للعائلة"].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-1.5 text-center text-[10px] font-black text-slate-600">
                <span className="rounded-lg bg-slate-50 px-1.5 py-1.5 ring-1 ring-slate-200">{isAr ? "الميزانية" : "Budget"}</span>
                <span className="rounded-lg bg-slate-50 px-1.5 py-1.5 ring-1 ring-slate-200">{isAr ? "الاستعمال" : "Usage"}</span>
                <span className="rounded-lg bg-slate-50 px-1.5 py-1.5 ring-1 ring-slate-200">{isAr ? "الشاشة" : "Screen"}</span>
                <span className="rounded-lg bg-slate-50 px-1.5 py-1.5 ring-1 ring-slate-200">{isAr ? "البطارية" : "Battery"}</span>
              </div>
              {status === "error" ? <p className="hidden text-[11px] font-bold text-rose-600">{isAr ? "حاول مرة أخرى." : "Try again."}</p> : null}
              <button
                type="button"
                onClick={() => setCompactOpen(true)}
                className="mt-auto inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-orange-500 px-3 text-xs font-black text-white shadow-sm transition hover:bg-orange-400"
              >
                <Send className="h-3.5 w-3.5" />
                {isAr ? "املأ التفاصيل" : isFr ? "Remplir les details" : "Add details"}
              </button>
              {normalizedWhatsapp ? (
                <a
                  href={`https://wa.me/${normalizedWhatsapp}?text=${encodeURIComponent(isAr ? "مرحبا، لم أجد الحاسوب المناسب في الموقع. أريد المساعدة." : "Hello, I did not find the right laptop. I need help.")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-black text-emerald-700 transition hover:bg-emerald-100"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {text.whatsapp}
                </a>
              ) : null}
            </>
          )}
        </div>
      </article>
      {compactOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[1.75rem] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
              <div>
                <div className="text-xs font-black uppercase text-orange-600">{isAr ? "طلب حاسوب خاص" : "Laptop request"}</div>
                <div className="text-sm font-black text-slate-950">{text.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setCompactOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                aria-label={isAr ? "إغلاق" : "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-3 sm:p-4">
              <LaptopRequestCard language={language} />
            </div>
          </div>
        </div>
      ) : null}
      </>
    );
  }

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-orange-200 bg-gradient-to-br from-white via-orange-50/60 to-slate-50 shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="border-b border-orange-100 p-5 sm:p-6 lg:border-b-0 lg:border-e">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
            <Search className="h-3.5 w-3.5 text-orange-300" />
            {isAr ? "طلب خاص" : isFr ? "Demande speciale" : "Special request"}
          </div>
          <h2 className="mt-4 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">{text.title}</h2>
          <p className="mt-2 max-w-md text-sm font-semibold leading-7 text-slate-600">{text.subtitle}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-slate-700">
            <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">{isAr ? "ميزانيتك" : "Budget"}</span>
            <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">{isAr ? "استعمالك" : "Usage"}</span>
            <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">{isAr ? "نتواصل معك" : "We reply"}</span>
          </div>
          <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-xs font-bold leading-6 text-slate-500 ring-1 ring-orange-100">
            {text.hint}
          </p>
          {normalizedWhatsapp ? (
            <a
              href={`https://wa.me/${normalizedWhatsapp}?text=${encodeURIComponent(isAr ? "مرحبا، لم أجد الحاسوب المناسب في الموقع. أريد المساعدة." : "Hello, I did not find the right laptop. I need help.")}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-500"
            >
              <MessageCircle className="h-4 w-4" />
              {text.whatsapp}
            </a>
          ) : null}
        </div>

        <div className="p-4 sm:p-5">
          {status === "sent" ? (
            <div className="grid min-h-64 place-items-center rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-5 py-8 text-center">
              <div>
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                <div className="mt-3 text-xl font-black text-emerald-950">{text.sentTitle}</div>
                <p className="mt-2 text-sm font-semibold leading-7 text-emerald-700">{text.sentBody}</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={field} value={form.name} onChange={(event) => update({ name: event.target.value })} placeholder={text.name} />
                <input className={field} value={form.phone} onChange={(event) => update({ phone: event.target.value })} placeholder={text.phone} inputMode="tel" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <input className={field} value={form.wilaya} onChange={(event) => update({ wilaya: event.target.value })} placeholder={text.wilaya} />
                <input className={field} value={form.budget} onChange={(event) => update({ budget: event.target.value })} placeholder={text.budget} inputMode="numeric" />
                <select className={select} value={form.usage} onChange={(event) => update({ usage: event.target.value })}>
                  <option value="">{text.usage}</option>
                  {["دراسة وبيت", "عمل يومي", "برمجة", "تصميم", "ألعاب خفيفة", "شاشة كبيرة للعائلة"].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <select className={select} value={form.screen} onChange={(event) => update({ screen: event.target.value })}>
                  <option value="">{text.screen}</option>
                  {["12-13 inch", "14 inch", "15.6 inch", "17.3 inch"].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select className={select} value={form.storage} onChange={(event) => update({ storage: event.target.value })}>
                  <option value="">{text.storage}</option>
                  {["HDD عادي", "SSD سريع", "لا يهم"].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select className={select} value={form.battery} onChange={(event) => update({ battery: event.target.value })}>
                  <option value="">{text.battery}</option>
                  {["بطارية جيدة", "بطارية ضعيفة بسعر أقل", "لا يهم"].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <details className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <summary className="flex cursor-pointer items-center gap-2 text-sm font-black text-slate-700">
                  <SlidersHorizontal className="h-4 w-4 text-orange-500" />
                  {isAr ? "تفاصيل اختيارية" : isFr ? "Details optionnels" : "Optional details"}
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <select className={select} value={form.brand} onChange={(event) => update({ brand: event.target.value })}>
                    <option value="">{text.brand}</option>
                    {["HP", "Dell", "Lenovo", "Asus", "Acer", "Toshiba", "Sony", "لا يهم"].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  <select className={select} value={form.cpu} onChange={(event) => update({ cpu: event.target.value })}>
                    <option value="">{text.cpu}</option>
                    {["i3", "i5", "i7", "Pentium", "Celeron", "Ryzen", "AMD", "لا يهم"].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  <select className={select} value={form.ram} onChange={(event) => update({ ram: event.target.value })}>
                    <option value="">{text.ram}</option>
                    {["4 GB", "6 GB", "8 GB", "16 GB", "لا يهم"].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>
              </details>
              <textarea className={`${field} min-h-24 resize-none py-3`} value={form.notes} onChange={(event) => update({ notes: event.target.value })} placeholder={text.notes} />
              {status === "error" ? <p className="text-xs font-bold text-rose-600">{isAr ? "حدث خطأ، حاول مرة أخرى." : "Error, try again."}</p> : null}
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 text-sm font-black text-white shadow-sm transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Send className="h-4 w-4" />
                {text.button}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function ProductsPage() {
  const { language } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get("category") || "all";
  const initialIsLaptopCategory = LAPTOP_CATEGORY_SLUGS.has(initialCategory);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [displayCount, setDisplayCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filters, setFilters] = useState<ProductFilterState>({
    ...DEFAULT_FILTERS,
    search: searchParams.get("q") || "",
    category: initialCategory,
    brand: searchParams.get("brand") || "all",
    cpu: searchParams.get("cpu") || "all",
    ram: searchParams.get("ram") || "all",
    screen: searchParams.get("screen") || "all",
    storage: searchParams.get("storage") === "SSD" || searchParams.get("storage") === "HDD" ? searchParams.get("storage") as ProductFilterState["storage"] : "all",
    battery: BATTERY_FILTER_VALUES.has(searchParams.get("battery") as ProductFilterState["battery"]) ? searchParams.get("battery") as ProductFilterState["battery"] : "all",
    doubleGraphics: searchParams.get("doubleGraphics") === "1",
    tactile: searchParams.get("tactile") === "1",
    deal: DEAL_FILTER_VALUES.has(searchParams.get("deal") as ProductFilterState["deal"]) ? searchParams.get("deal") as ProductFilterState["deal"] : "all",
    condition: (searchParams.get("condition") as "all" | "NEW" | "USED") || "all",
    sort: (searchParams.get("sort") as import("@/components/ProductFilters").SortOption) || (initialIsLaptopCategory || searchParams.get("deal") ? "value" : "default"),
    minPrice: Number(searchParams.get("minPrice") ?? 0),
    maxPrice: Number(searchParams.get("maxPrice") ?? 500000),
    inStockOnly: searchParams.get("inStock") === "1",
    onSaleOnly: searchParams.get("onSale") === "1",
  });

  // Keep URL in sync with filters so sharing the link restores the exact view
  const syncUrl = useCallback((f: ProductFilterState) => {
    const p: Record<string, string> = {};
    if (f.search) p.q = f.search;
    if (f.category !== "all") p.category = f.category;
    if (f.brand !== "all") p.brand = f.brand;
    if (f.cpu !== "all") p.cpu = f.cpu;
    if (f.ram !== "all") p.ram = f.ram;
    if (f.screen !== "all") p.screen = f.screen;
    if (f.storage !== "all") p.storage = f.storage;
    if (f.battery !== "all") p.battery = f.battery;
    if (f.doubleGraphics) p.doubleGraphics = "1";
    if (f.tactile) p.tactile = "1";
    if (f.deal !== "all") p.deal = f.deal;
    if (f.condition !== "all") p.condition = f.condition;
    if (f.sort !== "default") p.sort = f.sort;
    if (f.minPrice > 0) p.minPrice = String(f.minPrice);
    if (f.maxPrice < 500000) p.maxPrice = String(f.maxPrice);
    if (f.inStockOnly) p.inStock = "1";
    if (f.onSaleOnly) p.onSale = "1";
    setSearchParams(p, { replace: true });
  }, [setSearchParams]);

  const handleFilterChange = useCallback((next: ProductFilterState) => {
    setFilters(next);
    setDisplayCount(BATCH_SIZE);
    syncUrl(next);
  }, [syncUrl]);

  useEffect(() => {
    void Promise.all([productService.getProducts(), adminService.getCategories()])
      .then(([productData, categoryData]) => {
        setProducts(productData.filter((product) => product.status === "ACTIVE" && !product.isSoldOut && product.stock > 0));
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

  const showLaptopFilters = LAPTOP_CATEGORY_SLUGS.has(filters.category);

  const activeCategory = filters.category !== "all"
    ? categories.find((c) => c.slug === filters.category)
    : null;

  const categoryLabel = activeCategory ? getLocalizedText(activeCategory.name, language) : null;

  const seoTitle = categoryLabel ?? translate(language, "productsTitle");
  const seoDescription = categoryLabel
    ? language === "ar"
      ? `تسوق أفضل ${getLocalizedText(activeCategory!.name, "ar")} بأسعار منافسة — توصيل لجميع الولايات الـ58 والدفع عند الاستلام.`
      : language === "fr"
        ? `Achetez les meilleurs ${getLocalizedText(activeCategory!.name, "fr")} au meilleur prix — livraison dans toute l'Algérie, paiement à la livraison.`
        : `Shop the best ${getLocalizedText(activeCategory!.name, "en")} at competitive prices — delivery to all 58 wilayas, pay on delivery.`
    : translate(language, "categoryDescription");
  const seoPath = activeCategory ? `/products?category=${activeCategory.slug}` : "/products";

  const filtered = useMemo(() => {
    const list = products.filter((product) => matchesProductsPageFilters(product, filters, showLaptopFilters));

    // Apply sort
    switch (filters.sort) {
      case "price_asc": return [...list].sort((a, b) => productPrice(a) - productPrice(b));
      case "price_desc": return [...list].sort((a, b) => productPrice(b) - productPrice(a));
      case "value": return showLaptopFilters
        ? [...list].sort(compareLaptopValue)
        : [...list].sort((a, b) => laptopValueScore(b) - laptopValueScore(a));
      case "newest": return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "name": return [...list].sort((a, b) => (a.name.ar || a.name.fr || "").localeCompare(b.name.ar || b.name.fr || ""));
      case "default": if (showLaptopFilters) return [...list].sort(compareLaptopValue);
      default: return [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
  }, [filters, products, showLaptopFilters]);

  const laptopOptionCounts = useMemo<LaptopOptionCounts | undefined>(() => {
    if (!showLaptopFilters) return undefined;

    const counts: LaptopOptionCounts = {
      price: {},
      battery: { good: 0, weak: 0 },
      storage: { HDD: 0, SSD: 0 },
      screen: {},
      processor: {},
      brand: {},
      ram: {},
      graphics: { double: 0 },
      touch: { tactile: 0 },
      deal: { bestValue: 0, powerDeal: 0, budget: 0, fast: 0 },
    };

    const pricePresets = [
      [0, 500000],
      [0, 30000],
      [30000, 50000],
      [50000, 80000],
      [80000, 120000],
      [120000, 500000],
    ] as const;

    pricePresets.forEach(([min, max]) => {
      counts.price[pricePresetKey(min, max)] = products.filter((product) => {
        if (!matchesProductsPageFilters(product, filters, true, "price")) return false;
        const price = productPrice(product);
        return price >= min && price <= max;
      }).length;
    });

    (["good", "weak"] as const).forEach((value) => {
      counts.battery[value] = products.filter((product) => {
        if (!matchesProductsPageFilters(product, filters, true, "battery")) return false;
        return value === "weak" ? hasWeakBattery(product) : hasGoodBattery(product);
      }).length;
    });

    (["HDD", "SSD"] as const).forEach((value) => {
      counts.storage[value] = products.filter((product) => {
        if (!matchesProductsPageFilters(product, filters, true, "storage")) return false;
        return value === "SSD" ? /\bssd\b|nvme/i.test(laptopSearchText(product)) : /\bhdd\b|disque dur/i.test(laptopSearchText(product));
      }).length;
    });

    Object.entries(SCREEN_PATTERNS).forEach(([value, re]) => {
      counts.screen[value] = products.filter((product) =>
        matchesProductsPageFilters(product, filters, true, "screen") && re.test(laptopSearchText(product)),
      ).length;
    });

    Object.entries(CPU_PATTERNS).forEach(([value, re]) => {
      counts.processor[value] = products.filter((product) =>
        matchesProductsPageFilters(product, filters, true, "processor") && re.test(laptopSearchText(product)),
      ).length;
    });

    products.forEach((product) => {
      const productBrand = typeof product.brand === "string" ? product.brand : product.brand.name;
      if (!productBrand) return;
      if (!matchesProductsPageFilters(product, filters, true, "brand")) return;
      counts.brand[productBrand] = (counts.brand[productBrand] ?? 0) + 1;
    });

    (["4", "8", "16", "32"] as const).forEach((value) => {
      const ramRe = new RegExp(`\\b${value}\\s*(?:gb|go)\\b`, "i");
      counts.ram[value] = products.filter((product) =>
        matchesProductsPageFilters(product, filters, true, "ram") && ramRe.test(laptopSearchText(product)),
      ).length;
    });

    counts.graphics.double = products.filter((product) =>
      matchesProductsPageFilters(product, filters, true, "graphics") && hasDoubleGraphics(product),
    ).length;

    counts.touch.tactile = products.filter((product) =>
      matchesProductsPageFilters(product, filters, true, "touch") && hasTactile(product),
    ).length;

    (["bestValue", "powerDeal", "budget", "fast"] as const).forEach((value) => {
      counts.deal[value] = products.filter((product) =>
        matchesProductsPageFilters(product, filters, true, "deal") && matchesDealFilter(product, { ...filters, deal: value }),
      ).length;
    });

    return counts;
  }, [filters, products, showLaptopFilters]);

  const displayedProducts = filtered.slice(0, displayCount);
  const hasMore = displayCount < filtered.length;
  const laptopRequestInsertAfter = showLaptopFilters && displayedProducts.length > 0
    ? Math.min(displayedProducts.length - 1, displayedProducts.length >= 10 ? 7 : Math.max(1, Math.floor(displayedProducts.length / 2) - 1))
    : -1;

  // Reset to first batch whenever filters produce a different list
  useEffect(() => { setDisplayCount(BATCH_SIZE); }, [filtered]);

  // Infinite scroll — load next batch when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) setDisplayCount((c) => c + BATCH_SIZE); },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  if (loading) {
    return <LoadingState label={translate(language, "loading")} />;
  }

  if (errorMessage) {
    return <EmptyState title={translate(language, "noProductsTitle")} description={errorMessage} />;
  }

  return (
    <div className="space-y-6">
      <Seo title={seoTitle} description={seoDescription} path={seoPath} />
      {/* Mobile: slim single-line header */}
      <section className="surface-card overflow-hidden p-3.5 sm:p-5 md:p-8">
        <div className="flex items-center justify-between gap-3 md:hidden">
          <div className="min-w-0">
            {categoryLabel && (
              <p className="text-[11px] font-bold uppercase tracking-widest text-teal-600">{translate(language, "productsEyebrow")}</p>
            )}
            <h1 className="font-serif text-lg font-semibold text-slate-950 truncate">{seoTitle}</h1>
          </div>
          <span className="shrink-0 rounded-full bg-slate-950 px-3 py-1 text-sm font-semibold text-white">{filtered.length}</span>
        </div>
        {/* Desktop: full layout */}
        <div className="hidden md:flex md:flex-wrap md:items-end md:justify-between md:gap-6">
          <div>
            <p className="section-eyebrow">{translate(language, "productsEyebrow")}</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-slate-950 md:text-4xl">{seoTitle}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{seoDescription}</p>
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
        onChange={handleFilterChange}
        showLaptopFilters={showLaptopFilters}
        laptopOptionCounts={laptopOptionCounts}
      />

      {filtered.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <EmptyState title={translate(language, "noProductsTitle")} description={translate(language, "noProductsDescription")} />
          {showLaptopFilters ? <LaptopRequestCard language={language} compact /> : null}
        </div>
      ) : (
        <div className="space-y-6">
          <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${showLaptopFilters ? "lg:grid-cols-4 xl:grid-cols-5" : "md:gap-6 xl:grid-cols-3"}`}>
            {displayedProducts.map((product, index) => (
              <Fragment key={product._id}>
                <ProductCard product={product} language={language} />
                {showLaptopFilters && index === laptopRequestInsertAfter ? (
                  <LaptopRequestCard language={language} compact />
                ) : null}
              </Fragment>
            ))}
          </div>
          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="flex justify-center py-4">
            {hasMore ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                {language === "ar" ? `${filtered.length} منتج — تم عرض الكل` : `${filtered.length} produits — tout affiché`}
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
