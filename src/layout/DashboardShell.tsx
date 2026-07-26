import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Gift,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  Store,
  TicketPercent,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";

type LinkItem = { href: string; label: string; badge?: number };

const ICON_MAP: Record<string, React.ElementType> = {
  "/gestion": LayoutDashboard,
  "/gestion/products": Package,
  "/gestion/categories": Store,
  "/gestion/brands": Shield,
  "/gestion/orders": ShoppingCart,
  "/gestion/shipping": MapPinned,
  "/gestion/promo-codes": TicketPercent,
  "/gestion/affiliates": Users,
  "/gestion/commissions": TrendingUp,
  "/gestion/withdrawals": Wallet,
  "/gestion/coupon-requests": Gift,
  "/gestion/settings": Settings,
  "/gestion/admins": Shield,
  "/gestion/analytics": BarChart3,
  "/gestion/finance": Wallet,
  "/gestion/customers": Users,
  "/gestion/blacklist": Shield,
  "/affiliate": LayoutDashboard,
};

const NAV_GROUPS: { ar: string; fr: string; en: string; paths: string[] }[] = [
  { ar: "الرئيسية", fr: "Général", en: "General", paths: ["/gestion", "/affiliate"] },
  { ar: "المنتجات", fr: "Catalogue", en: "Catalog", paths: ["/gestion/products", "/gestion/categories", "/gestion/brands"] },
  { ar: "المبيعات", fr: "Ventes", en: "Sales", paths: ["/gestion/orders", "/gestion/promo-codes", "/gestion/coupon-requests"] },
  { ar: "الشركاء", fr: "Affiliés", en: "Affiliates", paths: ["/gestion/affiliates", "/gestion/commissions", "/gestion/withdrawals"] },
  { ar: "العمليات", fr: "Opérations", en: "Operations", paths: ["/gestion/shipping", "/gestion/finance", "/gestion/analytics", "/gestion/customers"] },
  { ar: "الإدارة", fr: "Administration", en: "Admin", paths: ["/gestion/admins", "/gestion/blacklist", "/gestion/settings"] },
];

function NavItem({ link, collapsed, onNav }: { link: LinkItem; collapsed: boolean; onNav?: () => void }) {
  const Icon = ICON_MAP[link.href] ?? LayoutDashboard;
  return (
    <NavLink
      to={link.href}
      end={link.href === "/gestion" || link.href === "/affiliate"}
      onClick={onNav}
      title={collapsed ? link.label : undefined}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[13px] font-medium transition-all duration-150${
          collapsed ? " justify-center" : ""
        }${isActive
          ? " bg-white/10 text-white"
          : " text-slate-400 hover:bg-white/6 hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all${
              isActive
                ? " bg-amber-400 text-slate-950 shadow-sm shadow-amber-500/25"
                : ""
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
          {!collapsed && <span className="truncate leading-none">{link.label}</span>}
          {!collapsed && !!link.badge && (
            <span className="ms-auto grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {link.badge > 99 ? "99+" : link.badge}
            </span>
          )}
          {collapsed && !!link.badge && (
            <span className="absolute end-1 top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-[1.5px] ring-[#0f172a]" />
          )}
        </>
      )}
    </NavLink>
  );
}

export function DashboardShell({
  title,
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const isRtl = language === "ar";

  const linkMap = Object.fromEntries(links.map((l) => [l.href, l]));
  const groups = NAV_GROUPS.map((g) => ({
    label: (g[language as "ar" | "fr" | "en"] ?? g.en) as string,
    items: g.paths.map((p) => linkMap[p]).filter((x): x is LinkItem => Boolean(x)),
  })).filter((g) => g.items.length > 0);

  const sidebarContent = (onNav?: () => void) => (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Brand */}
      <div className={`flex shrink-0 items-center border-b border-white/[0.06] ${collapsed ? "justify-center px-0 py-4" : "gap-3 px-5 py-4"}`}>
        {siteSettings?.logo ? (
          <img src={siteSettings.logo} alt={storeName} className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-white/20" />
        ) : (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-black text-slate-950">
            VS
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold tracking-tight text-white">{storeName}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              {language === "ar" ? "لوحة التحكم" : language === "fr" ? "Administration" : "Admin Panel"}
            </div>
          </div>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-4 scrollbar-none">
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              {!collapsed ? (
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                  {group.label}
                </div>
              ) : (
                <div className="mb-1.5 mx-2 h-px bg-white/[0.06]" />
              )}
              <div className="space-y-0.5">
                {group.items.map((link) => (
                  <NavItem key={link.href} link={link} collapsed={collapsed} onNav={onNav} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/[0.06] px-2.5 py-3 space-y-0.5">
        <Link
          to="/"
          onClick={onNav}
          title={collapsed ? (language === "ar" ? "المتجر" : "Store") : undefined}
          className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[13px] font-medium text-slate-400 hover:bg-white/6 hover:text-white transition-colors${collapsed ? " justify-center" : ""}`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <ExternalLink className="h-4 w-4" />
          </span>
          {!collapsed && <span>{translate(language, "viewSite")}</span>}
        </Link>
        <button
          type="button"
          onClick={() => { onLogout(); onNav?.(); }}
          title={collapsed ? (language === "ar" ? "خروج" : "Logout") : undefined}
          className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-[13px] font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors${collapsed ? " justify-center" : ""}`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <LogOut className="h-4 w-4" />
          </span>
          {!collapsed && <span>{translate(language, "logout")}</span>}
        </button>
        {/* User info */}
        <div className={`mt-1 flex items-center gap-3 rounded-xl bg-white/5 px-2.5 py-2.5${collapsed ? " justify-center" : ""}`}>
          <div
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-400 text-[13px] font-black text-slate-950"
            title={collapsed ? (session?.user.name ?? session?.user.email ?? "") : undefined}
          >
            {session?.user.name?.charAt(0)?.toUpperCase() ?? <User className="h-4 w-4" />}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold leading-tight text-white">{session?.user.name ?? session?.user.email}</div>
              <div className="truncate text-[10px] text-slate-500">{title}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-layout">
      {/* Desktop sidebar */}
      <aside className={`admin-sidebar${collapsed ? " admin-sidebar-collapsed" : ""}`}>
        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label="Toggle sidebar"
          className="admin-collapse-btn"
        >
          {collapsed !== isRtl
            ? <ChevronLeft className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        {sidebarContent()}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" />
          <aside
            className="absolute start-0 top-0 h-full w-[220px] border-e border-white/[0.06] bg-[#0f172a] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-end p-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-xl bg-white/8 text-white hover:bg-white/14 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {sidebarContent(() => setMobileOpen(false))}
          </aside>
        </div>
      )}

      {/* Main area */}
      <main className={`admin-main${collapsed ? " admin-main-collapsed" : ""}`}>
        {/* Mobile topbar */}
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm lg:hidden">
          <div className="flex items-center gap-3">
            {siteSettings?.logo ? (
              <img src={siteSettings.logo} alt={storeName} className="h-8 w-8 rounded-xl object-cover" />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-xs font-black text-slate-950">
                VS
              </div>
            )}
            <div>
              <div className="text-[11px] text-slate-400">{title}</div>
              <div className="text-sm font-semibold text-slate-900">{session?.user.name ?? session?.user.email}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-slate-50 transition-colors hover:bg-slate-100"
          >
            <Menu className="h-5 w-5 text-slate-700" />
          </button>
        </div>

        {children}
      </main>
    </div>
  );
}
