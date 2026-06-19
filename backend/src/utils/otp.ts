import crypto from "crypto";
import { env } from "../config/env.js";

export type OtpChannel = "whatsapp";

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

  const message = [
    "*VisaDZ*",
    `Your verification code: *${code}*`,
    "Valid for 5 minutes.",
    "Do not share this code with anyone.",
    "رمز التحقق الخاص بك صالح لمدة 5 دقائق. لا تشاركه مع أي شخص."
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
  const statusLine = ZR_STATUS_AR[status] ?? `حالة جديدة: ${status}`;
  const message = [
    `*VisaDZ* — تحديث طلبك`,
    ``,
    `📦 رقم الطلب: *${orderNumber}*`,
    `🔍 رقم التتبع: *${trackingNumber}*`,
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
