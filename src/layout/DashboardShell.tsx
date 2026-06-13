import { ExternalLink, LogOut, User } from "lucide-react";
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
  links: Array<{ href: string; label: string }>;
  children: React.ReactNode;
  onLogout: () => void;
}) {
  const { language, adminSession, affiliateSession, siteSettings } = useApp();
  const session = adminSession ?? affiliateSession;
  const storeName = siteSettings?.storeName || "VisaStore";

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="surface-card-dark h-fit p-6 lg:sticky lg:top-6">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-wide text-white">
              {siteSettings?.logo ? (
                <img src={siteSettings.logo} alt={storeName} className="h-8 w-8 rounded-xl object-cover" />
              ) : (
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-amber-300 via-orange-400 to-teal-500 text-xs font-extrabold text-slate-950">
                  VS
                </div>
              )}
              {storeName}
            </Link>
            <Link to="/" className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10">
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
          {description ? <p className="mt-3 hidden text-sm leading-7 text-slate-300 lg:block">{description}</p> : null}

          <button
            onClick={onLogout}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10 lg:hidden"
          >
            <LogOut className="h-4 w-4" />
            {translate(language, "logout")}
          </button>
        </div>

        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-6 lg:flex-col lg:gap-2 lg:space-y-0 lg:overflow-visible lg:pb-0">
          {links.map((link) => (
            <NavLink
              key={link.href}
              to={link.href}
              end={link.href === "/admin" || link.href === "/affiliate"}
              className={({ isActive }) =>
                `block shrink-0 whitespace-nowrap rounded-[1.2rem] px-4 py-3 text-sm transition ${
                  isActive
                    ? "bg-white text-slate-950"
                    : "border border-white/10 text-slate-200 hover:bg-white/10 lg:border-0"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <button onClick={onLogout} className="mt-8 hidden w-full items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10 lg:inline-flex">
          <LogOut className="h-4 w-4" />
          {translate(language, "logout")}
        </button>
      </aside>
      <section className="min-w-0 space-y-6">{children}</section>
    </div>
  );
}
