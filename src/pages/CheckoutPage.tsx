import { Bot, MapPinned, PackageCheck, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { OrderSummaryCard } from "@/components/OrderSummaryCard";
import { useApp } from "@/hooks/useApp";
import { orderService } from "@/services/order.service";
import { promoService } from "@/services/promo.service";
import { shippingService } from "@/services/shipping.service";
import type { DeliveryType, Wilaya } from "@/types";
import { translate } from "@/utils/i18n";

const phonePattern = /^(05|06|07)\d{8}$/;

export function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, affiliateRef, language, rememberPendingOrder, pushToast, updateQuantity, removeFromCart, siteSettings } = useApp();
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [wilayaCode, setWilayaCode] = useState("16");
  const [commune, setCommune] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("DESK_PICKUP");
  const [promoCode, setPromoCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [promoApplying, setPromoApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.variant.price * item.quantity, 0), [cart]);
  const total = Math.max(0, subtotal + shippingFee - discount);
  const selectedWilaya = wilayas.find((wilaya) => wilaya.code === wilayaCode);

  if (cart.length === 0) {
    return <EmptyState title={translate(language, "emptyCart")} description={translate(language, "cartDescription")} />;
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
      pushToast(translate(language, "promoApplied"), "success");
    } catch (error) {
      setDiscount(0);
      const message = error instanceof Error ? error.message : translate(language, "promoRejected");
      setErrorMessage(message);
      pushToast(message, "error");
    } finally {
      setPromoApplying(false);
    }
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
      });

      rememberPendingOrder({ orderId: order._id, orderNumber: order.orderNumber });
      navigate("/checkout/confirm");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create order";
      setErrorMessage(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { icon: UserRound, label: translate(language, "checkoutStepCustomer") },
    { icon: MapPinned, label: translate(language, "checkoutStepDelivery") },
    { icon: Bot, label: translate(language, "checkoutStepAi") },
    { icon: PackageCheck, label: translate(language, "checkoutStepSuccess") },
  ];

  return (
    <div className="space-y-6">
      <section className="surface-card p-6 md:p-8">
        <h1 className="font-serif text-4xl font-semibold text-slate-950">{translate(language, "checkoutTitle")}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{translate(language, "checkoutDescription")}</p>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.label} className={`rounded-[1.5rem] px-4 py-4 ${index === 0 ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>
              <step.icon className="h-5 w-5" />
              <div className="mt-3 text-sm font-semibold">{step.label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <form onSubmit={submit} className="surface-card space-y-6 p-6">
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-white">1</div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{translate(language, "checkoutStepCustomer")}</h2>
                <p className="text-sm text-slate-500">{translate(language, "checkoutSecureNote")}</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="field-input" placeholder={translate(language, "fullName")} />
              <input required value={phone} onChange={(event) => setPhone(event.target.value)} className="field-input" placeholder="05 / 06 / 07..." />
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
              <select value={wilayaCode} onChange={(event) => setWilayaCode(event.target.value)} className="field-select">
                {wilayas.map((wilaya) => (
                  <option key={wilaya._id} value={wilaya.code}>
                    {wilaya.code} · {language === "ar" ? wilaya.name.ar : language === "fr" ? wilaya.name.fr : wilaya.name.en}
                  </option>
                ))}
              </select>
              {selectedWilaya?.communes?.length ? (
                <select value={commune} onChange={(event) => setCommune(event.target.value)} className="field-select">
                  <option value="">{translate(language, "commune")}</option>
                  {selectedWilaya.communes.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              ) : (
                <input required value={commune} onChange={(event) => setCommune(event.target.value)} className="field-input" placeholder={translate(language, "commune")} />
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setDeliveryType("DESK_PICKUP")}
                className={`rounded-[1.5rem] border px-5 py-4 text-left transition ${
                  deliveryType === "DESK_PICKUP" ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white"
                }`}
              >
                <div className="font-semibold text-slate-950">{translate(language, "deskPickup")}</div>
                <div className="mt-1 text-sm text-slate-500">{translate(language, "checkoutDeliveryDeskDesc")}</div>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryType("HOME_DELIVERY")}
                className={`rounded-[1.5rem] border px-5 py-4 text-left transition ${
                  deliveryType === "HOME_DELIVERY" ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white"
                }`}
              >
                <div className="font-semibold text-slate-950">{translate(language, "homeDelivery")}</div>
                <div className="mt-1 text-sm text-slate-500">{translate(language, "checkoutDeliveryHomeDesc")}</div>
              </button>
            </div>

            <textarea required value={address} onChange={(event) => setAddress(event.target.value)} rows={4} className="field-textarea mt-4" placeholder={translate(language, "address")} />
          </section>

          {siteSettings?.promoCodeEnabled !== false ? (
            <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50/70 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-900">{translate(language, "promoCode")}</div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                  className="field-input flex-1 uppercase"
                  placeholder={translate(language, "promoCode")}
                />
                <button type="button" onClick={() => void applyPromo()} disabled={promoApplying} className="accent-button">
                  {promoApplying ? translate(language, "applyingPromo") : translate(language, "applyPromo")}
                </button>
              </div>
            </section>
          ) : null}

          {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
          <button disabled={submitting} className="secondary-button flex w-full justify-center py-4">
            {submitting ? translate(language, "checkoutSubmitting") : translate(language, "checkoutSubmit")}
          </button>
        </form>

        <div className="space-y-4">
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
          <div className="surface-card p-5">
            <div className="text-sm text-slate-500">{translate(language, "shippingFee")}</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{selectedWilaya ? `${selectedWilaya.code} · ${language === "ar" ? selectedWilaya.name.ar : language === "fr" ? selectedWilaya.name.fr : selectedWilaya.name.en}` : "-"}</div>
            <div className="mt-2 text-sm text-slate-600">{translate(language, deliveryType === "HOME_DELIVERY" ? "checkoutDeliveryHomeDesc" : "checkoutDeliveryDeskDesc")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
