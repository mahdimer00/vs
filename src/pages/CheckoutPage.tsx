import { BadgeCheck, Building2, Check, CheckCircle2, Clock3, Home, Lock, MapPin, MapPinned, MessageCircle, Phone, PhoneCall, RefreshCw, Send, ShieldCheck, Tag, Truck, UserRound, WalletCards, X } from "lucide-react";
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
import { pixelInitiateCheckout, pixelLead, pixelPurchase, pixelSetUserPhone } from "@/utils/pixel";
import { ttqAddPaymentInfo, ttqCompleteRegistration, ttqIdentify, ttqInitiateCheckout, ttqPlaceAnOrder, ttqPurchase } from "@/utils/tiktok";
import { trackEvent } from "@/utils/tracking";
import { trackFunnelStep, trackCheckoutError, trackFormValidationError } from "@/utils/checkoutFunnel";
import { sentrySetUser } from "@/utils/sentry";
import { clarityTag } from "@/utils/clarity";

const phonePattern = /^(05|06|07)\d{8}$/;
const checkoutDraftKey = "visastore-checkout-draft";

export function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, affiliateRef, language, rememberConfirmedOrder, rememberPendingOrder, clearCart, pushToast, updateQuantity, removeFromCart, siteSettings } = useApp();
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phone2, setPhone2] = useState("");
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
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const [zrTerritories, setZrTerritories] = useState<ZRTerritory[]>([]);
  const [selectedZrTerritory, setSelectedZrTerritory] = useState<ZRTerritory | null>(null);

  const [manualConfirm, setManualConfirm] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyModalStep, setVerifyModalStep] = useState<"choice" | "whatsapp">("choice");

  // OTP verification state
  const [otpChannels, setOtpChannels] = useState<{ whatsapp: boolean } | null>(null);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [phoneVerificationToken, setPhoneVerificationToken] = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [otpNotice, setOtpNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
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
      setFullName(draft.fullName || [draft.firstName, draft.lastName].filter(Boolean).join(" ").trim() || "");
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
    if (!wilayaCode) return;

    void shippingService
      .calculateShipping({ wilayaCode, deliveryType, zrTerritoryId: selectedZrTerritory?.id })
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
      JSON.stringify({ fullName, phone, wilayaCode, commune, communeOther, address, deliveryType }),
    );
  }, [address, commune, communeOther, deliveryType, fullName, phone, wilayaCode]);

  // Load available OTP channels once
  useEffect(() => {
    otpService.getChannels().then(setOtpChannels).catch(() => setOtpChannels({ whatsapp: false }));
  }, []);

  // Load ZR territories once
  useEffect(() => {
    zrShippingService.getTerritories().then(setZrTerritories).catch(() => setZrTerritories([]));
  }, []);

  // Identify user with TikTok + Meta + Sentry as soon as phone is valid
  useEffect(() => {
    if (phonePattern.test(phone.trim())) {
      void ttqIdentify(phone.trim());
      pixelSetUserPhone(phone.trim());
      sentrySetUser(phone.trim());
      clarityTag("phone_prefix", phone.trim().slice(0, 4));
      trackFunnelStep("phone_entered");
    }
  }, [phone]);

  // Reset OTP if phone changes
  useEffect(() => {
    if (verifiedPhone && phone !== verifiedPhone) {
      setPhoneVerificationToken(null);
      setVerifiedPhone("");
      setOtpSent(false);
      setOtpCode("");
      setOtpNotice(null);
      setOtpSecondsLeft(0);
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    }
  }, [phone, verifiedPhone]);

  // Auto-submit after OTP verified inside the popup modal
  const isPhoneVerifiedRef = useRef(false);
  useEffect(() => {
    const justVerified = Boolean(phoneVerificationToken) && !isPhoneVerifiedRef.current;
    isPhoneVerifiedRef.current = Boolean(phoneVerificationToken);
    if (justVerified && showVerifyModal) {
      setShowVerifyModal(false);
      void placeOrder();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneVerificationToken, showVerifyModal]);

  useEffect(() => {
    if (!commune.trim() || selectedZrTerritory || zrTerritories.length === 0) {
      return;
    }

    const normalizedCommune = commune.trim().toLowerCase();
    const match = zrTerritories.find((territory) =>
      territory.wilayaCode === wilayaCode &&
      (territory.name.toLowerCase() === normalizedCommune || territory.nameAr === commune.trim())
    );

    if (match) {
      setSelectedZrTerritory(match);
      setCommuneOther(false);
    }
  }, [commune, selectedZrTerritory, wilayaCode, zrTerritories]);

  useEffect(() => {
    return () => {
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    };
  }, []);

  const otpRequired = Boolean(otpChannels?.whatsapp);
  const phoneIsValid = phonePattern.test(phone.trim());
  const isPhoneVerified = Boolean(phoneVerificationToken && verifiedPhone === phone);
  const selectedWilayaZrTerritories = useMemo(
    () => zrTerritories.filter((territory) => territory.wilayaCode === wilayaCode),
    [wilayaCode, zrTerritories],
  );
  const otpTimerLabel = `${Math.floor(otpSecondsLeft / 60)}:${String(otpSecondsLeft % 60).padStart(2, "0")}`;
  const otpNoticeClassName = otpNotice?.tone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-rose-200 bg-rose-50 text-rose-700";

  const sendOtp = async () => {
    if (!phoneIsValid || otpSending) return;
    setOtpSending(true);
    setOtpNotice(null);
    try {
      const result = await otpService.sendOtp(phone.trim(), "whatsapp");
      void ttqIdentify(phone.trim());
      const _ttqContents = cart.map((i) => ({ content_id: i.product._id, content_type: "product", content_name: i.product.name.en || i.product.name.ar || i.product.name.fr }));
      ttqAddPaymentInfo(_ttqContents, subtotal);
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
      setOtpNotice({
        tone: "success",
        text: language === "ar"
          ? "تم إرسال رمز التحقق عبر واتساب."
          : language === "fr"
            ? "Le code WhatsApp a ete envoye."
            : "The WhatsApp verification code was sent.",
      });
      pushToast(language === "ar" ? "تم إرسال رمز التحقق" : language === "fr" ? "Code envoyé" : "Code sent", "success");
    } catch (err) {
      setOtpSent(false);
      setOtpNotice({
        tone: "error",
        text: err instanceof Error ? err.message : translate(language, "adminActionError"),
      });
      pushToast(err instanceof Error ? err.message : translate(language, "adminActionError"), "error");
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtp = async () => {
    if (otpCode.length !== 6 || otpVerifying) return;
    setOtpVerifying(true);
    setOtpNotice(null);
    try {
      const result = await otpService.verifyOtp(phone.trim(), otpCode);
      ttqCompleteRegistration();
      setPhoneVerificationToken(result.verificationToken);
      setVerifiedPhone(phone.trim());
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
      setOtpSecondsLeft(0);
      setOtpNotice({
        tone: "success",
        text: language === "ar"
          ? "تم التحقق من رقم الهاتف بنجاح."
          : language === "fr"
            ? "Le numero a ete verifie."
            : "The phone number was verified.",
      });
      pushToast(language === "ar" ? "تم التحقق من رقم الهاتف ✓" : language === "fr" ? "Numéro vérifié ✓" : "Phone verified ✓", "success");
    } catch (err) {
      setOtpNotice({
        tone: "error",
        text: err instanceof Error ? err.message : translate(language, "adminActionError"),
      });
      pushToast(err instanceof Error ? err.message : translate(language, "adminActionError"), "error");
    } finally {
      setOtpVerifying(false);
    }
  };

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.variant.price * item.quantity, 0), [cart]);
  const total = Math.max(0, subtotal + shippingFee - discount);
  const selectedWilaya = wilayas.find((wilaya) => wilaya.code === wilayaCode);

  const useZrCommunes = selectedWilayaZrTerritories.length > 0;

  // Track InitiateCheckout once when the page mounts with items in cart
  useEffect(() => {
    if (cart.length === 0) return;
    const numItems = cart.reduce((n, item) => n + item.quantity, 0);
    pixelInitiateCheckout({ value: subtotal, numItems });
    const ttqContents = cart.map((i) => ({ content_id: i.product._id, content_type: "product", content_name: i.product.name.en || i.product.name.ar || i.product.name.fr }));
    ttqInitiateCheckout(ttqContents, subtotal);
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

  const scrollToField = (fieldId: string) => {
    setInvalidField(fieldId);
    setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
    }, 50);
  };

  const validate = () => {
    const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
    if (nameParts.length < 2 || nameParts.some((p) => p.length < 2)) {
      trackFormValidationError("fullName");
      scrollToField("field-fullname");
      return language === "ar"
        ? "⚠️ يرجى إدخال الاسم الكامل — الاسم واللقب معاً (مثال: أحمد محمد)"
        : language === "fr"
          ? "⚠️ Entrez prénom ET nom — ex: Ahmed Mohamed"
          : "⚠️ Enter first AND last name — e.g. Ahmed Mohamed";
    }
    if (!phonePattern.test(phone.trim())) {
      trackFormValidationError("phone");
      scrollToField("field-phone");
      return language === "ar"
        ? "⚠️ رقم الهاتف غير صحيح — يجب أن يبدأ بـ 05 أو 06 أو 07"
        : language === "fr"
          ? "⚠️ Numéro invalide — doit commencer par 05, 06 ou 07"
          : "⚠️ Invalid phone — must start with 05, 06 or 07";
    }
    if (!commune.trim()) {
      trackFormValidationError("commune");
      scrollToField("field-commune");
      return language === "ar"
        ? "⚠️ يرجى اختيار البلدية"
        : language === "fr"
          ? "⚠️ Veuillez choisir votre commune"
          : "⚠️ Please select your commune";
    }
    if (address.trim().length < 5) {
      trackFormValidationError("address");
      scrollToField("field-address");
      return language === "ar"
        ? "⚠️ يرجى كتابة عنوانك بالتفصيل (مثال: حي النصر، شارع 20، رقم 5)"
        : language === "fr"
          ? "⚠️ Écrivez votre adresse complète (ex: Cité Nasr, rue 20, n°5)"
          : "⚠️ Write your full address (e.g. El Nasr district, street 20, n°5)";
    }
    setInvalidField(null);
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

  const placeOrder = async (opts: { manualConfirmOverride?: boolean } = {}) => {
    const effectiveManualConfirm = opts.manualConfirmOverride ?? manualConfirm;

    setSubmitting(true);
    setErrorMessage("");

    const capiEventId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const getCookie = (name: string) =>
      document.cookie.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1] ?? undefined;
    const fbp = getCookie("_fbp");
    const fbc = getCookie("_fbc");

    pixelSetUserPhone(phone); // Refresh advanced matching before Lead/Purchase
    pixelLead(capiEventId);
    const _placeContents = cart.map((i) => ({ content_id: i.product._id, content_type: "product", content_name: i.product.name.en || i.product.name.ar || i.product.name.fr }));
    void ttqIdentify(phone);
    ttqPlaceAnOrder(_placeContents, total, capiEventId);
    trackEvent({ eventType: "order_submit" });

    try {
      const order = await orderService.createOrder({
        customer: {
          fullName,
          phone,
          phone2: phone2 && /^(05|06|07)\d{8}$/.test(phone2) ? phone2 : undefined,
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
        manualConfirm: effectiveManualConfirm || undefined,
        zrTerritoryId: selectedZrTerritory?.id,
        fbp,
        fbc,
        clientUserAgent: navigator.userAgent,
      });

      pixelPurchase({ orderId: order._id, value: total, eventID: capiEventId });
      ttqPurchase(_placeContents, total, `${capiEventId}_ttq_purchase`);
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      // Scroll to error banner at top of form
      setTimeout(() => {
        document.getElementById("checkout-error-banner")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
      return;
    }
    setInvalidField(null);
    if (otpRequired && !isPhoneVerified && !manualConfirm) {
      setShowVerifyModal(true);
      return;
    }
    await placeOrder();
  };

  return (
    <>
    <div className="space-y-6">
      <Seo title={translate(language, "checkoutTitle")} description={translate(language, "checkoutDescription")} path="/checkout" noindex />


      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-950 sm:text-3xl">{translate(language, "checkoutTitle")}</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <form id="checkout-form" onSubmit={submit} className="surface-card order-2 space-y-6 p-4 sm:p-6 lg:order-1">

          {/* Error banner — top of form, scrolled to automatically on validation fail */}
          {errorMessage ? (
            <div id="checkout-error-banner" className="flex items-start gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-4 shadow-sm">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
              </div>
              <div>
                <p className="font-bold text-rose-800">{errorMessage}</p>
                <p className="mt-0.5 text-sm text-rose-600">
                  {language === "ar" ? "انتبه للحقل المحدد باللون الأحمر أدناه 👇" : language === "fr" ? "Regardez le champ en rouge ci-dessous 👇" : "Look at the highlighted field below 👇"}
                </p>
              </div>
            </div>
          ) : null}

          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-white">1</div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{translate(language, "checkoutStepCustomer")}</h2>
                <p className="text-sm text-slate-500">{translate(language, "checkoutSecureNote")}</p>
              </div>
            </div>
            <div className="grid gap-4">
              {/* Full name — single field, requires 2 words, live validation */}
              {(() => {
                const parts = fullName.trim().split(/\s+/).filter(Boolean);
                const hasTwo = parts.length >= 2 && parts.every((p) => p.length >= 2);
                const typedSomething = fullName.trim().length > 0;
                return (
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">
                      {language === "ar" ? "الاسم الكامل" : language === "fr" ? "Nom complet" : "Full name"}
                      <span className="ms-1 text-rose-500">*</span>
                    </label>
                    <IconField icon={UserRound}>
                      <input
                        id="field-fullname"
                        required
                        value={fullName}
                        onChange={(event) => { setFullName(event.target.value); if (invalidField === "field-fullname") setInvalidField(null); }}
                        className={`field-input field-input-icon transition ${invalidField === "field-fullname" ? "border-rose-500 ring-2 ring-rose-200" : typedSomething && !hasTwo ? "border-amber-400 ring-1 ring-amber-200" : typedSomething && hasTwo ? "border-emerald-400 ring-1 ring-emerald-200" : ""}`}
                        placeholder={language === "ar" ? "أحمد محمد" : language === "fr" ? "Ahmed Mohamed" : "Ahmed Mohamed"}
                        autoComplete="name"
                      />
                    </IconField>
                    {typedSomething && !hasTwo ? (
                      <p className="ps-1 text-xs font-medium text-amber-600">
                        ⚠️ {language === "ar"
                          ? "يرجى إدخال الاسم واللقب معاً — مثال: أحمد محمد"
                          : language === "fr"
                            ? "Ajoutez votre prénom et nom — ex: Ahmed Mohamed"
                            : "Please enter both first and last name — e.g. Ahmed Mohamed"}
                      </p>
                    ) : typedSomething && hasTwo ? (
                      <p className="ps-1 text-xs font-medium text-emerald-600">
                        ✓ {language === "ar" ? "تم — الاسم صحيح" : language === "fr" ? "Correct ✓" : "Name looks good ✓"}
                      </p>
                    ) : (
                      <p className="ps-1 text-xs text-slate-400">
                        {language === "ar"
                          ? "مثال: أحمد محمد — الاسم واللقب إلزاميان"
                          : language === "fr"
                            ? "Ex: Ahmed Mohamed — prénom et nom obligatoires"
                            : "E.g. Ahmed Mohamed — first and last name required"}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Primary phone */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    {language === "ar" ? "رقم الهاتف" : language === "fr" ? "Numéro de téléphone" : "Phone number"}
                    <span className="ms-1 text-rose-500">*</span>
                  </label>
                  <IconField icon={Phone}>
                    <input
                      id="field-phone"
                      required
                      dir="ltr"
                      inputMode="tel"
                      value={phone}
                      onChange={(event) => { setPhone(event.target.value.replace(/\D/g, "").slice(0, 10)); if (invalidField === "field-phone") setInvalidField(null); }}
                      className={`field-input field-input-icon transition ${invalidField === "field-phone" ? "border-rose-500 ring-2 ring-rose-200" : ""}`}
                      placeholder="0555 12 34 56"
                      autoComplete="tel"
                    />
                  </IconField>
                  <p className="ps-1 text-xs text-slate-400">{translate(language, "checkoutHintPhone")}</p>
                </div>

                {/* Alternate phone */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    {language === "ar" ? "رقم بديل" : language === "fr" ? "N° alternatif" : "Backup phone"}
                    <span className="ms-1 text-xs font-normal text-slate-400">({language === "ar" ? "اختياري" : language === "fr" ? "optionnel" : "optional"})</span>
                  </label>
                  <IconField icon={Phone}>
                    <input
                      dir="ltr"
                      inputMode="tel"
                      value={phone2}
                      onChange={(event) => setPhone2(event.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="field-input field-input-icon"
                      placeholder="0666 00 00 00"
                      autoComplete="tel"
                    />
                  </IconField>
                  <p className="ps-1 text-xs text-slate-400">
                    {language === "ar" ? "إذا كان الرقم الأول مغلقاً" : language === "fr" ? "Si le premier est injoignable" : "If primary is unreachable"}
                  </p>
                </div>
              </div>
            </div>
            {/* Show verified badge if already confirmed — popup modal handles the rest */}
            {otpRequired && phoneIsValid && isPhoneVerified ? (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <span className="font-semibold text-emerald-800">{language === "ar" ? "تم التحقق ✓" : language === "fr" ? "Vérifié ✓" : "Verified ✓"}</span>
                  <span className="ms-2 text-sm text-emerald-600" dir="ltr">{phone}</span>
                </div>
              </div>
            ) : null}

          </section>

          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-teal-600 text-white">2</div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-950">{translate(language, "checkoutStepDelivery")}</h2>
                <p className="text-sm text-slate-500">{translate(language, "trustDelivery")}</p>
              </div>
              {useZrCommunes && (
                <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
                  <svg width="18" height="18" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="40" height="40" rx="8" fill="#0CAF60"/>
                    <text x="20" y="27" textAnchor="middle" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="18" fill="white">ZR</text>
                  </svg>
                  <span className="text-[11px] font-bold text-emerald-700">ZR Express</span>
                </div>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  {language === "ar" ? "الولاية" : language === "fr" ? "Wilaya" : "Wilaya"}
                  <span className="ms-1 text-rose-500">*</span>
                </label>
                <IconField icon={MapPin}>
                  <select
                    value={wilayaCode}
                    onChange={(event) => {
                      setWilayaCode(event.target.value);
                      setCommune("");
                      setCommuneOther(false);
                      setSelectedZrTerritory(null);
                    }}
                    className="field-select field-input-icon"
                  >
                    {wilayas.map((wilaya) => (
                      <option key={wilaya._id} value={wilaya.code}>
                        {wilaya.code} · {language === "ar" ? wilaya.name.ar : language === "fr" ? wilaya.name.fr : wilaya.name.en}
                      </option>
                    ))}
                  </select>
                </IconField>
              </div>
              {useZrCommunes ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    {language === "ar" ? "البلدية" : language === "fr" ? "Commune" : "Commune"}
                    <span className="ms-1 text-rose-500">*</span>
                  </label>
                  <IconField icon={MapPinned}>
                    <select
                      id="field-commune"
                      value={communeOther ? "__other__" : selectedZrTerritory?.id ?? ""}
                      onChange={(event) => {
                        if (invalidField === "field-commune") setInvalidField(null);
                        const { value } = event.target;
                        if (value === "__other__") {
                          setCommuneOther(true);
                          setSelectedZrTerritory(null);
                          setCommune("");
                          return;
                        }

                        const territory = selectedWilayaZrTerritories.find((entry) => entry.id === value) ?? null;
                        setCommuneOther(false);
                        setSelectedZrTerritory(territory);
                        setCommune(territory?.name ?? "");
                      }}
                      className="field-select field-input-icon"
                    >
                      <option value="">{language === "ar" ? "اختر البلدية" : language === "fr" ? "Choisir la commune" : "Choose your commune"}</option>
                      {selectedWilayaZrTerritories.map((territory) => (
                        <option key={territory.id} value={territory.id}>
                          {territory.name}
                          {territory.nameAr ? ` · ${territory.nameAr}` : ""}
                          {territory.hasPricing
                            ? ` · ${deliveryType === "HOME_DELIVERY" ? territory.homePrice : territory.pickupPrice} ${language === "ar" ? "دج" : "DA"}`
                            : ""}
                        </option>
                      ))}
                      <option value="__other__">{translate(language, "communeOther")}</option>
                    </select>
                  </IconField>

                  {selectedZrTerritory ? (
                    <div className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm">
                      <span className="font-semibold text-teal-800">
                        {language === "ar" ? "سعر التوصيل: " : language === "fr" ? "Frais de livraison : " : "Delivery cost: "}
                      </span>
                      <span className="font-bold text-teal-700">{formatCurrency(shippingFee, language)}</span>
                    </div>
                  ) : null}

                  {communeOther ? (
                    <div className="flex flex-col gap-2">
                      <IconField icon={MapPinned}>
                        <input
                          required
                          value={commune}
                          onChange={(event) => setCommune(event.target.value)}
                          className="field-input field-input-icon"
                          placeholder={translate(language, "commune")}
                        />
                      </IconField>
                      <button
                        type="button"
                        onClick={() => {
                          setCommuneOther(false);
                          setCommune("");
                        }}
                        className="self-start text-xs font-semibold text-teal-700 underline"
                      >
                        {language === "ar" ? "الرجوع إلى قائمة ZR" : language === "fr" ? "Revenir a la liste ZR" : "Back to ZR list"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {!useZrCommunes && selectedWilaya?.communes?.length && !communeOther ? (
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
              ) : !useZrCommunes ? (
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
              ) : null}
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
              <label className="block text-sm font-medium text-slate-700">
                {language === "ar" ? "العنوان التفصيلي" : language === "fr" ? "Adresse complète" : "Full address"}
                <span className="ms-1 text-rose-500">*</span>
              </label>
              <IconField icon={Home}>
                <textarea id="field-address" required value={address} onChange={(event) => { setAddress(event.target.value); if (invalidField === "field-address") setInvalidField(null); }} rows={3} className={`field-textarea field-input-icon transition ${invalidField === "field-address" ? "border-rose-500 ring-2 ring-rose-200" : address.trim().length > 0 && address.trim().length < 5 ? "border-rose-300 ring-1 ring-rose-200" : ""}`} placeholder={language === "ar" ? "حي النصر، شارع المدينة، رقم 12" : language === "fr" ? "Cité El Nasr, rue principale, n°12" : "El Nasr district, main street, n°12"} />
              </IconField>
              {address.trim().length > 0 && address.trim().length < 5 ? (
                <p className="ps-1 text-xs font-medium text-rose-500">
                  {language === "ar" ? `${address.trim().length}/5 أحرف — يرجى إدخال عنوان أكثر تفصيلاً` : language === "fr" ? `${address.trim().length}/5 caractères minimum` : `${address.trim().length}/5 characters minimum`}
                </p>
              ) : (
                <p className="ps-1 text-xs text-slate-400">{translate(language, "checkoutHintAddress")}</p>
              )}
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

          {/* Trust badges — above submit button for max visibility */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-4">
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-teal-100 text-teal-700">
                <WalletCards className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold text-slate-700">{language === "ar" ? "دفع عند الاستلام" : language === "fr" ? "Paiement à la livraison" : "Pay on delivery"}</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-teal-100 text-teal-700">
                <Truck className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold text-slate-700">{language === "ar" ? "شحن لكل الولايات" : language === "fr" ? "Livraison partout" : "All wilayas"}</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-teal-100 text-teal-700">
                <Lock className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold text-slate-700">{language === "ar" ? "بياناتك آمنة" : language === "fr" ? "Données sécurisées" : "Secure data"}</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-teal-100 text-teal-700">
                <X className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold text-slate-700">{language === "ar" ? "الإلغاء مجاني" : language === "fr" ? "Annulation gratuite" : "Free cancellation"}</span>
            </div>
          </div>

          {/* Sticky submit — stays visible on mobile while scrolling the form */}
          <div className="sticky bottom-0 -mx-4 bg-white/95 px-4 pb-4 pt-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:relative lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <button
              disabled={submitting}
              className="flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-5 text-base font-bold text-white shadow-[0_10px_30px_rgba(20,184,166,0.4)] transition hover:from-teal-500 hover:to-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <span>{submitting ? translate(language, "checkoutSubmitting") : translate(language, "checkoutSubmit")}</span>
              </span>
              <span className="shrink-0 rounded-xl bg-white/20 px-3 py-1.5 text-sm font-extrabold">
                {formatCurrency(total, language)}
              </span>
            </button>
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

    {/* Verification choice / OTP bottom-sheet modal */}
    {showVerifyModal ? (
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 px-0 backdrop-blur-sm sm:items-center sm:px-4"
        onClick={() => { setShowVerifyModal(false); setVerifyModalStep("choice"); }}
      >
        <div
          className="w-full max-w-md overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]"
          onClick={(e) => e.stopPropagation()}
        >
          {verifyModalStep === "choice" ? (
            <div className="p-5">
              {/* Header */}
              <div className="mb-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 px-5 py-4 text-center">
                <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm ring-2 ring-slate-200">
                  <ShieldCheck className="h-7 w-7 text-teal-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-950">
                  {language === "ar" ? "خطوة أخيرة — تأكيد الطلب" : language === "fr" ? "Dernière étape — Confirmer la commande" : "Last step — Confirm your order"}
                </h2>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  {language === "ar"
                    ? <span>طلبك جاهز! اختر طريقة التأكيد على الرقم <span className="font-bold text-slate-900" dir="ltr">{phone}</span></span>
                    : language === "fr"
                      ? <span>Commande prête ! Choisissez comment confirmer au <span className="font-bold text-slate-900" dir="ltr">{phone}</span></span>
                      : <span>Order ready! Choose how to confirm at <span className="font-bold text-slate-900" dir="ltr">{phone}</span></span>}
                </p>
              </div>

              <div className="space-y-3">
                {/* WhatsApp option — RECOMMENDED */}
                <button
                  type="button"
                  onClick={() => {
                    setVerifyModalStep("whatsapp");
                    void sendOtp();
                  }}
                  className="relative flex w-full items-center gap-4 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50 px-5 py-4 text-start shadow-sm transition hover:border-emerald-400 hover:from-emerald-100 active:scale-[0.98]"
                >
                  <span className="absolute end-3 top-3 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    {language === "ar" ? "أسرع" : language === "fr" ? "RAPIDE" : "FASTEST"}
                  </span>
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#25D366] shadow-md shadow-green-200">
                    <svg viewBox="0 0 24 24" fill="white" className="h-6 w-6" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-emerald-900">
                      {language === "ar" ? "تأكيد عبر واتساب" : language === "fr" ? "Confirmer via WhatsApp" : "Confirm via WhatsApp"}
                    </div>
                    <div className="mt-1 text-xs text-emerald-700 leading-relaxed">
                      {language === "ar"
                        ? "ستصلك رسالة واتساب برمز 6 أرقام → أدخله → يُسجَّل طلبك فوراً ✓"
                        : language === "fr"
                          ? "Vous recevrez un code à 6 chiffres → saisissez-le → commande confirmée ✓"
                          : "You get a 6-digit code → enter it → order confirmed instantly ✓"}
                    </div>
                  </div>
                </button>

                {/* Phone call option */}
                <button
                  type="button"
                  onClick={() => {
                    setManualConfirm(true);
                    setShowVerifyModal(false);
                    setVerifyModalStep("choice");
                    void placeOrder({ manualConfirmOverride: true });
                  }}
                  className="flex w-full items-center gap-4 rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-start transition hover:border-blue-200 hover:bg-blue-50 active:scale-[0.98]"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-200">
                    <PhoneCall className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-800">
                      {language === "ar" ? "أفضّل مكالمة هاتفية" : language === "fr" ? "Je préfère un appel" : "I prefer a phone call"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {language === "ar"
                        ? "سيُسجَّل طلبك الآن وسيتصل بك فريقنا خلال دقائق أو ساعات للتأكيد"
                        : language === "fr"
                          ? "Commande enregistrée maintenant, notre équipe vous appellera dans quelques heures"
                          : "Order saved now, our team will call you within minutes or hours to confirm"}
                    </div>
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={() => { setShowVerifyModal(false); setVerifyModalStep("choice"); }}
                className="mt-4 w-full rounded-2xl py-3 text-sm text-slate-400 transition hover:text-slate-600"
              >
                {language === "ar" ? "← العودة لتعديل البيانات" : language === "fr" ? "← Modifier mes informations" : "← Go back to edit"}
              </button>
            </div>
          ) : (
            /* WhatsApp OTP step inside modal */
            <div>
              <div className="flex items-center gap-3 bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-4 text-white">
                <button
                  type="button"
                  onClick={() => setVerifyModalStep("choice")}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 transition hover:bg-white/25"
                  aria-label="back"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">
                    {language === "ar" ? "تأكيد رقم الهاتف" : language === "fr" ? "Vérification WhatsApp" : "Phone Verification"}
                  </div>
                  <div className="text-sm text-white/80" dir="ltr">{phone}</div>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {!otpSent || otpSecondsLeft === 0 ? (
                  <div className="space-y-4">
                    {!otpSent ? (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                        <p className="text-sm font-semibold text-slate-800">
                          {language === "ar" ? "كيف يعمل التحقق عبر واتساب؟" : language === "fr" ? "Comment ça marche ?" : "How does it work?"}
                        </p>
                        <ol className="space-y-1.5 text-sm text-slate-600 list-none">
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">1</span>
                            {language === "ar"
                              ? <span>اضغط على الزر أدناه وسيصلك رسالة واتساب على الرقم <span className="font-semibold text-slate-900" dir="ltr">{phone}</span></span>
                              : language === "fr"
                                ? <span>Cliquez sur le bouton et vous recevrez un code WhatsApp au <span className="font-semibold" dir="ltr">{phone}</span></span>
                                : <span>Click the button and you'll receive a WhatsApp message at <span className="font-semibold" dir="ltr">{phone}</span></span>}
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">2</span>
                            <span>{language === "ar" ? "أدخل الرمز المكوّن من 6 أرقام الذي ستستلمه" : language === "fr" ? "Saisissez le code à 6 chiffres reçu" : "Enter the 6-digit code you receive"}</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">3</span>
                            <span>{language === "ar" ? "يُثبَّت طلبك تلقائياً بعد التحقق ✓" : language === "fr" ? "Votre commande sera confirmée automatiquement ✓" : "Your order will be placed automatically ✓"}</span>
                          </li>
                        </ol>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">
                        {language === "ar" ? "انتهت صلاحية الرمز. أرسل رمزاً جديداً:" : language === "fr" ? "Code expiré. Envoyez un nouveau code :" : "Code expired. Send a new code:"}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => void sendOtp()}
                      disabled={otpSending}
                      className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 py-4 text-sm font-semibold text-white transition hover:from-green-500 hover:to-emerald-500 disabled:opacity-60"
                    >
                      {otpSending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {otpSending
                        ? (language === "ar" ? "جارٍ الإرسال..." : language === "fr" ? "Envoi..." : "Sending...")
                        : (language === "ar" ? "أرسل لي رمز واتساب" : language === "fr" ? "Envoyer le code WhatsApp" : "Send WhatsApp code")}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      {language === "ar"
                        ? <span>✅ تم إرسال رمز واتساب إلى <span className="font-semibold" dir="ltr">{phone}</span> — تحقق من رسائلك</span>
                        : language === "fr"
                          ? <span>✅ Code envoyé sur WhatsApp au <span className="font-semibold" dir="ltr">{phone}</span> — vérifiez vos messages</span>
                          : <span>✅ WhatsApp code sent to <span className="font-semibold" dir="ltr">{phone}</span> — check your messages</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">
                        {language === "ar" ? "أدخل الرمز الذي وصلك:" : language === "fr" ? "Entrez le code reçu :" : "Enter the code you received:"}
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <Clock3 className="h-3 w-3" />
                        {otpTimerLabel}
                      </span>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="_ _ _ _ _ _"
                      className="field-input w-full py-4 text-center font-mono text-2xl tracking-[0.45em]"
                      dir="ltr"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => void verifyOtp()}
                      disabled={otpCode.length !== 6 || otpVerifying}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 py-4 text-sm font-semibold text-white transition disabled:opacity-60"
                    >
                      {otpVerifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {otpVerifying
                        ? (language === "ar" ? "جارٍ التحقق..." : "Verifying...")
                        : (language === "ar" ? "تأكيد الرمز وإتمام الطلب" : "Verify & place order")}
                    </button>
                  </div>
                )}

                {otpNotice ? (
                  <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${otpNoticeClassName}`}>
                    {otpNotice.text}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    ) : null}
    </>
  );
}
