type TtqContents = Array<{ content_id: string; content_type: string; content_name: string }>;

const TIKTOK_PIXEL_ID = "D8QQOSRC77U5MO7JA4T0";
let ttqInitialized = false;

declare global {
  interface Window {
    TiktokAnalyticsObject?: string;
    ttq?: {
      track: (event: string, data?: Record<string, unknown>) => void;
      identify: (data: Record<string, string>) => void;
      page: () => void;
      load: (id: string) => void;
      methods: string[];
      setAndDefer: (t: unknown, e: string) => void;
      instance: (t: string) => unknown;
      push: (...args: unknown[]) => void;
      _i: Record<string, unknown>;
      _t: Record<string, unknown>;
      _o: Record<string, unknown>;
    };
  }
}

export function initTikTokPixel(): void {
  if (ttqInitialized || typeof window === "undefined") return;
  ttqInitialized = true;

  window.TiktokAnalyticsObject = "ttq";
  const ttq = (window.ttq = window.ttq || ([] as unknown as typeof window.ttq)!);
  const methods = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"] as const;

  // Build the stub exactly as TikTok official snippet does
  const stub = ttq as unknown as Record<string, unknown> & { push: (...a: unknown[]) => void };
  stub.methods = [...methods];
  stub.setAndDefer = function(t: Record<string, unknown>, e: string) {
    t[e] = function(...args: unknown[]) { stub.push([e, ...args]); };
  };
  for (const m of methods) (stub.setAndDefer as (t: Record<string, unknown>, e: string) => void)(stub, m);
  stub.instance = function(t: string) {
    const arr = ((stub._i ?? {})[t] ?? []) as Record<string, unknown>;
    for (const m of methods) (stub.setAndDefer as (t: Record<string, unknown>, e: string) => void)(arr, m);
    return arr;
  };
  stub.load = function(id: string) {
    stub._i = stub._i ?? {};
    (stub._i as Record<string, unknown[]>)[id] = [];
    stub._t = stub._t ?? {};
    (stub._t as Record<string, number>)[id] = +new Date();
    stub._o = stub._o ?? {};
    (stub._o as Record<string, unknown>)[id] = {};
    const s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.src = `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${id}&lib=ttq`;
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(s, first);
  };

  window.ttq!.load(TIKTOK_PIXEL_ID);
  window.ttq!.page();
}

async function sha256(value: string): Promise<string> {
  if (!value) return "";
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeAlgerianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("213")) return `+${digits}`;
  if (digits.startsWith("0")) return `+213${digits.slice(1)}`;
  return `+213${digits}`;
}

function ttq() {
  return window.ttq;
}

function genEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function ttqIdentify(phone?: string): Promise<void> {
  const t = ttq();
  if (!t || !phone) return;
  const normalized = normalizeAlgerianPhone(phone);
  const hashed = await sha256(normalized);
  t.identify({ phone_number: hashed });
}

export function ttqViewContent(productId: string, productName: string, value: number): void {
  ttq()?.track("ViewContent", {
    contents: [{ content_id: productId, content_type: "product", content_name: productName }],
    value, currency: "DZD", event_id: genEventId(),
  });
}

export function ttqAddToCart(productId: string, productName: string, value: number): void {
  ttq()?.track("AddToCart", {
    contents: [{ content_id: productId, content_type: "product", content_name: productName }],
    value, currency: "DZD", event_id: genEventId(),
  });
}

export function ttqAddToWishlist(productId: string, productName: string, value: number): void {
  ttq()?.track("AddToWishlist", {
    contents: [{ content_id: productId, content_type: "product", content_name: productName }],
    value, currency: "DZD", event_id: genEventId(),
  });
}

export function ttqSearch(query: string, contents: TtqContents = []): void {
  ttq()?.track("Search", {
    contents, search_string: query, value: 0, currency: "DZD", event_id: genEventId(),
  });
}

export function ttqInitiateCheckout(contents: TtqContents, value: number): void {
  ttq()?.track("InitiateCheckout", { contents, value, currency: "DZD", event_id: genEventId() });
}

export function ttqAddPaymentInfo(contents: TtqContents, value: number): void {
  ttq()?.track("AddPaymentInfo", { contents, value, currency: "DZD", event_id: genEventId() });
}

export function ttqPlaceAnOrder(contents: TtqContents, value: number, eventId?: string): void {
  ttq()?.track("PlaceAnOrder", { contents, value, currency: "DZD", event_id: eventId ?? genEventId() });
}

export function ttqPurchase(contents: TtqContents, value: number, eventId?: string): void {
  ttq()?.track("Purchase", { contents, value, currency: "DZD", event_id: eventId ?? genEventId() });
}

export function ttqCompleteRegistration(): void {
  ttq()?.track("CompleteRegistration", { value: 0, currency: "DZD", event_id: genEventId() });
}

export function ttqPage(): void {
  ttq()?.page();
}
