import { Facebook, Instagram, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Truck, Youtube } from "lucide-react";
import { TikTokIcon } from "@/components/TikTokIcon";
import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";

export function ContactPage() {
  const { language, siteSettings } = useApp();
  const phone = siteSettings?.phone || "+213 555 00 00 00";
  const whatsapp = siteSettings?.whatsapp || phone;
  const whatsappLink = `https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`;
  const social = siteSettings?.socialLinks || {};

  const cards = [
    { icon: Phone, label: translate(language, "contactPhone"), value: phone, href: `tel:${phone.replace(/\s/g, "")}` },
    { icon: MessageCircle, label: translate(language, "contactWhatsapp"), value: whatsapp, href: whatsappLink },
    { icon: Mail, label: translate(language, "contactEmail"), value: "support@visadz.store", href: "mailto:support@visadz.store" },
  ];

  const socialLinks = [
    { key: "facebook", icon: Facebook, href: social.facebook },
    { key: "instagram", icon: Instagram, href: social.instagram },
    { key: "tiktok", icon: TikTokIcon, href: social.tiktok },
    { key: "youtube", icon: Youtube, href: social.youtube },
  ].filter((item) => item.href);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="surface-card overflow-hidden p-0">
        <div className="bg-[linear-gradient(135deg,_#fff7ed,_#ffffff_35%,_#eff6ff)] p-8">
          <h1 className="font-serif text-4xl font-semibold text-slate-950">{translate(language, "contactTitle")}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{translate(language, "contactDescription")}</p>
          {siteSettings?.address ? (
            <div className="mt-5 flex items-start gap-3 text-sm text-slate-700">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
              <span>{siteSettings.address}</span>
            </div>
          ) : null}
          {socialLinks.length ? (
            <div className="mt-5 flex flex-wrap gap-3">
              {socialLinks.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:text-teal-700 hover:shadow-md"
                >
                  <item.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <a key={card.label} href={card.href} target={card.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="surface-card block p-6 transition hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(15,23,42,0.1)]">
            <card.icon className="h-5 w-5 text-teal-700" />
            <div className="mt-4 text-sm text-slate-500">{card.label}</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{card.value}</div>
          </a>
        ))}
      </section>

      {siteSettings?.mapUrl ? (
        <section className="surface-card overflow-hidden p-0">
          <iframe
            src={siteSettings.mapUrl}
            title="Store location"
            className="h-80 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="surface-card p-6">
          <Truck className="h-5 w-5 text-amber-600" />
          <div className="mt-4 text-lg font-semibold text-slate-950">{translate(language, "trustDelivery")}</div>
          <p className="mt-2 text-sm leading-7 text-slate-600">{translate(language, "contactDeliveryCoverage")}</p>
        </div>
        <div className="surface-card p-6">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <div className="mt-4 text-lg font-semibold text-slate-950">{translate(language, "trustQuality")}</div>
          <p className="mt-2 text-sm leading-7 text-slate-600">{translate(language, "contactQualitySupport")}</p>
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
