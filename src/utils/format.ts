import type { Locale, LocalizedText, ProductVariant } from "@/types";

const localeMap: Record<Locale, string> = {
  ar: "ar-DZ",
  fr: "fr-DZ",
  en: "en-DZ",
};

export function formatCurrency(value: number, language: Locale = "fr"): string {
  return `${new Intl.NumberFormat(localeMap[language]).format(value)} DZD`;
}

/**
 * Algerians commonly read large prices using the pre-1964 currency scale
 * (1 dinar = 100 of the old unit), e.g. 1000 DA is said as "100 ألف".
 * Returns a short Arabic phrase like "2 مليون و 100 ألف", or null when the
 * amount is too small to be worth converting or the locale isn't Arabic.
 */
export function formatLegacyDinarHint(value: number, language: Locale): string | null {
  if (language !== "ar") {
    return null;
  }

  const legacyValue = Math.round(value * 100);
  if (legacyValue < 1000) {
    return null;
  }

  const millions = Math.floor(legacyValue / 1_000_000);
  const thousands = Math.floor((legacyValue % 1_000_000) / 1000);
  const parts: string[] = [];
  if (millions > 0) {
    parts.push(`${millions} مليون`);
  }
  if (thousands > 0) {
    parts.push(`${thousands} ألف`);
  }

  return parts.length > 0 ? parts.join(" و ") : null;
}

export function getLocalizedText(value: LocalizedText, language: Locale): string {
  return value[language] || value.en || value.fr || value.ar;
}

export function isRTL(language: Locale): boolean {
  return language === "ar";
}

export function buildVariantLabel(variant: ProductVariant): string {
  return [variant.ram, variant.storage, variant.color].filter(Boolean).join(" / ") || variant.sku;
}

export function formatDate(value: string, language: Locale = "fr"): string {
  return new Intl.DateTimeFormat(localeMap[language], {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
