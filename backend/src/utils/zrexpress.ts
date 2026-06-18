import crypto from "crypto";
import { env } from "../config/env.js";

const ZR_BASE = "https://api.zrexpress.app/api/v1";

interface ZRRate {
  toTerritoryId: string;
  toTerritoryName: string;
  toTerritoryNameArabic: string;
  toTerritoryLevel: string;
  deliveryPrices: { deliveryType: string; price: number }[];
}

interface ZRTerritorySearchItem {
  id: string;
  code?: number;
  name: string;
  nameArabic?: string;
  level: string;
  parentId?: string | null;
  delivery?: {
    canSend?: boolean;
    hasHomeDelivery?: boolean;
    hasPickupPoint?: boolean;
  };
}

interface ZRTerritorySearchResponse {
  items?: ZRTerritorySearchItem[];
  pageNumber?: number;
  pageSize?: number;
  totalPages?: number;
  hasNext?: boolean;
}

export interface ZRTerritory {
  id: string;
  wilayaId: string;
  name: string;
  nameAr: string;
  wilayaCode: string;
  wilayaName: string;
  wilayaNameAr: string;
  homePrice: number;
  pickupPrice: number;
  hasPricing: boolean;
}

interface ZRParcelResponse {
  id: string;
  trackingNumber?: string;
  state?: { name?: string; nameArabic?: string };
  deliveryType?: string;
  amount?: number;
  createdAt?: string;
  deliveredAt?: string;
}

let territoriesMap: Map<string, ZRTerritory> | null = null;
let ratesCache: ZRTerritory[] | null = null;
let ratesCacheTime = 0;
const RATES_CACHE_TTL_MS = 30 * 60 * 1000;
let territorySearchCache: ZRTerritorySearchItem[] | null = null;

// phone (international) → ZR customer UUID
const customerIdCache = new Map<string, string>();

function zrHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Tenant": env.ZR_EXPRESS_TENANT_ID ?? "",
    "X-Api-Key": env.ZR_EXPRESS_SECRET_KEY ?? "",
  };
}

export function isZRConfigured(): boolean {
  return Boolean(env.ZR_EXPRESS_TENANT_ID && env.ZR_EXPRESS_SECRET_KEY);
}

function normalizeTerritory(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[-_\s]+/g, " ");
}

// Stable UUID from a seed — used for productId (ZR validates format, not existence)
function deterministicUUID(seed: string): string {
  const h = crypto.createHash("sha256").update(seed).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function toInternationalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("213")) return `+${digits}`;
  if (digits.startsWith("0")) return `+213${digits.slice(1)}`;
  return `+${digits}`;
}

async function fetchRates(): Promise<ZRRate[]> {
  const res = await fetch(`${ZR_BASE}/delivery-pricing/rates`, { headers: zrHeaders() });
  if (!res.ok) throw new Error(`ZR rates fetch failed: ${res.status}`);
  const json = (await res.json()) as { rates?: ZRRate[] } | ZRRate[];
  return Array.isArray(json) ? json : (json.rates ?? []);
}

async function fetchTerritories(): Promise<ZRTerritorySearchItem[]> {
  if (territorySearchCache) return territorySearchCache;

  const items: ZRTerritorySearchItem[] = [];
  let pageNumber = 1;
  let hasNext = true;

  while (hasNext) {
    const res = await fetch(`${ZR_BASE}/territories/search`, {
      method: "POST",
      headers: zrHeaders(),
      body: JSON.stringify({ pageNumber, pageSize: 1000, includeUnavailable: true }),
    });
    if (!res.ok) throw new Error(`ZR territories fetch failed: ${res.status}`);
    const json = (await res.json()) as ZRTerritorySearchResponse;
    items.push(...(json.items ?? []));
    hasNext = Boolean(json.hasNext);
    pageNumber += 1;
  }

  territorySearchCache = items;
  return items;
}

async function loadTerritories(): Promise<Map<string, ZRTerritory>> {
  if (territoriesMap) return territoriesMap;

  const territories = await getZRTerritories();
  const map = new Map<string, ZRTerritory>();

  for (const territory of territories) {
    map.set(normalizeTerritory(territory.name), territory);
    if (territory.nameAr) {
      map.set(normalizeTerritory(territory.nameAr), territory);
    }
  }

  territoriesMap = map;
  return map;
}

export async function getZRTerritories(): Promise<ZRTerritory[]> {
  if (ratesCache && Date.now() - ratesCacheTime < RATES_CACHE_TTL_MS) return ratesCache;
  if (!isZRConfigured()) return [];

  const [rates, territories] = await Promise.all([fetchRates(), fetchTerritories()]);
  const rateByTerritoryId = new Map(
    rates
      .filter((rate) => rate.toTerritoryLevel === "commune" && rate.toTerritoryId)
      .map((rate) => [
        rate.toTerritoryId,
        {
          homePrice: rate.deliveryPrices.find((price) => price.deliveryType === "home")?.price ?? 0,
          pickupPrice: rate.deliveryPrices.find((price) => price.deliveryType === "pickup-point")?.price ?? 0,
        },
      ]),
  );
  const wilayasById = new Map(
    territories
      .filter((item) => item.level === "wilaya")
      .map((item) => [item.id, item]),
  );

  ratesCacheTime = Date.now();
  ratesCache = territories
    .filter((item) => item.level === "commune" && item.delivery?.canSend)
    .map((item) => {
      const rate = rateByTerritoryId.get(item.id);
      const wilaya = item.parentId ? wilayasById.get(item.parentId) : undefined;
      const homePrice = rate?.homePrice ?? 0;
      const pickupPrice = rate?.pickupPrice ?? 0;

      return {
        id: item.id,
        wilayaId: item.parentId ?? "",
        name: item.name,
        nameAr: item.nameArabic ?? "",
        wilayaCode: wilaya?.code ? String(wilaya.code).padStart(2, "0") : "",
        wilayaName: wilaya?.name ?? "",
        wilayaNameAr: wilaya?.nameArabic ?? "",
        homePrice,
        pickupPrice,
        hasPricing: homePrice > 0 || pickupPrice > 0,
      };
    })
    .sort((a, b) => {
      const wilayaCompare = a.wilayaCode.localeCompare(b.wilayaCode);
      return wilayaCompare !== 0 ? wilayaCompare : a.name.localeCompare(b.name);
    });

  return ratesCache;
}

async function lookupTerritory(commune: string): Promise<ZRTerritory | null> {
  try {
    const map = await loadTerritories();
    const normalized = normalizeTerritory(commune);

    if (map.has(normalized)) return map.get(normalized) ?? null;

    for (const [key, territory] of map) {
      if (key.includes(normalized) || normalized.includes(key)) return territory;
    }
    return null;
  } catch {
    return null;
  }
}

async function lookupTerritoryById(communeId: string): Promise<ZRTerritory | null> {
  try {
    const territories = await getZRTerritories();
    return territories.find((t) => t.id === communeId) ?? null;
  } catch {
    return null;
  }
}

// ZR customer API: POST /customers/individual with { name, phone: { number1 } }
// Returns a customer UUID that must go inside customer.customerId in the parcel body.
async function getOrCreateZRCustomer(fullName: string, intlPhone: string): Promise<string> {
  if (customerIdCache.has(intlPhone)) return customerIdCache.get(intlPhone)!;

  const res = await fetch(`${ZR_BASE}/customers/individual`, {
    method: "POST",
    headers: zrHeaders(),
    body: JSON.stringify({ name: fullName, phone: { number1: intlPhone } }),
  });

  if (res.ok) {
    const data = (await res.json()) as { id: string };
    customerIdCache.set(intlPhone, data.id);
    return data.id;
  }

  // 409 Conflict = customer already exists — try to extract ID from error body
  if (res.status === 409) {
    const err = (await res.json()) as { id?: string; customerId?: string };
    const id = err.id ?? err.customerId;
    if (id) {
      customerIdCache.set(intlPhone, id);
      return id;
    }
  }

  const errText = await res.text().catch(() => String(res.status));
  throw new Error(`ZR customer creation failed ${res.status}: ${errText}`);
}

export async function createZRParcel(order: {
  orderNumber: string;
  total: number;
  deliveryType: "HOME_DELIVERY" | "DESK_PICKUP";
  zrTerritoryId?: string | null;
  zrWilayaId?: string | null;
  customer: {
    fullName: string;
    phone: string;
    phone2?: string | null;
    commune: string;
    address: string;
  };
  items: { productName: { en: string; ar?: string }; variantLabel?: string; quantity: number; unitPrice: number }[];
}): Promise<{ parcelId: string; trackingNumber: string }> {
  if (!isZRConfigured()) throw new Error("ZR Express credentials not configured");

  // Resolve commune + wilaya territory IDs
  let communeId = order.zrTerritoryId ?? null;
  let wilayaId = order.zrWilayaId ?? null;

  if (!wilayaId) {
    // Look up the wilaya from the commune UUID or commune name
    const territory = communeId
      ? await lookupTerritoryById(communeId)
      : await lookupTerritory(order.customer.commune);
    if (!territory) throw new Error(`ZR territory not found for commune: ${order.customer.commune}`);
    communeId = communeId ?? territory.id;
    wilayaId = territory.wilayaId;
  }

  if (!communeId || !wilayaId) {
    throw new Error(`ZR territory IDs incomplete for commune: ${order.customer.commune}`);
  }

  const intlPhone = toInternationalPhone(order.customer.phone);
  const customerId = await getOrCreateZRCustomer(order.customer.fullName, intlPhone);

  const orderedProducts = order.items.map((item) => {
    const sku = item.variantLabel ?? item.productName.en;
    return {
      productId: deterministicUUID(`zr-product:${sku}`),
      productName: item.productName.en,
      productSku: sku,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      weight: 0.5,
      stockType: "local",
    };
  });

  const productsDesc = order.items.map((item) => `${item.productName.en} x ${item.quantity}`).join(", ");
  const description = `${productsDesc} | قابل للكسر`;

  const phone2 = order.customer.phone2 ? toInternationalPhone(order.customer.phone2) : undefined;

  const body: Record<string, unknown> = {
    externalId: order.orderNumber,
    amount: order.total,
    deliveryType: order.deliveryType === "HOME_DELIVERY" ? "home" : "pickup-point",
    description,
    customer: {
      customerId,                                          // must be INSIDE customer object
      name: order.customer.fullName,
      phone: phone2 ? { number1: intlPhone, number2: phone2 } : { number1: intlPhone },
    },
    deliveryAddress: {
      street: order.customer.address || order.customer.commune,
      cityTerritoryId: wilayaId,                          // wilaya
      districtTerritoryId: communeId,                     // commune
    },
    weight: { weight: 0.5 },
    orderedProducts,
  };

  const createRes = await fetch(`${ZR_BASE}/parcels`, {
    method: "POST",
    headers: zrHeaders(),
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`ZR Express parcel creation failed ${createRes.status}: ${err}`);
  }

  const created = (await createRes.json()) as { id: string };
  const parcelId = created.id;

  const getRes = await fetch(`${ZR_BASE}/parcels/${parcelId}`, { headers: zrHeaders() });
  if (!getRes.ok) throw new Error(`ZR Express parcel fetch failed: ${getRes.status}`);

  const parcel = (await getRes.json()) as ZRParcelResponse;
  const trackingNumber = parcel.trackingNumber ?? parcelId;

  return { parcelId, trackingNumber };
}

export async function getZRParcel(parcelId: string): Promise<ZRParcelResponse | null> {
  if (!isZRConfigured()) return null;
  try {
    const res = await fetch(`${ZR_BASE}/parcels/${parcelId}`, { headers: zrHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as ZRParcelResponse;
  } catch {
    return null;
  }
}

export async function cancelZRParcel(parcelId: string): Promise<void> {
  if (!isZRConfigured()) return;
  try {
    await fetch(`${ZR_BASE}/parcels/${parcelId}`, { method: "DELETE", headers: zrHeaders() });
  } catch {
    // best-effort
  }
}

const ZR_WEBHOOK_EVENTS = ["parcel.state.updated", "parcel.state.situation.created", "parcel.isReturn.updated"];

export async function registerZRWebhook(url: string): Promise<{ id: string; url: string }> {
  if (!isZRConfigured()) throw new Error("ZR Express not configured");
  const res = await fetch(`${ZR_BASE}/webhooks/endpoints`, {
    method: "POST",
    headers: zrHeaders(),
    body: JSON.stringify({ url, filterTypes: ZR_WEBHOOK_EVENTS }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ZR webhook registration failed ${res.status}: ${err}`);
  }
  return (await res.json()) as { id: string; url: string };
}

export async function listZRWebhooks(): Promise<Array<{ id: string; url: string }>> {
  if (!isZRConfigured()) return [];
  try {
    const res = await fetch(`${ZR_BASE}/webhooks/endpoints`, { headers: zrHeaders() });
    if (!res.ok) return [];
    const data = (await res.json()) as
      | Array<{ id: string; url: string }>
      | { data?: Array<{ id: string; url: string }>; items?: Array<{ id: string; url: string }> };
    if (Array.isArray(data)) return data;
    return data.data ?? data.items ?? [];
  } catch {
    return [];
  }
}

export async function generateZRLabelPdf(trackingNumbers: string[]): Promise<Buffer> {
  if (!isZRConfigured()) throw new Error("ZR Express credentials not configured");

  // Try several ZR endpoint patterns — ZR may return PDF bytes or a JSON {url} redirect
  const endpoints = [
    { path: "/parcels/labels/individual/pdf", body: { trackingNumbers, format: "A6" } },
    { path: "/parcels/stickers/pdf", body: { trackingNumbers, format: "A6" } },
    { path: "/parcels/print", body: { trackingNumbers } },
  ];

  let lastErr = "";
  for (const ep of endpoints) {
    const res = await fetch(`${ZR_BASE}${ep.path}`, {
      method: "POST",
      headers: zrHeaders(),
      body: JSON.stringify(ep.body),
    });

    if (!res.ok) {
      lastErr = `${ep.path} → ${res.status}`;
      continue;
    }

    const contentType = res.headers.get("content-type") ?? "";

    // ZR may return JSON { url: "https://..." } instead of PDF bytes directly
    if (contentType.includes("application/json") || contentType.includes("text/")) {
      const json = (await res.json()) as { url?: string; pdfUrl?: string; downloadUrl?: string; link?: string };
      const pdfUrl = json.url ?? json.pdfUrl ?? json.downloadUrl ?? json.link;
      if (!pdfUrl) {
        lastErr = `${ep.path} → JSON with no URL: ${JSON.stringify(json)}`;
        continue;
      }
      const pdfRes = await fetch(pdfUrl);
      if (!pdfRes.ok) throw new Error(`ZR label URL fetch failed: ${pdfRes.status}`);
      return Buffer.from(await pdfRes.arrayBuffer());
    }

    // Direct binary PDF
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 4) {
      lastErr = `${ep.path} → empty response (${buf.length} bytes)`;
      continue;
    }
    return buf;
  }

  throw new Error(`ZR Express label generation failed: ${lastErr}`);
}

export async function getZRParcelHistory(parcelId: string): Promise<Array<{ state: string; stateAr: string; date: string }>> {
  if (!isZRConfigured()) return [];
  try {
    const res = await fetch(`${ZR_BASE}/parcels/${parcelId}/history`, { headers: zrHeaders() });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{ state?: { name?: string; nameArabic?: string }; createdAt?: string; date?: string }>;
    return data.map((entry) => ({
      state: entry.state?.name ?? "",
      stateAr: entry.state?.nameArabic ?? "",
      date: entry.createdAt ?? entry.date ?? "",
    }));
  } catch {
    return [];
  }
}

export async function generateZRBulkLabelPdf(trackingNumbers: string[]): Promise<Buffer> {
  if (!isZRConfigured()) throw new Error("ZR Express credentials not configured");
  const res = await fetch(`${ZR_BASE}/parcels/labels/bulk`, {
    method: "POST",
    headers: zrHeaders(),
    body: JSON.stringify({ trackingNumbers, format: "A6" }),
  });
  if (!res.ok) throw new Error(`ZR Express bulk label generation failed: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function resetTerritoriesCache(): void {
  territoriesMap = null;
  ratesCache = null;
  ratesCacheTime = 0;
  territorySearchCache = null;
}
