import { Facebook, Headset, Instagram, MapPin, MessageCircle, Phone, ShieldCheck, Truck, WalletCards, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import { TikTokIcon } from "@/components/TikTokIcon";
import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";

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
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="grid gap-3">
            {trustItems.map((item) => (
              <div key={item.label} className="muted-card flex items-center gap-3 px-4 py-4">
                <item.icon className="h-5 w-5 text-teal-700" />
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">{translate(language, "footerLegalTitle")}</div>
            <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600">
              <Link to="/contact" className="hover:text-teal-700">
                {translate(language, "contact")}
              </Link>
              <Link to="/privacy-policy" className="hover:text-teal-700">
                {translate(language, "privacyPolicyTitle")}
              </Link>
              <Link to="/terms" className="hover:text-teal-700">
                {translate(language, "termsTitle")}
              </Link>
              <Link to="/return-policy" className="hover:text-teal-700">
                {translate(language, "returnPolicyTitle")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
