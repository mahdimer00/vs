import dotenv from "dotenv";
import { z } from "zod";
import { AppError } from "../utils/app-error.js";

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  MONGO_URI: z.string().default("mongodb://localhost:27017/visastore"),
  JWT_SECRET: z.string().min(16).default("replace-with-long-random-secret"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  BACKEND_URL: z.string().default("http://localhost:4000"),
  OLLAMA_URL: z.string().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("llama3.1"),
  UPLOAD_DIR: z.string().default("uploads"),
  ADMIN_EMAIL: z.string().email().default("admin@visastore.dz"),
  ADMIN_PASSWORD: z.string().min(12).default("ChangeThisAdminPassword123!"),
  AFFILIATE_EMAIL: z.string().email().default("affiliate@visastore.dz"),
  AFFILIATE_PASSWORD: z.string().min(12).default("ChangeThisAffiliatePassword123!"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  // Meta Conversions API (server-side pixel)
  META_PIXEL_ID: z.string().optional(),
  FACEBOOK_ACCESS_TOKEN: z.string().optional(),
  // Request signing — must match VITE_API_SECRET in frontend
  API_REQUEST_SECRET: z.string().optional(),
  // ZR Express shipping integration
  ZR_EXPRESS_TENANT_ID: z.string().optional(),
  ZR_EXPRESS_SECRET_KEY: z.string().optional(),
});

export const env = schema.parse(process.env);

if (
  env.NODE_ENV === "production" &&
  (
    env.JWT_SECRET === "replace-with-long-random-secret" ||
    env.ADMIN_PASSWORD === "ChangeThisAdminPassword123!" ||
    env.AFFILIATE_PASSWORD === "ChangeThisAffiliatePassword123!"
  )
) {
  throw new AppError("Production secrets are not configured", 500);
}
