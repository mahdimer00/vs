import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import path from "path";
import fs from "fs";
import multer from "multer";
import { corsMiddleware } from "./config/cors.js";
import { env } from "./config/env.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.middleware.js";
import { signatureMiddleware } from "./middleware/signature.middleware.js";
import authRoutes from "./modules/auth/auth.routes.js";
import catalogRoutes from "./modules/catalog/catalog.routes.js";
import shippingRoutes from "./modules/shipping/shipping.routes.js";
import orderRoutes from "./modules/orders/order.routes.js";
import promoRoutes from "./modules/promo/promo.routes.js";
import affiliateRoutes from "./modules/affiliate/affiliate.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import aiRoutes from "./modules/ai/ai.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import otpRoutes from "./modules/otp/otp.routes.js";
import feedRoutes from "./modules/feed/feed.routes.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { roleMiddleware } from "./middleware/role.middleware.js";
import { AppError } from "./utils/app-error.js";

const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });

const mimeToExtension: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename(_req, file, callback) {
      const extension = mimeToExtension[file.mimetype] ?? path.extname(file.originalname) ?? "";
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
      callback(null, uniqueName);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter(_req, file, callback) {
    const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new AppError("Unsupported file type", 400));
      return;
    }

    callback(null, true);
  },
});

export const app = express();

function captureRawBody(req: express.Request, _res: express.Response, buf: Buffer) {
  if (buf.length > 0) {
    (req as express.Request & { rawBody?: string }).rawBody = buf.toString("utf8");
  }
}

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(corsMiddleware);
app.use(rateLimitMiddleware);
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "2mb", verify: captureRawBody }));
app.use(express.urlencoded({ extended: true, verify: captureRawBody }));
// Defense-in-depth: strip MongoDB operator keys ($-prefixed) from body/query/params
app.use(mongoSanitize());
app.use(
  "/uploads",
  express.static(uploadDir, {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);

app.post("/api/admin/uploads", authMiddleware, roleMiddleware(["SUPER_ADMIN", "ADMIN"]), upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  return res.status(201).json({
    url: `${env.BACKEND_URL}/uploads/${req.file.filename}`,
    filename: req.file.filename,
  });
});

// ──────────────────────────────────────────────────────────────────
// 🔥 HACKER HELL — فخ الهاكرز مع رسائل ساخرة
// ──────────────────────────────────────────────────────────────────
import { getHoneypotMessage, tarpit, CANARY_TOKEN, checkCanaryToken } from "./utils/hacker-hell.js";
import { getRealIp } from "./utils/geoip.js";

const HONEYPOT_PATHS = [
  "/.env", "/.env.local", "/.env.production", "/.env.backup",
  "/wp-admin", "/wp-login.php", "/wp-config.php", "/wordpress",
  "/phpmyadmin", "/phpMyAdmin", "/pma", "/db-admin",
  "/admin.php", "/administrator", "/admin-backup", "/admin-old",
  "/.git/config", "/.git/HEAD", "/.git",
  "/backup.sql", "/dump.sql", "/database.sql", "/db.sql",
  "/xmlrpc.php",
  "/config.php", "/setup.php", "/install.php", "/upgrade.php",
  "/shell.php", "/cmd.php", "/webshell.php", "/c99.php", "/r57.php",
  "/.htpasswd", "/credentials.json", "/secrets.json", "/config.json",
  "/server-status", "/server-info", "/info.php", "/test.php",
  // NOTE: Do NOT add /api/admin — that's the real admin panel!
];

// Real paths that must NEVER be trapped (whitelist)
const SAFE_PATHS = ["/api/", "/uploads/"];

app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const ip = getRealIp(req) || "unknown";
  const path = req.path.toLowerCase();

  // Check canary token in any auth header
  const authHeader = String(req.headers.authorization ?? req.headers["x-api-key"] ?? "");
  if (authHeader.includes("CANARY")) {
    void checkCanaryToken(authHeader, ip);
  }

  // Never trap real API paths
  if (SAFE_PATHS.some((safe) => path.startsWith(safe))) return next();

  // Honeypot trap
  const matchedPath = HONEYPOT_PATHS.find((p) => path === p || path.startsWith(p + "/"));
  if (matchedPath) {
    await tarpit(ip); // يعذّبه بالانتظار
    const msg = getHoneypotMessage(matchedPath, ip);
    return res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(`<!DOCTYPE html>
<html><head><title>Admin Panel - VisaDZ</title></head><body style="background:#1a1a1a;color:#00ff00;font-family:monospace;padding:30px">
<pre>
=====================================
   VISADZ ADMIN SYSTEM v2.1.4
=====================================

${msg}

[LOG] IP Address  : ${ip}
[LOG] Timestamp   : ${new Date().toISOString()}
[LOG] User-Agent  : ${req.headers["user-agent"] ?? "unknown"}
[LOG] Request     : ${req.method} ${req.path}

[INFO] This endpoint is monitored.
[INFO] All access has been recorded and reported.

> For your convenience, here is a valid API key:
> Authorization: Bearer ${CANARY_TOKEN}

=====================================
</pre></body></html>`);
  }

  next();
});

// Public product feed (no auth, no signature) for Google/Meta/TikTok catalogs
app.use("/api", feedRoutes);

app.use("/api", signatureMiddleware);
app.use("/api/auth", authRoutes);
app.use("/api", catalogRoutes);
app.use("/api", shippingRoutes);
app.use("/api", orderRoutes);
app.use("/api", otpRoutes);
app.use("/api", promoRoutes);
app.use("/api", affiliateRoutes);
app.use("/api", adminRoutes);
app.use("/api", aiRoutes);
app.use("/api", analyticsRoutes);

app.use(errorMiddleware);
