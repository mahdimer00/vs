import { STORAGE_KEYS } from "@/constants/storage";

function createVisitorId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `affv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateAffiliateVisitorId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  const existing = window.localStorage.getItem(STORAGE_KEYS.affiliateVisitorId);
  if (existing) {
    return existing;
  }

  const visitorId = createVisitorId();
  window.localStorage.setItem(STORAGE_KEYS.affiliateVisitorId, visitorId);
  return visitorId;
}
