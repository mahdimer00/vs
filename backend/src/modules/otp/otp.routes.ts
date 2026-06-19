import { Router } from "express";
import { z } from "zod";
import { OtpModel } from "../../models/otp.model.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AppError } from "../../utils/app-error.js";
import {
  createVerificationToken,
  generateOtpCode,
  hashOtpCode,
  isWhatsAppConfigured,
  otpTtlSeconds,
  sendWhatsAppOtp,
  verifyOtpCode,
} from "../../utils/otp.js";
import { sendTikTokEvent } from "../../utils/tiktokEvents.js";

const router = Router();

const OTP_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RATE_LIMIT = 3; // max OTPs per phone per 10 min
const MAX_VERIFY_ATTEMPTS = 5;

router.get(
  "/otp/channels",
  asyncHandler(async (_req, res) => {
    return res.json({ whatsapp: isWhatsAppConfigured() });
  }),
);

router.post(
  "/otp/send",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        phone: z.string().regex(/^(05|06|07)\d{8}$/, "رقم الهاتف غير صحيح"),
      })
      .parse(req.body);

    if (!isWhatsAppConfigured()) {
      throw new AppError("خدمة WhatsApp غير متاحة حالياً", 503);
    }

    const windowStart = new Date(Date.now() - OTP_RATE_WINDOW_MS);
    const recentCount = await OtpModel.countDocuments({
      phone: input.phone,
      expiresAt: { $gte: windowStart },
    });
    if (recentCount >= OTP_RATE_LIMIT) {
      throw new AppError("تجاوزت الحد الأقصى لإرسال الرموز. حاول مجدداً بعد 10 دقائق.", 429);
    }

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
      throw new AppError("فشل إرسال رمز التحقق. حاول مجدداً.", 502);
    }

    return res.json({ success: true, expiresIn: otpTtlSeconds() });
  }),
);

router.post(
  "/otp/verify",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        phone: z.string().regex(/^(05|06|07)\d{8}$/),
        code: z.string().regex(/^\d{6}$/, "الرمز يجب أن يكون 6 أرقام"),
      })
      .parse(req.body);

    const otp = await OtpModel.findOne({
      phone: input.phone,
      expiresAt: { $gte: new Date() },
      usedAt: null,
    }).sort({ expiresAt: -1 });

    if (!otp) {
      throw new AppError("لم يتم إرسال رمز تحقق أو انتهت صلاحيته", 400);
    }

    if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new AppError("تجاوزت عدد المحاولات المسموحة. أعد إرسال الرمز.", 429);
    }

    otp.attempts += 1;

    if (!verifyOtpCode(input.code, otp.codeHash)) {
      await otp.save();
      const remaining = MAX_VERIFY_ATTEMPTS - otp.attempts;
      throw new AppError(
        remaining > 0 ? `رمز التحقق غير صحيح. ${remaining} محاولات متبقية` : "تجاوزت عدد المحاولات المسموحة.",
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
