import { BadgePercent, Check, Copy, Facebook, Phone, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { IconField } from "@/components/IconField";
import { useApp } from "@/hooks/useApp";
import { apiRequest } from "@/services/apiClient";

const phonePattern = /^(05|06|07)\d{8}$/;

interface CampaignSettings {
  enabled: boolean;
  settings?: {
    storeName: string;
    couponDiscountType: "PERCENTAGE" | "FIXED";
    couponDiscountValue: number;
    couponExpiryDays: number;
    couponMinOrder: number;
    couponConditionText: string;
    couponSocialLinks: Record<string, string>;
  };
}

interface ClaimResult {
  success: boolean;
  code: string;
  alreadyClaimed: boolean;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  expiresAt?: string;
}

const SOCIAL_ICONS: Record<string, { label: string; color: string }> = {
  tiktok: { label: "TikTok", color: "bg-slate-900" },
  facebook: { label: "Facebook", color: "bg-[#1877F2]" },
  instagram: { label: "Instagram", color: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400" },
  youtube: { label: "YouTube", color: "bg-[#FF0000]" },
  whatsapp: { label: "WhatsApp", color: "bg-[#25D366]" },
};

export function GetCouponPage() {
  const { language } = useApp();
  const [searchParams] = useSearchParams();
  const source = searchParams.get("src") || searchParams.get("utm_source") || "direct";

  const [campaign, setCampaign] = useState<CampaignSettings | null>(null);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [followed, setFollowed] = useState(false);

  const isAr = language === "ar";

  useEffect(() => {
    apiRequest<CampaignSettings>("/api/coupon-campaign/settings")
      .then(setCampaign)
      .catch(() => setCampaign({ enabled: false }));
  }, []);

  const claim = async () => {
    if (!phonePattern.test(phone.trim())) {
      setError(isAr ? "أدخل رقم هاتف صحيح (05/06/07...)" : "Enter a valid phone number");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await apiRequest<ClaimResult>("/api/coupon-campaign/claim", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim(), source }),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ، حاول مجدداً");
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async () => {
    if (!result?.code) return;
    await navigator.clipboard.writeText(result.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const discountLabel = result
    ? result.discountType === "PERCENTAGE"
      ? `${result.discountValue}%`
      : `${result.discountValue.toLocaleString("ar-DZ")} ${isAr ? "دج" : "DA"}`
    : campaign?.settings?.couponDiscountType === "PERCENTAGE"
      ? `${campaign.settings.couponDiscountValue}%`
      : `${(campaign?.settings?.couponDiscountValue ?? 0).toLocaleString()} ${isAr ? "دج" : "DA"}`;

  if (!campaign) return null;

  if (!campaign.enabled) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <div className="text-5xl mb-4">🎟️</div>
        <h1 className="text-xl font-bold text-slate-950">{isAr ? "الحملة غير متاحة حالياً" : "Campaign not available"}</h1>
        <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-teal-600 px-6 py-3 text-sm font-semibold text-white">
          {isAr ? "تسوق الآن" : "Shop now"}
        </Link>
      </div>
    );
  }

  const s = campaign.settings!;
  const socialLinks = s.couponSocialLinks ?? {};
  const hasSocial = Object.keys(socialLinks).length > 0;
  const requiresFollow = hasSocial && s.couponConditionText;

  return (
    <div className="mx-auto max-w-lg space-y-0 pb-10" dir={isAr ? "rtl" : "ltr"}>
      <Seo title={isAr ? `احصل على خصم ${discountLabel}` : `Get ${discountLabel} discount`} noindex path="/get-coupon" />

      {/* Hero */}
      <div className="overflow-hidden rounded-b-[3rem] bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 px-6 pb-12 pt-10 text-center">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-amber-400/20 ring-2 ring-amber-400/30">
          <BadgePercent className="h-10 w-10 text-amber-300" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-white sm:text-4xl">
          {isAr ? `خصم ${discountLabel} خاص بك` : `Your ${discountLabel} discount`}
        </h1>
        <p className="mt-3 text-slate-300 leading-relaxed">
          {isAr
            ? `احصل على كود خصم خاص على جميع منتجات ${s.storeName} — استخدمه مرة واحدة`
            : `Get an exclusive discount code for ${s.storeName}`}
        </p>
        {s.couponMinOrder > 0 && (
          <p className="mt-2 text-sm text-amber-300">
            {isAr ? `الحد الأدنى للطلب: ${s.couponMinOrder.toLocaleString("ar-DZ")} دج` : `Min order: ${s.couponMinOrder.toLocaleString()} DA`}
          </p>
        )}
      </div>

      <div className="px-4 pt-8 space-y-6">

        {/* Step 1 — Follow on social (if required) */}
        {requiresFollow && !result && (
          <div className="surface-card p-5 space-y-4">
            <div className="flex items-center gap-2 font-bold text-slate-950">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-950 text-xs font-bold text-white">1</span>
              {s.couponConditionText || (isAr ? "تابعنا على وسائل التواصل" : "Follow us on social media")}
            </div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(socialLinks).map(([platform, url]) => {
                const info = SOCIAL_ICONS[platform] ?? { label: platform, color: "bg-slate-700" };
                return (
                  <a key={platform} href={String(url)} target="_blank" rel="noopener noreferrer"
                    onClick={() => setFollowed(true)}
                    className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 active:scale-95 ${info.color}`}>
                    {platform === "tiktok" && <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.41a8.16 8.16 0 004.77 1.52V7.49a4.85 4.85 0 01-1-.8z"/></svg>}
                    {platform === "facebook" && <Facebook className="h-5 w-5" />}
                    {platform === "instagram" && <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>}
                    {!["tiktok","facebook","instagram"].includes(platform) && <span>🔗</span>}
                    {info.label}
                  </a>
                );
              })}
            </div>
            {followed && (
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <Check className="h-4 w-4" /> {isAr ? "شكراً على المتابعة! انتقل للخطوة التالية" : "Thanks for following!"}
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Phone input */}
        {!result && (
          <div className="surface-card p-5 space-y-4">
            {requiresFollow && (
              <div className="flex items-center gap-2 font-bold text-slate-950">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-950 text-xs font-bold text-white">2</span>
                {isAr ? "أدخل رقم هاتفك" : "Enter your phone number"}
              </div>
            )}
            {!requiresFollow && (
              <h2 className="font-bold text-slate-950 text-lg">{isAr ? "أدخل رقمك واحصل على الكود فوراً" : "Enter your number to get the code"}</h2>
            )}
            <IconField icon={Phone}>
              <input
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                onKeyDown={(e) => e.key === "Enter" && void claim()}
                className="field-input field-input-icon w-full"
                placeholder="0555 12 34 56"
                autoComplete="tel"
              />
            </IconField>
            {error && <p className="text-sm font-medium text-rose-600">⚠️ {error}</p>}
            <button
              type="button"
              disabled={submitting || phone.length < 10 || (requiresFollow && !followed)}
              onClick={() => void claim()}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 py-4 text-base font-bold text-slate-950 shadow-[0_8px_24px_rgba(251,191,36,0.4)] transition hover:from-amber-300 active:scale-[0.98] disabled:opacity-60"
            >
              <BadgePercent className="h-5 w-5" />
              {submitting
                ? (isAr ? "جارٍ التوليد..." : "Generating...")
                : (isAr ? `احصل على خصم ${discountLabel}` : `Get ${discountLabel} off`)}
            </button>
            {requiresFollow && !followed && (
              <p className="text-center text-xs text-slate-400">{isAr ? "تابعنا أولاً ثم أدخل رقمك" : "Follow us first, then enter your number"}</p>
            )}
          </div>
        )}

        {/* Result — coupon revealed */}
        {result && (
          <div className="surface-card overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-5 text-center text-white">
              <div className="text-3xl mb-1">🎉</div>
              <h2 className="text-xl font-extrabold">
                {result.alreadyClaimed
                  ? (isAr ? "كودك الخاص بك" : "Your existing code")
                  : (isAr ? "تهانينا! كودك جاهز" : "Congratulations! Here's your code")}
              </h2>
              <p className="mt-1 text-white/80 text-sm">
                {isAr ? `خصم ${discountLabel} على طلبك القادم` : `${discountLabel} off your next order`}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {/* Big coupon code */}
              <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-5 text-center">
                <div className="font-mono text-3xl font-black tracking-[0.3em] text-slate-950">{result.code}</div>
                <div className="mt-2 text-xs text-slate-500">
                  {result.expiresAt
                    ? (isAr ? `ينتهي في: ${new Date(result.expiresAt).toLocaleDateString("ar-DZ")}` : `Expires: ${new Date(result.expiresAt).toLocaleDateString()}`)
                    : (isAr ? "كود لمرة واحدة — استخدمه في أول طلب" : "One-time use — valid on your first order")}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void copyCode()}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition ${copied ? "bg-emerald-100 text-emerald-700" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? (isAr ? "تم النسخ ✓" : "Copied ✓") : (isAr ? "نسخ الكود" : "Copy code")}
              </button>

              <Link
                to={`/products?promo=${result.code}`}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 py-4 text-base font-bold text-white shadow-[0_8px_24px_rgba(20,184,166,0.3)] transition hover:from-teal-500"
              >
                <ShoppingBag className="h-5 w-5" />
                {isAr ? "تسوق الآن واستخدم الكود" : "Shop now and use the code"}
              </Link>

              <p className="text-center text-xs text-slate-400">
                {isAr ? "أدخل الكود في صفحة الطلب — الدفع عند الاستلام" : "Enter code at checkout — pay on delivery"}
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
