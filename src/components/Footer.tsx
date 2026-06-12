import { Headset, ShieldCheck, Truck, WalletCards } from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";

export function Footer() {
  const { language } = useApp();
  const trustItems = [
    { icon: WalletCards, label: translate(language, "trustCod") },
    { icon: Truck, label: translate(language, "trustDelivery") },
    { icon: ShieldCheck, label: translate(language, "trustQuality") },
    { icon: Headset, label: translate(language, "trustSupport") },
  ];

  return (
    <footer className="border-t border-white/70 bg-white/70 backdrop-blur">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div>
          <div className="font-serif text-2xl font-semibold text-slate-950">VisaStore</div>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{translate(language, "footerDescription")}</p>
          <div className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-400">{translate(language, "footerBadge")}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {trustItems.map((item) => (
            <div key={item.label} className="muted-card flex items-center gap-3 px-4 py-4">
              <item.icon className="h-5 w-5 text-teal-700" />
              <span className="text-sm font-medium text-slate-700">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
