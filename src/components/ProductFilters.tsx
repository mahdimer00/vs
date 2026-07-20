import { ChevronDown, ChevronUp, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import type { Locale } from "@/types";
import { formatCurrency } from "@/utils/format";
import { translate } from "@/utils/i18n";

export type SortOption = "default" | "newest" | "price_asc" | "price_desc" | "name";

export interface ProductFilterState {
  search: string;
  category: string;
  brand: string;
  minPrice: number;
  maxPrice: number;
  condition: "all" | "NEW" | "USED";
  inStockOnly: boolean;
  onSaleOnly: boolean;
  sort: SortOption;
  cpu: string;
  ram: string;
  screen: string;
}

function activeFilterCount(state: ProductFilterState): number {
  let count = 0;
  if (state.search) count++;
  if (state.category !== "all") count++;
  if (state.brand !== "all") count++;
  if (state.maxPrice < 500000 || state.minPrice > 0) count++;
  if (state.condition !== "all") count++;
  if (state.inStockOnly) count++;
  if (state.onSaleOnly) count++;
  if (state.cpu !== "all") count++;
  if (state.ram !== "all") count++;
  if (state.screen !== "all") count++;
  return count;
}

export const DEFAULT_FILTERS: ProductFilterState = {
  search: "", category: "all", brand: "all",
  minPrice: 0, maxPrice: 500000,
  condition: "all", inStockOnly: false, onSaleOnly: false, sort: "default",
  cpu: "all", ram: "all", screen: "all",
};

type ChipOption = { value: string; label: string };

function ChipRow({ label, options, value, onChange }: {
  label: string; options: ChipOption[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              value === o.value
                ? "border-teal-500 bg-teal-600 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const PRICE_PRESETS = [
  { label: "كل الأسعار", min: 0, max: 500000 },
  { label: "أقل من 3 مليون", min: 0, max: 30000 },
  { label: "3 – 5 مليون", min: 30000, max: 50000 },
  { label: "5 – 8 مليون", min: 50000, max: 80000 },
  { label: "8 – 12 مليون", min: 80000, max: 120000 },
  { label: "أكثر من 12 مليون", min: 120000, max: 500000 },
];

export function ProductFilters({
  categories, brands, state, language, onChange, showLaptopFilters,
}: {
  categories: Array<{ value: string; label: string }>;
  brands: string[];
  state: ProductFilterState;
  language: Locale;
  onChange: (value: ProductFilterState) => void;
  showLaptopFilters?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const active = activeFilterCount(state);
  const isAr = language === "ar";

  const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
    { value: "default", label: isAr ? "الافتراضي" : language === "fr" ? "Par défaut" : "Default" },
    { value: "newest", label: isAr ? "الأحدث" : language === "fr" ? "Plus récent" : "Newest" },
    { value: "price_asc", label: isAr ? "السعر: الأقل" : language === "fr" ? "Prix croissant" : "Price: Low→High" },
    { value: "price_desc", label: isAr ? "السعر: الأعلى" : language === "fr" ? "Prix décroissant" : "Price: High→Low" },
    { value: "name", label: isAr ? "الاسم" : language === "fr" ? "Nom" : "Name A→Z" },
  ];

  const CPU_OPTIONS: ChipOption[] = [
    { value: "all", label: isAr ? "كل المعالجات" : "All CPUs" },
    { value: "i3", label: "Core i3" },
    { value: "i5", label: "Core i5" },
    { value: "i7", label: "Core i7" },
    { value: "i9", label: "Core i9" },
    { value: "ryzen5", label: "Ryzen 5" },
    { value: "ryzen7", label: "Ryzen 7" },
  ];

  const RAM_OPTIONS: ChipOption[] = [
    { value: "all", label: isAr ? "كل الذاكرة" : "All RAM" },
    { value: "4", label: "4 GB" },
    { value: "8", label: "8 GB" },
    { value: "16", label: "16 GB" },
    { value: "32", label: "32 GB" },
  ];

  const SCREEN_OPTIONS: ChipOption[] = [
    { value: "all", label: isAr ? "كل الأحجام" : "All sizes" },
    { value: "13", label: '13"' },
    { value: "14", label: '14"' },
    { value: "15", label: '15.6"' },
    { value: "17", label: '17"' },
  ];

  const activePricePreset = PRICE_PRESETS.find(
    (p) => p.min === state.minPrice && p.max === state.maxPrice,
  ) ?? null;

  return (
    <div className="surface-card overflow-hidden">
      {/* Active filter badges */}
      {active > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-4 sm:px-5">
          {state.search && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
              "{state.search}"
              <button onClick={() => onChange({ ...state, search: "" })}><X className="h-3 w-3" /></button>
            </span>
          )}
          {state.category !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
              {categories.find(c => c.value === state.category)?.label ?? state.category}
              <button onClick={() => onChange({ ...state, category: "all" })}><X className="h-3 w-3" /></button>
            </span>
          )}
          {state.brand !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
              {state.brand}
              <button onClick={() => onChange({ ...state, brand: "all" })}><X className="h-3 w-3" /></button>
            </span>
          )}
          {state.cpu !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
              {CPU_OPTIONS.find(o => o.value === state.cpu)?.label ?? state.cpu}
              <button onClick={() => onChange({ ...state, cpu: "all" })}><X className="h-3 w-3" /></button>
            </span>
          )}
          {state.ram !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
              RAM {state.ram} GB
              <button onClick={() => onChange({ ...state, ram: "all" })}><X className="h-3 w-3" /></button>
            </span>
          )}
          {state.screen !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
              {state.screen}"
              <button onClick={() => onChange({ ...state, screen: "all" })}><X className="h-3 w-3" /></button>
            </span>
          )}
          {(state.maxPrice < 500000 || state.minPrice > 0) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              {activePricePreset?.label ?? `${formatCurrency(state.minPrice, language)} – ${formatCurrency(state.maxPrice, language)}`}
              <button onClick={() => onChange({ ...state, minPrice: 0, maxPrice: 500000 })}><X className="h-3 w-3" /></button>
            </span>
          )}
          {state.condition !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              {state.condition === "NEW" ? (isAr ? "جديد" : "New") : (isAr ? "مستعمل" : "Used")}
              <button onClick={() => onChange({ ...state, condition: "all" })}><X className="h-3 w-3" /></button>
            </span>
          )}
          {state.inStockOnly && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              {isAr ? "متوفر فقط" : "In stock"}
              <button onClick={() => onChange({ ...state, inStockOnly: false })}><X className="h-3 w-3" /></button>
            </span>
          )}
          {state.onSaleOnly && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">
              {isAr ? "تخفيضات فقط" : "On sale"}
              <button onClick={() => onChange({ ...state, onSaleOnly: false })}><X className="h-3 w-3" /></button>
            </span>
          )}
          <button onClick={() => onChange(DEFAULT_FILTERS)} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">
            <RotateCcw className="h-3 w-3" />
            {isAr ? "مسح الكل" : "Clear all"}
          </button>
        </div>
      )}

      {/* Mobile toggle */}
      <button type="button" onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between gap-3 p-4 sm:p-5 md:hidden" aria-expanded={open}>
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal className="h-4 w-4 text-teal-600" />
          <span className="text-sm font-semibold text-slate-900">{translate(language, "filtersTitle")}</span>
          {active > 0 && <span className="grid h-5 w-5 place-items-center rounded-full bg-teal-600 text-[11px] font-bold text-white">{active}</span>}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {/* Filters body */}
      <div className={`${open ? "block" : "hidden"} md:block`}>
        <div className="p-4 pt-0 sm:p-5 sm:pt-0 md:p-5 space-y-4">
          <div className="mb-1 hidden md:flex md:flex-wrap md:items-center md:justify-between md:gap-3 md:pt-1">
            <div className="text-sm font-semibold text-slate-950">{translate(language, "filtersTitle")}</div>
          </div>

          {/* Row 1: search, category, brand, sort */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input value={state.search} onChange={(e) => onChange({ ...state, search: e.target.value })}
              placeholder={translate(language, "filtersSearchPlaceholder")} className="field-input" />
            <select value={state.category} onChange={(e) => onChange({ ...state, category: e.target.value })} className="field-select">
              <option value="all">{translate(language, "filtersCategoryAll")}</option>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={state.brand} onChange={(e) => onChange({ ...state, brand: e.target.value })} className="field-select">
              <option value="all">{translate(language, "filtersBrandAll")}</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={state.sort} onChange={(e) => onChange({ ...state, sort: e.target.value as SortOption })} className="field-select">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Price range chips — shown for all, but especially useful for laptops */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isAr ? "نطاق السعر (1 مليون = 10,000 دج)" : "Price range"}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRICE_PRESETS.map((preset) => {
                const isActive = state.minPrice === preset.min && state.maxPrice === preset.max;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onChange({ ...state, minPrice: preset.min, maxPrice: preset.max })}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? "border-teal-500 bg-teal-600 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Laptop-specific filters */}
          {showLaptopFilters && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-700">
                💻 {isAr ? "فلترة متخصصة للحواسيب المحمولة" : "Laptop specific filters"}
              </div>

              <ChipRow
                label={isAr ? "المعالج (CPU)" : "Processor"}
                options={CPU_OPTIONS}
                value={state.cpu}
                onChange={(v) => onChange({ ...state, cpu: v })}
              />

              <ChipRow
                label={isAr ? "الذاكرة العشوائية (RAM)" : "RAM"}
                options={RAM_OPTIONS}
                value={state.ram}
                onChange={(v) => onChange({ ...state, ram: v })}
              />

              <ChipRow
                label={isAr ? "حجم الشاشة" : "Screen size"}
                options={SCREEN_OPTIONS}
                value={state.screen}
                onChange={(v) => onChange({ ...state, screen: v })}
              />
            </div>
          )}

          {/* Condition + quick toggles */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Condition chips */}
            <div className="flex flex-wrap gap-2">
              {(["all", "NEW", "USED"] as const).map((c) => (
                <button key={c} type="button" onClick={() => onChange({ ...state, condition: c })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${state.condition === c ? "border-teal-500 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                  {c === "all" ? (isAr ? "الكل" : "All") : c === "NEW" ? (isAr ? "جديد" : "New") : (isAr ? "مستعمل" : "Used")}
                </button>
              ))}
              <button type="button" onClick={() => onChange({ ...state, inStockOnly: !state.inStockOnly })}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${state.inStockOnly ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                {isAr ? "متوفر فقط" : "In stock"}
              </button>
              <button type="button" onClick={() => onChange({ ...state, onSaleOnly: !state.onSaleOnly })}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${state.onSaleOnly ? "border-rose-400 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                {isAr ? "تخفيضات" : "On sale"}
              </button>
            </div>
          </div>

          {active > 0 && (
            <button type="button" onClick={() => { onChange(DEFAULT_FILTERS); setOpen(false); }} className="ghost-button gap-2">
              <RotateCcw className="h-4 w-4" />
              {translate(language, "filtersReset")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
