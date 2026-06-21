declare global {
  interface Window {
    clarity?: (action: string, ...args: unknown[]) => void;
  }
}

const CLARITY_ID = (import.meta.env.VITE_CLARITY_ID as string | undefined)?.trim() || "xaoo2w13pn";

export function initClarity(): void {
  if (!CLARITY_ID || typeof window === "undefined" || typeof document === "undefined") return;

  // Official Microsoft Clarity snippet
  (function (c: Window, l: Document, a: string, r: string, i: string) {
    const w = c as Window & { [key: string]: unknown };
    w[a] =
      w[a] ||
      function (...args: unknown[]) {
        (w[a] as { q?: unknown[][] }).q = (w[a] as { q?: unknown[][] }).q || [];
        ((w[a] as { q: unknown[][] }).q).push(args);
      };
    const t = l.createElement(r) as HTMLScriptElement;
    t.async = true;
    t.src = `https://www.clarity.ms/tag/${i}`;
    const y = l.getElementsByTagName(r)[0];
    if (y?.parentNode) y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", CLARITY_ID);
}

// Tag a user (e.g. affiliate, admin)
export function clarityTag(key: string, value: string): void {
  window.clarity?.("set", key, value);
}

// Send a named event to Clarity
export function clarityEvent(name: string): void {
  window.clarity?.("event", name);
}

// Upgrade session to be included in the recording sample
export function clarityUpgradePriority(reason: string): void {
  window.clarity?.("upgrade", reason);
}
