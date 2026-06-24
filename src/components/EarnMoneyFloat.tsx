/**
 * Floating affiliate program teaser button.
 * Hidden on product detail and checkout pages (don't disturb buyers).
 * Dismissable per session.
 */
import { X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "@/hooks/useApp";

const DISMISSED_KEY = "vs_earn_dismissed";

// Pages where we should NOT show (user is in buying flow)
const HIDDEN_PATHS = ["/checkout", "/cart", "/order/"];

function DzdCoinIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-6 w-6 shrink-0" aria-hidden="true">
      {/* Coin circle */}
      <circle cx="16" cy="16" r="14" fill="#F59E0B" />
      <circle cx="16" cy="16" r="11" fill="#FCD34D" />
      {/* Inner ring detail */}
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="#D97706" strokeWidth="0.8" />
      {/* DZD text */}
      <text
        x="16" y="20"
        textAnchor="middle"
        fontSize="8"
        fontWeight="900"
        fontFamily="Arial, sans-serif"
        fill="#92400E"
      >
        دج
      </text>
    </svg>
  );
}

export function EarnMoneyFloat() {
  const { language } = useApp();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISSED_KEY) === "1"; } catch { return false; }
  });

  // Hide on buying-flow pages
  const hiddenOnPath = HIDDEN_PATHS.some((p) => location.pathname.startsWith(p));
  // Also hide on individual product pages (start with /products/ and have a slug)
  const isProductDetail = /^\/products\/[^/]+/.test(location.pathname);

  if (dismissed || hiddenOnPath || isProductDetail) return null;

  const dismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try { sessionStorage.setItem(DISMISSED_KEY, "1"); } catch { /* noop */ }
    setDismissed(true);
  };

  return (
    // Positioned at start (right side in RTL) to avoid conflict with WhatsApp (end/left)
    // Uses bottom-6 lg to stay above nothing on desktop
    // Uses bottom-24 on mobile to clear sticky bars
    <div className="fixed bottom-20 start-4 z-30 lg:bottom-[4.5rem]">
      <div className="flex items-center overflow-hidden rounded-2xl border border-amber-300 bg-white shadow-[0_4px_20px_rgba(251,191,36,0.3)]">
        <Link
          to="/earn-money"
          className="flex items-center gap-2 px-3 py-2.5 transition hover:bg-amber-50"
          aria-label={language === "ar" ? "اربح معنا" : "Earn with us"}
        >
          <DzdCoinIcon />
          <div className="hidden sm:block">
            <div className="text-[11px] font-extrabold text-amber-700 leading-tight">
              {language === "ar" ? "اربح دج" : language === "fr" ? "Gagnez DA" : "Earn DZD"}
            </div>
            <div className="text-[10px] text-amber-500 leading-tight">
              {language === "ar" ? "شارك واكسب" : "Share & earn"}
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="flex h-full items-center border-s border-amber-200 px-2 py-2.5 text-amber-400 hover:bg-amber-50 hover:text-amber-600 transition"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
