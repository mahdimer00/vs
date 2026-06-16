import { Facebook, Headset, Instagram, MapPin, MessageCircle, Phone, ShieldCheck, Truck, WalletCards, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import { TikTokIcon } from "@/components/TikTokIcon";
import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";

export function Footer() {
  const { language, siteSettings } = useApp();
  const storeName = siteSettings?.storeName || "VisaStore";
  const year = new Date().getFullYear();

  const trustItems = [
    { icon: WalletCards, label: translate(language, "trustCod"), color: "text-amber-600" },
    { icon: Truck, label: translate(language, "trustDelivery"), color: "text-teal-600" },
    { icon: ShieldCheck, label: translate(language, "trustQuality"), color: "text-emerald-600" },
    { icon: Headset, label: translate(language, "trustSupport"), color: "text-blue-600" },
  ];

  const phone = siteSettings?.phone;
  const whatsapp = siteSettings?.whatsapp;
  const social = siteSettings?.socialLinks || {};
  const socialLinks = [
    { key: "facebook", icon: Facebook, href: social.facebook, label: "Facebook" },
    { key: "instagram", icon: Instagram, href: social.instagram, label: "Instagram" },
    { key: "tiktok", icon: TikTokIcon, href: social.tiktok, label: "TikTok" },
    { key: "youtube", icon: Youtube, href: social.youtube, label: "YouTube" },
  ].filter((item) => item.href);

  return (
    <footer className="mt-8 border-t border-slate-200/70 bg-white/80 backdrop-blur">
      {/* Main footer */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr_auto]">

          {/* Brand column */}
          <div>
            <div className="flex items-center gap-3">
              {siteSettings?.logo ? (
                <img src={siteSettings.logo} alt={storeName} className="h-10 w-10 rounded-2xl object-cover shadow-md" />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 via-orange-400 to-teal-500 text-xs font-extrabold text-slate-950 shadow-md">
                  VS
                </div>
              )}
              <div className="font-serif text-xl font-bold text-slate-950">{storeName}</div>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-7 text-slate-500">{translate(language, "footerDescription")}</p>
            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-teal-600">{translate(language, "footerBadge")}</div>

            {/* Contact */}
            <div className="mt-5 space-y-2.5 text-sm">
              {siteSettings?.address ? (
                <div className="flex items-start gap-2 text-slate-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  <span>{siteSettings.address}</span>
                </div>
              ) : null}
              {phone ? (
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-slate-600 transition hover:text-teal-700" dir="ltr">
                  <Phone className="h-4 w-4 text-teal-600" />
                  <span>{phone}</span>
                </a>
              ) : null}
              {whatsapp ? (
                <a href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-slate-600 transition hover:text-teal-700" dir="ltr">
                  <MessageCircle className="h-4 w-4 text-teal-600" />
                  <span>{whatsapp}</span>
                </a>
              ) : null}
            </div>

            {/* Social links */}
            {socialLinks.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {socialLinks.map((item) => (
                  <a
                    key={item.key}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={item.label}
                    className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-700 hover:shadow-md"
                  >
                    <item.icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {/* Trust items */}
          <div>
            <div className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">{translate(language, "trustQuality")}</div>
            <div className="grid gap-2.5">
              {trustItems.map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                  <item.icon className={`h-5 w-5 shrink-0 ${item.color}`} />
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Legal links */}
          <div className="min-w-[160px]">
            <div className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">{translate(language, "footerLegalTitle")}</div>
            <nav className="flex flex-col gap-2.5 text-sm">
              <Link to="/contact" className="text-slate-600 transition hover:text-teal-700">{translate(language, "contact")}</Link>
              <Link to="/track-order" className="text-slate-600 transition hover:text-teal-700">{translate(language, "trackOrder")}</Link>
              <Link to="/privacy-policy" className="text-slate-600 transition hover:text-teal-700">{translate(language, "privacyPolicyTitle")}</Link>
              <Link to="/terms" className="text-slate-600 transition hover:text-teal-700">{translate(language, "termsTitle")}</Link>
              <Link to="/return-policy" className="text-slate-600 transition hover:text-teal-700">{translate(language, "returnPolicyTitle")}</Link>
            </nav>
          </div>
        </div>
      </div>

      {/* Copyright bar */}
      <div className="border-t border-slate-100 bg-slate-50/80">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <span>© {year} {storeName}. {translate(language, "footerBadge")}</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy-policy" className="transition hover:text-teal-700">{translate(language, "privacyPolicyTitle")}</Link>
            <Link to="/terms" className="transition hover:text-teal-700">{translate(language, "termsTitle")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
