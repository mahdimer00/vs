import type { AuthSession } from "@/types";
import { getSignatureHeaders } from "@/utils/apiSignature";

const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const API_BASE_URL =
  rawApiBaseUrl && rawApiBaseUrl.length > 0
    ? rawApiBaseUrl.replace(/\/$/, "")
    : typeof window !== "undefined" && window.location.port !== "5173"
      ? window.location.origin
      : "http://localhost:4000";

type RequestOptions = RequestInit & {
  token?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = API_BASE_URL.startsWith("http")
    ? new URL(`${API_BASE_URL}${path}`)
    : new URL(`${API_BASE_URL}${path}`, window.location.origin);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const sigHeaders = await getSignatureHeaders();
  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...sigHeaders,
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null
        ? (payload as { message?: string; error?: string }).message ||
          (payload as { message?: string; error?: string }).error
        : undefined;
    throw new ApiError(message || "Request failed", response.status);
  }

  return payload as T;
}

export async function apiUpload<T>(path: string, file: File, token: string): Promise<T> {
  const url = API_BASE_URL.startsWith("http")
    ? new URL(`${API_BASE_URL}${path}`)
    : new URL(`${API_BASE_URL}${path}`, window.location.origin);

  const formData = new FormData();
  formData.append("file", file);

  const sigHeaders = await getSignatureHeaders();
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...sigHeaders },
    body: formData,
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null
        ? (payload as { message?: string; error?: string }).message ||
          (payload as { message?: string; error?: string }).error
        : undefined;
    throw new ApiError(message || "Upload failed", response.status);
  }

  return payload as T;
}

export function tokenFromSession(session: AuthSession | null): string | undefined {
  return session?.token;
}
