import ar from "@/locales/ar.json";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import type { Locale } from "@/types";

const dictionaries = { ar, fr, en } as const;
export type TranslationKey = keyof typeof en;

export function translate(language: Locale, key: TranslationKey): string {
  return dictionaries[language][key] ?? dictionaries.en[key] ?? key;
}

export function translateStatus(language: Locale, status: string): string {
  return translate(language, `status_${status}` as TranslationKey);
}
