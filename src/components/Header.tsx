import { Heart, Home, LayoutDashboard, LayoutGrid, LogOut, Mail, PackageSearch, ShoppingBag, Truck, User, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";

export function Header() {
  const { cart, language, setLanguage, wishlist, siteSettings, adminSession, setAdminSession, affiliateSession, setAffiliateSession } = useApp();
  const navigate = useNavigate();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const storeName = siteSettings?.storeName || "VisaStore";
  const session = adminSession ?? affiliateSession;
  const dashboardPath = adminSession ? "/admin" : "/affiliate";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleLogout = () => {
    if (adminSession) {
      setAdminSession(null);
    } else {
      setAffiliateSession(null);
    }
    setMenuOpen(false);
    navigate("/");
  };
  const links = [
    { to: "/", label: translate(language, "home"), icon: Home },
    { to: "/products", label: translate(language, "products"), icon: PackageSearch },
    { to: "/categories", label: translate(language, "categories"), icon: LayoutGrid },
    { to: "/earn-money", label: translate(language, "earnMoneyNav"), icon: Wallet },
    { to: "/track-order", label: translate(language, "trackOrder"), icon: Truck },
    { to: "/contact", label: translate(language, "contact"), icon: Mail },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            {siteSettings?.logo ? (
              <img src={siteSettings.logo} alt={storeName} className="h-12 w-12 rounded-[1.25rem] object-cover shadow-lg shadow-amber-300/35" />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-[1.25rem] bg-gradient-to-br from-amber-300 via-orange-400 to-teal-500 text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-300/35">
                VS
              </div>
            )}
            <div className="font-serif text-xl font-semibold tracking-wide text-slate-950">{storeName}</div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {links.map((link) =>
              link.to === "/earn-money" ? (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-md shadow-amber-300/40 transition hover:shadow-lg ${
                      isActive ? "ring-2 ring-slate-950/20" : ""
                    }`
                  }
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </NavLink>
              ) : (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                    }`
                  }
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </NavLink>
              ),
            )}
          </nav>

          <div className="flex items-center gap-3">
            <LanguageSwitcher value={language} onChange={setLanguage} />
            <Link to="/wishlist" className="relative rounded-full border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300">
              <Heart className="h-5 w-5 text-slate-900" />
              {wishlist.length > 0 ? (
                <span className="absolute -end-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1.5 text-center text-xs font-bold text-white">
                  {wishlist.length}
                </span>
              ) : null}
            </Link>
            <Link to="/cart" className="relative rounded-full border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300">
              <ShoppingBag className="h-5 w-5 text-slate-900" />
              <span className="absolute -end-1 -top-1 min-w-5 rounded-full bg-amber-400 px-1.5 text-center text-xs font-bold text-slate-950">
                {count}
              </span>
            </Link>
            {session ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((value) => !value)}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 pe-3 shadow-sm transition hover:border-slate-300"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-teal-500 text-sm font-bold text-slate-950">
                    {session.user.name?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                  </span>
                  <span className="hidden max-w-[8rem] truncate text-sm font-semibold text-slate-800 sm:inline">
                    {session.user.name || session.user.email}
                  </span>
                </button>
                {menuOpen ? (
                  <div className="absolute end-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <div className="truncate text-sm font-semibold text-slate-900">{session.user.name || session.user.email}</div>
                      <div className="truncate text-xs text-slate-500">{session.user.email}</div>
                    </div>
                    <Link
                      to={dashboardPath}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      {translate(language, "dashboard")}
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" />
                      {translate(language, "logout")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
          {links.map((link) =>
            link.to === "/earn-money" ? (
              <NavLink
                key={link.to}
                to={link.to}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-md shadow-amber-300/40"
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </NavLink>
            ) : (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"
                  }`
                }
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </NavLink>
            ),
          )}
        </div>
      </div>
    </header>
  );
}
