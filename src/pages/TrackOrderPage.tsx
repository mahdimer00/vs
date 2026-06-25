import { ArrowLeft, CheckCircle2, Clock, Phone, Search, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { IconField } from "@/components/IconField";
import { Seo } from "@/components/Seo";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/hooks/useApp";
import { orderService } from "@/services/order.service";
import type { Order } from "@/types";
import { formatCurrency, formatDate, getLocalizedText } from "@/utils/format";
import { translate } from "@/utils/i18n";

interface ZREvent {
  state: string;
  stateAr: string;
  date: string;
}

const ZR_STATE_AR: Record<string, string> = {
  "order received": "تم استلام الطلب",
  "order in process": "الطلب قيد المعالجة",
  "confirmation call": "مكالمة تأكيد العميل",
  "order confirmed": "تم تأكيد الطلب",
  "ready to ship": "جاهز للشحن",
  "confirmed at office": "مؤكد في المكتب",
  "dispatch in the same wilaya": "إرسال داخل نفس الولاية",
  "to region": "في الطريق إلى الولاية",
  "in transit": "في الطريق",
  "out for delivery": "في رحلة التسليم",
  "out for delivery again": "محاولة تسليم ثانية",
  "delivered": "تم التسليم",
  "collected": "تم الاستلام من المكتب",
  "recovered": "مُرجَع",
  "picked up": "تم الاستلام",
  "returned": "مُرجَع",
  "failed delivery": "فشل التسليم",
  "cancelled": "ملغى",
  "accepted": "مقبول",
  "pris en charge": "تم الاستلام من المتجر",
  "en cours de livraison": "في الطريق للتسليم",
  "livré": "تم التسليم",
  "retour": "مُرجَع",
  "échec de livraison": "فشل التسليم",
  "annulé": "ملغى",
};

function getZRStateAr(state: string, stateAr: string): string {
  if (stateAr) return stateAr;
  return ZR_STATE_AR[state.toLowerCase()] ?? state;
}

export function TrackOrderPage() {
  const { language } = useApp();
  const [phone, setPhone] = useState("");
  const [searchMode, setSearchMode] = useState<"phone" | "order">("phone");
  const [order, setOrder] = useState<Order | null>(null);
  const [phoneResults, setPhoneResults] = useState<Order[] | null>(null);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [zrTracking, setZrTracking] = useState<ZREvent[] | null>(null);
  const [zrTrackingNumber, setZrTrackingNumber] = useState<string | null>(null);
  const [zrLoading, setZrLoading] = useState(false);

  useEffect(() => {
    if (!order) {
      setZrTracking(null);
      setZrTrackingNumber(null);
      return;
    }
    setZrLoading(true);
    orderService.getZRTracking(order.orderNumber)
      .then((data) => {
        setZrTracking(data.tracking);
        setZrTrackingNumber(data.trackingNumber);
      })
      .catch(() => {
        setZrTracking([]);
      })
      .finally(() => setZrLoading(false));
  }, [order]);

  const reset = () => {
    setOrder(null);
    setPhoneResults(null);
    setError("");
  };

  const search = async () => {
    if (!phone.trim() || searching) return;
    setSearching(true);
    try {
      reset();
      if (searchMode === "phone") {
        const results = await orderService.trackOrdersByPhone(phone.trim());
        setPhoneResults(results);
        if (results.length === 0) setError(translate(language, "trackPhoneEmptyDescription"));
      } else {
        const found = await orderService.trackByOrderNumber(phone.trim());
        setOrder(found);
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

      {/* ZR Express live tracking */}
      <div className="surface-card p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              {language === "ar" ? "تتبع الشحنة - ZR Express" : language === "fr" ? "Suivi ZR Express" : "ZR Express Tracking"}
            </h2>
            {zrTrackingNumber ? (
              <div className="mt-0.5 text-sm font-mono text-slate-500" dir="ltr">{zrTrackingNumber}</div>
            ) : null}
          </div>
        </div>

        {zrLoading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
            <Clock className="h-4 w-4 animate-spin" />
            {language === "ar" ? "جاري التحميل..." : language === "fr" ? "Chargement..." : "Loading..."}
          </div>
        ) : zrTracking && zrTracking.length > 0 ? (() => {
          const sorted = [...zrTracking].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const latestState = sorted[0].state.toLowerCase();
          const isDelivered = latestState.includes("delivered") || latestState.includes("livr") || latestState.includes("collected") || latestState.includes("picked up");
          const isFailed = latestState.includes("return") || latestState.includes("retour") || latestState.includes("echec") || latestState.includes("annul") || latestState.includes("cancel") || latestState.includes("recovered");

          // ZR full pipeline steps
          const ZR_STEPS = [
            { key: "order received", ar: "استلام الطلب", fr: "Reçu" },
            { key: "order in process", ar: "قيد المعالجة", fr: "En traitement" },
            { key: "confirmation call", ar: "مكالمة التأكيد", fr: "Appel" },
            { key: "order confirmed", ar: "مؤكد", fr: "Confirmé" },
            { key: "ready to ship", ar: "جاهز للشحن", fr: "Prêt" },
            { key: "confirmed at office", ar: "مؤكد بالمكتب", fr: "Au bureau" },
            { key: "dispatch", ar: "مُرسَل", fr: "Expédié" },
            { key: "to region", ar: "إلى الولاية", fr: "En région" },
            { key: "out for delivery", ar: "في رحلة التسليم", fr: "En livraison" },
            { key: "delivered", ar: "تم التسليم", fr: "Livré" },
          ];

          // Find which step is active
          const completedKeys = sorted.map((e) => e.state.toLowerCase());
          const activeStepIdx = ZR_STEPS.reduce((acc, step, idx) => {
            const found = completedKeys.some((s) => s.includes(step.key.split(" ")[0]));
            return found ? idx : acc;
          }, -1);

          return (
            <>
              {/* Progress stepper */}
              {!isFailed && (
                <div className="mt-5 overflow-x-auto">
                  <div className="flex min-w-[600px] items-start gap-0">
                    {ZR_STEPS.map((step, idx) => {
                      const done = idx <= activeStepIdx;
                      const current = idx === activeStepIdx;
                      const label = language === "ar" ? step.ar : language === "fr" ? step.fr : step.key.replace(/(^|\s)\w/g, (c) => c.toUpperCase());
                      return (
                        <div key={step.key} className="flex flex-1 flex-col items-center gap-1 text-center">
                          <div className="relative flex w-full items-center">
                            {idx > 0 && (
                              <div className={`h-0.5 flex-1 ${done ? "bg-emerald-400" : "bg-slate-200"}`} />
                            )}
                            <div className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                              isDelivered && done
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : current
                                  ? "border-teal-500 bg-teal-500 text-white shadow-[0_0_0_4px_rgba(20,184,166,0.2)]"
                                  : done
                                    ? "border-emerald-400 bg-emerald-400 text-white"
                                    : "border-slate-200 bg-white text-slate-400"
                            }`}>
                              {done ? "✓" : idx + 1}
                            </div>
                            {idx < ZR_STEPS.length - 1 && (
                              <div className={`h-0.5 flex-1 ${idx < activeStepIdx ? "bg-emerald-400" : "bg-slate-200"}`} />
                            )}
                          </div>
                          <div className={`mt-1 text-[10px] leading-tight font-medium ${current ? "text-teal-700" : done ? "text-emerald-700" : "text-slate-400"}`}>
                            {label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Events log */}
              <ol className="relative mt-6 border-s border-slate-200 ps-5 space-y-4">
                {sorted.map((event, idx) => (
                  <li key={idx} className="relative">
                    <span className="absolute -start-[0.95rem] flex h-[1.2rem] w-[1.2rem] items-center justify-center">
                      {idx === 0 ? (
                        <CheckCircle2 className={`h-5 w-5 ${isDelivered ? "text-emerald-500" : isFailed ? "text-rose-400" : "text-teal-600"}`} />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-slate-300" />
                      )}
                    </span>
                    <div className={`ms-2 rounded-xl border px-4 py-3 ${
                      idx === 0
                        ? isDelivered ? "border-emerald-200 bg-emerald-50" : isFailed ? "border-rose-200 bg-rose-50" : "border-teal-200 bg-teal-50"
                        : "border-slate-100 bg-slate-50"
                    }`}>
                      <div className={`font-semibold text-sm ${idx === 0 ? isDelivered ? "text-emerald-800" : isFailed ? "text-rose-700" : "text-teal-800" : "text-slate-700"}`}>
                        {language === "ar" ? getZRStateAr(event.state, event.stateAr) : event.state}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {event.date ? formatDate(event.date, language) : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          );
        })() : zrTracking !== null ? (
          <div className="mt-6 text-sm text-slate-400">
            {language === "ar" ? "لا توجد تحديثات للشحنة بعد" : language === "fr" ? "Aucune mise à jour de livraison pour l'instant" : "No delivery updates yet"}
          </div>
        ) : null}
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

          {/* Search mode toggle */}
          <div className="mt-4 flex gap-2">
            {[
              { mode: "phone" as const, label: language === "ar" ? "📞 رقم الهاتف" : "📞 Phone" },
              { mode: "order" as const, label: language === "ar" ? "📦 رقم الطلب" : "📦 Order #" },
            ].map(({ mode, label }) => (
              <button key={mode} type="button" onClick={() => { setSearchMode(mode); setPhone(""); reset(); }}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${searchMode === mode ? "border-teal-500 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-600 hover:border-teal-300"}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <IconField icon={searchMode === "phone" ? Phone : Search} className="flex-1">
              <input
                value={phone}
                onChange={(event) => {
                  if (searchMode === "phone") {
                    setPhone(event.target.value.replace(/\D/g, "").slice(0, 10));
                  } else {
                    setPhone(event.target.value.toUpperCase().slice(0, 20));
                  }
                }}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }}
                className="field-input field-input-icon w-full"
                placeholder={searchMode === "phone" ? translate(language, "trackPhonePlaceholder") : (language === "ar" ? "VS-20260625-1234" : "VS-20260625-1234")}
                dir={searchMode === "order" ? "ltr" : undefined}
              />
            </IconField>
            <button onClick={() => void search()} disabled={searching} className="primary-button gap-2 disabled:opacity-60">
              <Search className={`h-4 w-4 ${searching ? "animate-spin" : ""}`} />
              {searching ? translate(language, "loading") : translate(language, "trackSearch")}
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
