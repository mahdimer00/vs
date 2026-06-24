/**
 * Small floating button that promotes the affiliate program.
 * Shows on all public pages, links to /earn-money.
 * Dismissed by clicking X (stored in sessionStorage).
 */
import { BadgePercent, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/hooks/useApp";

const DISMISSED_KEY = "vs_earn_dismissed";

export function EarnMoneyFloat() {
  const { language, siteSettings } = useApp();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISSED_KEY) === "1"; } catch { return false; }
  });

  // Only show when affiliate program feature is meaningful and there's a WhatsApp
  if (dismissed) return null;

  const dismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try { sessionStorage.setItem(DISMISSED_KEY, "1"); } catch { /* noop */ }
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-24 start-4 z-40 lg:bottom-6">
      <div className="group relative flex items-center gap-2 overflow-hidden rounded-full border border-amber-300/50 bg-gradient-to-r from-amber-400 to-orange-400 shadow-[0_8px_24px_rgba(251,191,36,0.4)]">
        <Link
          to="/earn-money"
          className="flex items-center gap-2 py-2.5 ps-4 pe-3 text-sm font-bold text-slate-950 transition"
          aria-label={language === "ar" ? "اربح معنا" : "Earn with us"}
        >
          <BadgePercent className="h-4 w-4 shrink-0" />
          <span className="hidden sm:block whitespace-nowrap">
            {language === "ar" ? "اربح معنا" : language === "fr" ? "Gagnez avec nous" : "Earn with us"}
          </span>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="flex h-full items-center pe-2.5 ps-1 text-slate-800/60 hover:text-slate-950"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
