import { ArrowLeft, Phone, Search, Truck } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { IconField } from "@/components/IconField";
import { Seo } from "@/components/Seo";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/hooks/useApp";
import { orderService } from "@/services/order.service";
import type { Order } from "@/types";
import { formatCurrency, formatDate, getLocalizedText } from "@/utils/format";
import { translate } from "@/utils/i18n";

export function TrackOrderPage() {
  const { language } = useApp();
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [phoneResults, setPhoneResults] = useState<Order[] | null>(null);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);

  const reset = () => {
    setOrder(null);
    setPhoneResults(null);
    setError("");
  };

  const search = async () => {
    if (!phone.trim() || searching) {
      return;
    }

    setSearching(true);
    try {
      reset();
      const results = await orderService.trackOrdersByPhone(phone.trim());
      setPhoneResults(results);
      if (results.length === 0) {
        setError(translate(language, "trackPhoneEmptyDescription"));
      }
    } catch (searchError) {
      setPhoneResults(null);
      setError(searchError instanceof Error ? searchError.message : "Unable to search orders");
    } finally {
      setSearching(false);
    }
  };

  const orderDetail = (current: Order) => (
    <div className="space-y-6">
      <div className="surface-card p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            {phoneResults ? (
              <button onClick={() => setOrder(null)} className="ghost-button mb-3 gap-2">
                <ArrowLeft className="h-4 w-4" />
                {translate(language, "trackByPhone")}
              </button>
            ) : null}
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
              {current.deliveryType === "HOME_DELIVERY" ? translate(language, "homeDelivery") : translate(language, "deskPickup")}
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

  const phoneList = (results: Order[]) => (
    <div className="space-y-4">
      {results.map((entry) => (
        <button
          key={entry._id}
          onClick={() => setOrder(entry)}
          className="surface-card flex w-full flex-col gap-3 p-5 text-start transition hover:border-teal-300 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="text-lg font-semibold text-slate-950">{entry.orderNumber}</div>
            <div className="mt-1 text-sm text-slate-500">{formatDate(entry.createdAt, language)}</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-lg font-semibold text-slate-950">{formatCurrency(entry.total, language)}</div>
            <StatusBadge label={entry.status} language={language} />
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Seo title={translate(language, "trackTitle")} description={translate(language, "trackDescription")} path="/track-order" />
      <div className="surface-card overflow-hidden p-0">
        <div className="bg-[linear-gradient(135deg,_#fff7ed,_#ffffff_35%,_#eff6ff)] p-6 md:p-8">
          <h1 className="font-serif text-2xl font-semibold text-slate-950 sm:text-3xl md:text-4xl">{translate(language, "trackTitle")}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{translate(language, "trackDescription")}</p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <IconField icon={Phone} className="flex-1">
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
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
            <button onClick={() => void search()} disabled={searching} className="primary-button gap-2 disabled:opacity-60">
              <Search className={`h-4 w-4 ${searching ? "animate-spin" : ""}`} />
              {searching ? (translate(language, "loading")) : translate(language, "trackSearch")}
            </button>
          </div>
          {error ? <div className="mt-3 text-sm text-rose-600">{error}</div> : null}
        </div>
      </div>

      {order ? (
        orderDetail(order)
      ) : phoneResults && phoneResults.length > 0 ? (
        phoneList(phoneResults)
      ) : (
        <EmptyState title={translate(language, "trackEmptyTitle")} description={translate(language, "trackEmptyDescription")} />
      )}
    </div>
  );
}
