import { Router } from "express";
import { z } from "zod";
import { OtpModel } from "../../models/otp.model.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AppError } from "../../utils/app-error.js";
import {
  createVerificationToken,
  generateOtpCode,
  hashOtpCode,
  isSmsConfigured,
  isWhatsAppConfigured,
  otpTtlSeconds,
  sendSmsOtp,
  sendWhatsAppOtp,
  verifySmsOtp,
  verifyOtpCode,
} from "../../utils/otp.js";
import { sendTikTokEvent } from "../../utils/tiktokEvents.js";
import { isIpAllowed } from "../../utils/geoip.js";

const router = Router();

const OTP_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 min
const OTP_RATE_LIMIT = 3;                  // max 3 OTPs per phone per 10 min
const MAX_VERIFY_ATTEMPTS = 5;
const SMS_DAILY_LIMIT_PER_PHONE = 1;      // max 1 SMS per phone per day — use WhatsApp for retries
const SMS_GLOBAL_DAILY_LIMIT = 200;        // max 200 SMS/day total (cost protection)

// Global SMS counter — resets at midnight (in-memory, enough for single server)
let smsDailyCount = 0;
let smsDayReset = new Date().toDateString();
function checkAndIncrementSmsGlobal(): boolean {
  const today = new Date().toDateString();
  if (today !== smsDayReset) { smsDailyCount = 0; smsDayReset = today; }
  if (smsDailyCount >= SMS_GLOBAL_DAILY_LIMIT) return false;
  smsDailyCount++;
  return true;
}

// Return available channels to frontend
router.get(
  "/otp/channels",
  asyncHandler(async (_req, res) => {
    return res.json({
      whatsapp: isWhatsAppConfigured(),
      sms: isSmsConfigured(),
    });
  }),
);

// Send OTP via chosen channel
router.post(
  "/otp/send",
  asyncHandler(async (req, res) => {
    // ── SECURITY: Algeria-only ──
    const clientIp = String(req.ip ?? req.headers["x-forwarded-for"] ?? "");
    const { allowed } = await isIpAllowed(clientIp);
    if (!allowed) {
      throw new AppError("الوصول متاح فقط من داخل الجزائر.", 403);
    }

    const input = z
      .object({
        phone: z.string().regex(/^(05|06|07)\d{8}$/, "رقم الهاتف غير صحيح"),
        channel: z.enum(["whatsapp", "sms"]),
      })
      .parse(req.body);

    if (input.channel === "whatsapp" && !isWhatsAppConfigured()) {
      throw new AppError("خدمة واتساب غير متاحة حالياً", 503);
    }
    if (input.channel === "sms" && !isSmsConfigured()) {
      throw new AppError("خدمة الرسائل القصيرة غير متاحة حالياً", 503);
    }

    // Rate limit per phone (10 min window)
    const windowStart = new Date(Date.now() - OTP_RATE_WINDOW_MS);
    const recentCount = await OtpModel.countDocuments({ phone: input.phone, expiresAt: { $gte: windowStart } });
    if (recentCount >= OTP_RATE_LIMIT) {
      throw new AppError("تجاوزت الحد الأقصى لإرسال الرموز. حاول مجدداً بعد 10 دقائق.", 429);
    }

    // ── SMS-specific extra limits ──
    if (input.channel === "sms") {
      // Per-phone daily SMS limit
      const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
      const smsTodayForPhone = await OtpModel.countDocuments({ phone: input.phone, channel: "sms", createdAt: { $gte: dayStart } });
      if (smsTodayForPhone >= SMS_DAILY_LIMIT_PER_PHONE) {
        throw new AppError("تم إرسال رسالة SMS مسبقاً لهذا الرقم. استخدم واتساب للتحقق.", 429);
      }
      // Global daily SMS limit (cost protection)
      if (!checkAndIncrementSmsGlobal()) {
        throw new AppError("خدمة SMS غير متاحة مؤقتاً. حاول واتساب أو أعد المحاولة لاحقاً.", 429);
      }
    }

    if (input.channel === "sms") {
      // For SMS: Prelude manages the OTP code — just trigger the send
      try {
        await sendSmsOtp(input.phone);
      } catch (err) {
        throw new AppError("فشل إرسال رمز SMS. حاول مجدداً.", 502);
      }
      // Store a placeholder so rate limiting works and we know SMS was sent
      await OtpModel.create({
        phone: input.phone,
        codeHash: "sms-managed-by-prelude", // Prelude handles verification
        channel: "sms",
        expiresAt: new Date(Date.now() + otpTtlSeconds() * 1000),
      });
      return res.json({ success: true, expiresIn: otpTtlSeconds(), channel: "sms" });
    }

    // WhatsApp: generate + hash + send via Baileys
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + otpTtlSeconds() * 1000);

    await OtpModel.create({
      phone: input.phone,
      codeHash: hashOtpCode(code),
      channel: "whatsapp",
      expiresAt,
    });

    try {
      await sendWhatsAppOtp(input.phone, code);
    } catch (err) {
      await OtpModel.deleteMany({ phone: input.phone, codeHash: hashOtpCode(code) });
      throw new AppError("فشل إرسال رمز واتساب. حاول مجدداً.", 502);
    }

    return res.json({ success: true, expiresIn: otpTtlSeconds(), channel: "whatsapp" });
  }),
);

// Verify OTP
router.post(
  "/otp/verify",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        phone: z.string().regex(/^(05|06|07)\d{8}$/),
        code: z.string().regex(/^\d{6}$/, "الرمز يجب أن يكون 6 أرقام"),
        channel: z.enum(["whatsapp", "sms"]).default("whatsapp"),
      })
      .parse(req.body);

    if (input.channel === "sms") {
      // Verify via Prelude
      const otp = await OtpModel.findOne({
        phone: input.phone,
        channel: "sms",
        expiresAt: { $gte: new Date() },
        usedAt: null,
      }).sort({ expiresAt: -1 });

      if (!otp) {
        throw new AppError("لم يتم إرسال رمز SMS أو انتهت صلاحيته", 400);
      }
      if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
        throw new AppError("تجاوزت عدد المحاولات المسموحة. أعد إرسال الرمز.", 429);
      }

      otp.attempts += 1;
      const isValid = await verifySmsOtp(input.phone, input.code);
      if (!isValid) {
        await otp.save();
        const remaining = MAX_VERIFY_ATTEMPTS - otp.attempts;
        throw new AppError(
          remaining > 0 ? `رمز SMS غير صحيح. ${remaining} محاولات متبقية` : "تجاوزت عدد المحاولات.",
          400,
        );
      }
      otp.usedAt = new Date();
      await otp.save();
    } else {
      // WhatsApp: verify against stored hash
      const otp = await OtpModel.findOne({
        phone: input.phone,
        channel: "whatsapp",
        expiresAt: { $gte: new Date() },
        usedAt: null,
      }).sort({ expiresAt: -1 });

      if (!otp) {
        throw new AppError("لم يتم إرسال رمز أو انتهت صلاحيته", 400);
      }
      if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
        throw new AppError("تجاوزت عدد المحاولات المسموحة. أعد إرسال الرمز.", 429);
      }
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
    }

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
