/**
 * GeoGate — blocks non-Algeria visitors from seeing the site.
 * Admin routes (/gestion, /affiliate) are exempt so admin can work from anywhere.
 * Shows a clean "service not available in your region" page.
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiRequest } from "@/services/apiClient";

const EXEMPT_PATHS = ["/gestion", "/affiliate"];
const CHECK_KEY = "vs_geo_ok";
const CHECK_TTL = 30 * 60 * 1000; // recheck every 30 min

export function GeoGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<"loading" | "allowed" | "blocked">("loading");

  // Skip geo check for admin/affiliate paths
  const isExempt = EXEMPT_PATHS.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (isExempt) { setStatus("allowed"); return; }

    // Check cache first
    try {
      const cached = JSON.parse(sessionStorage.getItem(CHECK_KEY) ?? "null") as { allowed: boolean; ts: number } | null;
      if (cached && Date.now() - cached.ts < CHECK_TTL) {
        setStatus(cached.allowed ? "allowed" : "blocked");
        return;
      }
    } catch { /* ignore */ }

    // Fetch from backend
    apiRequest<{ allowed: boolean; country: string }>("/api/geo/check")
      .then((res) => {
        const allowed = res.allowed;
        sessionStorage.setItem(CHECK_KEY, JSON.stringify({ allowed, ts: Date.now() }));
        setStatus(allowed ? "allowed" : "blocked");
      })
      .catch(() => {
        // If check fails (network error) → allow (don't block real Algerian customers)
        setStatus("allowed");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (status === "blocked") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4" dir="rtl">
        <div className="max-w-md text-center space-y-6">
          {/* Logo */}
          <div className="inline-block rounded-2xl bg-slate-900 px-6 py-3 text-2xl font-bold text-teal-400">
            VisaDZ
          </div>

          {/* Icon */}
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-slate-800 text-4xl">
            🇩🇿
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-white">
              هذا المتجر متاح فقط داخل الجزائر
            </h1>
            <p className="text-slate-400 leading-relaxed">
              متجر VisaDZ يخدم العملاء الجزائريين حصراً.
              الدفع عند الاستلام — التوصيل لجميع الولايات الـ 58.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-4 text-sm text-slate-500 space-y-1">
            <div>This store is only available in Algeria.</div>
            <div>Ce magasin est disponible uniquement en Algérie.</div>
          </div>

          <p className="text-xs text-slate-600">
            If you are in Algeria and see this message, please disable your VPN.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
