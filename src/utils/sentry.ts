/**
 * Self-hosted error tracking — sends errors to our own backend.
 * Free, unlimited, no third-party account needed.
 * Microsoft Clarity handles session recording (also free).
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export function initSentry(): void {
  if (typeof window === "undefined") return;

  // Catch unhandled JS errors
  window.addEventListener("error", (event) => {
    void reportErrorToBackend({
      type: "uncaught",
      message: event.message,
      source: event.filename,
      line: event.lineno,
      stack: event.error?.stack,
    });
  });

  // Catch unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    void reportErrorToBackend({
      type: "unhandled_promise",
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}

async function reportErrorToBackend(data: {
  type: string;
  message: string;
  source?: string;
  line?: number;
  stack?: string;
  context?: Record<string, unknown>;
}): Promise<void> {
  if (!API_BASE) return;
  try {
    await fetch(`${API_BASE}/api/client-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    });
  } catch {
    // never throw from error reporter
  }
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  void reportErrorToBackend({ type: "captured", message, stack, context });
}

export function sentryCaptureMessage(message: string, _level?: string): void {
  void reportErrorToBackend({ type: "message", message });
}

export function sentrySetUser(phone: string): void {
  // Stored in memory for context enrichment only — not sent to any third party
  if (typeof window !== "undefined") {
    (window as Window & { __vsUser?: string }).__vsUser = phone;
  }
}

export function sentryAddBreadcrumb(_category: string, _message: string, _data?: Record<string, unknown>): void {
  // Breadcrumbs are tracked via Clarity events instead
}
