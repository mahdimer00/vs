import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { authMiddleware, type AuthedRequest } from "../../middleware/auth.middleware.js";
import { loginRateLimitMiddleware, registerRateLimitMiddleware } from "../../middleware/rateLimit.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { comparePassword, hashPassword, signToken } from "../../utils/auth.js";
import { UserModel } from "../../models/user.model.js";
import { AffiliateModel } from "../../models/affiliate.model.js";
import { EmailOtpModel } from "../../models/email-otp.model.js";
import { AppError } from "../../utils/app-error.js";
import { sendTelegramMessage } from "../../utils/telegram.js";
import { sendAffiliateOtpEmail } from "../../utils/email.js";
import type { AdminPermission } from "../../constants/permissions.js";
import type { AuthPayload } from "../../middleware/auth.middleware.js";

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}
function generateCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

const router = Router();

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const affiliateAuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const affiliateRegisterSchema = affiliateAuthSchema.extend({
  name: z.string().min(2),
  phone: z.string().regex(/^(05|06|07)\d{8}$/, "Invalid Algerian phone number"),
  ref: z.string().trim().optional(),
  shareMethod: z.string().max(50).optional(),
});

async function generateUniqueReferralCode(name: string) {
  const base = name.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "VISA";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `${base}${Math.floor(100 + Math.random() * 900)}`;
    const exists = await AffiliateModel.exists({ referralCode: code });
    if (!exists) {
      return code;
    }
  }

  return `${base}${Date.now().toString().slice(-4)}`;
}

router.post(
  "/admin/login",
  loginRateLimitMiddleware,
  asyncHandler(async (req, res) => {
    const input = adminLoginSchema.parse(req.body);
    const user = await UserModel.findOne({ email: input.email.toLowerCase(), isActive: true });
    if (!user || !(await comparePassword(input.password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken({ sub: String(user._id), role: user.role as AuthPayload["role"], email: String(user.email), permissions: user.permissions as AdminPermission[] | undefined });
    return res.json({
      token,
      user: { id: String(user._id), name: user.name, email: user.email, role: user.role, permissions: user.permissions },
    });
  }),
);

// Step 1: Submit registration → sends OTP email
router.post(
  "/affiliate/register",
  registerRateLimitMiddleware,
  asyncHandler(async (req, res) => {
    const input = affiliateRegisterSchema.parse(req.body);
    const email = input.email.toLowerCase();

    const exists = await AffiliateModel.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "هذا البريد الإلكتروني مسجّل مسبقاً" });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    // Remove any previous OTP for this email
    await EmailOtpModel.deleteMany({ email });

    // Hash password in advance so it's ready after verification
    const passwordHash = await hashPassword(input.password);

    await EmailOtpModel.create({
      email,
      codeHash: hashCode(code),
      expiresAt,
      payload: {
        name: input.name,
        email,
        phone: input.phone,
        passwordHash,
        ref: input.ref?.toUpperCase(),
        shareMethod: input.shareMethod || "",
      },
    });

    try {
      await sendAffiliateOtpEmail(email, input.name, code);
    } catch (err) {
      console.error("[Resend] Failed to send OTP email:", err);
      // Don't expose the error — just inform the user
      throw new AppError("فشل إرسال البريد الإلكتروني. تحقق من عنوان بريدك وحاول مجدداً.", 502);
    }

    return res.status(200).json({
      message: "otpSent",
      email,
    });
  }),
);

// Step 2: Verify OTP → create affiliate with ACTIVE status (auto-confirm)
router.post(
  "/affiliate/verify-otp",
  asyncHandler(async (req, res) => {
    const input = z.object({
      email: z.string().email(),
      code: z.string().regex(/^\d{6}$/),
    }).parse(req.body);

    const email = input.email.toLowerCase();
    const record = await EmailOtpModel.findOne({ email, usedAt: null, expiresAt: { $gte: new Date() } });

    if (!record) {
      throw new AppError("الرمز منتهي الصلاحية. أعد التسجيل من البداية.", 400);
    }
    if (record.attempts >= 5) {
      throw new AppError("تجاوزت عدد المحاولات المسموحة. أعد التسجيل.", 429);
    }

    record.attempts += 1;
    if (hashCode(input.code) !== record.codeHash) {
      await record.save();
      const left = 5 - record.attempts;
      throw new AppError(`رمز التحقق غير صحيح. ${left} محاولات متبقية.`, 400);
    }

    record.usedAt = new Date();
    await record.save();

    const payload = record.payload as {
      name: string; email: string; phone: string; passwordHash: string; ref?: string; shareMethod?: string;
    };

    // Check again in case registered during OTP wait
    const existing = await AffiliateModel.findOne({ email: payload.email });
    if (existing) {
      throw new AppError("هذا البريد الإلكتروني مسجّل مسبقاً.", 409);
    }

    let referredBy: string | undefined;
    if (payload.ref) {
      const referrer = await AffiliateModel.findOne({ referralCode: payload.ref });
      if (referrer) referredBy = String(referrer._id);
    }

    // Auto-confirm: status ACTIVE immediately (no admin approval needed)
    const affiliate = await AffiliateModel.create({
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      passwordHash: payload.passwordHash,
      referralCode: await generateUniqueReferralCode(payload.name),
      commissionRate: 1,
      status: "ACTIVE",
      shareMethod: payload.shareMethod || "",
      referredBy,
      balancePending: 0,
      balanceApproved: 0,
      balancePaid: 0,
    });

    void sendTelegramMessage(
      `✅ <b>New affiliate activated (auto)</b>\n` +
        `Name: ${affiliate.name}\n` +
        `Email: ${affiliate.email}\n` +
        `Phone: ${affiliate.phone}\n` +
        (payload.shareMethod ? `Share method: ${payload.shareMethod}\n` : "") +
        (referredBy ? `Referred by: ${payload.ref}\n` : "") +
        `Status: ACTIVE ✓`,
    );

    // Auto-login after verification
    const token = signToken({ sub: String(affiliate._id), role: "AFFILIATE", email: affiliate.email });
    const { passwordHash: _ph, ...safeAffiliate } = affiliate.toObject();
    return res.status(201).json({ token, affiliate: safeAffiliate });
  }),
);

router.post(
  "/affiliate/login",
  loginRateLimitMiddleware,
  asyncHandler(async (req, res) => {
    const input = affiliateAuthSchema.parse(req.body);
    const affiliate = await AffiliateModel.findOne({ email: input.email.toLowerCase() });
    if (!affiliate || !(await comparePassword(input.password, affiliate.passwordHash))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (affiliate.status === "PENDING") {
      throw new AppError("Affiliate account is pending approval", 403);
    }
    if (affiliate.status === "BLOCKED") {
      throw new AppError("Affiliate account has been blocked. Contact support for help.", 403);
    }
    if (affiliate.status !== "ACTIVE") {
      throw new AppError("Affiliate account is not active", 403);
    }

    const token = signToken({ sub: String(affiliate._id), role: "AFFILIATE", email: String(affiliate.email) });
    const { passwordHash: _ph, ...safeAffiliate } = affiliate.toObject();
    return res.json({ token, affiliate: safeAffiliate });
  }),
);

router.get(
  "/me",
  authMiddleware,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user.role === "AFFILIATE") {
      const affiliate = await AffiliateModel.findById(req.user.sub);
      if (!affiliate) {
        return res.status(404).json({ message: "Affiliate account no longer exists" });
      }
      return res.json({
        user: {
          id: String(affiliate._id),
          name: affiliate.name,
          email: affiliate.email,
          role: "AFFILIATE",
        },
      });
    }

    const user = await UserModel.findById(req.user.sub);
    if (!user) {
      return res.status(404).json({ message: "User account no longer exists" });
    }
    return res.json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
    });
  }),
);

export default router;
