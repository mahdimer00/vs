import { Mail, MessageCircle, Phone, ShieldCheck, Truck } from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";

export function ContactPage() {
  const { language } = useApp();
  const cards = [
    { icon: Phone, label: translate(language, "contactPhone"), value: "+213 555 00 00 00" },
    { icon: MessageCircle, label: translate(language, "contactWhatsapp"), value: "+213 770 00 00 00" },
    { icon: Mail, label: translate(language, "contactEmail"), value: "support@visastore.dz" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="surface-card overflow-hidden p-0">
        <div className="bg-[linear-gradient(135deg,_#fff7ed,_#ffffff_35%,_#eff6ff)] p-8">
          <h1 className="font-serif text-4xl font-semibold text-slate-950">{translate(language, "contactTitle")}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{translate(language, "contactDescription")}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="surface-card p-6">
            <card.icon className="h-5 w-5 text-teal-700" />
            <div className="mt-4 text-sm text-slate-500">{card.label}</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{card.value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="surface-card p-6">
          <Truck className="h-5 w-5 text-amber-600" />
          <div className="mt-4 text-lg font-semibold text-slate-950">{translate(language, "trustDelivery")}</div>
          <p className="mt-2 text-sm leading-7 text-slate-600">Delivery support for all 58 Algerian wilayas.</p>
        </div>
        <div className="surface-card p-6">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <div className="mt-4 text-lg font-semibold text-slate-950">{translate(language, "trustQuality")}</div>
          <p className="mt-2 text-sm leading-7 text-slate-600">Questions about authenticity, product quality, and after-sales support.</p>
        </div>
        <div className="surface-card p-6">
          <MessageCircle className="h-5 w-5 text-sky-600" />
          <div className="mt-4 text-lg font-semibold text-slate-950">{translate(language, "contactHours")}</div>
          <p className="mt-2 text-sm leading-7 text-slate-600">{translate(language, "contactHoursValue")}</p>
        </div>
      </section>
    </div>
  );
}
