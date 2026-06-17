import { BadgeCheck, Building2, Check, Home, Lock, MapPin, MapPinned, Phone, ShieldCheck, Tag, Truck, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { IconField } from "@/components/IconField";
import { OrderSummaryCard } from "@/components/OrderSummaryCard";
import { Seo } from "@/components/Seo";
import { useApp } from "@/hooks/useApp";
import { orderService } from "@/services/order.service";
import { promoService } from "@/services/promo.service";
import { shippingService } from "@/services/shipping.service";
import type { DeliveryType, Wilaya } from "@/types";
import { formatCurrency } from "@/utils/format";
import { translate } from "@/utils/i18n";
import { pixelInitiateCheckout, pixelLead, pixelPurchase } from "@/utils/pixel";
import { trackEvent } from "@/utils/tracking";

const phonePattern = /^(05|06|07)\d{8}$/;
const checkoutDraftKey = "visastore-checkout-draft";

export function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, affiliateRef, language, rememberConfirmedOrder, rememberPendingOrder, clearCart, pushToast, updateQuantity, removeFromCart, siteSettings } = useApp();
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [wilayaCode, setWilayaCode] = useState("16");
  const [commune, setCommune] = useState("");
  const [communeOther, setCommuneOther] = useState(false);
  const [address, setAddress] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("DESK_PICKUP");
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [promoApplying, setPromoApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(checkoutDraftKey);
      if (!raw) {
        return;
      }
      const draft = JSON.parse(raw) as Partial<{
        fullName: string;
        phone: string;
        wilayaCode: string;
        commune: string;
        communeOther: boolean;
        address: string;
        deliveryType: DeliveryType;
      }>;
      setFullName(draft.fullName || "");
      setPhone(draft.phone || "");
      setWilayaCode(draft.wilayaCode || "16");
      setCommune(draft.commune || "");
      setCommuneOther(Boolean(draft.communeOther));
      setAddress(draft.address || "");
      setDeliveryType(draft.deliveryType || "DESK_PICKUP");
    } catch {
      window.localStorage.removeItem(checkoutDraftKey);
    }
  }, []);

  useEffect(() => {
    void shippingService
      .getWilayas()
      .then((data) => setWilayas(data))
      .catch(() => pushToast(translate(language, "checkoutWilayaLoadError"), "error"));
  }, [language, pushToast]);

  useEffect(() => {
    if (!wilayaCode) {
      return;
    }

    void shippingService
      .calculateShipping({ wilayaCode, deliveryType })
      .then((response) => {
        setShippingFee(response.fee);
      })
      .catch(() => {
        setShippingFee(0);
        pushToast(translate(language, "checkoutShippingFeeError"), "error");
      });
  }, [deliveryType, wilayaCode, language, pushToast]);

  useEffect(() => {
    window.localStorage.setItem(
      checkoutDraftKey,
      JSON.stringify({ fullName, phone, wilayaCode, commune, communeOther, address, deliveryType }),
    );
  }, [address, commune, communeOther, deliveryType, fullName, phone, wilayaCode]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.variant.price * item.quantity, 0), [cart]);
  const total = Math.max(0, subtotal + shippingFee - discount);
  const selectedWilaya = wilayas.find((wilaya) => wilaya.code === wilayaCode);

  // Track InitiateCheckout once when the page mounts with items in cart
  useEffect(() => {
    if (cart.length === 0) return;
    const numItems = cart.reduce((n, item) => n + item.quantity, 0);
    pixelInitiateCheckout({ value: subtotal, numItems });
    trackEvent({ eventType: "checkout_start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run only once on mount

  if (cart.length === 0) {
    return (
      <>
        <Seo title={translate(language, "checkoutTitle")} description={translate(language, "checkoutDescription")} path="/checkout" noindex />
        <EmptyState title={translate(language, "emptyCart")} description={translate(language, "cartDescription")} />
      </>
    );
  }

  const validate = () => {
    if (!fullName.trim()) {
      return translate(language, "checkoutValidationFullName");
    }
    if (!phonePattern.test(phone.trim())) {
      return translate(language, "checkoutValidationPhone");
    }
    if (!commune.trim()) {
      return translate(language, "checkoutValidationCommune");
    }
    if (!address.trim()) {
      return translate(language, "checkoutValidationAddress");
    }
    return "";
  };

  const applyPromo = async () => {
    if (!phonePattern.test(phone.trim())) {
      setErrorMessage(translate(language, "checkoutValidationPromoPhone"));
      pushToast(translate(language, "checkoutValidationPromoPhone"), "error");
      return;
    }

    setPromoApplying(true);
    setErrorMessage("");

    try {
      const categoryIds = [
        ...new Set(
          cart.map((item) =>
            typeof item.product.category === "string" ? item.product.category : item.product.category._id,
          ),
        ),
      ];

      const response = await promoService.validate({
        code: promoCode,
        phone,
        subtotal,
        productIds: cart.map((item) => item.product._id),
        categoryIds,
        shippingFee,
      });

      setDiscount(response.discount);
      setAppliedPromoCode(promoCode);
      pushToast(translate(language, "promoApplied"), "success");
    } catch (error) {
      setDiscount(0);
      setAppliedPromoCode("");
      const message = error instanceof Error ? error.message : translate(language, "promoRejected");
      setErrorMessage(message);
      pushToast(message, "error");
    } finally {
      setPromoApplying(false);
    }
  };

  const removePromo = () => {
    setDiscount(0);
    setAppliedPromoCode("");
    setPromoCode("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      pushToast(validationError, "error");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    // Generate a unique ID for this submission so the browser Pixel event and
    // the server-side CAPI event can be deduplicated by Meta.
    const capiEventId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Read _fbp / _fbc cookies set by Meta Pixel (used by CAPI for better matching)
    const getCookie = (name: string) =>
      document.cookie.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1] ?? undefined;
    const fbp = getCookie("_fbp");
    const fbc = getCookie("_fbc");

    // Lead fires when the customer submits the form (intent confirmed)
    pixelLead(capiEventId);
    trackEvent({ eventType: "order_submit" });

    try {
      const order = await orderService.createOrder({
        customer: {
          fullName,
          phone,
          wilayaCode,
          commune,
          address,
        },
        items: cart.map((item) => ({
          productId: item.product._id,
          variantId: item.variant._id,
          quantity: item.quantity,
        })),
        deliveryType,
        promoCode: promoCode || undefined,
        affiliateRef: affiliateRef || undefined,
        capiEventId,
        fbp,
        fbc,
        clientUserAgent: navigator.userAgent,
      });

      // Purchase fires only after the backend confirms the order was created.
      // eventID matches the _purchase suffix in capi.ts to keep deduplication correct.
      pixelPurchase({ orderId: order._id, value: total, eventID: capiEventId });
      trackEvent({ eventType: "purchase", orderId: order._id });

      window.localStorage.removeItem(checkoutDraftKey);
      rememberPendingOrder(null);
      rememberConfirmedOrder(order);
      clearCart();
      navigate("/order/success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create order";
      setErrorMessage(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <Seo title={translate(language, "checkoutTitle")} description={translate(language, "checkoutDescription")} path="/checkout" noindex />

      {/* Fixed mobile CTA — scrolls to the form */}
      <div className="fixed bottom-0 start-0 end-0 z-30 border-t border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => document.getElementById("checkout-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="flex w-full items-center justify-between gap-3 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4 text-base font-semibold text-white shadow-[0_8px_24px_rgba(20,184,166,0.35)] transition active:scale-95"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {translate(language, "checkoutSubmit")}
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold">{formatCurrency(total, language)}</span>
        </button>
      </div>

      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-950 sm:text-3xl">{translate(language, "checkoutTitle")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{translate(language, "checkoutDescription")}</p>
        <div className="mt-4 flex max-w-3xl items-start gap-3 rounded-[1.5rem] border border-teal-100 bg-teal-50/80 p-4 text-sm text-teal-900">
          <Phone className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{translate(language, "orderSuccessDescription")}</div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <form id="checkout-form" onSubmit={submit} className="surface-card order-2 space-y-6 p-6 lg:order-1">
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-white">1</div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{translate(language, "checkoutStepCustomer")}</h2>
                <p className="text-sm text-slate-500">{translate(language, "checkoutSecureNote")}</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <IconField icon={UserRound}>
                  <input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="field-input field-input-icon" placeholder={translate(language, "fullName")} />
                </IconField>
                <p className="ps-1 text-xs text-slate-400">{translate(language, "checkoutHintFullName")}</p>
              </div>
              <div className="space-y-1.5">
                <IconField icon={Phone}>
                  <input
                    required
                    dir="ltr"
                    inputMode="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="field-input field-input-icon"
                    placeholder="0555 12 34 56"
                  />
                </IconField>
                <p className="ps-1 text-xs text-slate-400">{translate(language, "checkoutHintPhone")}</p>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-teal-600 text-white">2</div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{translate(language, "checkoutStepDelivery")}</h2>
                <p className="text-sm text-slate-500">{translate(language, "trustDelivery")}</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <IconField icon={MapPin}>
                <select value={wilayaCode} onChange={(event) => setWilayaCode(event.target.value)} className="field-select field-input-icon">
                  {wilayas.map((wilaya) => (
                    <option key={wilaya._id} value={wilaya.code}>
                      {wilaya.code} · {language === "ar" ? wilaya.name.ar : language === "fr" ? wilaya.name.fr : wilaya.name.en}
                    </option>
                  ))}
                </select>
              </IconField>
              {selectedWilaya?.communes?.length && !communeOther ? (
                <IconField icon={MapPinned}>
                  <select
                    value={commune}
                    onChange={(event) => {
                      if (event.target.value === "__other__") {
                        setCommuneOther(true);
                        setCommune("");
                        return;
                      }
                      setCommune(event.target.value);
                    }}
                    className="field-select field-input-icon"
                  >
                    <option value="">{translate(language, "commune")}</option>
                    {selectedWilaya.communes.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                    <option value="__other__">{translate(language, "communeOther")}</option>
                  </select>
                </IconField>
              ) : (
                <div className="flex flex-col gap-2">
                  <IconField icon={MapPinned}>
                    <input required value={commune} onChange={(event) => setCommune(event.target.value)} className="field-input field-input-icon" placeholder={translate(language, "commune")} />
                  </IconField>
                  {selectedWilaya?.communes?.length ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCommuneOther(false);
                        setCommune("");
                      }}
                      className="self-start text-xs font-semibold text-teal-700 underline"
                    >
                      {translate(language, "communeChooseFromList")}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDeliveryType("DESK_PICKUP")}
                className={`relative rounded-[1.5rem] border p-4 text-start transition ${
                  deliveryType === "DESK_PICKUP"
                    ? "border-teal-500 bg-teal-50 shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                {deliveryType === "DESK_PICKUP" && (
                  <span className="absolute end-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-teal-500 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <div className={`mb-2 grid h-10 w-10 place-items-center rounded-2xl ${deliveryType === "DESK_PICKUP" ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"}`}>
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="font-semibold text-slate-950">{translate(language, "deskPickup")}</div>
                <div className="mt-1 text-xs text-slate-500">{translate(language, "checkoutDeliveryDeskDesc")}</div>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryType("HOME_DELIVERY")}
                className={`relative rounded-[1.5rem] border p-4 text-start transition ${
                  deliveryType === "HOME_DELIVERY"
                    ? "border-teal-500 bg-teal-50 shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                {deliveryType === "HOME_DELIVERY" && (
                  <span className="absolute end-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-teal-500 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <div className={`mb-2 grid h-10 w-10 place-items-center rounded-2xl ${deliveryType === "HOME_DELIVERY" ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"}`}>
                  <Home className="h-5 w-5" />
                </div>
                <div className="font-semibold text-slate-950">{translate(language, "homeDelivery")}</div>
                <div className="mt-1 text-xs text-slate-500">{translate(language, "checkoutDeliveryHomeDesc")}</div>
              </button>
            </div>

            <div className="mt-4 space-y-1.5">
              <IconField icon={Home}>
                <textarea required value={address} onChange={(event) => setAddress(event.target.value)} rows={4} className="field-textarea field-input-icon" placeholder={translate(language, "address")} />
              </IconField>
              <p className="ps-1 text-xs text-slate-400">{translate(language, "checkoutHintAddress")}</p>
            </div>
          </section>

          {siteSettings?.promoCodeEnabled !== false ? (
            <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50/70 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-900">{translate(language, "promoCode")}</div>
              {appliedPromoCode ? (
                <div className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <BadgeCheck className="h-4 w-4 shrink-0" />
                    <span>
                      {appliedPromoCode} · {translate(language, "promoApplied")} (-{formatCurrency(discount, language)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={removePromo}
                    aria-label={translate(language, "removePromo")}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <IconField icon={Tag} className="flex-1">
                    <input
                      value={promoCode}
                      onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                      className="field-input field-input-icon w-full uppercase"
                      placeholder={translate(language, "promoCode")}
                    />
                  </IconField>
                  <button type="button" onClick={() => void applyPromo()} disabled={promoApplying} className="accent-button">
                    {promoApplying ? translate(language, "applyingPromo") : translate(language, "applyPromo")}
                  </button>
                </div>
              )}
            </section>
          ) : null}

          {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
          <button
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 py-4 text-base font-semibold text-white shadow-[0_14px_32px_rgba(20,184,166,0.28)] transition hover:from-teal-500 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ShieldCheck className="h-5 w-5" />
            {submitting ? translate(language, "checkoutSubmitting") : translate(language, "checkoutSubmit")}
          </button>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-teal-700" />
              {translate(language, "checkoutTrustSecure")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-700" />
              {translate(language, "checkoutTrustCod")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-teal-700" />
              {translate(language, "checkoutTrustDelivery")}
            </span>
          </div>
        </form>

        <div className="order-1 space-y-4 lg:order-2">
          <div className="lg:sticky lg:top-24 lg:space-y-4">
            <OrderSummaryCard
              cart={cart}
              subtotal={subtotal}
              shippingFee={shippingFee}
              discount={discount}
              total={total}
              language={language}
              onUpdateQuantity={updateQuantity}
              onRemove={removeFromCart}
            />
            <div className="surface-card mt-4 p-5 lg:mt-0">
              <div className="text-sm text-slate-500">{translate(language, "shippingFee")}</div>
              <div className="mt-2 text-lg font-semibold text-slate-950">{selectedWilaya ? `${selectedWilaya.code} · ${language === "ar" ? selectedWilaya.name.ar : language === "fr" ? selectedWilaya.name.fr : selectedWilaya.name.en}` : "-"}</div>
              <div className="mt-2 text-sm text-slate-600">{translate(language, deliveryType === "HOME_DELIVERY" ? "checkoutDeliveryHomeDesc" : "checkoutDeliveryDeskDesc")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
