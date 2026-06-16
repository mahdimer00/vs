import { Router } from "express";
import { z } from "zod";
import { authMiddleware, type AuthedRequest } from "../../middleware/auth.middleware.js";
import { loginRateLimitMiddleware, registerRateLimitMiddleware } from "../../middleware/rateLimit.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { comparePassword, hashPassword, signToken } from "../../utils/auth.js";
import { UserModel } from "../../models/user.model.js";
import { AffiliateModel } from "../../models/affiliate.model.js";
import { AppError } from "../../utils/app-error.js";
import { sendTelegramMessage } from "../../utils/telegram.js";
import type { AdminPermission } from "../../constants/permissions.js";
import type { AuthPayload } from "../../middleware/auth.middleware.js";

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

router.post(
  "/affiliate/register",
  registerRateLimitMiddleware,
  asyncHandler(async (req, res) => {
    const input = affiliateRegisterSchema.parse(req.body);
    const exists = await AffiliateModel.findOne({ email: input.email.toLowerCase() });
    if (exists) {
      return res.status(409).json({ message: "Email already registered" });
    }

    let referredBy: string | undefined;
    if (input.ref) {
      const referrer = await AffiliateModel.findOne({ referralCode: input.ref.toUpperCase() });
      if (referrer) {
        referredBy = String(referrer._id);
      }
    }

    const affiliate = await AffiliateModel.create({
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      referralCode: await generateUniqueReferralCode(input.name),
      commissionRate: 1,
      status: "PENDING",
      referredBy,
      balancePending: 0,
      balanceApproved: 0,
      balancePaid: 0,
    });

    void sendTelegramMessage(
      `🆕 <b>New affiliate registration</b>\n` +
        `Name: ${affiliate.name}\n` +
        `Email: ${affiliate.email}\n` +
        `Phone: ${affiliate.phone}\n` +
        `Status: PENDING — waiting for approval`,
    );

    const { passwordHash: _ph, ...safeAffiliate } = affiliate.toObject();
    return res.status(201).json({
      message: "Affiliate registration submitted and pending approval",
      affiliate: safeAffiliate,
    });
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
