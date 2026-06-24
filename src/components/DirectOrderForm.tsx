/**
 * DirectOrderForm — inline checkout on product detail page.
 * Enabled by siteSettings.directOrderMode toggle in admin.
 * No cart, no OTP, no navigation — order placed directly on product page.
 */
import { Building2, Check, Home, Lock, MapPin, MapPinned, Phone, ShieldCheck, Truck, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconField } from "@/components/IconField";
import { useApp } from "@/hooks/useApp";
import { orderService } from "@/services/order.service";
import { shippingService } from "@/services/shipping.service";
import { type ZRTerritory, zrShippingService } from "@/services/shipping.zr.service";
import type { DeliveryType, Product, ProductVariant, Wilaya } from "@/types";
import { formatCurrency } from "@/utils/format";
import { translate } from "@/utils/i18n";
import { getOrCreateExternalId } from "@/utils/externalId";
import { pixelLead, pixelPurchase, pixelSetUserPhone } from "@/utils/pixel";
import { trackEvent } from "@/utils/tracking";

const phonePattern = /^(05|06|07)\d{8}$/;

interface DirectOrderFormProps {
  product: Product;
  variant: ProductVariant;
  quantity: number;
  shippingFee: number;
}

export function DirectOrderForm({ product, variant, quantity, shippingFee: initialFee }: DirectOrderFormProps) {
  const navigate = useNavigate();
  const { language, affiliateRef, rememberConfirmedOrder, pushToast } = useApp();

  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [zrTerritories, setZrTerritories] = useState<ZRTerritory[]>([]);
  const [selectedZrTerritory, setSelectedZrTerritory] = useState<ZRTerritory | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [wilayaCode, setWilayaCode] = useState("16");
  const [commune, setCommune] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("DESK_PICKUP");
  const [shippingFee, setShippingFee] = useState(initialFee);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [invalidField, setInvalidField] = useState<string | null>(null);

  const price = variant.price * quantity;
  const total = Math.max(0, price + shippingFee);

  // Load wilayas + ZR territories once
  useEffect(() => {
    shippingService.getWilayas().then(setWilayas).catch(() => undefined);
    zrShippingService.getTerritories().then(setZrTerritories).catch(() => undefined);
  }, []);

  // Update shipping when wilaya or territory changes
  useEffect(() => {
    if (!wilayaCode) return;
    shippingService
      .calculateShipping({ wilayaCode, deliveryType, zrTerritoryId: selectedZrTerritory?.id })
      .then((r) => setShippingFee(r.fee))
      .catch(() => undefined);
  }, [wilayaCode, deliveryType, selectedZrTerritory]);

  const selectedWilayaZrTerritories = useMemo(
    () => zrTerritories.filter((t) => t.wilayaCode === wilayaCode),
    [wilayaCode, zrTerritories],
  );
  const useZrCommunes = selectedWilayaZrTerritories.length > 0;
  const selectedWilaya = wilayas.find((w) => w.code === wilayaCode);

  const scrollToField = (id: string) => {
    setInvalidField(id);
    setTimeout(() => {
      const el = document.getElementById(`dof-${id}`);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.focus(); }
    }, 50);
  };

  const validate = () => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2 || parts.some((p) => p.length < 2)) {
      scrollToField("name");
      return language === "ar" ? "⚠️ أدخل الاسم واللقب معاً — مثال: أحمد محمد" : "⚠️ Enter first and last name";
    }
    if (!phonePattern.test(phone.trim())) {
      scrollToField("phone");
      return language === "ar" ? "⚠️ رقم الهاتف غير صحيح — يبدأ بـ 05 أو 06 أو 07" : "⚠️ Invalid phone number";
    }
    if (!commune.trim()) {
      scrollToField("commune");
      return language === "ar" ? "⚠️ يرجى اختيار البلدية" : "⚠️ Please select your commune";
    }
    if (address.trim().length < 5) {
      scrollToField("address");
      return language === "ar" ? "⚠️ أدخل عنوانك بالتفصيل (مثال: حي النصر، شارع المدينة)" : "⚠️ Please enter your full address";
    }
    setInvalidField(null);
    return "";
  };

  const submit = async () => {
    const err = validate();
    if (err) {
      setErrorMessage(err);
      setTimeout(() => {
        document.getElementById("dof-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      pixelSetUserPhone(phone.trim());
      const externalId = getOrCreateExternalId();
      const capiEventId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      pixelLead(capiEventId);
      trackEvent({ eventType: "order_submit" });

      const order = await orderService.createOrder({
        customer: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          wilayaCode,
          commune,
          address: address.trim(),
        },
        items: [{ productId: product._id, variantId: variant._id, quantity }],
        deliveryType,
        affiliateRef: affiliateRef || undefined,
        capiEventId,
        clientUserAgent: navigator.userAgent,
        manualConfirm: true, // bypass OTP in direct mode
        zrTerritoryId: selectedZrTerritory?.id,
        externalId: externalId || undefined,
      });

      pixelPurchase({ orderId: order._id, value: total, eventID: capiEventId });
      trackEvent({ eventType: "purchase", orderId: order._id });

      rememberConfirmedOrder(order);
      navigate("/order/success");
    } catch (error) {
      const message = error instanceof Error ? error.message : translate(language, "checkoutSubmitting");
      setErrorMessage(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = (id: string) =>
    `field-input field-input-icon transition ${invalidField === id ? "border-rose-500 ring-2 ring-rose-200" : ""}`;

  const selectClass = (id: string) =>
    `field-select field-input-icon transition ${invalidField === id ? "border-rose-500 ring-2 ring-rose-200" : ""}`;

  return (
    <div className="mt-6 space-y-4 rounded-[2rem] border-2 border-teal-200 bg-gradient-to-b from-teal-50/60 to-white p-5 shadow-[0_8px_32px_rgba(20,184,166,0.12)]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-600 text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <div className="font-bold text-slate-950">
            {language === "ar" ? "أتمم طلبك الآن" : language === "fr" ? "Finalisez votre commande" : "Complete your order"}
          </div>
          <div className="text-xs text-slate-500">
            {language === "ar" ? "الدفع عند الاستلام — توصيل لجميع الولايات" : language === "fr" ? "Paiement à la livraison" : "Cash on delivery"}
          </div>
        </div>
        <div className="ms-auto text-xl font-extrabold text-teal-700">{formatCurrency(total, language)}</div>
      </div>

      {/* Error */}
      {errorMessage ? (
        <div id="dof-error" className="flex items-start gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3">
          <span className="text-rose-500">⚠️</span>
          <p className="text-sm font-semibold text-rose-800">{errorMessage}</p>
        </div>
      ) : null}

      {/* Full name */}
      <div className="space-y-1">
        <label className="block text-sm font-semibold text-slate-700">
          {language === "ar" ? "الاسم الكامل" : language === "fr" ? "Nom complet" : "Full name"}
          <span className="ms-1 text-rose-500">*</span>
        </label>
        <IconField icon={UserRound}>
          <input
            id="dof-name"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); if (invalidField === "name") { setInvalidField(null); setErrorMessage(""); } }}
            className={fieldClass("name")}
            placeholder={language === "ar" ? "أحمد محمد" : "Ahmed Mohamed"}
            autoComplete="name"
          />
        </IconField>
        <p className="ps-1 text-[11px] text-slate-400">
          {language === "ar" ? "الاسم واللقب معاً — مثال: أحمد محمد" : "First and last name required"}
        </p>
      </div>

      {/* Phone */}
      <div className="space-y-1">
        <label className="block text-sm font-semibold text-slate-700">
          {language === "ar" ? "رقم الهاتف" : language === "fr" ? "Téléphone" : "Phone"}
          <span className="ms-1 text-rose-500">*</span>
        </label>
        <IconField icon={Phone}>
          <input
            id="dof-phone"
            dir="ltr"
            inputMode="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); if (invalidField === "phone") { setInvalidField(null); setErrorMessage(""); } }}
            className={fieldClass("phone")}
            placeholder="0555 12 34 56"
            autoComplete="tel"
          />
        </IconField>
      </div>


      {/* Wilaya + Commune */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-semibold text-slate-700">
            {language === "ar" ? "الولاية" : "Wilaya"}<span className="ms-1 text-rose-500">*</span>
          </label>
          <IconField icon={MapPin}>
            <select
              value={wilayaCode}
              onChange={(e) => { setWilayaCode(e.target.value); setCommune(""); setSelectedZrTerritory(null); }}
              className="field-select field-input-icon"
            >
              {wilayas.map((w) => (
                <option key={w._id} value={w.code}>
                  {w.code} · {language === "ar" ? w.name.ar : language === "fr" ? w.name.fr : w.name.en}
                </option>
              ))}
            </select>
          </IconField>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-semibold text-slate-700">
            {language === "ar" ? "البلدية" : "Commune"}<span className="ms-1 text-rose-500">*</span>
          </label>
          <IconField icon={MapPinned}>
            {useZrCommunes ? (
              <select
                id="dof-commune"
                value={selectedZrTerritory?.id ?? ""}
                onChange={(e) => {
                  if (invalidField === "commune") { setInvalidField(null); setErrorMessage(""); }
                  const t = selectedWilayaZrTerritories.find((x) => x.id === e.target.value) ?? null;
                  setSelectedZrTerritory(t);
                  setCommune(t?.name ?? "");
                }}
                className={selectClass("commune")}
              >
                <option value="">{language === "ar" ? "اختر البلدية" : "Choose commune"}</option>
                {selectedWilayaZrTerritories.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.nameAr ? ` · ${t.nameAr}` : ""}
                    {t.hasPricing ? ` · ${deliveryType === "HOME_DELIVERY" ? t.homePrice : t.pickupPrice} دج` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="dof-commune"
                value={commune}
                onChange={(e) => { setCommune(e.target.value); if (invalidField === "commune") { setInvalidField(null); setErrorMessage(""); } }}
                className={fieldClass("commune")}
                placeholder={language === "ar" ? "البلدية" : "Commune"}
              />
            )}
          </IconField>
        </div>
      </div>

      {/* Delivery type */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setDeliveryType("DESK_PICKUP")}
          className={`flex items-center gap-2 rounded-2xl border-2 p-3 text-sm font-semibold transition ${deliveryType === "DESK_PICKUP" ? "border-teal-500 bg-teal-50 text-teal-900" : "border-slate-200 bg-white text-slate-600"}`}
        >
          {deliveryType === "DESK_PICKUP" && <Check className="h-4 w-4 shrink-0 text-teal-600" />}
          <Building2 className="h-4 w-4 shrink-0" />
          <span>{language === "ar" ? "استلام من المكتب" : "Desk pickup"}</span>
        </button>
        <button
          type="button"
          onClick={() => setDeliveryType("HOME_DELIVERY")}
          className={`flex items-center gap-2 rounded-2xl border-2 p-3 text-sm font-semibold transition ${deliveryType === "HOME_DELIVERY" ? "border-teal-500 bg-teal-50 text-teal-900" : "border-slate-200 bg-white text-slate-600"}`}
        >
          {deliveryType === "HOME_DELIVERY" && <Check className="h-4 w-4 shrink-0 text-teal-600" />}
          <Home className="h-4 w-4 shrink-0" />
          <span>{language === "ar" ? "توصيل للمنزل" : "Home delivery"}</span>
        </button>
      </div>

      {/* Address — always required */}
      <div className="space-y-1">
        <label className="block text-sm font-semibold text-slate-700">
          {language === "ar"
            ? deliveryType === "HOME_DELIVERY" ? "عنوان المنزل" : "عنوان الاستلام"
            : deliveryType === "HOME_DELIVERY" ? "Home address" : "Pickup address"}
          <span className="ms-1 text-rose-500">*</span>
        </label>
        <IconField icon={Home}>
          <textarea
            id="dof-address"
            value={address}
            onChange={(e) => { setAddress(e.target.value); if (invalidField === "address") { setInvalidField(null); setErrorMessage(""); } }}
            rows={2}
            className={`field-textarea field-input-icon transition ${invalidField === "address" ? "border-rose-500 ring-2 ring-rose-200" : ""}`}
            placeholder={language === "ar"
              ? deliveryType === "HOME_DELIVERY" ? "حي النصر، شارع المدينة، رقم 12" : "قريب من مكتب الشحن، الحي، المدينة"
              : "El Nasr district, street 20, n°5"}
          />
        </IconField>
      </div>

      {/* Shipping fee info */}
      {selectedZrTerritory ? (
        <div className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-xs text-teal-700">
          <Truck className="me-1.5 inline h-3.5 w-3.5" />
          {language === "ar" ? "رسوم التوصيل:" : "Delivery:"} <strong>{formatCurrency(shippingFee, language)}</strong>
        </div>
      ) : null}

      {/* Submit */}
      <button
        type="button"
        disabled={submitting}
        onClick={() => void submit()}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-5 text-base font-bold text-white shadow-[0_10px_30px_rgba(20,184,166,0.4)] transition hover:from-teal-500 hover:to-emerald-500 active:scale-[0.98] disabled:opacity-60"
      >
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          {submitting
            ? (language === "ar" ? "جارٍ الإرسال..." : "Sending...")
            : (language === "ar" ? "أتمم الطلب" : language === "fr" ? "Confirmer la commande" : "Place order")}
        </span>
        <span className="rounded-xl bg-white/20 px-3 py-1.5 text-sm font-extrabold">
          {formatCurrency(total, language)}
        </span>
      </button>

      {/* Trust */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 pt-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1"><Lock className="h-3 w-3 text-teal-600" />{language === "ar" ? "دفع عند الاستلام" : "Pay on delivery"}</span>
        <span className="flex items-center gap-1"><Truck className="h-3 w-3 text-teal-600" />{language === "ar" ? "شحن لكل الولايات" : "All wilayas"}</span>
        <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-teal-600" />{language === "ar" ? "الإلغاء مجاني" : "Free cancellation"}</span>
      </div>
    </div>
  );
}
