import { ArrowRight, CheckCircle2, KeyRound, Mail, Phone, RefreshCw, Share2, User, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { IconField } from "@/components/IconField";
import { Seo } from "@/components/Seo";
import { useApp } from "@/hooks/useApp";
import { authService } from "@/services/auth.service";
import { translate } from "@/utils/i18n";

const phonePattern = /^(05|06|07)\d{8}$/;

const SHARE_METHODS = [
  { value: "whatsapp", label: "مجموعات واتساب", icon: "💬" },
  { value: "facebook", label: "فيسبوك (صفحة أو مجموعة)", icon: "📘" },
  { value: "instagram", label: "انستغرام", icon: "📸" },
  { value: "tiktok", label: "تيك توك", icon: "🎵" },
  { value: "friends", label: "أصدقاء وعائلة", icon: "👥" },
  { value: "store", label: "متجر / محل تجاري", icon: "🏪" },
  { value: "other", label: "طريقة أخرى", icon: "✨" },
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
                {SHARE_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setForm({ ...form, shareMethod: m.value })}
                    className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-start text-sm font-medium transition ${form.shareMethod === m.value ? "border-teal-500 bg-teal-50 text-teal-900" : "border-slate-200 bg-white text-slate-700 hover:border-teal-200"}`}
                  >
                    <span className="text-lg">{m.icon}</span>
                    <span>{m.label}</span>
                    {form.shareMethod === m.value && <span className="ms-auto text-teal-600">✓</span>}
                  </button>
                ))}
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
