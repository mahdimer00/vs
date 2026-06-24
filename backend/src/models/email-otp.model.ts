import { model, Schema } from "mongoose";

// Stores pending affiliate registrations waiting for email OTP verification
const emailOtpSchema = new Schema({
  email: { type: String, required: true, index: true, lowercase: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  // Store full registration payload so we can create the affiliate after verification
  payload: { type: Schema.Types.Mixed, required: true },
});

emailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailOtpModel = model("EmailOtp", emailOtpSchema);
