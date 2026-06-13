import { Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";

export function NotFoundPage() {
  const { language } = useApp();

  return (
    <div className="surface-card flex flex-col items-center gap-4 p-6 text-center sm:p-10">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-500">
        <Compass className="h-8 w-8" />
      </div>
      <div className="text-sm font-bold uppercase tracking-[0.3em] text-amber-600">404</div>
      <h1 className="font-serif text-2xl font-semibold text-slate-950 sm:text-3xl">{translate(language, "notFoundTitle")}</h1>
      <p className="max-w-xl text-sm leading-7 text-slate-600">{translate(language, "notFoundDescription")}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link to="/" className="primary-button">
          {translate(language, "notFoundHome")}
        </Link>
        <Link to="/products" className="ghost-button">
          {translate(language, "notFoundProducts")}
        </Link>
      </div>
    </div>
  );
}
