import { env } from "../config/env.js";

const ZR_BASE = "https://api.zrexpress.app/api/v1";
const ZR_TERRITORY_PAGE_SIZE = 200;

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

let territoriesMap: Map<string, string> | null = null;
let ratesCache: ZRTerritory[] | null = null;
let ratesCacheTime = 0;
const RATES_CACHE_TTL_MS = 30 * 60 * 1000;
let territorySearchCache: ZRTerritorySearchItem[] | null = null;

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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_\s]+/g, " ");
}

async function fetchRates(): Promise<ZRRate[]> {
  const res = await fetch(`${ZR_BASE}/delivery-pricing/rates`, { headers: zrHeaders() });
  if (!res.ok) throw new Error(`ZR rates fetch failed: ${res.status}`);
  const json = (await res.json()) as { rates?: ZRRate[] } | ZRRate[];
  return Array.isArray(json) ? json : (json.rates ?? []);
}

async function fetchTerritories(): Promise<ZRTerritorySearchItem[]> {
  if (territorySearchCache) {
    return territorySearchCache;
  }

  const items: ZRTerritorySearchItem[] = [];
  let pageNumber = 1;
  let hasNext = true;

  while (hasNext) {
    const res = await fetch(`${ZR_BASE}/territories/search`, {
      method: "POST",
      headers: zrHeaders(),
      body: JSON.stringify({
        pageNumber,
        pageSize: 1000,
        includeUnavailable: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`ZR territories fetch failed: ${res.status}`);
    }

    const json = (await res.json()) as ZRTerritorySearchResponse;
    items.push(...(json.items ?? []));

    hasNext = Boolean(json.hasNext);
    pageNumber += 1;
  }

  territorySearchCache = items;
  return items;
}

async function loadTerritories(): Promise<Map<string, string>> {
  if (territoriesMap) return territoriesMap;

  const territories = await getZRTerritories();
  const map = new Map<string, string>();

  for (const territory of territories) {
    map.set(normalizeTerritory(territory.name), territory.id);
    if (territory.nameAr) {
      map.set(normalizeTerritory(territory.nameAr), territory.id);
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

async function lookupTerritoryId(commune: string): Promise<string | null> {
  try {
    const map = await loadTerritories();
    const normalized = normalizeTerritory(commune);

    if (map.has(normalized)) {
      return map.get(normalized) ?? null;
    }

    for (const [key, id] of map) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return id;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// In-memory cache: phone → ZR customerId
const customerIdCache = new Map<string, string>();
// In-memory cache: sku → ZR productId
const productIdCache = new Map<string, string>();

function toInternationalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("213")) return `+${digits}`;
  if (digits.startsWith("0")) return `+213${digits.slice(1)}`;
  return `+${digits}`;
}

async function getOrCreateZRCustomer(fullName: string, phone: string): Promise<string> {
  const intlPhone = toInternationalPhone(phone);
  if (customerIdCache.has(intlPhone)) return customerIdCache.get(intlPhone)!;

  // Search existing
  const searchRes = await fetch(`${ZR_BASE}/customers?phoneNumber=${encodeURIComponent(intlPhone)}&pageSize=1`, { headers: zrHeaders() });
  if (searchRes.ok) {
    const data = (await searchRes.json()) as { data?: Array<{ id: string }>; items?: Array<{ id: string }> } | Array<{ id: string }>;
    const items = Array.isArray(data) ? data : (data.data ?? data.items ?? []);
    if (items.length > 0 && items[0].id) {
      customerIdCache.set(intlPhone, items[0].id);
      return items[0].id;
    }
  }

  // Create new
  const createRes = await fetch(`${ZR_BASE}/customers`, {
    method: "POST",
    headers: zrHeaders(),
    body: JSON.stringify({ name: fullName, phone: { number1: intlPhone } }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`ZR customer creation failed ${createRes.status}: ${err}`);
  }
  const created = (await createRes.json()) as { id: string };
  customerIdCache.set(intlPhone, created.id);
  return created.id;
}

async function getOrCreateZRProduct(name: string, sku: string, price: number): Promise<string> {
  const key = sku || name;
  if (productIdCache.has(key)) return productIdCache.get(key)!;

  // Search existing by sku
  if (sku) {
    const searchRes = await fetch(`${ZR_BASE}/products?sku=${encodeURIComponent(sku)}&pageSize=1`, { headers: zrHeaders() });
    if (searchRes.ok) {
      const data = (await searchRes.json()) as { data?: Array<{ id: string }>; items?: Array<{ id: string }> } | Array<{ id: string }>;
      const items = Array.isArray(data) ? data : (data.data ?? data.items ?? []);
      if (items.length > 0 && items[0].id) {
        productIdCache.set(key, items[0].id);
        return items[0].id;
      }
    }
  }

  // Create new
  const createRes = await fetch(`${ZR_BASE}/products`, {
    method: "POST",
    headers: zrHeaders(),
    body: JSON.stringify({ name, sku: sku || name, basePrice: price, localStock: 999 }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`ZR product creation failed ${createRes.status}: ${err}`);
  }
  const created = (await createRes.json()) as { id: string };
  productIdCache.set(key, created.id);
  return created.id;
}

export async function createZRParcel(order: {
  orderNumber: string;
  total: number;
  deliveryType: "HOME_DELIVERY" | "DESK_PICKUP";
  zrTerritoryId?: string | null;
  customer: {
    fullName: string;
    phone: string;
    commune: string;
    address: string;
  };
  items: { productName: { en: string; ar?: string }; variantLabel?: string; quantity: number; unitPrice: number }[];
}): Promise<{ parcelId: string; trackingNumber: string }> {
  if (!isZRConfigured()) throw new Error("ZR Express credentials not configured");

  const territoryId = order.zrTerritoryId ?? await lookupTerritoryId(order.customer.commune);
  if (!territoryId) {
    throw new Error(`ZR territory not found for commune: ${order.customer.commune}`);
  }

  // 1. Get/create customer in ZR
  const customerId = await getOrCreateZRCustomer(order.customer.fullName, order.customer.phone);

  // 2. Get/create products in ZR
  const orderedProducts = await Promise.all(
    order.items.map(async (item) => {
      const sku = item.variantLabel ?? item.productName.en;
      const productId = await getOrCreateZRProduct(item.productName.en, sku, item.unitPrice);
      return {
        productId,
        productName: item.productName.en,
        productSku: sku,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        weight: 0.5,
        stockType: "local",
      };
    }),
  );

  const description = order.items.map((item) => `${item.productName.en} x ${item.quantity}`).join(", ");

  const body: Record<string, unknown> = {
    externalId: order.orderNumber,
    amount: order.total,
    deliveryType: order.deliveryType === "HOME_DELIVERY" ? "home" : "pickup-point",
    description,
    customerId,
    customer: {
      name: order.customer.fullName,
      phone: { number1: toInternationalPhone(order.customer.phone) },
    },
    deliveryAddress: {
      street: order.customer.address || order.customer.commune,
      districtTerritoryId: territoryId,
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
    await fetch(`${ZR_BASE}/parcels/${parcelId}`, {
      method: "DELETE",
      headers: zrHeaders(),
    });
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

  const res = await fetch(`${ZR_BASE}/parcels/labels/individual/pdf`, {
    method: "POST",
    headers: zrHeaders(),
    body: JSON.stringify({ trackingNumbers, format: "A6" }),
  });

  if (!res.ok) throw new Error(`ZR Express label generation failed: ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
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
