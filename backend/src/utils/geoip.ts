/**
 * GeoIP lookup using ip-api.com (free, no key needed, 45 req/min).
 * Used to enforce Algeria-only orders.
 */

interface IpApiResponse {
  status: "success" | "fail";
  country: string;
  countryCode: string;
  regionName: string;
  city: string;
  isp: string;
  org: string;
  as: string;
  proxy: boolean;
  hosting: boolean;
}

// Simple in-memory cache — avoids hitting ip-api on repeated requests from same IP
const cache = new Map<string, { result: IpApiResponse; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

function normalizeIp(ip: string): string {
  // Handle IPv6-mapped IPv4 (::ffff:1.2.3.4)
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  return ip;
}

function isLocalIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") ||
    ip.startsWith("172.") ||
    ip === "localhost"
  );
}

export async function lookupIp(rawIp: string): Promise<IpApiResponse | null> {
  const ip = normalizeIp(rawIp ?? "");
  if (!ip || isLocalIp(ip)) return null;

  const cached = cache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.result;

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,isp,proxy,hosting`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return null;
    const data = await res.json() as IpApiResponse;
    if (data.status !== "success") return null;
    cache.set(ip, { result: data, ts: Date.now() });
    return data;
  } catch {
    return null;
  }
}

/**
 * Returns true if the IP is allowed to place an order.
 * In production: only Algeria (DZ).
 * Local/dev IPs are always allowed.
 */
export async function isIpAllowed(rawIp: string): Promise<{ allowed: boolean; country: string; isProxy: boolean }> {
  const ip = normalizeIp(rawIp ?? "");

  // Always allow local/dev
  if (!ip || isLocalIp(ip)) {
    return { allowed: true, country: "DZ", isProxy: false };
  }

  const geo = await lookupIp(ip);
  if (!geo) {
    // If GeoIP lookup fails, allow the order (don't block on API failure)
    return { allowed: true, country: "UNKNOWN", isProxy: false };
  }

  const allowed = geo.countryCode === "DZ";
  return {
    allowed,
    country: geo.countryCode,
    isProxy: geo.proxy || geo.hosting,
  };
}
