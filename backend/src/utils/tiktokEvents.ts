import crypto from "crypto";
import { env } from "../config/env.js";

const TIKTOK_PIXEL_ID = "D8QQOSRC77U5MO7JA4T0";
const TIKTOK_API_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function hashPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const e164 = digits.startsWith("0") ? "213" + digits.slice(1) : digits;
  return sha256(e164);
}

export interface TikTokContent {
  content_id: string;
  content_type: "product" | "product_group";
  content_name: string;
  price?: number;
  quantity?: number;
}

export interface TikTokEventOptions {
  event: string;
  eventId?: string;
  phone?: string;
  clientIp?: string;
  clientUserAgent?: string;
  sourceUrl?: string;
  value?: number;
  currency?: string;
  contents?: TikTokContent[];
  searchString?: string;
}

export async function sendTikTokEvent(options: TikTokEventOptions): Promise<void> {
  if (!env.TIKTOK_ACCESS_TOKEN) return;

  const user: Record<string, string> = {};
  if (options.phone) user["phone_number"] = hashPhone(options.phone);
  if (options.phone) user["external_id"] = hashPhone(options.phone);
  if (options.clientIp) user["ip"] = options.clientIp;
  if (options.clientUserAgent) user["user_agent"] = options.clientUserAgent;

  const properties: Record<string, unknown> = {
    currency: options.currency ?? "DZD",
    value: options.value ?? 0,
  };
  if (options.contents && options.contents.length > 0) {
    properties["contents"] = options.contents;
    properties["content_type"] = "product";
  }
  if (options.searchString) {
    properties["search_string"] = options.searchString;
  }

  const eventData: Record<string, unknown> = {
    event: options.event,
    event_time: Math.floor(Date.now() / 1000),
    user,
    page: { url: options.sourceUrl ?? `${env.FRONTEND_URL}/` },
    properties,
  };
  if (options.eventId) eventData["event_id"] = options.eventId;

  const payload = {
    pixel_code: TIKTOK_PIXEL_ID,
    event_source: "web",
    event_source_id: TIKTOK_PIXEL_ID,
    data: [eventData],
  };

  try {
    const res = await fetch(TIKTOK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": env.TIKTOK_ACCESS_TOKEN,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok && env.NODE_ENV !== "production") {
      console.warn("[TikTok Events]", options.event, "failed:", await res.text());
    }
  } catch (err) {
    if (env.NODE_ENV !== "production") {
      console.warn("[TikTok Events] network error:", err);
    }
  }
}
