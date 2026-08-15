import { BatteryCharging, Heart, Monitor, ShieldCheck, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import type { Locale, Product } from "@/types";
import { formatCurrency, getLocalizedText } from "@/utils/format";
import { translate } from "@/utils/i18n";

function extractLaptopSpecs(product: Product): { cpu?: string; ram?: string; storage?: string; screen?: string; gpu?: string; batteryBad?: boolean; batteryMentioned?: boolean; batteryGood?: boolean } | null {
  const nameText = `${product.name.ar || ""} ${product.name.fr || ""} ${product.name.en || ""}`;
  const specs = (product.specifications as Record<string, string> | undefined) ?? {};

  // Pull screen from specs if present (handles 'الشاشة', 'Screen', 'Ecran', etc.)
  const specScreenEntry = Object.entries(specs).find(([k]) => /شاشة|screen|ecran|inch|بوصة/i.test(k));
  const specScreenText = specScreenEntry ? specScreenEntry[1] : "";

  // Pull CPU from specs if present
  const specCpuEntry = Object.entries(specs).find(([k]) => /معالج|cpu|processor/i.test(k));
  const specCpuText = specCpuEntry ? specCpuEntry[1] : "";

  // Pull RAM from specs
  const specRamEntry = Object.entries(specs).find(([k]) => /رام|ram|mémoire|memory/i.test(k));
  const specRamText = specRamEntry ? specRamEntry[1] : "";

  // Pull storage from specs
  const specStorageEntry = Object.entries(specs).find(([k]) => /تخزين|ssd|hdd|storage|disque/i.test(k));
  const specStorageText = specStorageEntry ? specStorageEntry[1] : "";
  const specGpuEntry = Object.entries(specs).find(([k]) => /كرت|gpu|graphics|graphique|vga/i.test(k));
  const specGpuText = specGpuEntry ? specGpuEntry[1] : "";

  // Full search text: name + all spec values
  const specValues = Object.values(specs).join(" ");
  const fullText = `${nameText} ${product.adminNote ?? ""} ${specValues}`;

  // ── CPU extraction ──
  let cpu: string | undefined;
  const cpuSourceText = `${specCpuText} ${nameText} ${specValues}`;
  const cpuMatch = cpuSourceText.match(/AMD\s+Ryzen\s*[3579]\s*(?:Pro\s*)?\d{4}[A-Z]*/i)
    || cpuSourceText.match(/Ryzen\s*[3579]\s*(?:Pro\s*)?\d{4}[A-Z]*/i)
    || cpuSourceText.match(/Intel\s+Core\s+i[3579][-\s]?[A-Z]?\d{3,5}[A-Z]{0,3}/i)
    || cpuSourceText.match(/Core\s+i[3579][-\s]?[A-Z]?\d{3,5}[A-Z]{0,3}/i)
    || cpuSourceText.match(/\bi[3579][-\s]?\d{3,5}[A-Z]{0,3}\b/i)
    || cpuSourceText.match(/Intel\s+Core\s+i[3579]\b/i)
    || cpuSourceText.match(/Core\s+i[3579]\b/i)
    || cpuSourceText.match(/\bi[3579]\b/i)
    || cpuSourceText.match(/Intel\s+Pentium\s+(?:Dual-Core\s+)?[A-Z]?\d+[A-Z\d]*/i)
    || cpuSourceText.match(/Pentium\s+(?:Dual-Core\s+)?[A-Z]?\d+[A-Z\d]*/i)
    || cpuSourceText.match(/Intel\s+Celeron\s+[A-Z]?\d+[A-Z\d]*/i)
    || cpuSourceText.match(/Celeron\s+[A-Z]?\d+[A-Z\d]*/i)
    || cpuSourceText.match(/AMD\s+Athlon\s+(?:II\s+)?X?\d?\s*[A-Z]?\d+[A-Z\d]*/i)
    || cpuSourceText.match(/AMD\s+Dual.?Core\s+[A-Z]?\d+[A-Z\d]*/i)
    || cpuSourceText.match(/AMD\s+A\d+[-\s]?\d*[A-Z]*/i)
    || cpuSourceText.match(/AMD\s+E[12](?:\s+Vision)?/i)
    || cpuSourceText.match(/AMD\s+Vision\s+Pro/i)
    || cpuSourceText.match(/\bCeleron\b/i)
    || cpuSourceText.match(/\bPentium\b/i)
    || cpuSourceText.match(/\bAMD\b/i);
  if (cpuMatch) {
    cpu = cpuMatch[0].replace(/\s+/g, " ").trim();
    const genMatch = cpuSourceText.match(/(\d+)(?:e?m?e|th|ème|st|nd|rd)\s*(?:gén?|gen)?/i);
    if (genMatch) cpu += ` ${genMatch[1]}ᵉ`;
  }

  // ── RAM extraction ──
  let ram: string | undefined;
  const ramSourceText = specRamText || fullText;
  const ramMatch = ramSourceText.match(/(\d+)\s*(?:GB|Go)\s*(?:RAM|DDR|LPDDR)/i)
    || ramSourceText.match(/RAM\s*[:\s]*(\d+)/i)
    || ramSourceText.match(/(\d+)\s*(?:GB|Go)/i)
    || nameText.match(/(\d+)\/\d+/);
  if (ramMatch) {
    const val = parseInt(ramMatch[1]);
    if (val >= 2 && val <= 128) ram = `${val} GB`;
  }

  // ── Storage extraction ──
  let storage: string | undefined;
  const storageSourceText = specStorageText || fullText;
  const storageMatch = storageSourceText.match(/(\d+(?:\.\d+)?)\s*(TB|To|GB|Go)?\s*(NVMe|NVM|SSD|HDD)/i)
    || storageSourceText.match(/(NVMe|NVM|SSD|HDD)\s*(\d+(?:\.\d+)?)\s*(TB|To|GB|Go)?/i)
    || nameText.match(/(\d+(?:\.\d+)?)\s*(TB|To|GB|Go)?\s*(NVMe|NVM|SSD|HDD)/i)
    || nameText.match(/(NVMe|NVM|SSD|HDD)\s*(\d+(?:\.\d+)?)\s*(TB|To|GB|Go)?/i)
    || nameText.match(/\d+\/(\d+)\s*(?:nvme|ssd|nvm|gb|go)/i);
  if (storageMatch) {
    const first = storageMatch[1];
    const second = storageMatch[2];
    const third = storageMatch[3];
    const type = /NVMe|NVM|SSD|HDD/i.test(first) ? first : third;
    const amount = /NVMe|NVM|SSD|HDD/i.test(first) ? second : first;
    const unit = /NVMe|NVM|SSD|HDD/i.test(first) ? third : second;
    const val = parseFloat(amount);
    if (val >= 1 && val <= 4096) {
      const normalizedUnit = /TB|To/i.test(unit || "") || val >= 1000 ? "TB" : "GB";
      const normalizedValue = normalizedUnit === "TB" && val >= 1000 ? val / 1000 : val;
      const normalizedType = /NVMe|NVM/i.test(type || "") ? "NVMe" : /SSD/i.test(type || "") ? "SSD" : /HDD/i.test(type || "") ? "HDD" : "";
      storage = `${Number.isInteger(normalizedValue) ? normalizedValue : normalizedValue.toFixed(1)} ${normalizedUnit}${normalizedType ? ` ${normalizedType}` : ""}`;
    }
  }

  // ── Screen extraction ──
  let screen: string | undefined;
  const screenSourceText = specScreenText || nameText;
  const screenMatch = screenSourceText.match(/(\d+\.?\d*)\s*(?:["''"’]|inch|pouces|بوصة)/i)
    || screenSourceText.match(/(\d+\.?\d*)[""']/i);
  if (screenMatch) {
    const val = parseFloat(screenMatch[1]);
    if (val >= 10 && val <= 22) screen = `${val}"`;
  }

  let gpu: string | undefined;
  const gpuSourceText = `${specGpuText} ${nameText} ${specValues}`;
  const gpuMatch = gpuSourceText.match(/NVIDIA\s+GeForce\s+[A-Z]*\s?\d{3,4}M?(?:\s*\d+\s*GB)?/i)
    || gpuSourceText.match(/GeForce\s+[A-Z]*\s?\d{3,4}M?(?:\s*\d+\s*GB)?/i)
    || gpuSourceText.match(/AMD\s+Radeon\s+(?:HD\s*)?\d{3,4}[A-Z]?(?:\s*\d+\s*GB)?/i)
    || gpuSourceText.match(/Radeon\s+(?:HD\s*)?\d{3,4}[A-Z]?(?:\s*\d+\s*GB)?/i)
    || gpuSourceText.match(/Intel\s+Iris\s+Xe/i)
    || gpuSourceText.match(/Intel\s+UHD\s+\d{3,4}/i)
    || gpuSourceText.match(/Intel\s+HD\s+\d{3,4}/i)
    || gpuSourceText.match(/Intel\s+HD\s+Graphics/i)
    || gpuSourceText.match(/ATI\s+Mobility\s+Radeon/i);
  if (gpuMatch) {
    gpu = gpuMatch[0].replace(/\s+/g, " ").trim();
    if (/^GeForce/i.test(gpu)) gpu = `NVIDIA ${gpu}`;
    if (/^Radeon/i.test(gpu)) gpu = `AMD ${gpu}`;
  }

  // ── Battery warning detection ──
  const batEntry = Object.entries(specs).find(([k]) => /بطارية|battery|batery|batterie/i.test(k));
  const batteryText = `${batEntry?.[1] ?? ""} ${fullText}`;
  const batteryMentioned = /بطارية|battery|batery|batterie|battrire|batterire|baterie|batrie|\b\d{1,3}\s*%/i.test(batteryText);
  const weakBatteryPattern = /لاشة|لاش|لش|ضعيفة|متوسطة|ميتة|mort|moyen|medium|faible|dead|lache|l[aâ]che|0%|بدون|sans|bat(?:t)?er(?:y|ie|i|ire)?\s*(?:lache|l[aâ]che|faible|weak|dead|moyen(?:ne)?|medium)/i;
  const batteryBad = batEntry
    ? weakBatteryPattern.test(batEntry[1])
    : /بدون بطارية|battery lache|batery lache|battrire lache|batterie lache|battery morte|sans batterie|faible batterie/i.test(fullText);
  const batteryGood = !batteryBad && (!batteryMentioned || /bonne|good|excellent|جيد|ممتاز|\b(?:7[5-9]|[89]\d|100)\s*%/i.test(batteryText));

  if (!cpu && !ram && !storage && !screen && !gpu && !batteryBad && !batteryGood) return null;
  return { cpu, ram, storage, screen, gpu, batteryBad, batteryMentioned, batteryGood };
}

function cpuLogo(cpu?: string): string | null {
  if (!cpu) return null;
  if (/ryzen\s*5/i.test(cpu)) return "/cpu-ryzen5.png";
  if (/ryzen\s*7/i.test(cpu)) return "/cpu-ryzen7.png";
  if (/ryzen/i.test(cpu)) return "/cpu-ryzen.png";
  if (/i3/i.test(cpu)) return "/cpu-i3.png";
  if (/i5/i.test(cpu)) return "/cpu-i5.png";
  if (/i7/i.test(cpu)) return "/cpu-i7.png";
  if (/pentium/i.test(cpu)) return "/cpu-pentium.png";
  if (/celeron/i.test(cpu)) return "/cpu-celeron.png";
  if (/amd|athlon/i.test(cpu)) return "/cpu-amd.png";
  return "/cpu-intel.png";
}

function fullCpuName(cpu?: string): string | undefined {
  if (!cpu) return undefined;
  let value = cpu.replace(/\s+/g, " ").trim();
  if (/^i[3579]/i.test(value)) value = `Intel Core ${value}`;
  if (/^Core\s+i[3579]/i.test(value)) value = `Intel ${value}`;
  if (/^Pentium/i.test(value)) value = `Intel ${value}`;
  if (/^Celeron/i.test(value)) value = `Intel ${value}`;
  if (/^Ryzen/i.test(value)) value = `AMD ${value}`;
  value = value
    .replace(/Intel\s+Intel\s+/i, "Intel ")
    .replace(/Core\s+(i[3579])\s+([A-Z]?\d{3,5}[A-Z]{0,3})/i, "Core $1-$2")
    .replace(/\b(i[3579])\s+([A-Z]?\d{3,5}[A-Z]{0,3})/i, "$1-$2")
    .replace(/\s+\d+(?:\.\d+)?\s*GHz.*$/i, "")
    .trim();
  return value;
}

function cardCpuName(cpu?: string): string | undefined {
  const value = fullCpuName(cpu);
  if (!value) return undefined;
  return value
    .replace(/^Intel\s+Core\s+/i, "")
    .replace(/^Intel\s+/i, "")
    .replace(/^AMD\s+Ryzen/i, "Ryzen")
    .replace(/^AMD\s+/i, "")
    .replace(/\s+\d+(?:st|nd|rd|th|e|eme|ème|ᵉ|áµ‰).*$/i, "")
    .trim();
}

function cpuPerformanceHint(cpu?: string, language: Locale = "ar"): string | null {
  const value = fullCpuName(cpu)?.toLowerCase() ?? "";
  if (!value) return null;

  if (/i7-(11|10)|i5-11|ryzen\s*5\s*(4|5|7)/i.test(value)) {
    return language === "ar" ? "أداء قوي وسريع" : language === "fr" ? "Performances rapides" : "Fast performance";
  }
  if (/i5-(10|8|7|6)|i7-[2345]|ryzen\s*5\s*3500/i.test(value)) {
    return language === "ar" ? "أداء قريب من i7 قديم" : language === "fr" ? "Proche d'un ancien i7" : "Close to an older i7";
  }
  if (/i5-[2345]|i3-[345]\d{3}m|i3-[345]\d{3}u/i.test(value)) {
    return language === "ar" ? "أداء قريب من i5 قديم" : language === "fr" ? "Proche d'un ancien i5" : "Close to an older i5";
  }
  if (/i3|a9|a10|a6|athlon/i.test(value)) {
    return language === "ar" ? "أفضل من Pentium و Celeron" : language === "fr" ? "Mieux que Pentium/Celeron" : "Better than Pentium/Celeron";
  }
  if (/pentium/i.test(value)) {
    return language === "ar" ? "أفضل من Celeron" : language === "fr" ? "Mieux que Celeron" : "Better than Celeron";
  }
  if (/celeron|e1|dual-core/i.test(value)) {
    return language === "ar" ? "للدراسة والتصفح" : language === "fr" ? "Pour études et navigation" : "For study and browsing";
  }
  return null;
}

function compactModelName(product: Product, brandName: string, specs: ReturnType<typeof extractLaptopSpecs>, language: Locale): string {
  const names = [product.name.en, product.name.fr, product.name.ar, getLocalizedText(product.name, language)].filter(Boolean);
  const rawName = names.find((name) => /[A-Za-z0-9]/.test(name)) || names[0] || brandName;
  const normalized = rawName
    .replace(/\s+/g, " ")
    .replace(/[|]+/g, " – ")
    .trim();

  const modelPatterns = [
    /\bLenovo\s+ThinkPad\s+[A-Z]?\d+[A-Z0-9-]*/i,
    /\bThinkPad\s+[A-Z]?\d+[A-Z0-9-]*/i,
    /\bLenovo\s+IdeaPad(?:\s+Slim)?(?:\s+[A-Z0-9-]+)?/i,
    /\bDell\s+Latitude\s+\d+[A-Z0-9-]*/i,
    /\bLatitude\s+\d+[A-Z0-9-]*/i,
    /\bHP\s+(?:ProBook|Pavilion|EliteBook|ProtectSmart)\s*[A-Z0-9-]*/i,
    /\b(?:ProBook|Pavilion|EliteBook|ProtectSmart)\s*[A-Z0-9-]*/i,
    /\bAcer\s+Aspire(?:\s+[A-Z0-9-]+){0,2}/i,
    /\bAspire\s+[A-Z0-9-]+/i,
    /\bASUS\s+[A-Z]\d+[A-Z0-9-]*/i,
    /\beMachines\s+[A-Z]\d+[A-Z0-9-]*/i,
    /\bMSI\s+[A-Z]+\d+[A-Z0-9-]*/i,
    /\bSony\s+VAIO(?:\s+\w+)?/i,
    /\bFujitsu\s+LIFEBOOK\s+[A-Z0-9-]+/i,
    /\bPACKARD\s+BELL(?:\s+[A-Z0-9-]+)?/i,
    /\bToshiba\s+[A-Z0-9-]+/i,
  ];

  for (const pattern of modelPatterns) {
    const match = normalized.match(pattern);
    if (match?.[0]) return match[0].replace(/\s+[-–]\s*$/g, "").trim();
  }

  const firstSegment = normalized.split(/\s+[–-]\s+|\s+\|\s+/)[0]?.trim();
  if (firstSegment && firstSegment.length > 4 && firstSegment.toLowerCase() !== brandName.toLowerCase()) {
    return firstSegment.length > 34 ? `${firstSegment.slice(0, 31).trim()}...` : firstSegment;
  }

  const cpu = specs?.cpu ? ` ${specs.cpu}` : "";
  return `${brandName}${cpu}`.trim();
}

function explicitCpuHint(product: Product): string | null {
  const specs = (product.specifications as Record<string, string> | undefined) ?? {};
  const entry = Object.entries(specs).find(([key]) => /مكافئ|يعادل|أداء|equivalent|performance/i.test(key));
  return entry?.[1]?.trim() || null;
}

function hasDedicatedGpu(gpu?: string): boolean {
  if (!gpu) return false;
  return /nvidia|geforce|radeon|ati/i.test(gpu) && !/intel|حسب المعالج/i.test(gpu);
}

function hasDoubleGraphics(product: Product, specs: ReturnType<typeof extractLaptopSpecs>): boolean {
  if (!specs?.gpu || !hasDedicatedGpu(specs.gpu)) return false;
  const allText = `${product.name.ar} ${product.name.fr} ${product.name.en} ${Object.values(product.specifications ?? {}).join(" ")}`;
  return /intel|core\s+i[3579]|pentium|celeron/i.test(allText) || /intel\s+(hd|uhd|iris)/i.test(allText);
}

function compactGpuName(gpu?: string): string | null {
  if (!gpu) return null;
  return gpu
    .replace(/Intel\s+HD\s+Graphics/i, "Intel HD")
    .replace(/AMD\s+Radeon\s+Graphics.*/i, "AMD Radeon")
    .replace(/\s+/g, " ")
    .trim();
}

function laptopUseCases(specs: ReturnType<typeof extractLaptopSpecs>, doubleGraphics: boolean, language: Locale): string[] {
  if (!specs) return [];
  const cpu = fullCpuName(specs.cpu)?.toLowerCase() ?? "";
  const hasSsd = /ssd|nvme/i.test(specs.storage ?? "");
  const screenValue = parseFloat(specs.screen ?? "0") || 0;
  const strongCpu = /i[57]-|ryzen\s*5|i3-8|i3-10|i3-11/i.test(cpu);
  const basicCpu = /celeron|pentium|e1|dual-core/i.test(cpu);
  const labels = {
    study: language === "ar" ? "دراسة وتصفح" : language === "fr" ? "Etudes & navigation" : "Study & browsing",
    daily: language === "ar" ? "عمل وبرامج يومية" : language === "fr" ? "Travail quotidien" : "Daily work",
    graphics: language === "ar" ? "تصميم وبرامج رسومية" : language === "fr" ? "Design & graphisme" : "Design & graphics",
    fast: language === "ar" ? "فتح سريع للبرامج" : language === "fr" ? "Ouverture rapide" : "Fast app opening",
    large: language === "ar" ? "شاشة كبيرة مريحة" : language === "fr" ? "Grand ecran confortable" : "Large comfortable screen",
    budget: language === "ar" ? "اختيار اقتصادي" : language === "fr" ? "Choix economique" : "Budget choice",
  };

  const result: string[] = [];
  result.push(strongCpu || !basicCpu ? labels.daily : labels.study);
  if (doubleGraphics || hasDedicatedGpu(specs.gpu)) result.push(labels.graphics);
  if (hasSsd) result.push(labels.fast);
  if (screenValue >= 17) result.push(labels.large);
  if (basicCpu && !hasSsd && result.length < 2) result.push(labels.budget);
  return result.slice(0, 3);
}

export function ProductCard({ product, language }: { product: Product; language: Locale }) {
  const { isWishlisted, toggleWishlist } = useApp();
  const price = product.discountPrice ?? product.basePrice;
  const brandName = typeof product.brand === "string" ? product.brand : product.brand.name;
  const hasDiscount = typeof product.discountPrice === "number" && product.discountPrice < product.basePrice;
  const discountPercent = hasDiscount ? Math.round(((product.basePrice - price) / product.basePrice) * 100) : 0;
  const wishlisted = isWishlisted(product._id);
  const soldOut = product.stock <= 0 || !!product.isSoldOut;
  const lowStock = !soldOut && product.stock > 0 && product.stock <= 5;
  const isFeatured = product.isFeatured && !soldOut;

  const laptopSpecs = extractLaptopSpecs(product);
  const modelTitle = compactModelName(product, brandName, laptopSpecs, language);
  const displayCpu = cardCpuName(laptopSpecs?.cpu);
  const doubleGraphics = hasDoubleGraphics(product, laptopSpecs);
  const useCases = laptopUseCases(laptopSpecs, doubleGraphics, language);
  const gpuName = compactGpuName(laptopSpecs?.gpu);

  return (
    <article className={`group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border transition duration-200 hover:-translate-y-0.5 ${
      isFeatured
        ? "featured-glow border-orange-400 bg-gradient-to-b from-orange-50/80 via-white to-white"
        : "border-slate-200 bg-white shadow-sm hover:border-orange-200 hover:shadow-md"
    }`}>
      <Link
        to={`/products/${product.slug}`}
        onClick={(event) => { if (soldOut) event.preventDefault(); }}
        aria-disabled={soldOut}
        className="flex flex-1 flex-col"
      >
        {/* Image */}
        <div className={`relative aspect-[1.18/1] overflow-hidden p-1.5 ${isFeatured ? "featured-shimmer bg-gradient-to-br from-orange-50 via-white to-amber-50" : "bg-slate-50"}`}>
          <img
            src={product.images[0]}
            alt={getLocalizedText(product.name, language)}
            loading="lazy"
            className={`h-full w-full object-contain transition duration-300 group-hover:scale-[1.02] ${soldOut ? "opacity-40 grayscale" : ""}`}
          />

          {/* Sold out overlay */}
          {soldOut ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-slate-900/85 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
                {translate(language, "productSoldOut")}
              </span>
            </div>
          ) : null}

          {!soldOut && (hasDiscount ? (
            <span className="absolute start-2 top-2 rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm">
              -{discountPercent}%
            </span>
          ) : lowStock ? (
            <span className="absolute start-2 top-2 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm">
              {product.stock === 1 ? (language === "ar" ? "آخر قطعة" : "Last one") : `${product.stock} فقط`}
            </span>
          ) : null)}

          {/* Wishlist */}
          <button
            type="button"
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleWishlist(product._id); }}
            aria-label={translate(language, wishlisted ? "wishlistRemove" : "wishlistAdd")}
            className={`absolute end-2 top-2 grid h-8 w-8 place-items-center rounded-full shadow-sm transition ${
              wishlisted ? "bg-rose-500 text-white" : "bg-white/90 text-slate-500 hover:bg-white hover:text-rose-500"
            }`}
          >
            <Heart className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400">{brandName}</span>
            {product.isEuropean ? (
              <span className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-700">
                🇪🇺 {language === "ar" ? "هابط كابة" : language === "fr" ? "Arrivage Europe" : "EU import"}
              </span>
            ) : null}
          </div>

          {/* Compact model name; full title stays on the detail page. */}
          <h3 className="line-clamp-1 min-h-5 text-sm font-black leading-5 text-slate-950 sm:text-[15px]">
            {modelTitle}
          </h3>

          {displayCpu ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-2 py-1.5">
              {cpuLogo(displayCpu) ? (
                <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-0.5 ring-1 ring-blue-100">
                  <img src={cpuLogo(displayCpu) ?? ""} alt={displayCpu} loading="lazy" className="h-full w-full object-contain" />
                </span>
              ) : null}
              <div className="min-w-0 flex-1">
                <div dir="ltr" className="truncate text-[12px] font-black leading-4 text-blue-800">
                  {displayCpu}
                </div>
                {gpuName ? (
                  <div dir="ltr" className="truncate text-[10px] font-bold leading-3 text-blue-600">
                    {gpuName}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {laptopSpecs && (
            <div className="flex flex-wrap gap-1.5">
              {laptopSpecs.ram && (
                <span dir="ltr" className="inline-flex items-center rounded-lg bg-sky-50 px-1.5 py-1 text-[10px] font-extrabold text-sky-700">
                  {laptopSpecs.ram}
                </span>
              )}
              {laptopSpecs.storage && (
                <span dir="ltr" className="inline-flex items-center rounded-lg bg-orange-50 px-1.5 py-1 text-[10px] font-extrabold text-orange-700">
                  {laptopSpecs.storage}
                </span>
              )}
              {laptopSpecs.screen && (
                <span dir="ltr" className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 px-1.5 py-1 text-[10px] font-extrabold text-slate-700">
                  <Monitor className="h-2.5 w-2.5" />
                  {laptopSpecs.screen}
                </span>
              )}
              {(laptopSpecs.batteryBad || laptopSpecs.batteryGood) && (
                <span className={`inline-flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-[10px] font-extrabold ring-1 ${laptopSpecs.batteryBad ? "bg-orange-50 text-orange-700 ring-orange-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}>
                  <BatteryCharging className="h-2.5 w-2.5" />
                  {laptopSpecs.batteryBad ? (language === "ar" ? "بطارية ضعيفة" : "Batterie faible") : (language === "ar" ? "بطارية جيدة" : "Batterie bonne")}
                </span>
              )}
              {doubleGraphics ? (
                <span className="inline-flex items-center rounded-lg bg-purple-50 px-1.5 py-1 text-[10px] font-extrabold text-purple-700 ring-1 ring-purple-200">
                  Double carte graphics
                </span>
              ) : null}
            </div>
          )}

          {useCases.length > 0 ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-2 py-1.5">
              <div className="mb-1 text-[10px] font-black text-emerald-700">
                {language === "ar" ? "يناسب" : language === "fr" ? "Ideal pour" : "Best for"}
              </div>
              <div className="flex flex-wrap gap-1">
                {useCases.map((useCase) => (
                  <span key={useCase} className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                    {useCase}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Real stock urgency — no fake numbers */}
          {product.stock === 1 ? (
            <div className="flex items-center gap-1 text-xs font-bold text-rose-600">
              {language === "ar" ? "آخر قطعة!" : language === "fr" ? "Dernière pièce!" : "Last one!"}
            </div>
          ) : product.stock === 2 ? (
            <div className="flex items-center gap-1 text-xs font-bold text-orange-600">
              {language === "ar" ? "قطعتان فقط" : language === "fr" ? "2 restantes" : "Only 2 left"}
            </div>
          ) : lowStock ? (
            <div className="flex items-center gap-1 text-xs font-bold text-amber-600">
              ⚡ {language === "ar" ? `${product.stock} قطع فقط` : language === "fr" ? `Plus que ${product.stock}` : `${product.stock} left`}
            </div>
          ) : null}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Price */}
          <div className={`rounded-xl border px-3 py-2 ${soldOut ? "border-slate-200 bg-slate-50" : "border-orange-100 bg-orange-50/70"}`} dir="ltr">
            <div className={`text-center text-xl font-black leading-none tracking-normal sm:text-[1.35rem] ${soldOut ? "text-slate-400" : "text-slate-950"}`}>
              {formatCurrency(price, language)}
            </div>
            {hasDiscount ? (
              <div className="mt-1 text-center text-[11px] font-bold text-slate-400 line-through">{formatCurrency(product.basePrice, language)}</div>
            ) : null}
          </div>

          {/* Availability */}
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <ShieldCheck className={`h-3.5 w-3.5 ${soldOut ? "text-slate-300" : "text-teal-600"}`} />
            <span className={soldOut ? "text-slate-400" : "text-teal-700"}>
              {soldOut ? translate(language, "productSoldOut") : translate(language, "productInStock")}
            </span>
          </div>

          {/* COD trust pill */}
          {!soldOut && (
            <div className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-bold text-emerald-800">
              <span>💵</span>
              <span>{language === "ar" ? "الدفع عند الاستلام" : language === "fr" ? "Paiement à la livraison" : "Cash on delivery"}</span>
              <span className="ms-auto text-emerald-500">✓</span>
            </div>
          )}

          {/* CTA button */}
          <div
            className={`mt-1 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full py-2 text-xs font-extrabold text-white transition ${
              soldOut
                ? "bg-slate-200 text-slate-400"
                : "bg-orange-500 shadow-sm group-hover:bg-orange-600"
            }`}
          >
            {!soldOut ? <Zap className="h-4 w-4 fill-current" /> : null}
            {soldOut
              ? translate(language, "productSoldOut")
              : translate(language, "productBuyNow")}
          </div>
        </div>
      </Link>
    </article>
  );
}
