import type { Locale } from "@/types";
import { translateStatus } from "@/utils/i18n";

export function StatusBadge({ label, language = "en" }: { label: string; language?: Locale }) {
  const tone =
    label.includes("DELIVER") || label.includes("PAID") || label.includes("ACTIVE")
      ? "bg-emerald-100 text-emerald-700"
      : label.includes("CANCEL") || label.includes("BLOCK") || label.includes("REJECT") || label.includes("FAILED")
        ? "bg-rose-100 text-rose-700"
        : "bg-amber-100 text-amber-700";

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{translateStatus(language, label)}</span>;
}
