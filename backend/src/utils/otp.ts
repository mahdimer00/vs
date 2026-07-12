import crypto from "crypto";
import { env } from "../config/env.js";
import { WebsiteSettingModel } from "../models/catalog.model.js";

export type OtpChannel = "whatsapp" | "email";

const OTP_TTL_SECONDS = 300; // 5 minutes

export function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

export function hashOtpCode(code: string): string {
  return crypto.createHmac("sha256", env.OTP_SECRET).update(code).digest("hex");
}

export function verifyOtpCode(code: string, hash: string): boolean {
  const expected = hashOtpCode(code);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

export function createVerificationToken(phone: string): string {
  const expiry = Math.floor(Date.now() / 1000) + 900; // 15 min
  const payload = `${phone}:${expiry}`;
  const sig = crypto.createHmac("sha256", env.OTP_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyVerificationToken(token: string, phone: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return false;
    const [tokenPhone, expiry, sig] = parts;
    if (tokenPhone !== phone) return false;
    if (parseInt(expiry, 10) < Math.floor(Date.now() / 1000)) return false;
    const payload = `${tokenPhone}:${expiry}`;
    const expected = crypto.createHmac("sha256", env.OTP_SECRET).update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export function otpTtlSeconds(): number {
  return OTP_TTL_SECONDS;
}

function getBaileysBaseUrls(): string[] {
  const configured = (env.BAILEYS_API_URL ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const candidates = new Set<string>();

  for (const rawUrl of configured) {
    try {
      const parsed = new URL(rawUrl);
      candidates.add(parsed.toString().replace(/\/$/, ""));

      if (parsed.hostname === "host.docker.internal" || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        for (const host of ["172.17.0.1", "172.18.0.1"]) {
          const fallback = new URL(parsed.toString());
          fallback.hostname = host;
          candidates.add(fallback.toString().replace(/\/$/, ""));
        }
      }
    } catch {
      continue;
    }
  }

  return [...candidates];
}

// Send OTP via WhatsApp (self-hosted Baileys API)
export async function sendWhatsAppOtp(phone: string, code: string): Promise<void> {
  if (!env.BAILEYS_API_URL) {
    throw new Error("WhatsApp (Baileys) is not configured");
  }

  const settings = await WebsiteSettingModel.findOne().select("storeName").lean().catch(() => null);
  const storeName = settings?.storeName || "المتجر";

  const message = [
    `🛍️ *${storeName}*`,
    ``,
    `مرحباً! لتأكيد طلبك يرجى إدخال رمز التحقق التالي:`,
    ``,
    `🔐 *${code}*`,
    ``,
    `⏱️ الرمز صالح لمدة 5 دقائق فقط`,
  ].join("\n");

  // Normalize Algerian number to international format.
  const normalized = phone.startsWith("0") ? `213${phone.slice(1)}` : phone;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.BAILEYS_API_KEY) {
    headers["X-Api-Key"] = env.BAILEYS_API_KEY;
  }

  const errors: string[] = [];

  for (const baseUrl of getBaileysBaseUrls()) {
    try {
      const res = await fetch(`${baseUrl}/send`, {
        method: "POST",
        headers,
        body: JSON.stringify({ phone: normalized, message }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        return;
      }

      const err = await res.text();
      errors.push(`${baseUrl} -> ${res.status}: ${err}`);
    } catch (error) {
      errors.push(`${baseUrl} -> ${error instanceof Error ? error.message : "request failed"}`);
    }
  }

  throw new Error(`WhatsApp OTP send failed: ${errors.join(" | ")}`);
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(env.BAILEYS_API_URL);
}

export function isEmailOtpConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

// Send OTP via email (used at checkout when user picks email verification)
export async function sendCheckoutEmailOtp(email: string, code: string, phone: string): Promise<void> {
  if (!env.RESEND_API_KEY) throw new Error("Email (Resend) not configured");
  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: "VisaDZ <noreply@visadz.store>",
    to: [email],
    subject: `رمز تأكيد طلبك — VisaDZ (${code})`,
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:16px">
        <div style="text-align:center;margin-bottom:24px">
          <div style="background:#0f172a;display:inline-block;padding:12px 24px;border-radius:12px;color:#99f6e4;font-size:22px;font-weight:700">VisaDZ</div>
        </div>
        <h2 style="color:#0f172a;margin:0 0 8px">تأكيد طلبك 🛒</h2>
        <p style="color:#475569;margin:0 0 8px;line-height:1.7">أدخل الرمز التالي لإتمام طلبك:</p>
        <p style="color:#94a3b8;font-size:12px;margin:0 0 24px">الرقم: ${phone}</p>
        <div style="background:#fff;border:2px solid #14b8a6;border-radius:16px;padding:24px;text-align:center;margin:0 0 24px">
          <div style="font-size:42px;font-weight:900;letter-spacing:10px;color:#0f172a;font-family:monospace">${code}</div>
          <div style="color:#94a3b8;font-size:13px;margin-top:8px">صالح لمدة 5 دقائق</div>
        </div>
        <p style="color:#94a3b8;font-size:12px">إذا لم تطلب هذا الرمز، تجاهل هذا البريد.</p>
      </div>
    `,
  });
}

// General-purpose WhatsApp message sender (used for abandoned cart recovery etc.)
export async function sendWhatsAppMessage(phone: string, message: string): Promise<void> {
  if (!env.BAILEYS_API_URL) return;
  const normalized = phone.startsWith("0") ? `213${phone.slice(1)}` : phone;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.BAILEYS_API_KEY) headers["X-Api-Key"] = env.BAILEYS_API_KEY;

  for (const baseUrl of getBaileysBaseUrls()) {
    try {
      const res = await fetch(`${baseUrl}/send`, {
        method: "POST",
        headers,
        body: JSON.stringify({ phone: normalized, message }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return;
    } catch {
      // best-effort
    }
  }
}

// WhatsApp notification when a new order is created
export async function sendWhatsAppOrderCreated(order: {
  customer: { fullName: string; phone: string };
  orderNumber: string;
  items: { productName: { ar?: string; en?: string }; variantLabel?: string; quantity: number; unitPrice: number }[];
  total: number;
  deliveryType: string;
  storeName?: string;
}): Promise<void> {
  if (!isWhatsAppConfigured()) return;
  const storeName = order.storeName || "المتجر";
  const itemsText = order.items
    .map((item) => `• ${item.productName.ar || item.productName.en || "منتج"}${item.variantLabel ? ` (${item.variantLabel})` : ""} × ${item.quantity}`)
    .join("\n");
  const delivery = order.deliveryType === "HOME_DELIVERY" ? "توصيل للمنزل" : "استلام من مكتب الشحن";

  const message = [
    `🛍️ *${storeName}*`,
    ``,
    `مرحباً *${order.customer.fullName}*! 👋`,
    ``,
    `✅ تم استلام طلبك بنجاح!`,
    `📦 رقم الطلب: *${order.orderNumber}*`,
    ``,
    itemsText,
    ``,
    `💰 المجموع: *${order.total.toLocaleString("ar-DZ")} دج*`,
    `🚚 ${delivery} — الدفع عند الاستلام`,
    ``,
    `⏳ سيتم التواصل معك قريباً لتأكيد موعد التسليم.`,
    `📍 تتبع طلبك: https://visadz.store/track-order`,
  ].join("\n");

  await sendWhatsAppMessage(order.customer.phone, message);
}

// Arabic status labels for WhatsApp notifications
const ZR_STATUS_AR: Record<string, string> = {
  SHIPPED:    "شحنتك في الطريق 🚚",
  DELIVERED:  "تم تسليم طلبك بنجاح ✅",
  PICKED_UP:  "تم استلام طلبك ✅",
  RETURNED:   "تم إرجاع الشحنة 🔄",
  CANCELLED:  "تم إلغاء الشحنة ❌",
  FAILED:     "فشلت محاولة التسليم ⚠️",
  PROCESSING: "جارٍ تجهيز شحنتك 📦",
};

export async function sendWhatsAppStatusUpdate(
  phone: string,
  orderNumber: string,
  trackingNumber: string,
  status: string,
): Promise<void> {
  if (!isWhatsAppConfigured()) return;
  const settings = await WebsiteSettingModel.findOne().select("storeName").lean().catch(() => null);
  const storeName = settings?.storeName || "المتجر";
  const statusLine = ZR_STATUS_AR[status] ?? `حالة جديدة: ${status}`;
  const message = [
    `🛍️ *${storeName}* — تحديث طلبك`,
    ``,
    `📦 رقم الطلب: *${orderNumber}*`,
    ...(trackingNumber ? [`🔍 رقم التتبع: *${trackingNumber}*`] : []),
    ``,
    statusLine,
    ``,
    `تابع شحنتك على: https://visadz.store/track-order`,
  ].join("\n");

  const normalized = phone.startsWith("0") ? `213${phone.slice(1)}` : phone;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.BAILEYS_API_KEY) headers["X-Api-Key"] = env.BAILEYS_API_KEY;

  for (const baseUrl of getBaileysBaseUrls()) {
    try {
      const res = await fetch(`${baseUrl}/send`, {
        method: "POST",
        headers,
        body: JSON.stringify({ phone: normalized, message }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return;
    } catch {
      // best-effort — don't block order update on WhatsApp failure
    }
  }
}
