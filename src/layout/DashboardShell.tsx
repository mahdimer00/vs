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
      <aside className="surface-card-dark sticky top-6 h-fit p-6">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">{language.toUpperCase()}</div>
          <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
          {description ? <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p> : null}
        </div>

        <nav className="mt-6 space-y-2">
          {links.map((link) => (
            <NavLink
              key={link.href}
              to={link.href}
              end={link.href === "/admin" || link.href === "/affiliate"}
              className={({ isActive }) =>
                `block rounded-[1.2rem] px-4 py-3 text-sm transition ${
                  isActive ? "bg-white text-slate-950" : "text-slate-200 hover:bg-white/10"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <button onClick={onLogout} className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10">
          <LogOut className="h-4 w-4" />
          {translate(language, "logout")}
        </button>
      </aside>
      <section className="space-y-6">{children}</section>
    </div>
  );
}
