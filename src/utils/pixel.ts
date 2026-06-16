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

  // Mirror the official fbq stub snippet
  if (!window.fbq) {
    const fn = function (...args: unknown[]) {
      (fn as unknown as { queue: unknown[][] }).queue.push(args);
    } as unknown as ((...a: unknown[]) => void) & {
      loaded: boolean;
      version: string;
      queue: unknown[][];
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

  window.fbq("init", PIXEL_ID);
}

function send(event: string, name: string, params?: Record<string, unknown>) {
  if (!PIXEL_ID || typeof window === "undefined" || !window.fbq) return;
  if (params) {
    window.fbq(event, name, params);
  } else {
    window.fbq(event, name);
  }
}

export function pixelPageView() {
  send("track", "PageView");
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

export function pixelLead() {
  send("track", "Lead");
}

export function pixelPurchase(payload: {
  orderId: string;
  value: number;
  currency?: string;
}) {
  send("track", "Purchase", {
    content_ids: [payload.orderId],
    value: payload.value,
    currency: payload.currency ?? "DZD",
  });
}
