import { Check, Phone, Truck } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { useApp } from "@/hooks/useApp";
import { formatCurrency } from "@/utils/format";
import { translate } from "@/utils/i18n";

export function OrderSuccessPage() {
  const { confirmedOrder, language, pendingOrder, rememberPendingOrder } = useApp();
  const order = confirmedOrder as { orderNumber?: string; total?: number } | null;

  useEffect(() => {
    if (pendingOrder) {
      rememberPendingOrder(null);
    }
  }, [pendingOrder, rememberPendingOrder]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Seo title={translate(language, "orderSuccessTitle")} description={translate(language, "orderSuccessDescription")} path="/order/success" noindex />
      <div className="surface-card overflow-hidden p-6 text-center sm:p-8">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="h-10 w-10" />
        </div>
        <h1 className="mt-6 font-serif text-2xl font-semibold text-slate-950 sm:text-3xl md:text-4xl">{translate(language, "orderSuccessTitle")}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          {translate(language, "orderSuccessDescription")} {order?.orderNumber ? `#${order.orderNumber}` : ""}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.35rem] bg-slate-50 px-4 py-4 text-start">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{translate(language, "trackByOrderNumber")}</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{order?.orderNumber || "--"}</div>
          </div>
          <div className="rounded-[1.35rem] bg-slate-50 px-4 py-4 text-start">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{translate(language, "adminOrderTotal")}</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{order?.total ? formatCurrency(order.total, language) : "--"}</div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/products" className="primary-button">
            {translate(language, "continueShopping")}
          </Link>
          <Link to="/track-order" className="ghost-button">
            {translate(language, "trackThisOrder")}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="surface-card flex items-start gap-4 p-5">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-teal-100 text-teal-700">
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-950">{translate(language, "phone")}</div>
            <p className="mt-1 text-sm leading-7 text-slate-600">{translate(language, "orderSuccessDescription")}</p>
          </div>
        </div>
        <div className="surface-card flex items-start gap-4 p-5">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-amber-100 text-amber-700">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-950">{translate(language, "trackOrder")}</div>
            <p className="mt-1 text-sm leading-7 text-slate-600">{translate(language, "trackDescription")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
