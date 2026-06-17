import { ArrowRight, BadgePercent, BarChart3, CheckCircle2, Link2, Share2, ShieldCheck, Sparkles, Star, TrendingUp, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";

const levelTiers = [
  { label: "Bronze", color: "from-amber-700 to-amber-500", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800" },
  { label: "Silver", color: "from-slate-500 to-slate-400", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700" },
  { label: "Gold", color: "from-yellow-500 to-amber-400", bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-800" },
  { label: "Platinum", color: "from-teal-600 to-emerald-500", bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-800" },
];

export function EarnMoneyPage() {
  const { language } = useApp();

  const steps = [
    { icon: Share2, title: translate(language, "earnMoneyStep1Title"), description: translate(language, "earnMoneyStep1Description") },
    { icon: Link2, title: translate(language, "earnMoneyStep2Title"), description: translate(language, "earnMoneyStep2Description") },
    { icon: Wallet, title: translate(language, "earnMoneyStep3Title"), description: translate(language, "earnMoneyStep3Description") },
  ];

  const highlights = [
    { icon: ShieldCheck, title: translate(language, "earnMoneyHighlight1Title"), description: translate(language, "earnMoneyHighlight1Description") },
    { icon: BarChart3, title: translate(language, "earnMoneyHighlight2Title"), description: translate(language, "earnMoneyHighlight2Description") },
    { icon: Sparkles, title: translate(language, "earnMoneyHighlight3Title"), description: translate(language, "earnMoneyHighlight3Description") },
  ];

  const perks = [
    translate(language, "earnMoneyHighlight1Title"),
    translate(language, "earnMoneyHighlight2Title"),
    translate(language, "earnMoneyHighlight3Title"),
  ];

  return (
    <div className="space-y-8">
      <Seo title={translate(language, "earnMoneyTitle")} description={translate(language, "earnMoneyDescription")} path="/earn-money" />

      {/* Hero */}
      <section className="surface-card-dark relative overflow-hidden p-6 sm:p-10 md:p-14">
        <div className="absolute -end-20 -top-20 h-72 w-72 rounded-full bg-gradient-to-br from-amber-400/30 to-rose-500/20 blur-3xl" />
        <div className="absolute -bottom-16 start-1/4 h-48 w-48 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="relative z-10 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] text-amber-300">
              <BadgePercent className="h-4 w-4" />
              {translate(language, "earnMoneyBadge")}
            </span>
            <h1 className="mt-5 max-w-2xl font-serif text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl">
              {translate(language, "earnMoneyTitle")}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 md:text-base">
              {translate(language, "earnMoneyDescription")}
            </p>

            {/* Quick stats */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { value: "5–15%", label: translate(language, "earnMoneyHighlight2Title") },
                { value: "48h", label: language === "ar" ? "دفع سريع" : language === "fr" ? "Paiement rapide" : "Fast payout" },
                { value: "100%", label: language === "ar" ? "مجاني" : language === "fr" ? "Gratuit" : "Free" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4 text-center backdrop-blur-sm">
                  <div className="text-2xl font-bold text-amber-300">{stat.value}</div>
                  <div className="mt-1 text-xs text-slate-400">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/affiliate/register" className="primary-button inline-flex items-center gap-2 bg-amber-400 text-slate-950 hover:bg-amber-300">
                {translate(language, "earnMoneyCtaRegister")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/affiliate/login" className="ghost-button inline-flex items-center gap-2 border border-white/15 text-white hover:bg-white/10">
                {translate(language, "earnMoneyCtaLogin")}
              </Link>
            </div>

            {/* Quick perks */}
            <div className="mt-6 flex flex-wrap gap-3">
              {perks.map((perk) => (
                <span key={perk} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  {perk}
                </span>
              ))}
            </div>
          </div>

          {/* Highlights cards */}
          <div className="grid gap-3">
            {highlights.map((highlight) => (
              <div key={highlight.title} className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-amber-300">
                    <highlight.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-white">{highlight.title}</h2>
                    <p className="mt-1.5 text-sm leading-6 text-slate-300">{highlight.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="surface-card p-8 md:p-12">
        <div className="text-center">
          <span className="section-eyebrow">{translate(language, "earnMoneyStepLabel")}</span>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-slate-950">{translate(language, "earnMoneyHowTitle")}</h2>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="relative rounded-[1.75rem] border border-slate-100 bg-gradient-to-b from-slate-50/90 to-white p-6 text-center shadow-[0_8px_32px_rgba(15,23,42,0.05)]">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 text-slate-950 shadow-lg shadow-amber-300/35">
                <step.icon className="h-6 w-6" />
              </div>
              <div className="absolute -top-3 end-5 grid h-7 w-7 place-items-center rounded-full bg-slate-950 text-xs font-bold text-white">
                {index + 1}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-950">{step.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Commission tiers */}
      <section className="surface-card p-8 md:p-12">
        <div className="text-center">
          <span className="section-eyebrow">{translate(language, "earnMoneyCommissionTitle")}</span>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-slate-950">{translate(language, "earnMoneyCommissionTitle")}</h2>
          <p className="mt-3 max-w-xl mx-auto text-sm leading-7 text-slate-600">{translate(language, "affiliateCommissionRule")}</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {levelTiers.map((tier, index) => (
            <div key={tier.label} className={`relative overflow-hidden rounded-[1.75rem] border p-6 ${tier.bg} ${tier.border}`}>
              <div className={`absolute -end-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${tier.color} opacity-15`} />
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${tier.bg} ${tier.text} border ${tier.border}`}>
                <Star className="h-3 w-3" fill="currentColor" />
                {tier.label}
              </div>
              <div className={`mt-4 text-3xl font-bold ${tier.text}`}>{(index + 1) * 3 + 2}%</div>
              <div className="mt-1 text-xs text-slate-500">{language === "ar" ? "عمولة على كل مبيعاتك" : language === "fr" ? "commission sur vos ventes" : "commission on sales"}</div>
              {index === levelTiers.length - 1 && (
                <div className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${tier.text}`}>
                  <TrendingUp className="h-3.5 w-3.5" />
                  {language === "ar" ? "أعلى مستوى" : language === "fr" ? "Niveau maximum" : "Top tier"}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-[1.5rem] border border-rose-100 bg-rose-50 p-4 text-sm text-rose-800">
          <BadgePercent className="mb-1 inline-block h-4 w-4" /> {translate(language, "affiliateCancelledRule")}
        </div>
      </section>

      {/* Why + CTA side-by-side */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="surface-card p-8">
          <h2 className="font-serif text-2xl font-semibold text-slate-950">{translate(language, "earnMoneyWhyTitle")}</h2>
          <div className="mt-5 space-y-4">
            {highlights.map((highlight) => (
              <div key={highlight.title} className="flex items-start gap-3 rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-950 text-white">
                  <highlight.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-950">{highlight.title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{highlight.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card-dark relative overflow-hidden p-8 flex flex-col justify-between">
          <div className="absolute inset-y-0 end-0 w-48 bg-gradient-to-l from-amber-400/15 to-transparent" />
          <div className="relative z-10">
            <h2 className="font-serif text-2xl font-semibold">{translate(language, "earnMoneyCtaTitle")}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">{translate(language, "earnMoneyCtaDescription")}</p>
          </div>
          <div className="relative z-10 mt-8 flex flex-col gap-3">
            <Link to="/affiliate/register" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-5 py-3.5 text-sm font-semibold text-slate-950 shadow transition hover:bg-amber-300">
              {translate(language, "earnMoneyCtaRegister")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/affiliate/login" className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10">
              {translate(language, "earnMoneyCtaLogin")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
