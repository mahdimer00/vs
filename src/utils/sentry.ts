import * as Sentry from "@sentry/react";

const SENTRY_DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();

export function initSentry() {
  if (!SENTRY_DSN || typeof window === "undefined") return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE ?? "production",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Capture 5% of transactions for performance monitoring
    tracesSampleRate: 0.05,
    // No session replays unless there's an error
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Filter out noise
    ignoreErrors: [
      "ResizeObserver loop",
      "Non-Error promise rejection",
      "Failed to fetch",
      "NetworkError",
      "Load failed",
    ],
    beforeSend(event) {
      // Strip sensitive data
      if (event.request?.cookies) delete event.request.cookies;
      return event;
    },
  });
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(error);
  });
}

export function sentryCaptureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
  if (!SENTRY_DSN) return;
  Sentry.captureMessage(message, level);
}

export function sentrySetUser(phone: string): void {
  if (!SENTRY_DSN) return;
  Sentry.setUser({ id: phone });
}

export function sentryAddBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  if (!SENTRY_DSN) return;
  Sentry.addBreadcrumb({ category, message, data, level: "info" });
}

// Re-export Sentry ErrorBoundary for use in main.tsx
export { Sentry };
