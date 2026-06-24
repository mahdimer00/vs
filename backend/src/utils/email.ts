import { Resend } from "resend";
import { env } from "../config/env.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const FROM = "VisaDZ <noreply@visadz.store>";

export async function sendAffiliateOtpEmail(to: string, name: string, code: string): Promise<void> {
  if (!resend) throw new Error("Resend API key not configured");

  await resend.emails.send({
    from: FROM,
    to: [to],
    subject: `رمز التحقق — VisaDZ (${code})`,
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:16px">
        <div style="text-align:center;margin-bottom:24px">
          <div style="background:#0f172a;display:inline-block;padding:12px 24px;border-radius:12px;color:#99f6e4;font-size:22px;font-weight:700;letter-spacing:1px">VisaDZ</div>
        </div>
        <h2 style="color:#0f172a;margin:0 0 8px">مرحباً ${name}! 👋</h2>
        <p style="color:#475569;margin:0 0 24px;line-height:1.7">
          شكراً لانضمامك لبرنامج المسوّقين في VisaDZ. أدخل الرمز التالي لتأكيد بريدك الإلكتروني وتفعيل حسابك فوراً:
        </p>
        <div style="background:#fff;border:2px solid #14b8a6;border-radius:16px;padding:24px;text-align:center;margin:0 0 24px">
          <div style="font-size:42px;font-weight:900;letter-spacing:10px;color:#0f172a;font-family:monospace">${code}</div>
          <div style="color:#94a3b8;font-size:13px;margin-top:8px">صالح لمدة 15 دقيقة</div>
        </div>
        <p style="color:#94a3b8;font-size:12px;margin:0">إذا لم تطلب هذا الرمز، يمكنك تجاهل هذا البريد.</p>
      </div>
    `,
  });
}
