/**
 * Get-Coupon landing page — maximum conversion design
 * Anti-spam: follow tracking with countdown timer
 * Mobile-first, RTL Arabic
 */
import { BadgePercent, Check, CheckCircle2, Copy, ExternalLink, Phone, ShoppingBag, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { useApp } from "@/hooks/useApp";
import { apiRequest } from "@/services/apiClient";

const phonePattern = /^(05|06|07)\d{8}$/;
const FOLLOW_WAIT_SECONDS = 25; // seconds user must wait after clicking follow

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

const PLATFORM_CONFIG: Record<string, { label: string; labelAr: string; gradient: string; icon: string }> = {
  tiktok: { label: "TikTok", labelAr: "تيك توك", gradient: "from-slate-900 to-slate-700", icon: "🎵" },
  facebook: { label: "Facebook", labelAr: "فيسبوك", gradient: "from-[#1877F2] to-[#0c5cc9]", icon: "📘" },
  instagram: { label: "Instagram", labelAr: "انستغرام", gradient: "from-purple-600 via-pink-500 to-orange-400", icon: "📸" },
  youtube: { label: "YouTube", labelAr: "يوتيوب", gradient: "from-[#FF0000] to-[#cc0000]", icon: "▶️" },
  whatsapp: { label: "WhatsApp", labelAr: "واتساب", gradient: "from-[#25D366] to-[#1da851]", icon: "💬" },
};

export function GetCouponPage() {
  const { language } = useApp();
  const [searchParams] = useSearchParams();
  const source = searchParams.get("src") || searchParams.get("utm_source") || "direct";
  const isAr = language === "ar";

  const [campaign, setCampaign] = useState<CampaignSettings | null>(null);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // Follow tracking anti-spam
  const [followedPlatform, setFollowedPlatform] = useState<string | null>(null);
  const [followCountdown, setFollowCountdown] = useState(0);
  const [followVerified, setFollowVerified] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    apiRequest<CampaignSettings>("/api/coupon-campaign/settings")
      .then(setCampaign)
      .catch(() => setCampaign({ enabled: false }));
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleFollowClick = (platform: string) => {
    if (followVerified) return;
    setFollowedPlatform(platform);
    setFollowCountdown(FOLLOW_WAIT_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setFollowCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setFollowVerified(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const s = campaign?.settings;
  const hasSocial = Object.keys(s?.couponSocialLinks ?? {}).filter((k) => s?.couponSocialLinks?.[k]).length > 0;
  const requiresFollow = hasSocial && s?.couponConditionText;
  const canProceed = !requiresFollow || followVerified;

  const discountLabel = s
    ? s.couponDiscountType === "PERCENTAGE"
      ? `${s.couponDiscountValue}%`
      : `${s.couponDiscountValue.toLocaleString("ar-DZ")} ${isAr ? "دج" : "DA"}`
    : "";

  const claim = async () => {
    if (!phonePattern.test(phone.trim())) {
      setError(isAr ? "أدخل رقم هاتف جزائري صحيح" : "Enter a valid Algerian phone number");
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
      setError(e instanceof Error ? e.message : (isAr ? "حدث خطأ، حاول مجدداً" : "Error, please try again"));
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async () => {
    if (!result?.code) return;
    await navigator.clipboard.writeText(result.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!campaign) return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
    </div>
  );

  if (!campaign.enabled) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center">
      <div className="text-6xl mb-4">🎟️</div>
      <h1 className="text-2xl font-bold text-white mb-3">{isAr ? "الحملة غير متاحة حالياً" : "Campaign not available"}</h1>
      <Link to="/" className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-500">
        <ShoppingBag className="h-4 w-4" />
        {isAr ? "تسوق الآن" : "Shop now"}
      </Link>
    </div>
  );

  // ── RESULT SCREEN ──
  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-slate-950 to-slate-950 flex items-center justify-center px-4 py-10" dir={isAr ? "rtl" : "ltr"}>
        <Seo title={isAr ? "كودك جاهز!" : "Your code is ready!"} noindex path="/get-coupon" />
        <div className="w-full max-w-sm space-y-5">
          {/* Success animation */}
          <div className="text-center">
            <div className="mx-auto mb-4 grid h-24 w-24 place-items-center rounded-full bg-emerald-500/20 ring-4 ring-emerald-500/30">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-black text-white">
              {result.alreadyClaimed
                ? (isAr ? "كودك الخاص 🎟️" : "Your code 🎟️")
                : (isAr ? "تهانينا! 🎉" : "Congratulations! 🎉")}
            </h1>
            <p className="mt-2 text-emerald-300 font-semibold">
              {isAr ? `خصم ${discountLabel} ينتظرك` : `${discountLabel} discount waiting for you`}
            </p>
          </div>

          {/* Big code card */}
          <div className="overflow-hidden rounded-3xl border-2 border-amber-400/30 bg-gradient-to-br from-amber-950/50 to-slate-900">
            <div className="px-6 py-5 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-400/70 mb-3">
                {isAr ? "كود الخصم الخاص بك" : "Your exclusive discount code"}
              </p>
              <div className="font-mono text-4xl font-black tracking-[0.35em] text-amber-300 select-all">
                {result.code}
              </div>
              {result.expiresAt && (
                <p className="mt-3 text-xs text-slate-400">
                  {isAr
                    ? `⏳ ينتهي: ${new Date(result.expiresAt).toLocaleDateString("ar-DZ")}`
                    : `⏳ Expires: ${new Date(result.expiresAt).toLocaleDateString()}`}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void copyCode()}
              className={`flex w-full items-center justify-center gap-2.5 py-4 text-sm font-bold transition ${
                copied
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              {copied ? (isAr ? "✓ تم النسخ!" : "✓ Copied!") : (isAr ? "انسخ الكود" : "Copy code")}
            </button>
          </div>

          {/* CTA */}
          <Link
            to="/products"
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 px-6 py-5 font-bold text-white shadow-[0_12px_32px_rgba(20,184,166,0.4)] transition hover:from-teal-400 active:scale-[0.98]"
          >
            <span className="flex items-center gap-2.5 text-base">
              <ShoppingBag className="h-6 w-6" />
              {isAr ? "تسوق الآن واستخدم الكود" : "Shop now and use code"}
            </span>
            <span className="rounded-xl bg-white/20 px-3 py-1.5 text-sm font-extrabold">{discountLabel} {isAr ? "خصم" : "OFF"}</span>
          </Link>

          <p className="text-center text-xs text-slate-500">
            {isAr ? "أدخل الكود عند إتمام الطلب — الدفع عند الاستلام فقط" : "Enter code at checkout — cash on delivery"}
          </p>
        </div>
      </div>
    );
  }

  // ── MAIN FUNNEL ──
  const socialEntries = Object.entries(s?.couponSocialLinks ?? {}).filter(([, url]) => url);
  const step = !requiresFollow ? 1 : !followVerified ? 1 : 2;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" dir={isAr ? "rtl" : "ltr"}>
      <Seo title={isAr ? `احصل على خصم ${discountLabel}` : `Get ${discountLabel} discount`} noindex path="/get-coupon" />

      {/* Hero */}
      <div className="relative overflow-hidden px-4 pt-14 pb-10 text-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-teal-500/10 blur-2xl" />
          <div className="absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-purple-500/10 blur-2xl" />
        </div>
        <div className="relative z-10 mx-auto max-w-sm">
          <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_12px_32px_rgba(251,191,36,0.4)]">
            <BadgePercent className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-black leading-tight text-white sm:text-4xl">
            {isAr
              ? <><span className="text-amber-400">خصم {discountLabel}</span><br />خاص بك!</>
              : <><span className="text-amber-400">{discountLabel} off</span><br />just for you!</>}
          </h1>
          <p className="mt-3 text-slate-400 leading-relaxed">
            {isAr
              ? `احصل على كود خصم حصري على منتجات ${s?.storeName || "المتجر"}`
              : `Get an exclusive coupon for ${s?.storeName || "our store"}`}
          </p>
          {s?.couponMinOrder ? (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-400">
              {isAr ? `الحد الأدنى: ${s.couponMinOrder.toLocaleString("ar-DZ")} دج` : `Min order: ${s.couponMinOrder.toLocaleString()} DA`}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-sm px-4 space-y-4 pb-12">

        {/* ── STEP 1: Follow ── */}
        {requiresFollow && (
          <div className={`overflow-hidden rounded-3xl border transition-all ${followVerified ? "border-emerald-500/30 bg-emerald-950/30" : "border-slate-700 bg-slate-800/50"}`}>
            <div className="px-5 py-4">
              <div className="flex items-center gap-3">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black ${followVerified ? "bg-emerald-500 text-white" : "bg-amber-400 text-slate-900"}`}>
                  {followVerified ? <Check className="h-5 w-5" /> : "1"}
                </div>
                <div>
                  <div className="font-bold text-white text-sm">{s?.couponConditionText || (isAr ? "تابعنا أولاً" : "Follow us first")}</div>
                  {followVerified
                    ? <p className="text-xs text-emerald-400 mt-0.5">{isAr ? "تم التحقق ✓ انتقل للخطوة التالية" : "Verified ✓ proceed to next step"}</p>
                    : <p className="text-xs text-slate-400 mt-0.5">{isAr ? "اضغط على الزر وانتظر للتحقق" : "Click the button and wait to verify"}</p>}
                </div>
              </div>

              {!followVerified && (
                <div className="mt-4 space-y-2.5">
                  {socialEntries.map(([platform, url]) => {
                    const cfg = PLATFORM_CONFIG[platform] ?? { label: platform, labelAr: platform, gradient: "from-slate-700 to-slate-600", icon: "🔗" };
                    const isActive = followedPlatform === platform;
                    return (
                      <a
                        key={platform}
                        href={String(url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleFollowClick(platform)}
                        className={`flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r px-4 py-3.5 text-white transition active:scale-[0.97] ${cfg.gradient}`}
                      >
                        <span className="flex items-center gap-2.5 font-bold text-sm">
                          <span className="text-xl">{cfg.icon}</span>
                          {isAr ? `تابعنا على ${cfg.labelAr}` : `Follow on ${cfg.label}`}
                        </span>
                        <ExternalLink className="h-4 w-4 opacity-70 shrink-0" />
                      </a>
                    );
                  })}

                  {/* Countdown after click */}
                  {followedPlatform && followCountdown > 0 && (
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2 text-amber-400">
                        <Timer className="h-5 w-5" />
                        <span className="font-bold text-lg">{followCountdown}s</span>
                      </div>
                      <p className="mt-1 text-xs text-amber-300/80">
                        {isAr ? "انتظر للتحقق من المتابعة..." : "Waiting to verify your follow..."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: Phone ── */}
        <div className={`overflow-hidden rounded-3xl border transition-all ${!canProceed ? "border-slate-800 bg-slate-900/30 opacity-60" : "border-slate-700 bg-slate-800/60"}`}>
          <div className="px-5 py-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black ${canProceed ? "bg-amber-400 text-slate-900" : "bg-slate-700 text-slate-500"}`}>
                {requiresFollow ? "2" : "1"}
              </div>
              <div>
                <div className="font-bold text-white text-sm">{isAr ? "أدخل رقم هاتفك" : "Enter your phone number"}</div>
                <p className="text-xs text-slate-400 mt-0.5">{isAr ? "سيُرسَل الكود لمرة واحدة فقط لكل رقم" : "One code per phone number"}</p>
              </div>
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2">
                <Phone className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && canProceed && void claim()}
                disabled={!canProceed}
                className="w-full rounded-2xl border border-slate-600 bg-slate-700/60 py-4 ps-12 pe-4 text-lg font-semibold text-white placeholder:text-slate-500 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-40"
                placeholder="0555 12 34 56"
                autoComplete="tel"
              />
            </div>

            {error && (
              <p className="flex items-center gap-2 text-sm font-semibold text-rose-400">
                <span>⚠️</span> {error}
              </p>
            )}

            <button
              type="button"
              disabled={submitting || !canProceed || phone.length < 10}
              onClick={() => void claim()}
              className="flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4.5 font-bold text-slate-900 shadow-[0_8px_28px_rgba(251,191,36,0.35)] transition hover:from-amber-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ paddingTop: "1.125rem", paddingBottom: "1.125rem" }}
            >
              <span className="flex items-center gap-2.5 text-base">
                <BadgePercent className="h-6 w-6" />
                {submitting
                  ? (isAr ? "جارٍ التوليد..." : "Generating...")
                  : (isAr ? `احصل على خصم ${discountLabel}` : `Get ${discountLabel} off`)}
              </span>
              <span className="rounded-xl bg-slate-900/20 px-3 py-1.5 text-sm font-black">←</span>
            </button>

            {!canProceed && requiresFollow && (
              <p className="text-center text-xs text-slate-500">
                {isAr ? "أكمل الخطوة الأولى أولاً" : "Complete step 1 first"}
              </p>
            )}
          </div>
        </div>

        {/* Trust row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { icon: "🔒", text: isAr ? "خصوصية تامة" : "100% private" },
            { icon: "⚡", text: isAr ? "فوري" : "Instant" },
            { icon: "💳", text: isAr ? "دفع عند الاستلام" : "Pay on delivery" },
          ].map((item) => (
            <div key={item.text} className="rounded-2xl border border-slate-700/50 bg-slate-800/30 px-2 py-3">
              <div className="text-xl mb-1">{item.icon}</div>
              <div className="text-[11px] font-semibold text-slate-400">{item.text}</div>
            </div>
          ))}
        </div>

        {/* Store link */}
        <div className="text-center">
          <Link to="/products" className="text-xs text-slate-500 hover:text-slate-300 transition">
            {isAr ? "أو تسوق بدون كوبون ←" : "Or shop without coupon →"}
          </Link>
        </div>
      </div>
    </div>
  );
}
