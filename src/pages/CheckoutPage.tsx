import { BadgeCheck, Building2, Check, CheckCircle2, Clock3, Home, Lock, MapPin, MapPinned, MessageCircle, Phone, PhoneCall, RefreshCw, Send, ShieldCheck, Tag, Truck, UserRound, X } from "lucide-react";
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
import { ttqAddPaymentInfo, ttqCompleteRegistration, ttqIdentify, ttqInitiateCheckout, ttqPlaceAnOrder, ttqPurchase } from "@/utils/tiktok";
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
  const [zrTerritories, setZrTerritories] = useState<ZRTerritory[]>([]);
  const [selectedZrTerritory, setSelectedZrTerritory] = useState<ZRTerritory | null>(null);
  const [communeSearch, setCommuneSearch] = useState("");
  const [showCommuneSuggestions, setShowCommuneSuggestions] = useState(false);

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
  const [otpModalOpen, setOtpModalOpen] = useState(false);
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

  // Identify user with TikTok as soon as phone is valid
  useEffect(() => {
    if (phonePattern.test(phone.trim())) {
      void ttqIdentify(phone.trim());
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
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
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
      setOtpModalOpen(false);
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
  const filteredZrTerritories = useMemo(() => {
    if (!useZrCommunes || communeSearch.trim().length < 2) return [];
    const q = communeSearch.trim().toLowerCase();
    return zrTerritories.filter(
      (territory) => territory.name.toLowerCase().includes(q) || territory.nameAr.includes(communeSearch.trim()),
    ).slice(0, 8);
  }, [zrTerritories, communeSearch, useZrCommunes]);

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

  const validate = () => {
    if (!firstName.trim() || !lastName.trim()) {
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

  const placeOrder = async (opts: { manualConfirmOverride?: boolean } = {}) => {
    const effectiveManualConfirm = opts.manualConfirmOverride ?? manualConfirm;

    setSubmitting(true);
    setErrorMessage("");

    const capiEventId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const getCookie = (name: string) =>
      document.cookie.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1] ?? undefined;
    const fbp = getCookie("_fbp");
    const fbc = getCookie("_fbc");

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
      pushToast(validationError, "error");
      return;
    }
    if (otpRequired && !isPhoneVerified && !manualConfirm) {
      setShowVerifyModal(true);
      return;
    }
    await placeOrder();
  };

  return (
    <>
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
              <div className="space-y-1.5">
                <IconField icon={Phone}>
                  <input
                    dir="ltr"
                    inputMode="tel"
                    value={phone2}
                    onChange={(event) => setPhone2(event.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="field-input field-input-icon"
                    placeholder={language === "ar" ? "رقم بديل (اختياري)" : language === "fr" ? "Numéro alternatif (optionnel)" : "Alternate phone (optional)"}
                  />
                </IconField>
                <p className="ps-1 text-xs text-slate-400">
                  {language === "ar" ? "رقم ثاني للتواصل إذا كان الأول مغلقاً (اختياري)" : language === "fr" ? "Numéro alternatif si le premier est injoignable (optionnel)" : "Backup number if primary is unreachable (optional)"}
                </p>
              </div>
            </div>
            <p className="mt-2 ps-1 text-xs text-slate-400">{translate(language, "checkoutHintFullName")}</p>
            {otpRequired && phoneIsValid ? (
              <div className={`mt-4 overflow-hidden rounded-[1.75rem] border shadow-sm ${
                isPhoneVerified ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
              }`}>
                {isPhoneVerified ? (
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-semibold text-emerald-800">
                        {language === "ar" ? "تم التحقق من رقمك ✓" : language === "fr" ? "Numéro vérifié ✓" : "Phone verified ✓"}
                      </div>
                      <div className="mt-0.5 text-sm text-emerald-600" dir="ltr">{phone}</div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 2-tab switcher */}
                    <div className="grid grid-cols-2 border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() => setManualConfirm(false)}
                        className={`flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition ${
                          !manualConfirm
                            ? "border-b-2 border-emerald-600 bg-emerald-50/60 text-emerald-700"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        {language === "ar" ? "واتساب" : language === "fr" ? "WhatsApp" : "WhatsApp"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualConfirm(true)}
                        className={`flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition ${
                          manualConfirm
                            ? "border-b-2 border-blue-600 bg-blue-50/60 text-blue-700"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <PhoneCall className="h-4 w-4" />
                        {language === "ar" ? "مكالمة هاتفية" : language === "fr" ? "Appel téléphonique" : "Phone call"}
                      </button>
                    </div>

                    <div className="p-5">
                      {!manualConfirm ? (
                        !otpSent ? (
                          <div className="space-y-4">
                            <p className="text-sm text-slate-600">
                              {language === "ar" ? "سنرسل رمز 6 أرقام إلى واتسابك:" : language === "fr" ? "Code à 6 chiffres envoyé sur WhatsApp au :" : "We'll send a 6-digit code to your WhatsApp:"}
                              <span className="ms-1 font-semibold text-slate-900" dir="ltr">{phone}</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => void sendOtp()}
                              disabled={otpSending}
                              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 py-4 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(22,163,74,0.2)] transition hover:from-green-500 hover:to-emerald-500 disabled:opacity-60"
                            >
                              {otpSending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                              {otpSending
                                ? (language === "ar" ? "جارٍ الإرسال..." : language === "fr" ? "Envoi..." : "Sending...")
                                : (language === "ar" ? "أرسل لي رمز واتساب" : language === "fr" ? "Envoyer le code WhatsApp" : "Send WhatsApp code")}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-slate-800">
                                {language === "ar" ? "أدخل الرمز الذي وصلك:" : language === "fr" ? "Entrez le code reçu :" : "Enter the code you received:"}
                              </p>
                              {otpSecondsLeft > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                  <Clock3 className="h-3 w-3" />
                                  {otpTimerLabel}
                                </span>
                              ) : null}
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
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void verifyOtp()}
                                disabled={otpCode.length !== 6 || otpVerifying}
                                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 py-3.5 text-sm font-semibold text-white transition disabled:opacity-60"
                              >
                                {otpVerifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                {language === "ar" ? "تأكيد الرمز" : language === "fr" ? "Confirmer" : "Verify"}
                              </button>
                              {otpSecondsLeft === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => void sendOtp()}
                                  disabled={otpSending}
                                  className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                  {language === "ar" ? "إعادة إرسال" : language === "fr" ? "Renvoyer" : "Resend"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="rounded-2xl bg-blue-50 px-4 py-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                            <PhoneCall className="h-4 w-4 shrink-0" />
                            {language === "ar" ? "سيتم تسجيل طلبك وسيتصل بك فريقنا قريباً" : language === "fr" ? "Votre commande sera enregistrée et notre équipe vous appellera" : "Your order will be saved and our team will call you"}
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            {language === "ar"
                              ? <span>سنتواصل معك على الرقم <span className="font-semibold text-slate-900" dir="ltr">{phone}</span> لتأكيد الطلب وتحديد موعد التسليم. قد يستغرق ذلك بضع دقائق أو ساعات.</span>
                              : language === "fr"
                                ? <span>Nous vous contacterons au <span className="font-semibold" dir="ltr">{phone}</span> pour confirmer la commande et planifier la livraison.</span>
                                : <span>We'll contact you at <span className="font-semibold" dir="ltr">{phone}</span> to confirm and schedule delivery.</span>}
                          </p>
                        </div>
                      )}

                      {otpNotice && !manualConfirm ? (
                        <div className={`mt-3 rounded-xl border px-4 py-3 text-sm font-medium ${otpNoticeClassName}`}>
                          {otpNotice.text}
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {false && otpRequired && phoneIsValid && !isPhoneVerified ? (
              <button
                type="button"
                onClick={() => setOtpModalOpen(true)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 md:hidden"
              >
                <ShieldCheck className="h-4 w-4" />
                {language === "ar" ? "فتح نافذة التحقق عبر WhatsApp" : language === "fr" ? "Ouvrir la verification WhatsApp" : "Open WhatsApp verification"}
              </button>
            ) : null}

            {/* OTP Phone Verification Panel */}
            {false && otpRequired && phoneIsValid && (
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
              {useZrCommunes ? (
                <div className="space-y-3">
                  <IconField icon={MapPinned}>
                    <select
                      value={communeOther ? "__other__" : selectedZrTerritory?.id ?? ""}
                      onChange={(event) => {
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
              {false && useZrCommunes ? (
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
              ) : !useZrCommunes && selectedWilaya?.communes?.length && !communeOther ? (
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
      {false && otpModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 px-4 py-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
            <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 px-5 py-5 text-white sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp OTP
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {language === "ar" ? "تأكيد رقم الهاتف" : language === "fr" ? "Confirmer le numero" : "Confirm your phone number"}
                    </h2>
                    <p className="mt-1 text-sm text-white/80">
                      {language === "ar"
                        ? "أرسل رمز التحقق عبر واتساب ثم أدخله هنا لإكمال الطلب."
                        : language === "fr"
                          ? "Envoyez le code WhatsApp puis saisissez-le ici pour terminer la commande."
                          : "Send the WhatsApp code, then enter it here to finish checkout."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOtpModalOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Close verification modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      {language === "ar" ? "الرقم المستهدف" : language === "fr" ? "Numero cible" : "Target number"}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900" dir="ltr">{phone}</div>
                  </div>
                  {otpSent && otpSecondsLeft > 0 ? (
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-emerald-700">
                      <Clock3 className="h-4 w-4" />
                      {otpTimerLabel}
                    </div>
                  ) : null}
                </div>
              </div>

              {otpNotice ? (
                <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${otpNoticeClassName}`}>
                  {otpNotice.text}
                </div>
              ) : null}

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => void sendOtp()}
                  disabled={otpSending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(22,163,74,0.25)] transition hover:from-emerald-500 hover:to-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {otpSending ? <RefreshCw className="h-4 w-4 animate-spin" /> : otpSent && otpSecondsLeft === 0 ? <RefreshCw className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {otpSending
                    ? (language === "ar" ? "جارٍ الإرسال..." : language === "fr" ? "Envoi..." : "Sending...")
                    : otpSent && otpSecondsLeft === 0
                      ? (language === "ar" ? "إعادة إرسال الرمز" : language === "fr" ? "Renvoyer le code" : "Resend code")
                      : (language === "ar" ? "إرسال رمز واتساب" : language === "fr" ? "Envoyer le code WhatsApp" : "Send WhatsApp code")}
                </button>

                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {language === "ar" ? "أدخل الرمز" : language === "fr" ? "Saisir le code" : "Enter the code"}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="_ _ _ _ _ _"
                    className="field-input w-full border-none bg-transparent px-0 text-center font-mono text-2xl tracking-[0.5em] shadow-none focus:ring-0"
                    dir="ltr"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void verifyOtp()}
                  disabled={otpCode.length !== 6 || otpVerifying}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {otpVerifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {language === "ar" ? "تأكيد الرمز" : language === "fr" ? "Verifier le code" : "Verify code"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {false && otpModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 px-4 py-4 sm:items-center">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {language === "ar" ? "التحقق من رقم الهاتف" : language === "fr" ? "Verification du numero" : "Phone verification"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {language === "ar" ? "سنرسل رمز التحقق عبر WhatsApp لهذا الرقم." : language === "fr" ? "Le code sera envoye sur WhatsApp pour ce numero." : "We will send the verification code to this WhatsApp number."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOtpModalOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close verification modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                <Phone className="h-4 w-4" />
                <span dir="ltr">{phone}</span>
              </div>
              <div className="mt-4 space-y-3">
                {!otpSent || otpSecondsLeft === 0 ? (
                  <button
                    type="button"
                    onClick={() => void sendOtp()}
                    disabled={otpSending}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    {otpSending ? "Sending..." : "Send verification code"}
                  </button>
                ) : null}
                {otpSent ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-blue-700">
                      <span>{language === "ar" ? "تم إرسال الرمز عبر WhatsApp" : language === "fr" ? "Code envoye via WhatsApp" : "Code sent via WhatsApp"}</span>
                      {otpSecondsLeft > 0 ? (
                        <span>{Math.floor(otpSecondsLeft / 60)}:{String(otpSecondsLeft % 60).padStart(2, "0")}</span>
                      ) : null}
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="_ _ _ _ _ _"
                      className="field-input w-full text-center font-mono text-lg tracking-widest"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => void verifyOtp()}
                      disabled={otpCode.length !== 6 || otpVerifying}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {otpVerifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {language === "ar" ? "تحقق" : language === "fr" ? "Verifier" : "Verify"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>

    {/* Verification choice / OTP bottom-sheet modal */}
    {showVerifyModal ? (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
        onClick={() => { setShowVerifyModal(false); setVerifyModalStep("choice"); }}
      >
        <div
          className="w-full max-w-md overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]"
          onClick={(e) => e.stopPropagation()}
        >
          {verifyModalStep === "choice" ? (
            <div className="p-6">
              <div className="mb-5 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-100">
                  <ShieldCheck className="h-6 w-6 text-slate-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {language === "ar" ? "كيف تريد تأكيد طلبك؟" : language === "fr" ? "Comment confirmer votre commande ?" : "How to confirm your order?"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {language === "ar" ? "اختر طريقة مناسبة لك" : language === "fr" ? "Choisissez votre méthode" : "Choose your preferred method"}
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setVerifyModalStep("whatsapp");
                    void sendOtp();
                  }}
                  className="flex w-full items-center gap-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-5 py-4 text-start transition hover:bg-emerald-100"
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#25D366]">
                    <svg viewBox="0 0 24 24" fill="white" className="h-6 w-6" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <div>
                    <div className="font-semibold text-emerald-800">
                      {language === "ar" ? "تحقق عبر واتساب" : language === "fr" ? "Vérifier via WhatsApp" : "Verify via WhatsApp"}
                    </div>
                    <div className="mt-0.5 text-sm text-emerald-600" dir="ltr">{phone}</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setManualConfirm(true);
                    setShowVerifyModal(false);
                    setVerifyModalStep("choice");
                    void placeOrder({ manualConfirmOverride: true });
                  }}
                  className="flex w-full items-center gap-4 rounded-2xl border-2 border-blue-200 bg-blue-50 px-5 py-4 text-start transition hover:bg-blue-100"
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
                    <PhoneCall className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-blue-800">
                      {language === "ar" ? "تأكيد بمكالمة هاتفية" : language === "fr" ? "Confirmer par appel" : "Confirm by phone call"}
                    </div>
                    <div className="mt-0.5 text-sm text-blue-600">
                      {language === "ar" ? "سنتصل بك لتأكيد طلبك" : language === "fr" ? "Nous vous appellerons pour confirmer" : "We'll call you to confirm"}
                    </div>
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={() => { setShowVerifyModal(false); setVerifyModalStep("choice"); }}
                className="mt-4 w-full rounded-2xl py-3 text-sm font-medium text-slate-500 transition hover:text-slate-700"
              >
                {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
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
                      <p className="text-sm text-slate-600">
                        {language === "ar"
                          ? "سنرسل رمز 6 أرقام إلى واتسابك على الرقم:"
                          : "We'll send a 6-digit code to your WhatsApp:"}
                        <span className="ms-1 font-semibold text-slate-900" dir="ltr">{phone}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-slate-600">
                        {language === "ar" ? "انتهت صلاحية الرمز. أرسل رمزاً جديداً:" : "Code expired. Send a new code:"}
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
                        ? (language === "ar" ? "جارٍ الإرسال..." : "Sending...")
                        : (language === "ar" ? "أرسل رمز واتساب" : "Send WhatsApp code")}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">
                        {language === "ar" ? "أدخل الرمز الذي وصلك:" : "Enter the code you received:"}
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
