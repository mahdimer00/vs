import { translate } from "@/utils/i18n";
import { useApp } from "@/hooks/useApp";

export function LoadingState({ label }: { label?: string }) {
  const { language } = useApp();

  return (
    <div className="surface-card mx-auto max-w-3xl p-6">
      <div className="grid gap-4">
        <div className="skeleton h-6 w-40" />
        <div className="skeleton h-28 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="skeleton h-28 w-full" />
          <div className="skeleton h-28 w-full" />
          <div className="skeleton h-28 w-full" />
        </div>
        <p className="text-sm font-medium text-slate-500">{label || translate(language, "loading")}</p>
      </div>
    </div>
  );
}
