type TtqContents = Array<{ content_id: string; content_type: string; content_name: string }>;

declare global {
  interface Window {
    ttq?: {
      track: (event: string, data?: Record<string, unknown>) => void;
      identify: (data: Record<string, string>) => void;
      page: () => void;
    };
  }
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
    value,
    currency: "DZD",
  });
}

export function ttqAddToCart(productId: string, productName: string, value: number): void {
  ttq()?.track("AddToCart", {
    contents: [{ content_id: productId, content_type: "product", content_name: productName }],
    value,
    currency: "DZD",
  });
}

export function ttqAddToWishlist(productId: string, productName: string, value: number): void {
  ttq()?.track("AddToWishlist", {
    contents: [{ content_id: productId, content_type: "product", content_name: productName }],
    value,
    currency: "DZD",
  });
}

export function ttqSearch(query: string, contents: TtqContents = []): void {
  ttq()?.track("Search", {
    contents,
    search_string: query,
    value: 0,
    currency: "DZD",
  });
}

export function ttqInitiateCheckout(contents: TtqContents, value: number): void {
  ttq()?.track("InitiateCheckout", { contents, value, currency: "DZD" });
}

export function ttqAddPaymentInfo(contents: TtqContents, value: number): void {
  ttq()?.track("AddPaymentInfo", { contents, value, currency: "DZD" });
}

export function ttqPlaceAnOrder(contents: TtqContents, value: number): void {
  ttq()?.track("PlaceAnOrder", { contents, value, currency: "DZD" });
}

export function ttqPurchase(contents: TtqContents, value: number): void {
  ttq()?.track("Purchase", { contents, value, currency: "DZD" });
}

export function ttqCompleteRegistration(): void {
  ttq()?.track("CompleteRegistration", { value: 0, currency: "DZD" });
}
