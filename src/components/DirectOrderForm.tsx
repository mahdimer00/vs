/**
 * DirectOrderForm — inline checkout on product detail page.
 * Enabled by siteSettings.directOrderMode toggle in admin.
 * No cart, no OTP, no navigation — order placed directly on product page.
 */
import { Building2, Check, CheckCircle2, Home, Lock, MapPin, MapPinned, Phone, PhoneCall, ShieldCheck, Truck, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconField } from "@/components/IconField";
import { useApp } from "@/hooks/useApp";
import { orderService } from "@/services/order.service";
import { promoService } from "@/services/promo.service";
import { shippingService } from "@/services/shipping.service";
import { type ZRTerritory, zrShippingService } from "@/services/shipping.zr.service";
import type { DeliveryType, Product, ProductVariant, Wilaya } from "@/types";
import { formatCurrency } from "@/utils/format";
import { translate } from "@/utils/i18n";
import { getOrCreateExternalId } from "@/utils/externalId";
import { pixelAddToCart, pixelLead, pixelPurchase, pixelSetUserPhone } from "@/utils/pixel";
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
  const { language, affiliateRef, rememberConfirmedOrder, pushToast, siteSettings } = useApp();

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
  const [promoCode, setPromoCode] = useState("");
  const [promoApplying, setPromoApplying] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState("");
  const [discount, setDiscount] = useState(0);
  // Track which fields the user has touched (to show errors only after interaction)
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const touch = (field: string) => setTouched((prev) => { const s = new Set(prev); s.add(field); return s; });

  // Live per-field error messages (shown after touch)
  const nameError = (() => {
    if (!touched.has("name")) return "";
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (!fullName.trim()) return language === "ar" ? "هذا الحقل مطلوب" : "Required";
    if (parts.length < 2 || parts.some(p => p.length < 2)) return language === "ar" ? "أدخل الاسم واللقب معاً — مثال: أحمد محمد" : "Enter first AND last name";
    return "";
  })();
  const phoneError = (() => {
    if (!touched.has("phone")) return "";
    if (!phone.trim()) return language === "ar" ? "هذا الحقل مطلوب" : "Required";
    if (!phonePattern.test(phone.trim())) return language === "ar" ? "رقم غير صحيح — يبدأ بـ 05 أو 06 أو 07" : "Invalid — must start with 05/06/07";
    return "";
  })();
  const communeError = (!touched.has("commune") || commune.trim()) ? "" : (language === "ar" ? "يرجى اختيار البلدية" : "Please select commune");
  const addressError = (() => {
    if (!touched.has("address")) return "";
    if (address.trim().length < 5) return language === "ar" ? "أدخل العنوان بالتفصيل (على الأقل 5 أحرف)" : "Enter full address (5+ chars)";
    return "";
  })();

  // Is every field valid — used for the floating submit button
  const isFormComplete = (() => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    return parts.length >= 2 &&
      parts.every(p => p.length >= 2) &&
      phonePattern.test(phone.trim()) &&
      commune.trim().length > 0 &&
      address.trim().length >= 5;
  })();

  const price = variant.price * quantity;
  const total = Math.max(0, price + shippingFee - discount);

  const applyPromo = async () => {
    if (!promoCode.trim() || !phonePattern.test(phone.trim())) return;
    setPromoApplying(true);
    try {
      const res = await promoService.validate({
        code: promoCode,
        phone: phone.trim(),
        subtotal: price,
        productIds: [product._id],
        categoryIds: [],
        shippingFee,
      });
      setDiscount(res.discount);
      setAppliedPromo(promoCode.toUpperCase());
      pushToast(language === "ar" ? "تم تطبيق كود الخصم ✓" : "Promo applied ✓", "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : translate(language, "promoRejected"), "error");
    } finally {
      setPromoApplying(false);
    }
  };

  // Fire AddPaymentInfo pixel when phone becomes valid (strong purchase intent signal)
  const phoneValid = phonePattern.test(phone.trim());
  const firedPaymentInfoRef = useRef(false);
  useEffect(() => {
    if (phoneValid && !firedPaymentInfoRef.current) {
      firedPaymentInfoRef.current = true;
      pixelSetUserPhone(phone.trim());
      pixelAddToCart({ productId: product._id, productName: product.name.fr || product.name.ar || product.name.en || "", value: price });
    }
  }, [phoneValid]); // eslint-disable-line react-hooks/exhaustive-deps

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
    touch(id);
    setTimeout(() => {
      const el = document.getElementById(`dof-${id}`);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.focus(); }
    }, 50);
  };

  const validate = () => {
    // Touch all fields so errors show
    setTouched(new Set(["name", "phone", "commune", "address"]));
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
        promoCode: appliedPromo || undefined,
        affiliateRef: affiliateRef || undefined,
        capiEventId,
        clientUserAgent: navigator.userAgent,
        manualConfirm: true,
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
    <div className="mt-6 space-y-4 overflow-hidden rounded-[2rem] border-2 border-teal-200 bg-gradient-to-b from-teal-50/60 to-white shadow-[0_8px_32px_rgba(20,184,166,0.14)]">

      {/* Top banner — ZR Express + cash on delivery */}
      <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-teal-700 to-emerald-700 px-5 py-3">
        <div className="flex items-center gap-2 text-white">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
            <svg viewBox="0 0 40 40" fill="none" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="8" fill="#0CAF60"/>
              <text x="20" y="27" textAnchor="middle" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="16" fill="white">ZR</text>
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold">
              {language === "ar" ? "الشحن عبر ZR Express" : language === "fr" ? "Livraison par ZR Express" : "Shipped via ZR Express"}
            </div>
            <div className="text-[10px] text-white/80">
              {language === "ar" ? "توصيل سريع لجميع الولايات الـ 58" : "Fast delivery to all 58 wilayas"}
            </div>
          </div>
        </div>
        <div className="shrink-0 rounded-xl bg-white/15 px-3 py-1.5 text-center">
          <div className="text-[10px] font-semibold text-white/80">
            {language === "ar" ? "الدفع" : "Payment"}
          </div>
          <div className="text-xs font-extrabold text-white">
            {language === "ar" ? "عند الاستلام" : "On delivery"}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-600 text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <div className="font-bold text-slate-950">
            {language === "ar" ? "أتمم طلبك الآن" : language === "fr" ? "Finalisez votre commande" : "Complete your order"}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <PhoneCall className="h-3 w-3" />
            {language === "ar" ? "سنتصل بك لتأكيد الطلب" : language === "fr" ? "On vous appellera pour confirmer" : "We'll call to confirm"}
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
            onBlur={() => touch("name")}
            className={fieldClass("name")}
            placeholder={language === "ar" ? "أحمد محمد" : "Ahmed Mohamed"}
            autoComplete="name"
          />
        </IconField>
        {nameError ? (
          <p className="flex items-center gap-1 ps-1 text-xs font-semibold text-rose-600">⚠️ {nameError}</p>
        ) : (
          <p className="ps-1 text-[11px] text-slate-400">{language === "ar" ? "الاسم واللقب معاً — مثال: أحمد محمد" : "First and last name"}</p>
        )}
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
            onBlur={() => touch("phone")}
            className={fieldClass("phone")}
            placeholder="0555 12 34 56"
            autoComplete="tel"
          />
        </IconField>
        {phoneError ? <p className="flex items-center gap-1 ps-1 text-xs font-semibold text-rose-600">⚠️ {phoneError}</p> : null}
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
                  touch("commune");
                  const t = selectedWilayaZrTerritories.find((x) => x.id === e.target.value) ?? null;
                  setSelectedZrTerritory(t);
                  setCommune(t?.name ?? "");
                }}
                onBlur={() => touch("commune")}
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
                onBlur={() => touch("commune")}
                className={fieldClass("commune")}
                placeholder={language === "ar" ? "البلدية" : "Commune"}
              />
            )}
          </IconField>
          {communeError ? <p className="flex items-center gap-1 text-xs font-semibold text-rose-600">⚠️ {communeError}</p> : null}
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
            onBlur={() => touch("address")}
            rows={2}
            className={`field-textarea field-input-icon transition ${invalidField === "address" || addressError ? "border-rose-500 ring-2 ring-rose-200" : ""}`}
            placeholder={language === "ar"
              ? deliveryType === "HOME_DELIVERY" ? "حي النصر، شارع المدينة، رقم 12" : "قريب من مكتب الشحن، الحي، المدينة"
              : "El Nasr district, street 20, n°5"}
          />
        </IconField>
        {addressError ? <p className="flex items-center gap-1 ps-1 text-xs font-semibold text-rose-600">⚠️ {addressError}</p> : null}
      </div>

      {/* Shipping fee + delivery time */}
      {selectedZrTerritory ? (
        <div className="flex items-center justify-between rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-teal-800">
            <Truck className="h-4 w-4 shrink-0 text-teal-600" />
            <span>
              {language === "ar" ? "رسوم التوصيل:" : "Delivery fee:"}
              <strong className="ms-1">{formatCurrency(shippingFee, language)}</strong>
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          <Truck className="h-4 w-4 shrink-0 text-teal-500" />
          {language === "ar" ? "اختر الولاية والبلدية لعرض سعر التوصيل" : "Select wilaya and commune to see delivery fee"}
        </div>
      )}

      {/* Promo code — shown when promoCodeEnabled in settings */}
      {siteSettings?.promoCodeEnabled !== false ? (
        appliedPromo ? (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="text-sm font-semibold text-emerald-700">
              🎉 {appliedPromo} — {language === "ar" ? "خصم" : "Discount"} {formatCurrency(discount, language)}
            </span>
            <button type="button" onClick={() => { setAppliedPromo(""); setPromoCode(""); setDiscount(0); }} className="text-xs text-rose-500 hover:text-rose-700">✕</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              className="field-input flex-1 uppercase text-sm"
              placeholder={language === "ar" ? "كود الخصم (اختياري)" : "Promo code (optional)"}
            />
            <button
              type="button"
              onClick={() => void applyPromo()}
              disabled={promoApplying || !promoCode.trim()}
              className="shrink-0 rounded-2xl border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-100 disabled:opacity-50"
            >
              {promoApplying ? "..." : (language === "ar" ? "تطبيق" : "Apply")}
            </button>
          </div>
        )
      ) : null}

      {/* Submit */}
      <button
        id="dof-submit-btn"
        type="button"
        disabled={submitting}
        onClick={() => void submit()}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-5 text-base font-bold text-white shadow-[0_10px_30px_rgba(20,184,166,0.4)] transition hover:from-teal-500 hover:to-emerald-500 active:scale-[0.98] disabled:opacity-60"
      >
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          {submitting
            ? (language === "ar" ? "جارٍ الإرسال..." : "Sending...")
            : (language === "ar" ? "أتمم الطلب الآن" : language === "fr" ? "Confirmer la commande" : "Place order now")}
        </span>
        <span className="rounded-xl bg-white/20 px-3 py-1.5 text-sm font-extrabold">
          {formatCurrency(total, language)}
        </span>
      </button>

      {/* Final trust row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="flex flex-col items-center gap-1 rounded-xl bg-slate-50 px-2 py-2">
          <Lock className="h-4 w-4 text-teal-600" />
          <span className="text-[10px] font-semibold text-slate-600">{language === "ar" ? "دفع عند الاستلام" : "Pay on delivery"}</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl bg-slate-50 px-2 py-2">
          <CheckCircle2 className="h-4 w-4 text-teal-600" />
          <span className="text-[10px] font-semibold text-slate-600">{language === "ar" ? "إلغاء مجاني" : "Free cancel"}</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl bg-slate-50 px-2 py-2">
          <PhoneCall className="h-4 w-4 text-teal-600" />
          <span className="text-[10px] font-semibold text-slate-600">{language === "ar" ? "تأكيد هاتفي" : "Call confirm"}</span>
        </div>
      </div>

      </div>{/* end p-5 */}
    </div>
  );
}
