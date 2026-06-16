import { ChevronDown, ChevronUp, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { Locale } from "@/types";
import { formatCurrency } from "@/utils/format";
import { translate } from "@/utils/i18n";

export interface ProductFilterState {
  search: string;
  category: string;
  brand: string;
  maxPrice: number;
}

function activeFilterCount(state: ProductFilterState): number {
  let count = 0;
  if (state.search) count++;
  if (state.category !== "all") count++;
  if (state.brand !== "all") count++;
  if (state.maxPrice < 500000) count++;
  return count;
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
  const [open, setOpen] = useState(false);
  const active = activeFilterCount(state);

  return (
    <div className="surface-card overflow-hidden">
      {/* Toggle row — always visible */}
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-center justify-between gap-3 p-4 sm:p-5 md:hidden"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal className="h-4 w-4 text-teal-600" />
          <span className="text-sm font-semibold text-slate-900">{translate(language, "filtersTitle")}</span>
          {active > 0 ? (
            <span className="grid h-5 w-5 place-items-center rounded-full bg-teal-600 text-[11px] font-bold text-white">{active}</span>
          ) : null}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {/* Filters body — collapsed on mobile, always open on md+ */}
      <div className={`${open ? "block" : "hidden"} md:block`}>
        <div className="p-4 pt-0 sm:p-5 sm:pt-0 md:p-5">
          {/* Desktop header */}
          <div className="mb-4 hidden md:flex md:flex-wrap md:items-center md:justify-between md:gap-3">
            <div className="text-sm font-semibold text-slate-950">{translate(language, "filtersTitle")}</div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            onClick={() => { onChange({ search: "", category: "all", brand: "all", maxPrice: 500000 }); setOpen(false); }}
            className="ghost-button mt-4 gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            {translate(language, "filtersReset")}
          </button>
        </div>
      </div>
    </div>
  );
}
