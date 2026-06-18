import { BadgeCheck, Building2, Check, CheckCircle2, Home, Lock, MapPin, MapPinned, Phone, RefreshCw, Send, ShieldCheck, Tag, Truck, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { IconField } from "@/components/IconField";
import { OrderSummaryCard } from "@/components/OrderSummaryCard";
import { Seo } from "@/components/Seo";
import { useApp } from "@/hooks/useApp";
import { orderService } from "@/services/order.service";
import { otpService } from "@/services/otp.service";
import { promoService } from "@/services/promo.service";
import { shippingService } from "@/services/shipping.service";
import { type ZRTerritory, zrShippingService } from "@/services/shipping.zr.service";
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
  const [zrTerritories, setZrTerritories] = useState<ZRTerritory[]>([]);
  const [selectedZrTerritory, setSelectedZrTerritory] = useState<ZRTerritory | null>(null);
  const [communeSearch, setCommuneSearch] = useState("");
  const [showCommuneSuggestions, setShowCommuneSuggestions] = useState(false);

  // OTP verification state
  const [otpChannels, setOtpChannels] = useState<{ whatsapp: boolean } | null>(null);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [phoneVerificationToken, setPhoneVerificationToken] = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const otpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(checkoutDraftKey);
      if (!raw) {
        return;
      }
      const draft = JSON.parse(raw) as Partial<{
        fullName: string;
        firstName: string;
        lastName: string;
        phone: string;
        wilayaCode: string;
        commune: string;
        communeOther: boolean;
        address: string;
        deliveryType: DeliveryType;
      }>;
      const draftFirstName = draft.firstName || draft.fullName?.trim().split(/\s+/).slice(0, -1).join(" ") || draft.fullName || "";
      const draftLastName = draft.lastName || draft.fullName?.trim().split(/\s+/).slice(-1).join(" ") || "";
      setFirstName(draftFirstName);
      setLastName(draftLastName);
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
    // Skip manual shipping calculation when ZR territory is selected (ZR provides the fee)
    if (!wilayaCode || selectedZrTerritory) return;

    void shippingService
      .calculateShipping({ wilayaCode, deliveryType })
      .then((response) => {
        setShippingFee(response.fee);
      })
      .catch(() => {
        setShippingFee(0);
        pushToast(translate(language, "checkoutShippingFeeError"), "error");
      });
  }, [deliveryType, wilayaCode, selectedZrTerritory, language, pushToast]);

  useEffect(() => {
    window.localStorage.setItem(
      checkoutDraftKey,
      JSON.stringify({ firstName, lastName, fullName: [firstName, lastName].filter(Boolean).join(" ").trim(), phone, wilayaCode, commune, communeOther, address, deliveryType }),
    );
  }, [address, commune, communeOther, deliveryType, firstName, lastName, phone, wilayaCode]);

  // Load available OTP channels once
  useEffect(() => {
    otpService.getChannels().then(setOtpChannels).catch(() => setOtpChannels({ whatsapp: false }));
  }, []);

  // Load ZR territories once
  useEffect(() => {
    zrShippingService.getTerritories().then(setZrTerritories).catch(() => setZrTerritories([]));
  }, []);

  // When ZR territory is selected, update shipping fee from ZR rates
  useEffect(() => {
    if (!selectedZrTerritory || zrTerritories.length === 0) return;
    const fee = deliveryType === "HOME_DELIVERY" ? selectedZrTerritory.homePrice : selectedZrTerritory.pickupPrice;
    if (fee > 0) setShippingFee(fee);
  }, [selectedZrTerritory, deliveryType, zrTerritories.length]);

  // Reset OTP if phone changes
  useEffect(() => {
    if (verifiedPhone && phone !== verifiedPhone) {
      setPhoneVerificationToken(null);
      setVerifiedPhone("");
      setOtpSent(false);
      setOtpCode("");
      setOtpSecondsLeft(0);
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    }
  }, [phone, verifiedPhone]);

  useEffect(() => {
    return () => {
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    };
  }, []);

  const otpRequired = Boolean(otpChannels?.whatsapp);
  const phoneIsValid = phonePattern.test(phone.trim());
  const isPhoneVerified = Boolean(phoneVerificationToken && verifiedPhone === phone);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  const sendOtp = async () => {
    if (!phoneIsValid || otpSending) return;
    setOtpModalOpen(true);
    setOtpSending(true);
    try {
      const result = await otpService.sendOtp(phone.trim(), "whatsapp");
      setOtpSent(true);
      setOtpCode("");
      const ttl = result.expiresIn ?? 300;
      setOtpSecondsLeft(ttl);
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
      otpTimerRef.current = setInterval(() => {
        setOtpSecondsLeft((s) => {
          if (s <= 1) { clearInterval(otpTimerRef.current!); return 0; }
          return s - 1;
        });
      }, 1000);
      pushToast(language === "ar" ? "تم إرسال رمز التحقق" : language === "fr" ? "Code envoyé" : "Code sent", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : translate(language, "adminActionError"), "error");
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtp = async () => {
    if (otpCode.length !== 6 || otpVerifying) return;
    setOtpVerifying(true);
    try {
      const result = await otpService.verifyOtp(phone.trim(), otpCode);
      setPhoneVerificationToken(result.verificationToken);
      setVerifiedPhone(phone.trim());
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
      setOtpSecondsLeft(0);
      setOtpModalOpen(false);
      pushToast(language === "ar" ? "تم التحقق من رقم الهاتف ✓" : language === "fr" ? "Numéro vérifié ✓" : "Phone verified ✓", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : translate(language, "adminActionError"), "error");
    } finally {
      setOtpVerifying(false);
    }
  };

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.variant.price * item.quantity, 0), [cart]);
  const total = Math.max(0, subtotal + shippingFee - discount);
  const selectedWilaya = wilayas.find((wilaya) => wilaya.code === wilayaCode);

  const useZrCommunes = zrTerritories.length > 0;
  const filteredZrTerritories = useMemo(() => {
    if (!useZrCommunes || communeSearch.trim().length < 2) return [];
    const q = communeSearch.trim().toLowerCase();
    return zrTerritories.filter(
      (t) => t.name.toLowerCase().includes(q) || t.nameAr.includes(communeSearch.trim()),
    ).slice(0, 8);
  }, [zrTerritories, communeSearch, useZrCommunes]);

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
    if (!firstName.trim() || !lastName.trim()) {
      return translate(language, "checkoutValidationFullName");
    }
    if (!phonePattern.test(phone.trim())) {
      return translate(language, "checkoutValidationPhone");
    }
    if (otpRequired && !isPhoneVerified) {
      return language === "ar"
        ? "يجب التحقق من رقم هاتفك عبر WhatsApp أو Telegram أولاً"
        : language === "fr"
          ? "Veuillez vérifier votre numéro de téléphone d'abord"
          : "Please verify your phone number first";
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
        phoneVerificationToken: phoneVerificationToken ?? undefined,
        zrTerritoryId: selectedZrTerritory?.id,
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
            {language === "ar" ? "أكمل بياناتك" : language === "fr" ? "Remplir le formulaire" : "Fill in your details"}
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold">{formatCurrency(total, language)}</span>
        </button>
      </div>

      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-950 sm:text-3xl">{translate(language, "checkoutTitle")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{translate(language, "checkoutDescription")}</p>
        <div className="mt-4 flex max-w-3xl items-start gap-3 rounded-[1.5rem] border border-teal-100 bg-teal-50/80 p-4 text-sm text-teal-900">
          <Phone className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{translate(language, "checkoutHintPhone")}</div>
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
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <IconField icon={UserRound}>
                  <input
                    required
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="field-input field-input-icon"
                    placeholder={language === "ar" ? "الاسم" : language === "fr" ? "Prenom" : "First name"}
                  />
                </IconField>
              </div>
              <div className="space-y-1.5">
                <IconField icon={UserRound}>
                  <input
                    required
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="field-input field-input-icon"
                    placeholder={language === "ar" ? "اللقب" : language === "fr" ? "Nom" : "Last name"}
                  />
                </IconField>
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
            <p className="mt-2 ps-1 text-xs text-slate-400">{translate(language, "checkoutHintFullName")}</p>

            {/* OTP Phone Verification Panel */}
            {otpRequired && phoneIsValid && (
              <div className={`mt-4 rounded-2xl border p-4 transition-all ${isPhoneVerified ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-blue-50"}`}>
                {isPhoneVerified ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                    {language === "ar" ? "تم التحقق من رقم الهاتف" : language === "fr" ? "Numéro vérifié" : "Phone verified"}
                    <span className="ms-auto text-xs font-normal text-emerald-600 opacity-70">{phone}</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                      <ShieldCheck className="h-4 w-4" />
                      {language === "ar" ? "التحقق من رقم الهاتف" : language === "fr" ? "Vérification du numéro" : "Phone Verification"}
                    </div>

                    {/* Send OTP button */}
                    {!otpSent || otpSecondsLeft === 0 ? (
                      <button
                        type="button"
                        onClick={() => void sendOtp()}
                        disabled={otpSending}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                      >
                        <Send className="h-4 w-4" />
                        {otpSending
                          ? language === "ar" ? "جاري الإرسال..." : language === "fr" ? "Envoi..." : "Sending..."
                          : language === "ar" ? "إرسال رمز التحقق" : language === "fr" ? "Envoyer le code" : "Send verification code"}
                      </button>
                    ) : null}

                    {/* OTP code input */}
                    {otpSent && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-blue-700">
                            {language === "ar" ? "أُرسل الرمز عبر WhatsApp" : language === "fr" ? "Code envoyé via WhatsApp" : "Code sent via WhatsApp"}
                          </p>
                          {otpSecondsLeft > 0 && (
                            <span className="text-[11px] text-blue-500">
                              {Math.floor(otpSecondsLeft / 60)}:{String(otpSecondsLeft % 60).padStart(2, "0")}
                            </span>
                          )}
                          {otpSecondsLeft === 0 && (
                            <button type="button" onClick={() => void sendOtp()} disabled={otpSending} className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800">
                              <RefreshCw className="h-3 w-3" />
                              {language === "ar" ? "إعادة إرسال" : language === "fr" ? "Renvoyer" : "Resend"}
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="_ _ _ _ _ _"
                            className="field-input flex-1 text-center font-mono text-lg tracking-widest"
                            dir="ltr"
                          />
                          <button
                            type="button"
                            onClick={() => void verifyOtp()}
                            disabled={otpCode.length !== 6 || otpVerifying}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {otpVerifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            {language === "ar" ? "تحقق" : language === "fr" ? "Vérifier" : "Verify"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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
              {useZrCommunes ? (
                // ZR Express territory-based commune autocomplete
                <div className="relative">
                  <IconField icon={MapPinned}>
                    <input
                      required
                      value={selectedZrTerritory ? `${selectedZrTerritory.name}${selectedZrTerritory.nameAr ? ` — ${selectedZrTerritory.nameAr}` : ""}` : communeSearch}
                      onChange={(event) => {
                        setCommuneSearch(event.target.value);
                        setSelectedZrTerritory(null);
                        setCommune("");
                        setShowCommuneSuggestions(true);
                      }}
                      onFocus={() => setShowCommuneSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowCommuneSuggestions(false), 150)}
                      className="field-input field-input-icon"
                      placeholder={language === "ar" ? "ابحث عن بلديتك..." : language === "fr" ? "Rechercher votre commune..." : "Search your commune..."}
                      autoComplete="off"
                    />
                  </IconField>
                  {showCommuneSuggestions && filteredZrTerritories.length > 0 && (
                    <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                      {filteredZrTerritories.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); }}
                            onClick={() => {
                              setSelectedZrTerritory(t);
                              setCommune(t.name);
                              setCommuneSearch("");
                              setShowCommuneSuggestions(false);
                            }}
                            className="flex w-full items-center justify-between px-4 py-2.5 text-start text-sm hover:bg-teal-50 hover:text-teal-800"
                          >
                            <span>
                              <span className="font-medium">{t.name}</span>
                              {t.nameAr ? <span className="ms-2 text-xs text-slate-400">{t.nameAr}</span> : null}
                            </span>
                            <span className="text-xs font-semibold text-teal-700">
                              {deliveryType === "HOME_DELIVERY" ? t.homePrice : t.pickupPrice} {language === "ar" ? "دج" : "DA"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : selectedWilaya?.communes?.length && !communeOther ? (
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
