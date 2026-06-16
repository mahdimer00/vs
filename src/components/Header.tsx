import { Heart, Home, LayoutDashboard, LayoutGrid, LogOut, Mail, Menu, PackageSearch, Search, ShoppingBag, Truck, User, Wallet, X } from "lucide-react";
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
      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-2 sm:h-16">

            {/* Logo */}
            <Link to="/" className="flex shrink-0 items-center gap-2">
              {siteSettings?.logo ? (
                <img src={siteSettings.logo} alt={storeName} className="h-9 w-9 rounded-[1rem] object-cover shadow-md shadow-amber-300/30 sm:h-10 sm:w-10" />
              ) : (
                <div className="grid h-9 w-9 place-items-center rounded-[1rem] bg-gradient-to-br from-amber-300 via-orange-400 to-teal-500 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-300/30 sm:h-10 sm:w-10">
                  VS
                </div>
              )}
              <div className="hidden font-serif text-lg font-bold tracking-wide text-slate-950 sm:block sm:text-xl">{storeName}</div>
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
            <div className="flex items-center gap-1.5 sm:gap-2">

              {/* Desktop: language + wishlist */}
              <div className="hidden md:flex md:items-center md:gap-2">
                <LanguageSwitcher value={language} onChange={setLanguage} />
                <Link to="/wishlist" aria-label="Wishlist" className="relative rounded-full border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-slate-300">
                  <Heart className="h-5 w-5 text-slate-700" />
                  {wishlist.length > 0 ? (
                    <span className="absolute -end-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1.5 text-center text-xs font-bold text-white">
                      {wishlist.length}
                    </span>
                  ) : null}
                </Link>
              </div>

              {/* Mobile: search icon */}
              <Link
                to="/products"
                aria-label="Search"
                className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 md:hidden"
              >
                <Search className="h-4 w-4 text-slate-700" />
              </Link>

              {/* Cart — always visible */}
              <Link to="/cart" aria-label="Cart" className="relative rounded-full border border-slate-200 bg-white p-2 shadow-sm transition hover:border-slate-300 sm:p-2.5">
                <ShoppingBag className="h-5 w-5 text-slate-700" />
                <span className="absolute -end-1 -top-1 min-w-5 rounded-full bg-amber-400 px-1.5 text-center text-xs font-bold text-slate-950">
                  {count}
                </span>
              </Link>

              {/* Desktop: session dropdown */}
              {session ? (
                <div className="relative hidden md:block" ref={menuRef}>
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
                className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 md:hidden"
              >
                {mobileNavOpen ? <X className="h-5 w-5 text-slate-700" /> : <Menu className="h-5 w-5 text-slate-700" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile full-height drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
          <div
            className="absolute inset-y-0 end-0 w-72 overflow-y-auto bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                {siteSettings?.logo ? (
                  <img src={siteSettings.logo} alt={storeName} className="h-8 w-8 rounded-xl object-cover" />
                ) : (
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-amber-300 via-orange-400 to-teal-500 text-xs font-extrabold text-slate-950">VS</div>
                )}
                <span className="font-serif font-bold text-slate-950">{storeName}</span>
              </div>
              <button type="button" onClick={() => setMobileNavOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100">
                <X className="h-4 w-4 text-slate-600" />
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex flex-col divide-y divide-slate-50 px-3 py-2">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 py-3.5 px-3 text-sm font-medium rounded-xl transition ${
                      link.accent
                        ? "font-bold text-amber-600"
                        : isActive
                          ? "bg-slate-950 text-white"
                          : "text-slate-700 hover:bg-slate-50"
                    }`
                  }
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${link.accent ? "bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950" : "bg-slate-100 text-slate-600"}`}>
                    <link.icon className="h-4 w-4" />
                  </span>
                  {link.label}
                </NavLink>
              ))}
            </nav>

            {/* Wishlist */}
            <div className="border-t border-slate-100 px-3 py-2">
              <Link
                to="/wishlist"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-500">
                  <Heart className="h-4 w-4" />
                  {wishlist.length > 0 ? (
                    <span className="absolute -end-1 -top-1 h-4 w-4 rounded-full bg-rose-500 text-center text-[10px] font-bold leading-4 text-white">{wishlist.length}</span>
                  ) : null}
                </span>
                {translate(language, "wishlistTitle")}
              </Link>
            </div>

            {/* Language switcher */}
            <div className="border-t border-slate-100 px-5 py-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{translate(language, "language")}</div>
              <LanguageSwitcher value={language} onChange={(lang) => { setLanguage(lang); setMobileNavOpen(false); }} />
            </div>

            {/* Session */}
            {session ? (
              <div className="border-t border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-teal-500 text-sm font-bold text-slate-950">
                    {session.user.name?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{session.user.name || session.user.email}</div>
                    <div className="truncate text-xs text-slate-500">{session.user.email}</div>
                  </div>
                </div>
                <Link
                  to={dashboardPath}
                  onClick={() => setMobileNavOpen(false)}
                  className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <LayoutDashboard className="h-4 w-4 text-teal-600" />
                  {translate(language, "dashboard")}
                </Link>
                <button
                  type="button"
                  onClick={() => { handleLogout(); setMobileNavOpen(false); }}
                  className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  {translate(language, "logout")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
