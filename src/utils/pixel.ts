import { getOrCreateExternalId } from "./externalId";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

const PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim();

let initialized = false;

/**
 * Inject the Meta Pixel base code and call fbq('init'). Call once on app start.
 * If VITE_META_PIXEL_ID is not set, this is a no-op.
 */
export function initPixel() {
  if (!PIXEL_ID || initialized || typeof document === "undefined") return;
  initialized = true;

  // Mirror the official fbq stub snippet exactly — callMethod check is required
  // so that after fbevents.js loads and attaches callMethod, queued events flush
  if (!window.fbq) {
    const fn = function (...args: unknown[]) {
      const f = fn as unknown as { callMethod?: (...a: unknown[]) => void; queue: unknown[][] };
      if (f.callMethod) {
        f.callMethod.apply(fn, args);
      } else {
        f.queue.push(args);
      }
    } as unknown as ((...a: unknown[]) => void) & {
      loaded: boolean;
      version: string;
      queue: unknown[][];
      callMethod?: (...args: unknown[]) => void;
    };
    fn.loaded = true;
    fn.version = "2.0";
    fn.queue = [];
    window.fbq = fn;
    window._fbq = fn;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  // Init with external_id for Advanced Matching — boosts EMQ significantly
  const externalId = getOrCreateExternalId();
  window.fbq("init", PIXEL_ID, externalId ? { external_id: externalId } : {});
}

function send(event: string, name: string, params?: Record<string, unknown>, options?: { eventID?: string }) {
  if (!PIXEL_ID || typeof window === "undefined" || !window.fbq) return;
  if (options?.eventID) {
    // Third argument = custom data, fourth = event options (eventID for deduplication)
    window.fbq(event, name, params ?? {}, { eventID: options.eventID });
  } else if (params) {
    window.fbq(event, name, params);
  } else {
    window.fbq(event, name);
  }
}

export function pixelPageView() {
  send("track", "PageView");
}

// Advanced Matching — call when phone is available to improve event match quality
// Also enriches external_id so Meta can link this session to future visits
export function pixelSetUserPhone(phone: string, email?: string) {
  if (!PIXEL_ID || typeof window === "undefined" || !window.fbq) return;
  const normalized = phone.startsWith("0") ? `213${phone.slice(1)}` : phone;
  const externalId = getOrCreateExternalId();
  const userData: Record<string, string> = {
    ph: normalized,
    country: "dz",
    ...(externalId ? { external_id: externalId } : {}),
    ...(email?.trim() ? { em: email.trim().toLowerCase() } : {}),
  };
  window.fbq("init", PIXEL_ID, userData);
}

export function pixelViewContent(payload: {
  productId: string;
  productName: string;
  value: number;
  currency?: string;
}) {
  send("track", "ViewContent", {
    content_ids: [payload.productId],
    content_name: payload.productName,
    content_type: "product",
    value: payload.value,
    currency: payload.currency ?? "DZD",
  });
}

export function pixelAddToCart(payload: {
  productId: string;
  productName: string;
  value: number;
  currency?: string;
}) {
  send("track", "AddToCart", {
    content_ids: [payload.productId],
    content_name: payload.productName,
    content_type: "product",
    value: payload.value,
    currency: payload.currency ?? "DZD",
  });
}

export function pixelInitiateCheckout(payload: {
  value: number;
  numItems: number;
  currency?: string;
}) {
  send("track", "InitiateCheckout", {
    value: payload.value,
    num_items: payload.numItems,
    currency: payload.currency ?? "DZD",
  });
}

/**
 * @param eventID - Must match the capiEventId sent to the backend
 *   so Meta can deduplicate this browser event against the server-side CAPI event.
 */
export function pixelLead(eventID?: string) {
  send("track", "Lead", {}, eventID ? { eventID } : undefined);
}

/**
 * @param payload.eventID - Must match the capiEventId sent to the backend
 *   so Meta can deduplicate this browser event against the server-side CAPI Purchase event.
 */
export function pixelPurchase(payload: {
  orderId: string;
  value: number;
  currency?: string;
  eventID?: string;
}) {
  send(
    "track",
    "Purchase",
    {
      content_ids: [payload.orderId],
      value: payload.value,
      currency: payload.currency ?? "DZD",
    },
    payload.eventID ? { eventID: `${payload.eventID}_purchase` } : undefined,
  );
}
