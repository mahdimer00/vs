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

export async function sendAffiliateCommissionUpdateEmail(
  to: string,
  affiliate: { name: string },
  tiers: Array<{ maxPrice: number | null; amount: number }>,
): Promise<void> {
  if (!resend) return;

  const tierRows = tiers
    .map((t, i) => {
      const prev = i === 0 ? null : tiers[i - 1].maxPrice;
      const from = prev != null ? `${prev.toLocaleString("ar-DZ")} دج` : "";
      const to_ = t.maxPrice != null ? `${t.maxPrice.toLocaleString("ar-DZ")} دج` : "";
      let range = "";
      if (i === 0) range = `أقل من ${to_}`;
      else if (t.maxPrice == null) range = `أكثر من ${from}`;
      else range = `من ${from} إلى ${to_}`;

      return `
        <tr>
          <td style="padding:10px 14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9">${range}</td>
          <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #f1f5f9">
            <span style="background:#f0fdf4;color:#15803d;font-weight:900;font-size:15px;padding:4px 12px;border-radius:50px">${t.amount.toLocaleString("ar-DZ")} دج</span>
          </td>
        </tr>`;
    })
    .join("");

  const { error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: `[VisaDZ] تحديث مهم: نظام عمولات جديد`,
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 16px;background:#f8fafc">
        <div style="text-align:center;margin-bottom:28px">
          <div style="background:#0f172a;display:inline-block;padding:12px 28px;border-radius:14px;color:#99f6e4;font-size:24px;font-weight:800;letter-spacing:1px">VisaDZ</div>
        </div>

        <div style="background:#fff;border-radius:20px;padding:28px 24px;border:1px solid #e2e8f0;margin-bottom:16px">
          <div style="font-size:36px;text-align:center;margin-bottom:12px">💰</div>
          <h2 style="color:#0f172a;margin:0 0 10px;text-align:center;font-size:20px">نظام عمولات جديد ومحسّن</h2>
          <p style="color:#475569;text-align:center;margin:0 0 24px;font-size:14px;line-height:1.7">
            مرحباً <strong>${affiliate.name}</strong>، يسعدنا إخبارك بتحديث مهم على برنامج الإحالة في VisaDZ.<br>
            انتقلنا إلى نظام عمولات ثابت حسب سعر المنتج — أوضح وأكثر عدلاً!
          </p>

          <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
            <thead>
              <tr style="background:#0f172a">
                <th style="padding:12px 14px;color:#99f6e4;font-size:13px;text-align:right">نطاق سعر المنتج</th>
                <th style="padding:12px 14px;color:#99f6e4;font-size:13px;text-align:center">عمولتك الثابتة</th>
              </tr>
            </thead>
            <tbody style="background:#fff">
              ${tierRows}
            </tbody>
          </table>

          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px 16px;margin-top:20px">
            <p style="margin:0;font-size:13px;color:#92400e;line-height:1.7">
              <strong>كيف تعمل؟</strong> عند شراء أي عميل عبر رابطك وتسليم الطلب، تحصل على العمولة المقابلة لسعر المنتج. لا نسب مئوية معقدة — مبلغ ثابت واضح لكل نطاق سعر.
            </p>
          </div>
        </div>

        <div style="text-align:center;margin-bottom:24px">
          <a href="https://visadz.store/affiliate" style="display:inline-block;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#99f6e4;text-decoration:none;padding:14px 36px;border-radius:50px;font-weight:800;font-size:15px;letter-spacing:0.5px">
            ابدأ التسويق الآن ←
          </a>
        </div>

        <div style="background:#fff;border-radius:16px;padding:18px 20px;border:1px solid #e2e8f0;text-align:center">
          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.7">
            شارك رابط إحالتك مع أصدقائك والمتابعين وابدأ ربح عمولة على كل عملية بيع ناجحة.<br>
            <strong style="color:#0f172a">كل سؤال؟ تواصل معنا عبر WhatsApp.</strong>
          </p>
        </div>

        <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:20px">
          VisaDZ — برنامج المسوّقين · تلقيت هذا البريد لأنك مسجّل في برنامجنا.
        </p>
      </div>
    `,
  });
  if (error) throw new Error(error.message);
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
