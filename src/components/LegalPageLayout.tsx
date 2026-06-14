import { Seo } from "@/components/Seo";
import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";
import type { TranslationKey } from "@/utils/i18n";

export function LegalPageLayout({ titleKey, bodyKey, path }: { titleKey: TranslationKey; bodyKey: TranslationKey; path: string }) {
  const { language, siteSettings } = useApp();
  const storeName = siteSettings?.storeName || "VisaStore";
  const body = translate(language, bodyKey).replaceAll("{store}", storeName);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Seo title={translate(language, titleKey)} path={path} />
      <section className="surface-card overflow-hidden p-6 md:p-8">
        <h1 className="font-serif text-2xl font-semibold text-slate-950 sm:text-3xl md:text-4xl">{translate(language, titleKey)}</h1>
      </section>
      <section className="surface-card space-y-4 p-6 md:p-8">
        {body.split("\n\n").map((paragraph, index) => (
          <p key={index} className="text-sm leading-7 text-slate-600">
            {paragraph}
          </p>
        ))}
      </section>
    </div>
  );
}
