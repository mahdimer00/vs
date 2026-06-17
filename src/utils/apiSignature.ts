const API_SECRET = (import.meta.env.VITE_API_SECRET as string | undefined) ?? "";
let signingKeyPromise: Promise<CryptoKey> | null = null;

type SignatureInput = {
  method: string;
  path: string;
  body?: string | null;
};

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function getSigningKey() {
  if (!signingKeyPromise) {
    signingKeyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(API_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  }

  return signingKeyPromise;
}

function createNonce() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function getSignatureHeaders({ method, path, body }: SignatureInput): Promise<Record<string, string>> {
  const normalizedMethod = method.toUpperCase();
  if (!API_SECRET || normalizedMethod === "GET" || normalizedMethod === "HEAD" || normalizedMethod === "OPTIONS") {
    return {};
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = createNonce();
  const contentHash = await sha256Hex(body ?? "");
  const canonical = [timestamp, nonce, normalizedMethod, path, contentHash].join(".");
  const key = await getSigningKey();
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical));
  const signature = bytesToHex(new Uint8Array(signatureBuffer));

  return {
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Content-SHA256": contentHash,
    "X-Signature": signature,
  };
}
