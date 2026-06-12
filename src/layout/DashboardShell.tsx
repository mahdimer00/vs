import { LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";
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
  const { language } = useApp();

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="surface-card-dark h-fit p-6 lg:sticky lg:top-6">
        <div className="flex items-start justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">{language.toUpperCase()}</div>
            <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
            {description ? <p className="mt-2 hidden text-sm leading-7 text-slate-300 lg:block">{description}</p> : null}
          </div>
          <button
            onClick={onLogout}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10 lg:hidden"
          >
            <LogOut className="h-4 w-4" />
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
