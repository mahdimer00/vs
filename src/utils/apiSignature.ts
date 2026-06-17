const API_SECRET = (import.meta.env.VITE_API_SECRET as string | undefined) ?? "";
let _signingKey: CryptoKey | null = null;

export async function getSignatureHeaders(): Promise<Record<string, string>> {
  if (!API_SECRET) return {};
  if (!_signingKey) {
    _signingKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(API_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sig = await crypto.subtle.sign("HMAC", _signingKey, new TextEncoder().encode(timestamp));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { "X-Timestamp": timestamp, "X-Signature": hex };
}
