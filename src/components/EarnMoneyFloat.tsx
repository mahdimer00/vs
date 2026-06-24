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

function BanknoteIcon() {
  return (
    <img
      src="/dz2000.jpg"
      alt="2000 DA"
      className="h-8 w-14 shrink-0 rounded-md object-cover shadow-sm"
      style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.2))" }}
    />
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
      <div className="flex items-center overflow-hidden rounded-2xl border border-green-300/60 bg-white shadow-[0_4px_20px_rgba(34,197,94,0.2)]">
        <Link
          to="/earn-money"
          className="flex items-center gap-2 px-2.5 py-2 transition hover:bg-green-50"
          aria-label={language === "ar" ? "اربح معنا" : "Earn with us"}
        >
          <BanknoteIcon />
          <div className="hidden sm:block">
            <div className="text-[11px] font-extrabold text-green-800 leading-tight">
              {language === "ar" ? "اربح 2000 دج" : language === "fr" ? "Gagnez 2000 DA" : "Earn 2000 DZD"}
            </div>
            <div className="text-[10px] text-green-600 leading-tight">
              {language === "ar" ? "شارك واكسب الآن" : "Share & earn now"}
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="flex h-full items-center border-s border-green-200 px-2 py-2 text-green-400 hover:bg-green-50 hover:text-green-700 transition"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
