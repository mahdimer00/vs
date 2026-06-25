/**
 * Shared OTP verification modal — used in both CheckoutPage and DirectOrderForm.
 * Supports WhatsApp and Email channels (admin configures which are active).
 */
import { Check, CheckCircle2, Mail, MessageCircle, Phone, PhoneCall, RefreshCw, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { otpService } from "@/services/otp.service";
import type { Locale, WebsiteSetting } from "@/types";

interface OtpVerifyModalProps {
  phone: string;
  language: Locale;
  siteSettings: WebsiteSetting | null;
  onVerified: (token: string) => void;
  onManualConfirm: () => void;
  onClose: () => void;
}

type Step = "choice" | "whatsapp" | "email";

export function OtpVerifyModal({ phone, language, siteSettings, onVerified, onManualConfirm, onClose }: OtpVerifyModalProps) {
  const [step, setStep] = useState<Step>("choice");
  const [emailInput, setEmailInput] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");
  const [activeChannel, setActiveChannel] = useState<"whatsapp" | "email">("whatsapp");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAr = language === "ar";

  // Check which channels are enabled by admin
  const whatsappOn = siteSettings?.otpWhatsappEnabled !== false && siteSettings?.otpEnabled !== false;
  const emailOn = siteSettings?.otpEmailEnabled !== false && siteSettings?.otpEnabled !== false;

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startTimer = (ttl: number) => {
    setSecondsLeft(ttl);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => { if (s <= 1) { clearInterval(timerRef.current!); return 0; } return s - 1; });
    }, 1000);
  };

  const sendOtp = async (channel: "whatsapp" | "email", email?: string) => {
    setSending(true);
    setError("");
    try {
      const res = await otpService.sendOtp(phone.trim(), channel, email);
      setActiveChannel(channel);
      setOtpSent(true);
      setOtpCode("");
      startTimer(res.expiresIn ?? 300);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      // WhatsApp server is down — show friendly message + suggest email
      if (channel === "whatsapp" && (msg.includes("503") || msg.includes("502") || msg.includes("متاحة") || msg.includes("failed"))) {
        setError(isAr
          ? "خدمة واتساب غير متاحة حالياً — جرّب التحقق عبر البريد الإلكتروني"
          : "WhatsApp is currently unavailable — try Email verification instead");
        // Auto-go back to choice so user can pick email
        setTimeout(() => { setStep("choice"); setOtpSent(false); setError(""); }, 2500);
      } else {
        setError(msg || (isAr ? "فشل الإرسال. حاول مجدداً." : "Send failed. Please try again."));
      }
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async () => {
    if (otpCode.length !== 6 || verifying) return;
    setVerifying(true);
    setError("");
    try {
      const res = await otpService.verifyOtp(phone.trim(), otpCode, activeChannel);
      onVerified(res.verificationToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : (isAr ? "رمز غير صحيح" : "Invalid code"));
    } finally {
      setVerifying(false);
    }
  };

  const timerLabel = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:px-4"
      onClick={onClose}>
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-[2rem]"
        onClick={(e) => e.stopPropagation()}>

        {step === "choice" ? (
          <div className="p-5">
            {/* Header */}
            <div className="mb-5">
              <div className="mb-3 flex items-center justify-center gap-2">
                <div className="h-2 w-8 rounded-full bg-teal-500" />
                <div className="h-2 w-8 rounded-full bg-teal-500" />
                <div className="h-2 w-8 animate-pulse rounded-full bg-amber-400" />
                <span className="ms-1 text-xs font-semibold text-amber-600">{isAr ? "الخطوة الأخيرة" : "Final step"}</span>
              </div>
              <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4 text-center">
                <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm ring-2 ring-amber-300">
                  <span className="text-2xl">📦</span>
                </div>
                <h2 className="text-lg font-extrabold text-slate-950">{isAr ? "طلبك لم يُرسَل بعد!" : "Order not sent yet!"}</h2>
                <p className="mt-1.5 text-sm text-slate-700">
                  {isAr
                    ? <span>اختر طريقة التحقق على الرقم <span className="font-extrabold text-slate-900" dir="ltr">{phone}</span></span>
                    : <span>Choose verification for <span className="font-extrabold text-slate-900" dir="ltr">{phone}</span></span>}
                </p>
              </div>
            </div>

            {/* Why verify — urgency message */}
            <div className="rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50 to-emerald-50 px-4 py-3">
              <div className="text-sm font-bold text-teal-800">
                {isAr ? "🔒 لماذا التحقق؟" : "🔒 Why verify?"}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-teal-700">
                {isAr
                  ? "التحقق من رقمك يضمن تخصيص المنتج باسمك فوراً وتسليمه بأسرع وقت — الطلبات المؤكدة تُعالَج بأولوية."
                  : "Verifying locks the product in your name instantly — verified orders are processed first."}
              </p>
            </div>

            <div className="space-y-3">
              {whatsappOn && (
                <button type="button"
                  onClick={() => { setStep("whatsapp"); void sendOtp("whatsapp"); }}
                  className="relative flex w-full items-center gap-4 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50 px-5 py-4 text-start transition hover:border-emerald-400 active:scale-[0.98]">
                  <span className="absolute end-3 top-3 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">{isAr ? "موصى به" : "RECOMMENDED"}</span>
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#25D366] shadow-md">
                    <svg viewBox="0 0 24 24" fill="white" className="h-6 w-6"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <div>
                    <div className="font-bold text-emerald-900">{isAr ? "رمز واتساب" : "WhatsApp OTP"}</div>
                    <div className="mt-0.5 text-xs text-emerald-700">{isAr ? "رمز 6 أرقام على واتسابك — فوري ✓" : "6-digit code on WhatsApp — instant ✓"}</div>
                  </div>
                </button>
              )}

              {emailOn && (
                <button type="button" onClick={() => setStep("email")}
                  className="flex w-full items-center gap-4 rounded-2xl border-2 border-blue-200 bg-blue-50 px-5 py-4 text-start transition hover:border-blue-400 hover:bg-blue-100 active:scale-[0.98]">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-600 shadow-md text-white">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-bold text-blue-900">{isAr ? "رمز البريد الإلكتروني" : "Email OTP"}</div>
                    <div className="mt-0.5 text-xs text-blue-600">{isAr ? "أدخل بريدك واستلم الرمز فوراً" : "Enter your email and receive a code"}</div>
                  </div>
                </button>
              )}

              <button type="button"
                onClick={() => { onClose(); onManualConfirm(); }}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-start transition hover:bg-slate-50">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-700">{isAr ? "مكالمة هاتفية" : "Phone call"}</div>
                  <div className="text-xs text-slate-400">{isAr ? "سيتصل بك فريقنا لتأكيد الطلب" : "Our team will call you"}</div>
                </div>
              </button>
            </div>

            <button type="button" onClick={onClose} className="mt-4 w-full py-3 text-sm text-slate-400 hover:text-slate-600">
              {isAr ? "← تعديل البيانات" : "← Go back"}
            </button>
          </div>

        ) : step === "email" && !otpSent ? (
          // Email input step
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setStep("choice")} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
              <div className="font-bold text-slate-950">{isAr ? "أدخل بريدك الإلكتروني" : "Enter your email"}</div>
            </div>
            <div className="space-y-1">
              <input
                type="email"
                dir="ltr"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && emailInput.includes("@") && void sendOtp("email", emailInput)}
                className="field-input w-full"
                placeholder="example@gmail.com"
                autoFocus
                autoComplete="email"
              />
              <p className="text-xs text-slate-400">{isAr ? "سيصلك رمز 6 أرقام على بريدك" : "You'll receive a 6-digit code"}</p>
            </div>
            {error && <p className="text-sm font-medium text-rose-600">⚠️ {error}</p>}
            <button
              type="button"
              disabled={!emailInput.includes("@") || sending}
              onClick={() => void sendOtp("email", emailInput)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? (isAr ? "جارٍ الإرسال..." : "Sending...") : (isAr ? "إرسال الرمز" : "Send code")}
            </button>
          </div>

        ) : !otpSent && error ? (
          // Send failed — show error + retry + go back
          <div className="p-5 space-y-4">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-center">
              <p className="font-bold text-rose-800">⚠️ {error}</p>
            </div>
            <button type="button"
              disabled={sending}
              onClick={() => { setError(""); void sendOtp(activeChannel, activeChannel === "email" ? emailInput : undefined); }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
              {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isAr ? "إعادة المحاولة" : "Retry"}
            </button>
            <button type="button"
              onClick={() => { setStep("choice"); setError(""); setOtpCode(""); }}
              className="w-full py-2.5 text-sm text-slate-400 hover:text-slate-600">
              {isAr ? "← اختر طريقة أخرى" : "← Choose another method"}
            </button>
          </div>

        ) : (
          // OTP code entry — only shown when otpSent = true
          <div>
            <div className={`flex items-center gap-3 px-5 py-4 text-white ${activeChannel === "email" ? "bg-gradient-to-r from-blue-600 to-indigo-600" : "bg-gradient-to-r from-green-600 to-emerald-600"}`}>
              <button type="button" onClick={() => { setStep(activeChannel === "email" ? "email" : "choice"); setOtpSent(false); setOtpCode(""); setError(""); }}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/15 hover:bg-white/25">
                <X className="h-4 w-4" />
              </button>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20">
                {activeChannel === "email" ? <Mail className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
              </div>
              <div>
                <div className="font-semibold">{activeChannel === "email" ? (isAr ? "تأكيد عبر البريد" : "Email verification") : (isAr ? "تأكيد عبر واتساب" : "WhatsApp verification")}</div>
                <div className="text-sm text-white/80" dir="ltr">{phone}</div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {otpSent && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {activeChannel === "email"
                    ? (isAr ? <span>✅ تم إرسال الرمز إلى <strong>{emailInput}</strong></span> : <span>✅ Code sent to <strong>{emailInput}</strong></span>)
                    : (isAr ? <span>✅ تم إرسال الرمز عبر واتساب إلى <strong dir="ltr">{phone}</strong></span> : <span>✅ WhatsApp code sent to <strong dir="ltr">{phone}</strong></span>)}
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">{isAr ? "أدخل الرمز:" : "Enter the code:"}</p>
                {secondsLeft > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">⏱ {timerLabel}</span>
                )}
              </div>

              <input
                type="text" inputMode="numeric" maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="_ _ _ _ _ _"
                className="field-input w-full py-4 text-center font-mono text-2xl tracking-[0.45em]"
                dir="ltr" autoFocus
              />

              {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">⚠️ {error}</p>}

              <div className="flex gap-2">
                <button type="button" onClick={() => void verifyOtp()}
                  disabled={otpCode.length !== 6 || verifying}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 py-3.5 text-sm font-bold text-white transition disabled:opacity-60">
                  {verifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {isAr ? "تأكيد الرمز" : "Verify code"}
                </button>
                {secondsLeft === 0 && (
                  <button type="button" onClick={() => void (activeChannel === "email" ? sendOtp("email", emailInput) : sendOtp("whatsapp"))}
                    disabled={sending}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                    <RefreshCw className="h-4 w-4" />
                    {isAr ? "إعادة إرسال" : "Resend"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
