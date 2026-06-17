import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export function signatureMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only verify writes — GET requests are public catalog data (no attack risk)
  if (!env.API_REQUEST_SECRET || req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }

  const timestamp = req.headers["x-timestamp"];
  const signature = req.headers["x-signature"];

  if (typeof timestamp !== "string" || typeof signature !== "string") {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 120) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  if (!/^[0-9a-f]{64}$/.test(signature)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const expected = crypto
    .createHmac("sha256", env.API_REQUEST_SECRET)
    .update(timestamp)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  next();
}
