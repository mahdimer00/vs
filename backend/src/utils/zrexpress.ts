import { env } from "../config/env.js";

const ZR_BASE = "https://api.zrexpress.app/api/v1";

interface ZRRate {
  toTerritoryId: string;
  toTerritoryName: string;
  toTerritoryNameArabic: string;
  toTerritoryLevel: string;
  deliveryPrices: { deliveryType: string; price: number }[];
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

// commune name → ZR territory UUID (populated on first use)
let territoriesMap: Map<string, string> | null = null;

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

async function loadTerritories(): Promise<Map<string, string>> {
  if (territoriesMap) return territoriesMap;

  const res = await fetch(`${ZR_BASE}/delivery-pricing/rates`, { headers: zrHeaders() });
  if (!res.ok) throw new Error(`ZR territories fetch failed: ${res.status}`);

  const json = await res.json() as { rates?: ZRRate[] } | ZRRate[];
  const rates: ZRRate[] = Array.isArray(json) ? json : (json.rates ?? []);
  const map = new Map<string, string>();

  for (const rate of rates) {
    if (rate.toTerritoryId) {
      map.set(normalizeTerritory(rate.toTerritoryName), rate.toTerritoryId);
      if (rate.toTerritoryNameArabic) {
        map.set(normalizeTerritory(rate.toTerritoryNameArabic), rate.toTerritoryId);
      }
    }
  }

  territoriesMap = map;
  return map;
}

async function lookupTerritoryId(commune: string): Promise<string | null> {
  try {
    const map = await loadTerritories();
    const normalized = normalizeTerritory(commune);

    if (map.has(normalized)) return map.get(normalized)!;

    // Partial match: find first territory that contains the commune name
    for (const [key, id] of map) {
      if (key.includes(normalized) || normalized.includes(key)) return id;
    }

    return null;
  } catch {
    return null;
  }
}

export async function createZRParcel(order: {
  orderNumber: string;
  total: number;
  deliveryType: "HOME_DELIVERY" | "DESK_PICKUP";
  customer: {
    fullName: string;
    phone: string;
    commune: string;
    address: string;
  };
  items: { productName: { en: string; ar?: string }; variantLabel?: string; quantity: number; unitPrice: number }[];
}): Promise<{ parcelId: string; trackingNumber: string }> {
  if (!isZRConfigured()) throw new Error("ZR Express credentials not configured");

  const territoryId = await lookupTerritoryId(order.customer.commune);
  const description = order.items.map((i) => `${i.productName.en} × ${i.quantity}`).join(", ");

  const body: Record<string, unknown> = {
    externalId: order.orderNumber,
    amount: order.total,
    deliveryType: order.deliveryType === "HOME_DELIVERY" ? "home" : "pickup-point",
    description,
    customer: {
      name: order.customer.fullName,
      phone: { number1: order.customer.phone },
    },
    deliveryAddress: {
      street: order.customer.address,
      ...(territoryId ? { cityTerritoryId: territoryId } : {}),
    },
    weight: { weight: 0.5 },
    orderedProducts: order.items.map((item) => ({
      productName: item.productName.en,
      productSku: item.variantLabel ?? "",
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      weight: 0.5,
    })),
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

  // Fetch parcel to get tracking number
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

export function resetTerritoriesCache(): void {
  territoriesMap = null;
}
