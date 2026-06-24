import { ArrowRight, CheckCircle2, KeyRound, Mail, Phone, RefreshCw, Share2, ShoppingBag, Sparkles, User, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { IconField } from "@/components/IconField";
import { Seo } from "@/components/Seo";
import { useApp } from "@/hooks/useApp";
import { authService } from "@/services/auth.service";
import { translate } from "@/utils/i18n";

const phonePattern = /^(05|06|07)\d{8}$/;

// Brand icons as inline SVG components
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
);
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.41a8.16 8.16 0 004.77 1.52V7.49a4.85 4.85 0 01-1-.8z"/>
  </svg>
);

interface ShareMethod {
  value: string;
  label: string;
  icon: React.ReactNode;
  bg: string;
}

const SHARE_METHODS: ShareMethod[] = [
  { value: "whatsapp", label: "مجموعات واتساب", icon: <WhatsAppIcon />, bg: "bg-[#25D366]" },
  { value: "facebook", label: "فيسبوك (صفحة أو مجموعة)", icon: <FacebookIcon />, bg: "bg-[#1877F2]" },
  { value: "instagram", label: "انستغرام", icon: <InstagramIcon />, bg: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400" },
  { value: "tiktok", label: "تيك توك", icon: <TikTokIcon />, bg: "bg-slate-900" },
  { value: "friends", label: "أصدقاء وعائلة", icon: <Users className="h-5 w-5 text-white" />, bg: "bg-amber-500" },
  { value: "store", label: "متجر / محل تجاري", icon: <ShoppingBag className="h-5 w-5 text-white" />, bg: "bg-teal-600" },
  { value: "other", label: "طريقة أخرى", icon: <Sparkles className="h-5 w-5 text-white" />, bg: "bg-violet-500" },
];

export function AffiliateRegisterPage() {
  const { language, setAffiliateSession } = useApp();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get("ref")?.trim().toUpperCase() || "";

  const [step, setStep] = useState<"form" | "otp">("form");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "", shareMethod: "" });
  const [otpCode, setOtpCode] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const parts = form.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return "أدخل الاسم الكامل (الاسم واللقب)";
    if (!form.email.includes("@")) return translate(language, "authValidationEmail");
    if (!phonePattern.test(form.phone.trim())) return translate(language, "authValidationPhone");
    if (form.password.length < 8) return translate(language, "authValidationPassword");
    if (form.password !== form.confirmPassword) return translate(language, "authValidationPasswordMatch");
    if (!form.shareMethod) return "يرجى اختيار كيف ستشارك روابطك";
    return "";
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await authService.affiliateRegister({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        ref: referralCode || undefined,
        shareMethod: form.shareMethod,
      });
      setRegisteredEmail(res.email);
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل إرسال الطلب");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await authService.affiliateVerifyOtp({ email: registeredEmail, code: otpCode });
      setAffiliateSession({ token: res.token, user: { id: String((res.affiliate as any)._id), name: res.affiliate.name, email: res.affiliate.email, role: "AFFILIATE" } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "رمز التحقق غير صحيح");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Seo title={translate(language, "authAffiliateRegisterTitle")} noindex />

      {/* Left info panel */}
      <section className="surface-card-dark p-6 sm:p-8">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-white/10">
          <UserPlus className="h-7 w-7 text-amber-300" />
        </div>
        <h1 className="mt-6 font-serif text-2xl font-semibold sm:text-3xl">{translate(language, "authAffiliateRegisterTitle")}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">{translate(language, "authAffiliateDescription")}</p>
        {referralCode ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-amber-300">
            <Users className="h-4 w-4" />
            {translate(language, "affiliateInvitedBy")} {referralCode}
          </div>
        ) : null}

        {/* Steps indicator */}
        <div className="mt-8 space-y-3">
          {[
            { n: 1, text: "أدخل بياناتك واختر طريقة المشاركة", done: step === "otp" },
            { n: 2, text: "تحقق من بريدك الإلكتروني بالرمز المرسل", done: false, active: step === "otp" },
            { n: 3, text: "ابدأ الكسب فوراً — حسابك مفعّل تلقائياً ✓", done: false },
          ].map(({ n, text, done, active }) => (
            <div key={n} className={`flex items-center gap-3 text-sm ${done ? "text-emerald-400" : active ? "text-amber-300 font-semibold" : "text-slate-400"}`}>
              <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? "bg-emerald-500 text-white" : active ? "bg-amber-400 text-slate-900" : "bg-white/10"}`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : n}
              </div>
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* Right form panel */}
      <section className="surface-card p-6 sm:p-8">
        {step === "form" ? (
          <form onSubmit={submitForm} className="space-y-4">
            <h2 className="font-bold text-slate-950">{language === "ar" ? "أنشئ حسابك" : "Create your account"}</h2>

            <IconField icon={User}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field-input field-input-icon" placeholder="الاسم الكامل (الاسم واللقب)" autoComplete="name" />
            </IconField>

            <IconField icon={Mail}>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="field-input field-input-icon" placeholder={translate(language, "authEmail")} autoComplete="email" />
            </IconField>

            <IconField icon={Phone}>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} className="field-input field-input-icon" placeholder="0555 12 34 56" autoComplete="tel" dir="ltr" />
            </IconField>

            <IconField icon={KeyRound}>
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" className="field-input field-input-icon" placeholder={translate(language, "authPassword")} autoComplete="new-password" />
            </IconField>

            <IconField icon={KeyRound}>
              <input value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} type="password" className="field-input field-input-icon" placeholder={translate(language, "authConfirmPassword")} autoComplete="new-password" />
            </IconField>

            {/* Share method — required */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Share2 className="h-4 w-4 text-teal-600" />
                {language === "ar" ? "كيف ستشارك روابطك؟" : language === "fr" ? "Comment partagerez-vous vos liens ?" : "How will you share your links?"}
                <span className="text-rose-500">*</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SHARE_METHODS.map((m) => {
                  const active = form.shareMethod === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setForm({ ...form, shareMethod: m.value })}
                      className={`flex items-center gap-2.5 rounded-2xl border-2 px-3 py-3 text-start text-sm font-semibold transition active:scale-95 ${
                        active
                          ? "border-teal-500 bg-teal-50 text-teal-900 shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${m.bg}`}>
                        {m.icon}
                      </div>
                      <span className="min-w-0 flex-1 truncate">{m.label}</span>
                      {active && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">⚠️ {error}</div> : null}

            <button disabled={submitting} className="primary-button flex w-full justify-center gap-2 py-4">
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              {submitting ? (language === "ar" ? "جارٍ الإرسال..." : "Sending...") : translate(language, "authRegister")}
            </button>

            <div className="text-sm text-slate-500">
              {translate(language, "authHaveAccount")}{" "}
              <Link to="/affiliate/login" className="inline-flex items-center gap-1 font-semibold text-teal-700">
                {translate(language, "authLogin")} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </form>
        ) : (
          /* OTP verification step */
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <Mail className="h-5 w-5" />
                {language === "ar" ? "تحقق من بريدك الإلكتروني" : "Check your email"}
              </div>
              <p className="mt-2 text-sm text-emerald-700">
                {language === "ar"
                  ? <>أرسلنا رمز التحقق إلى <strong>{registeredEmail}</strong>. أدخله هنا لتفعيل حسابك فوراً.</>
                  : <>We sent a verification code to <strong>{registeredEmail}</strong>. Enter it to activate your account.</>}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                {language === "ar" ? "رمز التحقق (6 أرقام)" : "Verification code (6 digits)"}
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="_ _ _ _ _ _"
                className="field-input w-full py-5 text-center font-mono text-3xl tracking-[0.5em]"
                dir="ltr"
                autoFocus
              />
            </div>

            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">⚠️ {error}</div> : null}

            <button
              type="button"
              disabled={otpCode.length !== 6 || submitting}
              onClick={() => void verifyOtp()}
              className="primary-button flex w-full justify-center gap-2 py-4"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              {submitting
                ? (language === "ar" ? "جارٍ التحقق..." : "Verifying...")
                : (language === "ar" ? "تفعيل الحساب" : "Activate account")}
            </button>

            <button type="button" onClick={() => { setStep("form"); setOtpCode(""); setError(""); }} className="w-full text-center text-sm text-slate-500 hover:text-slate-700">
              {language === "ar" ? "← العودة وتعديل البيانات" : "← Back to edit"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
