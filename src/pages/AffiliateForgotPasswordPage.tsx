import { ArrowRight, CheckCircle2, KeyRound, Lock, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IconField } from "@/components/IconField";
import { Seo } from "@/components/Seo";
import { useApp } from "@/hooks/useApp";
import { authService } from "@/services/auth.service";

export function AffiliateForgotPasswordPage() {
  const { language } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "otp" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) { setError("أدخل بريداً إلكترونياً صحيحاً"); return; }
    setLoading(true); setError("");
    try {
      await authService.affiliateForgotPassword(email.trim().toLowerCase());
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الإرسال");
    } finally { setLoading(false); }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setError("الرمز يجب أن يكون 6 أرقام"); return; }
    if (newPassword.length < 8) { setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }
    if (newPassword !== confirm) { setError("كلمتا المرور غير متطابقتين"); return; }
    setLoading(true); setError("");
    try {
      await authService.affiliateResetPassword({ email: email.trim().toLowerCase(), code, newPassword });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التحقق");
    } finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-md py-8">
      <Seo title="إعادة تعيين كلمة المرور" noindex />

      <div className="surface-card overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-8 text-center">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-rose-500/20 ring-2 ring-rose-400/30">
            <Lock className="h-8 w-8 text-rose-300" />
          </div>
          <h1 className="text-xl font-bold text-white">
            {language === "ar" ? "إعادة تعيين كلمة المرور" : "Reset Password"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {step === "email" && (language === "ar" ? "أدخل بريدك لاستلام رمز التحقق" : "Enter your email to receive a code")}
            {step === "otp" && (language === "ar" ? `أرسلنا رمزاً إلى ${email}` : `Code sent to ${email}`)}
            {step === "done" && (language === "ar" ? "تم تغيير كلمة المرور بنجاح ✓" : "Password changed successfully ✓")}
          </p>
        </div>

        <div className="p-6">
          {step === "email" && (
            <form onSubmit={sendOtp} className="space-y-4">
              <IconField icon={Mail}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input field-input-icon"
                  placeholder={language === "ar" ? "بريدك الإلكتروني" : "Your email"}
                  autoComplete="email"
                  autoFocus
                />
              </IconField>
              {error && <p className="text-sm font-medium text-rose-600">⚠️ {error}</p>}
              <button disabled={loading} className="primary-button flex w-full justify-center gap-2 py-4">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {loading ? "جارٍ الإرسال..." : "إرسال رمز التحقق"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={resetPassword} className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                📧 {language === "ar" ? `تم إرسال الرمز إلى ${email}` : `Code sent to ${email}`}
              </div>

              {/* OTP input */}
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-slate-700">رمز التحقق (6 أرقام)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="_ _ _ _ _ _"
                  className="field-input w-full py-4 text-center font-mono text-2xl tracking-[0.5em]"
                  dir="ltr"
                  autoFocus
                />
              </div>

              {/* New password */}
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-slate-700">كلمة المرور الجديدة</label>
                <IconField icon={KeyRound}>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="field-input field-input-icon"
                    placeholder="8 أحرف على الأقل"
                    autoComplete="new-password"
                  />
                </IconField>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-semibold text-slate-700">تأكيد كلمة المرور</label>
                <IconField icon={KeyRound}>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={`field-input field-input-icon ${confirm && newPassword !== confirm ? "border-rose-400" : ""}`}
                    placeholder="أعد كتابة كلمة المرور"
                    autoComplete="new-password"
                  />
                </IconField>
                {confirm && newPassword !== confirm && (
                  <p className="text-xs text-rose-600">كلمتا المرور غير متطابقتين</p>
                )}
              </div>

              {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">⚠️ {error}</p>}

              <button disabled={loading || code.length !== 6} className="primary-button flex w-full justify-center gap-2 py-4">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {loading ? "جارٍ التحقق..." : "تعيين كلمة المرور الجديدة"}
              </button>

              <button type="button" onClick={() => { setStep("email"); setCode(""); setError(""); }} className="w-full text-center text-sm text-slate-400 hover:text-slate-600">
                ← تغيير البريد الإلكتروني
              </button>
            </form>
          )}

          {step === "done" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="font-semibold text-slate-950">تم تغيير كلمة المرور بنجاح!</p>
              <p className="text-sm text-slate-500">يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.</p>
              <button onClick={() => navigate("/affiliate/login")} className="primary-button flex w-full justify-center gap-2 py-4">
                <ArrowRight className="h-4 w-4" />
                تسجيل الدخول
              </button>
            </div>
          )}

          {step !== "done" && (
            <div className="mt-4 text-center text-sm text-slate-500">
              <Link to="/affiliate/login" className="font-semibold text-teal-700 hover:text-teal-800">
                ← العودة لتسجيل الدخول
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
