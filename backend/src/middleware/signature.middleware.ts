import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

const MAX_SKEW_SECONDS = 120;
const NONCE_TTL_MS = MAX_SKEW_SECONDS * 1000;
const NONCE_CACHE_LIMIT = 5000;
const usedNonces = new Map<string, number>();

type SignedRequest = Request & { rawBody?: string };

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getRawBody(req: SignedRequest) {
  if (typeof req.rawBody === "string") {
    return req.rawBody;
  }

  if (req.body === undefined || req.body === null) {
    return "";
  }

  if (typeof req.body === "string") {
    return req.body;
  }

  return JSON.stringify(req.body);
}

function purgeExpiredNonces(now: number) {
  for (const [key, expiresAt] of usedNonces) {
    if (expiresAt > now) {
      break;
    }
    usedNonces.delete(key);
  }

  while (usedNonces.size > NONCE_CACHE_LIMIT) {
    const oldest = usedNonces.keys().next().value;
    if (!oldest) {
      break;
    }
    usedNonces.delete(oldest);
  }
}

function buildCanonicalRequest(req: Request, timestamp: string, nonce: string, contentHash: string) {
  return [timestamp, nonce, req.method.toUpperCase(), req.originalUrl, contentHash].join(".");
}

export function signatureMiddleware(req: SignedRequest, res: Response, next: NextFunction) {
  if (!env.API_REQUEST_SECRET || req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }

  const timestamp = req.headers["x-timestamp"];
  const nonce = req.headers["x-nonce"];
  const contentHash = req.headers["x-content-sha256"];
  const signature = req.headers["x-signature"];

  if (
    typeof timestamp !== "string" ||
    typeof nonce !== "string" ||
    typeof contentHash !== "string" ||
    typeof signature !== "string"
  ) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  if (!/^\d{10}$/.test(timestamp)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const ts = parseInt(timestamp, 10);
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > MAX_SKEW_SECONDS) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  if (!/^[0-9a-f]{32}$/i.test(nonce) || !/^[0-9a-f]{64}$/i.test(contentHash) || !/^[0-9a-f]{64}$/i.test(signature)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const actualContentHash = sha256Hex(getRawBody(req));
  if (!crypto.timingSafeEqual(Buffer.from(contentHash, "hex"), Buffer.from(actualContentHash, "hex"))) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const now = Date.now();
  purgeExpiredNonces(now);

  const nonceKey = `${timestamp}:${nonce.toLowerCase()}`;
  if (usedNonces.has(nonceKey)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const expected = crypto
    .createHmac("sha256", env.API_REQUEST_SECRET)
    .update(buildCanonicalRequest(req, timestamp, nonce.toLowerCase(), contentHash.toLowerCase()))
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  usedNonces.set(nonceKey, now + NONCE_TTL_MS);
  next();
}
