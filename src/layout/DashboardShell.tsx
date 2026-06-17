import { BarChart3, ExternalLink, Gift, LayoutDashboard, LogOut, MapPinned, Menu, Package, Settings, Shield, ShoppingCart, Store, TicketPercent, User, Users, Wallet, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";

export function DashboardShell({
  title,
  description,
  links,
  children,
  onLogout,
}: {
  title: string;
  description?: string;
  links: Array<{ href: string; label: string; badge?: number }>;
  children: React.ReactNode;
  onLogout: () => void;
}) {
  const { language, adminSession, affiliateSession, siteSettings } = useApp();
  const session = adminSession ?? affiliateSession;
  const storeName = siteSettings?.storeName || "VisaStore";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const iconByPath: Record<string, typeof LayoutDashboard> = {
    "/gestion": LayoutDashboard,
    "/gestion/products": Package,
    "/gestion/categories": Store,
    "/gestion/brands": Shield,
    "/gestion/orders": ShoppingCart,
    "/gestion/shipping": MapPinned,
    "/gestion/promo-codes": TicketPercent,
    "/gestion/affiliates": Users,
    "/gestion/commissions": Wallet,
    "/gestion/withdrawals": Wallet,
    "/gestion/coupon-requests": Gift,
    "/gestion/settings": Settings,
    "/gestion/admins": Shield,
    "/gestion/analytics": BarChart3,
    "/affiliate": LayoutDashboard,
  };

  const SidebarContent = () => (
    <>
      <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-wide text-white" onClick={() => setSidebarOpen(false)}>
            {siteSettings?.logo ? (
              <img src={siteSettings.logo} alt={storeName} className="h-8 w-8 rounded-xl object-cover" />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-amber-300 via-orange-400 to-teal-500 text-xs font-extrabold text-slate-950">
                VS
              </div>
            )}
            {storeName}
          </Link>
          <Link
            to="/"
            onClick={() => setSidebarOpen(false)}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10"
          >
            {translate(language, "viewSite")}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-base font-bold text-amber-300">
            {session?.user.name?.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">{title}</div>
            <div className="truncate text-sm font-semibold text-white">{session?.user.name || session?.user.email}</div>
          </div>
        </div>
        {description ? <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p> : null}
      </div>

      <nav className="mt-5 flex flex-col gap-1.5">
        {links.map((link) => (
          (() => {
            const Icon = iconByPath[link.href] || LayoutDashboard;
            return (
              <NavLink
                key={link.href}
                to={link.href}
                end={link.href === "/gestion" || link.href === "/affiliate"}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between gap-2 rounded-[1.2rem] px-4 py-3 text-sm font-medium transition ${
                    isActive ? "bg-white text-slate-950" : "text-slate-200 hover:bg-white/10"
                  }`
                }
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{link.label}</span>
                </span>
                {link.badge ? (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">
                    {link.badge > 99 ? "99+" : link.badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })()
        ))}
      </nav>

      <button
        onClick={() => { onLogout(); setSidebarOpen(false); }}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
      >
        <LogOut className="h-4 w-4" />
        {translate(language, "logout")}
      </button>
    </>
  );

  return (
    <div className="dashboard-shell relative">
      {/* Mobile top bar */}
      <div className="mb-4 flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-slate-950 px-4 py-3 text-white lg:hidden">
        <div className="flex items-center gap-3">
          {siteSettings?.logo ? (
            <img src={siteSettings.logo} alt={storeName} className="h-8 w-8 rounded-xl object-cover" />
          ) : (
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-amber-300 via-orange-400 to-teal-500 text-xs font-extrabold text-slate-950">
              VS
            </div>
          )}
          <div>
            <div className="text-xs text-slate-400">{title}</div>
            <div className="text-sm font-semibold">{session?.user.name || session?.user.email}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="grid h-9 w-9 place-items-center rounded-full border border-white/10 transition hover:bg-white/10"
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
          <aside
            className="absolute start-0 top-0 h-full w-72 overflow-y-auto bg-slate-950 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </aside>
        </div>
      ) : null}

      {/* Desktop layout */}
      <div className="dashboard-main grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="dashboard-sidebar surface-card-dark hidden h-fit p-6 lg:block lg:sticky lg:top-6">
          <SidebarContent />
        </aside>
        <section className="dashboard-workspace min-w-0 space-y-6">{children}</section>
      </div>
    </div>
  );
}
