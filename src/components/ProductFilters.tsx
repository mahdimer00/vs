import { RotateCcw, SlidersHorizontal } from "lucide-react";
import type { Locale } from "@/types";
import { formatCurrency } from "@/utils/format";
import { translate } from "@/utils/i18n";

export interface ProductFilterState {
  search: string;
  category: string;
  brand: string;
  maxPrice: number;
}

export function ProductFilters({
  categories,
  brands,
  state,
  language,
  onChange,
}: {
  categories: Array<{ value: string; label: string }>;
  brands: string[];
  state: ProductFilterState;
  language: Locale;
  onChange: (value: ProductFilterState) => void;
}) {
  return (
    <div className="surface-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-950">{translate(language, "filtersTitle")}</div>
          <div className="mt-1 text-sm text-slate-500">{translate(language, "filtersMobileHint")}</div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          <SlidersHorizontal className="h-4 w-4" />
          {translate(language, "filtersTitle")}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <input
          value={state.search}
          onChange={(event) => onChange({ ...state, search: event.target.value })}
          placeholder={translate(language, "filtersSearchPlaceholder")}
          className="field-input"
        />
        <select
          value={state.category}
          onChange={(event) => onChange({ ...state, category: event.target.value })}
          className="field-select"
        >
          <option value="all">{translate(language, "filtersCategoryAll")}</option>
          {categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
        <select
          value={state.brand}
          onChange={(event) => onChange({ ...state, brand: event.target.value })}
          className="field-select"
        >
          <option value="all">{translate(language, "filtersBrandAll")}</option>
          {brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 px-4 py-3">
          <div className="mb-3 flex items-center justify-between text-sm text-slate-600">
            <span>{translate(language, "filtersPrice")}</span>
            <span className="font-semibold text-slate-900">{formatCurrency(state.maxPrice, language)}</span>
          </div>
          <input
            type="range"
            min={10000}
            max={500000}
            step={5000}
            value={state.maxPrice}
            onChange={(event) => onChange({ ...state, maxPrice: Number(event.target.value) })}
            className="w-full accent-teal-600"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onChange({ search: "", category: "all", brand: "all", maxPrice: 500000 })}
        className="ghost-button mt-4 gap-2"
      >
        <RotateCcw className="h-4 w-4" />
        {translate(language, "filtersReset")}
      </button>
    </div>
  );
}
