import { Router } from "express";
import { z } from "zod";
import { OtpModel } from "../../models/otp.model.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AppError } from "../../utils/app-error.js";
import {
  createVerificationToken,
  generateOtpCode,
  hashOtpCode,
  isEmailOtpConfigured,
  isWhatsAppConfigured,
  otpTtlSeconds,
  sendCheckoutEmailOtp,
  sendWhatsAppOtp,
  verifyOtpCode,
} from "../../utils/otp.js";
import { sendTikTokEvent } from "../../utils/tiktokEvents.js";
import { isIpAllowed, getRealIp } from "../../utils/geoip.js";

const router = Router();

// Blocked temp email domains
const BLOCKED_EMAIL_DOMAINS = new Set([
  "mailinator.com","guerrillamail.com","tempmail.com","throwam.com","yopmail.com",
  "sharklasers.com","guerrillamailblock.com","grr.la","guerrillamail.info",
  "spam4.me","trashmail.com","trashmail.me","dispostable.com","maildrop.cc",
  "throwam.com","fake-email.net","mailnull.com","spamgourmet.com","getairmail.com",
  "fakeinbox.com","mailsac.com","mohmal.com","temp-mail.org","10minutemail.com",
  "tempinbox.com","emailondeck.com","discard.email","mailnesia.com","sharklasers.com",
]);

function isBlockedEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return BLOCKED_EMAIL_DOMAINS.has(domain);
}

const OTP_RATE_WINDOW_MS = 10 * 60 * 1000;
const OTP_RATE_LIMIT = 3;
const MAX_VERIFY_ATTEMPTS = 5;

// Available channels — frontend reads this to show/hide options
// Also checks siteSettings.otpEnabled so admin toggle works immediately
router.get(
  "/otp/channels",
  asyncHandler(async (_req, res) => {
    const { WebsiteSettingModel } = await import("../../models/catalog.model.js");
    const settings = await WebsiteSettingModel.findOne().select("otpEnabled otpWhatsappEnabled otpEmailEnabled").lean().catch(() => null);
    const globalEnabled = settings?.otpEnabled !== false;
    return res.json({
      whatsapp: globalEnabled && settings?.otpWhatsappEnabled !== false && isWhatsAppConfigured(),
      email: globalEnabled && settings?.otpEmailEnabled !== false && isEmailOtpConfigured(),
    });
  }),
);

// Send OTP
router.post(
  "/otp/send",
  asyncHandler(async (req, res) => {
    // Algeria-only
    const clientIp = getRealIp(req);
    const { allowed } = await isIpAllowed(clientIp);
    if (!allowed) throw new AppError("الوصول متاح فقط من داخل الجزائر.", 403);

    const input = z.object({
      phone: z.string().regex(/^(05|06|07)\d{8}$/, "رقم الهاتف غير صحيح"),
      channel: z.enum(["whatsapp", "email"]),
      email: z.string().email().optional(), // required for email channel
    }).parse(req.body);

    if (input.channel === "whatsapp" && !isWhatsAppConfigured()) {
      throw new AppError("خدمة واتساب غير متاحة حالياً", 503);
    }
    if (input.channel === "email") {
      if (!isEmailOtpConfigured()) throw new AppError("خدمة البريد الإلكتروني غير متاحة حالياً", 503);
      if (!input.email) throw new AppError("يرجى إدخال بريدك الإلكتروني", 400);
      if (isBlockedEmail(input.email)) throw new AppError("يرجى استخدام بريد إلكتروني حقيقي (Gmail, Outlook, Yahoo, ...)", 400);
    }

    // Rate limit per phone (10 min)
    const windowStart = new Date(Date.now() - OTP_RATE_WINDOW_MS);
    const recentCount = await OtpModel.countDocuments({ phone: input.phone, expiresAt: { $gte: windowStart } });
    if (recentCount >= OTP_RATE_LIMIT) {
      throw new AppError("تجاوزت الحد الأقصى لإرسال الرموز. حاول مجدداً بعد 10 دقائق.", 429);
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + otpTtlSeconds() * 1000);

    await OtpModel.create({
      phone: input.phone,
      codeHash: hashOtpCode(code),
      channel: input.channel,
      expiresAt,
    });

    try {
      if (input.channel === "whatsapp") {
        await sendWhatsAppOtp(input.phone, code);
      } else {
        await sendCheckoutEmailOtp(input.email!, code, input.phone);
      }
    } catch (err) {
      await OtpModel.deleteMany({ phone: input.phone, codeHash: hashOtpCode(code) });
      const msg = input.channel === "email"
        ? "فشل إرسال البريد الإلكتروني. تأكد من صحة عنوانك وحاول مجدداً."
        : "فشل إرسال رمز واتساب. حاول مجدداً.";
      throw new AppError(msg, 502);
    }

    return res.json({ success: true, expiresIn: otpTtlSeconds(), channel: input.channel });
  }),
);

// Verify OTP (WhatsApp or Email — both stored in DB)
router.post(
  "/otp/verify",
  asyncHandler(async (req, res) => {
    const input = z.object({
      phone: z.string().regex(/^(05|06|07)\d{8}$/),
      code: z.string().regex(/^\d{6}$/, "الرمز يجب أن يكون 6 أرقام"),
      channel: z.enum(["whatsapp", "email"]).default("whatsapp"),
    }).parse(req.body);

    const otp = await OtpModel.findOne({
      phone: input.phone,
      channel: input.channel,
      expiresAt: { $gte: new Date() },
      usedAt: null,
    }).sort({ expiresAt: -1 });

    if (!otp) throw new AppError("لم يتم إرسال رمز أو انتهت صلاحيته", 400);
    if (otp.attempts >= MAX_VERIFY_ATTEMPTS) throw new AppError("تجاوزت عدد المحاولات المسموحة. أعد إرسال الرمز.", 429);

    otp.attempts += 1;
    if (!verifyOtpCode(input.code, otp.codeHash)) {
      await otp.save();
      const remaining = MAX_VERIFY_ATTEMPTS - otp.attempts;
      throw new AppError(
        remaining > 0 ? `رمز التحقق غير صحيح. ${remaining} محاولات متبقية` : "تجاوزت عدد المحاولات.",
        400,
      );
    }

    otp.usedAt = new Date();
    await otp.save();

    void sendTikTokEvent({
      event: "CompleteRegistration",
      phone: input.phone,
      clientIp: req.ip,
      clientUserAgent: String(req.headers["user-agent"] ?? ""),
      sourceUrl: `${process.env.FRONTEND_URL ?? ""}/checkout`,
      value: 0,
    });

    return res.json({ success: true, verificationToken: createVerificationToken(input.phone) });
  }),
);

export default router;
