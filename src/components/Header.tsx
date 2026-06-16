import { Heart, Home, LayoutDashboard, LayoutGrid, LogOut, Mail, Menu, PackageSearch, ShoppingBag, Truck, User, Wallet, X } from "lucide-react";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  // Close mobile nav on route change
  useEffect(() => { setMobileNavOpen(false); }, []);

  const handleLogout = () => {
    if (adminSession) setAdminSession(null);
    else setAffiliateSession(null);
    setMenuOpen(false);
    navigate("/");
  };

  const links = [
    { to: "/", label: translate(language, "home"), icon: Home },
    { to: "/products", label: translate(language, "products"), icon: PackageSearch },
    { to: "/categories", label: translate(language, "categories"), icon: LayoutGrid },
    { to: "/earn-money", label: translate(language, "earnMoneyNav"), icon: Wallet, accent: true },
    { to: "/track-order", label: translate(language, "trackOrder"), icon: Truck },
    { to: "/contact", label: translate(language, "contact"), icon: Mail },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/85 shadow-sm backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3 sm:h-18">

            {/* Logo */}
            <Link to="/" className="flex shrink-0 items-center gap-2.5">
              {siteSettings?.logo ? (
                <img src={siteSettings.logo} alt={storeName} className="h-10 w-10 rounded-[1.1rem] object-cover shadow-md shadow-amber-300/30" />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-[1.1rem] bg-gradient-to-br from-amber-300 via-orange-400 to-teal-500 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-300/30">
                  VS
                </div>
              )}
              <div className="font-serif text-lg font-bold tracking-wide text-slate-950 sm:text-xl">{storeName}</div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-1 md:flex">
              {links.map((link) =>
                link.accent ? (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      `inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-md shadow-amber-300/35 transition hover:shadow-lg ${isActive ? "ring-2 ring-slate-950/20" : ""}`
                    }
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </NavLink>
                ) : (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === "/"}
                    className={({ isActive }) =>
                      `inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${isActive ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`
                    }
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </NavLink>
                ),
              )}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <LanguageSwitcher value={language} onChange={setLanguage} />

              <Link to="/wishlist" aria-label="Wishlist" className="relative rounded-full border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-slate-300 sm:p-3">
                <Heart className="h-5 w-5 text-slate-700" />
                {wishlist.length > 0 ? (
                  <span className="absolute -end-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1.5 text-center text-xs font-bold text-white">
                    {wishlist.length}
                  </span>
                ) : null}
              </Link>

              <Link to="/cart" aria-label="Cart" className="relative rounded-full border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-slate-300 sm:p-3">
                <ShoppingBag className="h-5 w-5 text-slate-700" />
                <span className="absolute -end-1 -top-1 min-w-5 rounded-full bg-amber-400 px-1.5 text-center text-xs font-bold text-slate-950">
                  {count}
                </span>
              </Link>

              {session ? (
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 pe-3 shadow-sm transition hover:border-slate-300"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-teal-500 text-xs font-bold text-slate-950 sm:h-8 sm:w-8 sm:text-sm">
                      {session.user.name?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                    </span>
                    <span className="hidden max-w-[8rem] truncate text-sm font-semibold text-slate-800 lg:inline">
                      {session.user.name || session.user.email}
                    </span>
                  </button>
                  {menuOpen ? (
                    <div className="absolute end-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
                      <div className="border-b border-slate-100 px-4 py-3">
                        <div className="truncate text-sm font-semibold text-slate-900">{session.user.name || session.user.email}</div>
                        <div className="truncate text-xs text-slate-500">{session.user.email}</div>
                      </div>
                      <Link to={dashboardPath} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                        <LayoutDashboard className="h-4 w-4" />
                        {translate(language, "dashboard")}
                      </Link>
                      <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50">
                        <LogOut className="h-4 w-4" />
                        {translate(language, "logout")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Mobile hamburger */}
              <button
                type="button"
                onClick={() => setMobileNavOpen((v) => !v)}
                aria-label="Toggle menu"
                className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 md:hidden"
              >
                {mobileNavOpen ? <X className="h-5 w-5 text-slate-700" /> : <Menu className="h-5 w-5 text-slate-700" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile slide-down nav */}
      {mobileNavOpen ? (
        <div className="sticky top-16 z-30 border-b border-slate-200/70 bg-white/95 shadow-lg backdrop-blur-xl md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col divide-y divide-slate-100 px-4 py-2 sm:px-6">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 py-3.5 text-sm font-medium transition ${
                    link.accent
                      ? "font-bold text-amber-600"
                      : isActive
                        ? "text-slate-950"
                        : "text-slate-600"
                  }`
                }
              >
                <span className={`grid h-9 w-9 place-items-center rounded-2xl ${link.accent ? "bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950" : "bg-slate-100 text-slate-600"}`}>
                  <link.icon className="h-4 w-4" />
                </span>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      ) : null}
    </>
  );
}
