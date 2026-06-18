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
  const baseUrl = env.BAILEYS_API_URL.replace(/\/$/, "");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.BAILEYS_API_KEY) {
    headers["X-Api-Key"] = env.BAILEYS_API_KEY;
  }

  const res = await fetch(`${baseUrl}/send`, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone: normalized, message }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp OTP send failed (${res.status}): ${err}`);
  }
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(env.BAILEYS_API_URL);
}
