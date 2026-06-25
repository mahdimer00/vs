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
  maxPrice: number;
  condition: "all" | "NEW" | "USED";
  inStockOnly: boolean;
  onSaleOnly: boolean;
  sort: SortOption;
}

function activeFilterCount(state: ProductFilterState): number {
  let count = 0;
  if (state.search) count++;
  if (state.category !== "all") count++;
  if (state.brand !== "all") count++;
  if (state.maxPrice < 500000) count++;
  if (state.condition !== "all") count++;
  if (state.inStockOnly) count++;
  if (state.onSaleOnly) count++;
  return count;
}

export const DEFAULT_FILTERS: ProductFilterState = {
  search: "", category: "all", brand: "all", maxPrice: 500000,
  condition: "all", inStockOnly: false, onSaleOnly: false, sort: "default",
};

export function ProductFilters({
  categories, brands, state, language, onChange,
}: {
  categories: Array<{ value: string; label: string }>;
  brands: string[];
  state: ProductFilterState;
  language: Locale;
  onChange: (value: ProductFilterState) => void;
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
        <div className="p-4 pt-0 sm:p-5 sm:pt-0 md:p-5">
          <div className="mb-4 hidden md:flex md:flex-wrap md:items-center md:justify-between md:gap-3">
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

          {/* Row 2: price + quick filter chips */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 px-4 py-2.5 flex-1 min-w-[180px]">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
                <span>{translate(language, "filtersPrice")}</span>
                <span className="font-semibold text-slate-900">{formatCurrency(state.maxPrice, language)}</span>
              </div>
              <input type="range" min={10000} max={500000} step={5000} value={state.maxPrice}
                onChange={(e) => onChange({ ...state, maxPrice: Number(e.target.value) })} className="w-full accent-teal-600" />
            </div>

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
            <button type="button" onClick={() => { onChange(DEFAULT_FILTERS); setOpen(false); }} className="ghost-button mt-4 gap-2">
              <RotateCcw className="h-4 w-4" />
              {translate(language, "filtersReset")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
