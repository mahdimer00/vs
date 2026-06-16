import type { AnalyticsEventType } from "@/types";

interface EventPayload {
  eventType: AnalyticsEventType;
  productId?: string;
  orderId?: string;
}

const rawBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/$/, "");

function getEndpoint(): string {
  if (rawBase && rawBase.startsWith("http")) {
    return `${rawBase}/api/analytics/event`;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/analytics/event`;
  }
  return "";
}

/**
 * Fire-and-forget: sends an analytics event to the backend.
 * Never throws — analytics must never break the storefront.
 */
export function trackEvent(payload: EventPayload): void {
  const url = getEndpoint();
  if (!url) return;

  const body = JSON.stringify({
    eventType: payload.eventType,
    productId: payload.productId,
    orderId: payload.orderId,
    pageUrl: typeof window !== "undefined" ? window.location.href : "",
    referrer: typeof document !== "undefined" ? document.referrer : "",
  });

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // silently ignore — analytics failures must not surface to users
  });
}
