import { Languages } from "lucide-react";
import type { Locale } from "@/types";

export function LanguageSwitcher({
  value,
  onChange,
}: {
  value: Locale;
  onChange: (value: Locale) => void;
}) {
  return (
    <label className="relative inline-flex items-center">
      <Languages className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <select
        className="rounded-full border border-slate-200 bg-white/90 py-2 ps-9 pe-9 text-sm font-medium text-slate-900 outline-none backdrop-blur transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/12"
        value={value}
        onChange={(event) => onChange(event.target.value as Locale)}
      >
        <option value="ar">العربية</option>
        <option value="fr">Français</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
