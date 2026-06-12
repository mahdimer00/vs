import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Banner, Locale } from "@/types";
import { getLocalizedText } from "@/utils/format";
import { translate } from "@/utils/i18n";

export function PromoSlider({
  banners,
  language,
}: {
  banners: Banner[];
  language: Locale;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [banners.length]);

  useEffect(() => {
    if (activeIndex >= banners.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, banners.length]);

  if (!banners.length) {
    return null;
  }

  const active = banners[activeIndex];
  const link = active.link || "/products";
  const external = /^https?:\/\//.test(link);

  return (
    <section className="surface-card overflow-hidden p-2">
      <div className="relative min-h-[220px] overflow-hidden rounded-[1.7rem] md:min-h-[280px]">
        {banners.map((banner, index) => (
          <div
            key={banner._id}
            className={`absolute inset-0 transition-all duration-700 ${
              index === activeIndex ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-[1.02]"
            }`}
          >
            <img
              src={banner.image}
              alt={getLocalizedText(banner.title, language)}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.82)_0%,rgba(2,6,23,0.42)_55%,rgba(2,6,23,0.14)_100%)]" />
          </div>
        ))}

        <div className="relative z-10 flex h-full min-h-[220px] flex-col justify-between p-5 md:min-h-[280px] md:p-7">
          <div className="inline-flex w-fit rounded-full border border-white/15 bg-black/20 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-amber-200 backdrop-blur">
            VisaStore Ads
          </div>

          <div className="max-w-2xl">
            <h1 className="max-w-[18ch] font-serif text-2xl font-semibold leading-tight text-white md:text-4xl">
              {getLocalizedText(active.title, language)}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {external ? (
                <a
                  href={link}
                  className="accent-button gap-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  {translate(language, "heroPrimary")}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ) : (
                <Link to={link} className="accent-button gap-2">
                  {translate(language, "heroPrimary")}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {banners.length > 1 ? (
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/25 px-3 py-2 backdrop-blur">
            {banners.map((banner, index) => (
              <button
                key={banner._id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-2.5 rounded-full transition-all ${
                  index === activeIndex ? "w-8 bg-white" : "w-2.5 bg-white/45"
                }`}
                aria-label={`Slide ${index + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
