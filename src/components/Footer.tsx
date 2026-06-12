import { Facebook, Headset, Instagram, MapPin, MessageCircle, Phone, ShieldCheck, Truck, WalletCards, Youtube } from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.6 5.82c-.93-.81-1.55-1.95-1.6-3.32h-2.92v13.7c0 1.6-1.3 2.9-2.9 2.9a2.9 2.9 0 0 1 0-5.8c.3 0 .6.05.88.13V10.5a5.9 5.9 0 0 0-.88-.07A5.9 5.9 0 0 0 3.4 16.3a5.9 5.9 0 0 0 5.78 5.9 5.9 5.9 0 0 0 5.9-5.9V9.07a8.4 8.4 0 0 0 4.92 1.58V7.7c-1.05 0-2.06-.36-2.88-1.05a4.6 4.6 0 0 1-.52-.83z" />
    </svg>
  );
}

export function Footer() {
  const { language, siteSettings } = useApp();
  const storeName = siteSettings?.storeName || "VisaStore";
  const trustItems = [
    { icon: WalletCards, label: translate(language, "trustCod") },
    { icon: Truck, label: translate(language, "trustDelivery") },
    { icon: ShieldCheck, label: translate(language, "trustQuality") },
    { icon: Headset, label: translate(language, "trustSupport") },
  ];

  const phone = siteSettings?.phone;
  const whatsapp = siteSettings?.whatsapp;
  const social = siteSettings?.socialLinks || {};
  const socialLinks = [
    { key: "facebook", icon: Facebook, href: social.facebook },
    { key: "instagram", icon: Instagram, href: social.instagram },
    { key: "tiktok", icon: TikTokIcon, href: social.tiktok },
    { key: "youtube", icon: Youtube, href: social.youtube },
  ].filter((item) => item.href);

  return (
    <footer className="border-t border-white/70 bg-white/70 backdrop-blur">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div>
          <div className="font-serif text-2xl font-semibold text-slate-950">{storeName}</div>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{translate(language, "footerDescription")}</p>
          <div className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-400">{translate(language, "footerBadge")}</div>

          <div className="mt-5 space-y-2 text-sm text-slate-600">
            {siteSettings?.address ? (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                <span>{siteSettings.address}</span>
              </div>
            ) : null}
            {phone ? (
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="flex items-center gap-2 hover:text-teal-700">
                <Phone className="h-4 w-4 text-teal-700" />
                <span>{phone}</span>
              </a>
            ) : null}
            {whatsapp ? (
              <a href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-teal-700">
                <MessageCircle className="h-4 w-4 text-teal-700" />
                <span>{whatsapp}</span>
              </a>
            ) : null}
          </div>

          {socialLinks.length ? (
            <div className="mt-5 flex flex-wrap gap-3">
              {socialLinks.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:-translate-y-0.5 hover:bg-teal-50 hover:text-teal-700"
                >
                  <item.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          ) : null}
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
