import { Heart, Menu, ShoppingBag } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";

export function Header() {
  const { cart, language, setLanguage, wishlist, siteSettings } = useApp();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const storeName = siteSettings?.storeName || "VisaStore";
  const links = [
    { to: "/", label: translate(language, "home") },
    { to: "/products", label: translate(language, "products") },
    { to: "/categories", label: translate(language, "categories") },
    { to: "/earn-money", label: translate(language, "earnMoneyNav") },
    { to: "/track-order", label: translate(language, "trackOrder") },
    { to: "/contact", label: translate(language, "contact") },
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
            <div>
              <div className="font-serif text-xl font-semibold tracking-wide text-slate-950">{storeName}</div>
              <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Algerian tech commerce</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {links.map((link) =>
              link.to === "/earn-money" ? (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-md shadow-amber-300/40 transition hover:shadow-lg ${
                      isActive ? "ring-2 ring-slate-950/20" : ""
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ) : (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                    }`
                  }
                >
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
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1.5 text-center text-xs font-bold text-white">
                  {wishlist.length}
                </span>
              ) : null}
            </Link>
            <Link to="/cart" className="relative rounded-full border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300">
              <ShoppingBag className="h-5 w-5 text-slate-900" />
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-amber-400 px-1.5 text-center text-xs font-bold text-slate-950">
                {count}
              </span>
            </Link>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-500">
            <Menu className="h-4 w-4" />
          </span>
          {links.map((link) =>
            link.to === "/earn-money" ? (
              <NavLink
                key={link.to}
                to={link.to}
                className="shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-md shadow-amber-300/40"
              >
                {link.label}
              </NavLink>
            ) : (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ),
          )}
        </div>
      </div>
    </header>
  );
}
