import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";
import type { TranslationKey } from "@/utils/i18n";

export function LegalPageLayout({ titleKey, bodyKey }: { titleKey: TranslationKey; bodyKey: TranslationKey }) {
  const { language, siteSettings } = useApp();
  const storeName = siteSettings?.storeName || "VisaStore";
  const body = translate(language, bodyKey).replaceAll("{store}", storeName);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="surface-card overflow-hidden p-6 md:p-8">
        <h1 className="font-serif text-4xl font-semibold text-slate-950">{translate(language, titleKey)}</h1>
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
