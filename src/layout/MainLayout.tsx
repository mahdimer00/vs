import { CheckCircle2, CircleAlert } from "lucide-react";
import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BackToTopButton } from "@/components/BackToTopButton";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { LoadingState } from "@/components/LoadingState";
import { useApp } from "@/hooks/useApp";

export function MainLayout() {
  const { toasts, dismissToast } = useApp();
  const location = useLocation();
  const isDashboard = location.pathname.startsWith("/gestion") || location.pathname.startsWith("/affiliate");

  return (
    <div className="min-h-screen text-slate-900">
      {!isDashboard ? <Header /> : null}
      <main className="mx-auto min-h-[calc(100vh-160px)] max-w-7xl overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8">
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </main>
      {!isDashboard ? <Footer /> : null}
      {!isDashboard ? <BackToTopButton /> : null}
      <div className="fixed bottom-4 end-4 z-50 max-w-[calc(100vw-2rem)] space-y-3">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            onClick={() => dismissToast(toast.id)}
            className={`flex items-center gap-3 rounded-[1.5rem] px-4 py-3 text-sm font-medium text-white shadow-xl ${
              toast.tone === "error" ? "bg-rose-600" : "bg-slate-950"
            }`}
          >
            {toast.tone === "error" ? <CircleAlert className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>{toast.message}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
