import crypto from "crypto";
import { env } from "../config/env.js";

// ─── Hashing helpers ────────────────────────────────────────────────────────

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/**
 * Normalize an Algerian phone to E.164-style (no +) then hash it.
 * "0555123456" → "213555123456" → sha256
 */
function hashPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const e164 = digits.startsWith("0") ? "213" + digits.slice(1) : digits;
  return sha256(e164);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CapiEventOptions {
  eventName: string;
  /** Deduplication ID — must match the Pixel eventID on the client. */
  eventId?: string;
  sourceUrl?: string;
  /** Unix timestamp in seconds. Defaults to now. */
  eventTime?: number;
  // Raw (unhashed) values — we hash them here before sending
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  country?: string;
  // Browser metadata passed from the frontend (never hash these)
  clientIp?: string;
  clientUserAgent?: string;
  fbp?: string;
  fbc?: string;
  // Custom data
  currency?: string;
  value?: number;
  contentIds?: string[];
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Send a server-side event to the Meta Conversions API.
 * Silently no-ops if META_PIXEL_ID or FACEBOOK_ACCESS_TOKEN are not configured.
 * Never throws — CAPI failures must never break order creation.
 */
export async function sendCapiEvent(options: CapiEventOptions): Promise<void> {
  if (!env.META_PIXEL_ID || !env.FACEBOOK_ACCESS_TOKEN) return;

  // Build hashed user_data (PII fields must be SHA-256 hashed)
  const userData: Record<string, unknown> = {};

  if (options.phone) userData["ph"] = [hashPhone(options.phone)];
  if (options.firstName) userData["fn"] = [sha256(options.firstName)];
  if (options.lastName && options.lastName.trim()) userData["ln"] = [sha256(options.lastName)];
  if (options.city) userData["ct"] = [sha256(options.city)];
  if (options.state) userData["st"] = [sha256(options.state)];
  if (options.country) userData["country"] = [sha256(options.country)];

  // These three must NOT be hashed
  if (options.clientIp) userData["client_ip_address"] = options.clientIp;
  if (options.clientUserAgent) userData["client_user_agent"] = options.clientUserAgent;
  if (options.fbp) userData["fbp"] = options.fbp;
  if (options.fbc) userData["fbc"] = options.fbc;

  const eventData: Record<string, unknown> = {
    event_name: options.eventName,
    event_time: options.eventTime ?? Math.floor(Date.now() / 1000),
    action_source: "website",
    event_source_url: options.sourceUrl ?? env.FRONTEND_URL,
    user_data: userData,
  };

  if (options.eventId) eventData["event_id"] = options.eventId;

  if (options.currency || options.value !== undefined || options.contentIds) {
    const customData: Record<string, unknown> = {};
    if (options.currency) customData["currency"] = options.currency;
    if (options.value !== undefined) customData["value"] = options.value;
    if (options.contentIds) {
      customData["content_ids"] = options.contentIds;
      customData["content_type"] = "product";
    }
    eventData["custom_data"] = customData;
  }

  const url = `https://graph.facebook.com/v20.0/${env.META_PIXEL_ID}/events?access_token=${env.FACEBOOK_ACCESS_TOKEN}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [eventData] }),
    });

    if (!response.ok && env.NODE_ENV !== "production") {
      console.warn("[CAPI]", options.eventName, "failed:", await response.text());
    }
  } catch (err) {
    // Never rethrow — CAPI must not block or crash the request
    if (env.NODE_ENV !== "production") {
      console.warn("[CAPI] Network error:", err);
    }
  }
}
