import { Hash, Phone, Search, Truck } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { IconField } from "@/components/IconField";
import { Seo } from "@/components/Seo";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/hooks/useApp";
import { orderService } from "@/services/order.service";
import type { Order } from "@/types";
import { formatCurrency, getLocalizedText } from "@/utils/format";
import { translate } from "@/utils/i18n";

export function TrackOrderPage() {
  const { language } = useApp();
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");

  const reset = () => {
    setOrder(null);
    setError("");
  };

  const search = async () => {
    if (!orderNumber.trim() || !phone.trim()) {
      return;
    }

    try {
      reset();
      setOrder(await orderService.trackOrder(orderNumber.trim(), phone.trim()));
    } catch (searchError) {
      setOrder(null);
      setError(searchError instanceof Error ? searchError.message : "Order not found");
    }
  };

  const orderDetail = (current: Order) => (
    <div className="space-y-6">
      <div className="surface-card p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-slate-500">{translate(language, "trackOrder")}</div>
            <div className="text-2xl font-semibold text-slate-950">{current.orderNumber}</div>
          </div>
          <StatusBadge label={current.status} language={language} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="muted-card p-4">
            <div className="text-sm text-slate-500">{translate(language, "adminOrderCustomer")}</div>
            <div className="mt-2 font-semibold text-slate-950">{current.customer.fullName}</div>
          </div>
          <div className="muted-card p-4">
            <div className="text-sm text-slate-500">{translate(language, "adminOrderTotal")}</div>
            <div className="mt-2 font-semibold text-slate-950">{formatCurrency(current.total, language)}</div>
          </div>
          <div className="muted-card p-4">
            <div className="text-sm text-slate-500">{translate(language, "wilaya")}</div>
            <div className="mt-2 font-semibold text-slate-950">
              {typeof current.customer.wilaya === "string"
                ? current.customer.wilaya
                : language === "ar"
                  ? current.customer.wilaya.name.ar
                  : language === "fr"
                    ? current.customer.wilaya.name.fr
                    : current.customer.wilaya.name.en}
            </div>
          </div>
          <div className="muted-card p-4">
            <div className="text-sm text-slate-500">{translate(language, "deliveryType")}</div>
            <div className="mt-2 inline-flex items-center gap-2 font-semibold text-slate-950">
              <Truck className="h-4 w-4 text-teal-700" />
              {current.deliveryType}
            </div>
          </div>
        </div>
      </div>

      <div className="surface-card p-6">
        <h2 className="text-lg font-semibold text-slate-950">{translate(language, "adminOrderItems")}</h2>
        <div className="mt-4 space-y-3">
          {current.items.map((item) => (
            <div key={`${item.productId}-${item.variantId || item.variantLabel}`} className="rounded-[1.35rem] border border-slate-200 bg-slate-50/85 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-slate-950">{getLocalizedText(item.productName, language)}</div>
                  <div className="mt-1 text-sm text-slate-500">{item.variantLabel}</div>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  x{item.quantity} · {formatCurrency(item.lineTotal, language)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Seo title={translate(language, "trackTitle")} description={translate(language, "trackDescription")} path="/track-order" />
      <div className="surface-card overflow-hidden p-0">
        <div className="bg-[linear-gradient(135deg,_#fff7ed,_#ffffff_35%,_#eff6ff)] p-6 md:p-8">
          <h1 className="font-serif text-2xl font-semibold text-slate-950 sm:text-3xl md:text-4xl">{translate(language, "trackTitle")}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{translate(language, "trackDescription")}</p>

          <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
            <IconField icon={Hash}>
              <input
                value={orderNumber}
                onChange={(event) => setOrderNumber(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void search();
                  }
                }}
                className="field-input field-input-icon w-full uppercase"
                placeholder={translate(language, "trackPlaceholder")}
              />
            </IconField>
            <IconField icon={Phone}>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void search();
                  }
                }}
                className="field-input field-input-icon w-full"
                placeholder={translate(language, "trackPhonePlaceholder")}
              />
            </IconField>
            <button onClick={() => void search()} className="primary-button gap-2">
              <Search className="h-4 w-4" />
              {translate(language, "trackSearch")}
            </button>
          </div>
          {error ? <div className="mt-3 text-sm text-rose-600">{error}</div> : null}
        </div>
      </div>

      {order ? orderDetail(order) : <EmptyState title={translate(language, "trackEmptyTitle")} description={translate(language, "trackEmptyDescription")} />}
    </div>
  );
}
