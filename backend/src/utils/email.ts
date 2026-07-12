import { Resend } from "resend";
import { env } from "../config/env.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const FROM = "VisaDZ <noreply@visadz.store>";

export async function sendAffiliateNewOrderEmail(to: string, affiliate: { name: string }, order: {
  orderNumber: string;
  total: number;
  commissionAmount: number;
  itemsText: string;
}): Promise<void> {
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to: [to],
    subject: `🎉 طلب جديد من رابطك — ${order.orderNumber} | VisaDZ`,
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:16px">
        <div style="text-align:center;margin-bottom:24px">
          <div style="background:#0f172a;display:inline-block;padding:12px 24px;border-radius:12px;color:#99f6e4;font-size:22px;font-weight:700;letter-spacing:1px">VisaDZ</div>
        </div>
        <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:16px;border:1px solid #e2e8f0">
          <div style="font-size:28px;text-align:center;margin-bottom:8px">🎉</div>
          <h2 style="color:#0f172a;margin:0 0 6px;text-align:center">طلب جديد من رابطك!</h2>
          <p style="color:#64748b;text-align:center;margin:0 0 20px;font-size:14px">مرحباً ${affiliate.name}، عميل جديد اشترى عبر رابط الإحالة الخاص بك</p>
          <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin-bottom:16px">
            <div style="font-size:13px;color:#475569;margin-bottom:4px">رقم الطلب</div>
            <div style="font-size:18px;font-weight:700;color:#0f172a">${order.orderNumber}</div>
          </div>
          <div style="font-size:13px;color:#475569;margin-bottom:8px;white-space:pre-line">${order.itemsText}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;background:#f0fdf4;border-radius:12px;padding:14px 16px;margin-top:12px">
            <div>
              <div style="font-size:12px;color:#16a34a">عمولتك المتوقعة</div>
              <div style="font-size:22px;font-weight:900;color:#15803d">${order.commissionAmount.toLocaleString("ar-DZ")} دج</div>
            </div>
            <div style="text-align:end">
              <div style="font-size:12px;color:#64748b">قيمة الطلب</div>
              <div style="font-size:16px;font-weight:700;color:#0f172a">${order.total.toLocaleString("ar-DZ")} دج</div>
            </div>
          </div>
        </div>
        <div style="text-align:center">
          <a href="https://visadz.store/affiliate" style="display:inline-block;background:#0f172a;color:#99f6e4;text-decoration:none;padding:12px 28px;border-radius:50px;font-weight:700;font-size:14px">تابع أرباحك →</a>
        </div>
        <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:16px">العمولة تُضاف بعد تسليم الطلب وتأكيده.</p>
      </div>
    `,
  });
}

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
