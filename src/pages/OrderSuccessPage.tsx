import { Check } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
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
    <div className="mx-auto max-w-2xl surface-card p-8 text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="h-10 w-10" />
      </div>
      <h1 className="mt-6 font-serif text-4xl font-semibold text-slate-950">{translate(language, "orderSuccessTitle")}</h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        {translate(language, "orderSuccessDescription")} {order?.orderNumber ? `#${order.orderNumber}` : ""}
      </p>
      {order?.total ? (
        <div className="mt-6 text-xl font-semibold text-slate-950">{formatCurrency(order.total, language)}</div>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/products" className="primary-button">
          {translate(language, "continueShopping")}
        </Link>
        <Link to="/track-order" className="ghost-button">
          {translate(language, "trackThisOrder")}
        </Link>
      </div>
    </div>
  );
}
