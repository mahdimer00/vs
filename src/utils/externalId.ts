/**
 * Generates and persists a unique external_id for Meta Advanced Matching.
 * Stored in localStorage so it's consistent across sessions for the same browser.
 * Meta uses this to match browser events → CAPI events → Facebook profiles.
 */
const KEY = "vs_eid";

export function getOrCreateExternalId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    return "";
  }
}

/** SHA-256 hash of the external_id for CAPI (server-side) */
export function getExternalIdForCapi(): string {
  return getOrCreateExternalId();
}
