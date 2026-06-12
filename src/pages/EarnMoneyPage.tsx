import { ArrowRight, BadgePercent, Link2, Share2, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";

export function EarnMoneyPage() {
  const { language } = useApp();

  const steps = [
    {
      icon: Share2,
      title: translate(language, "earnMoneyStep1Title"),
      description: translate(language, "earnMoneyStep1Description"),
    },
    {
      icon: Link2,
      title: translate(language, "earnMoneyStep2Title"),
      description: translate(language, "earnMoneyStep2Description"),
    },
    {
      icon: Wallet,
      title: translate(language, "earnMoneyStep3Title"),
      description: translate(language, "earnMoneyStep3Description"),
    },
  ];

  return (
    <div className="space-y-8">
      <section className="surface-card-dark relative overflow-hidden p-8 md:p-12">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br from-amber-400/30 to-rose-500/20 blur-3xl" />
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] text-amber-300">
          <BadgePercent className="h-4 w-4" />
          {translate(language, "earnMoneyBadge")}
        </span>
        <h1 className="mt-6 max-w-3xl font-serif text-4xl font-semibold md:text-5xl">{translate(language, "earnMoneyTitle")}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">{translate(language, "earnMoneyDescription")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/affiliate/register" className="primary-button inline-flex items-center gap-2">
            {translate(language, "earnMoneyCtaRegister")}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/affiliate/login" className="ghost-button inline-flex items-center gap-2 border border-white/15 text-white">
            {translate(language, "earnMoneyCtaLogin")}
          </Link>
        </div>
      </section>

      <section className="surface-card p-8 md:p-12">
        <h2 className="font-serif text-3xl font-semibold text-slate-950">{translate(language, "earnMoneyHowTitle")}</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-[1.75rem] border border-slate-100 bg-slate-50/70 p-6">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 text-slate-950 shadow-lg shadow-amber-300/35">
                <step.icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-amber-600">
                {translate(language, "earnMoneyStepLabel")} {index + 1}
              </div>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">{step.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="surface-card p-8">
          <h2 className="font-serif text-2xl font-semibold text-slate-950">{translate(language, "earnMoneyCommissionTitle")}</h2>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
            <li className="flex items-start gap-3 rounded-[1.25rem] bg-emerald-50 p-4 text-emerald-800">
              <BadgePercent className="mt-0.5 h-5 w-5 shrink-0" />
              {translate(language, "affiliateCommissionRule")}
            </li>
            <li className="flex items-start gap-3 rounded-[1.25rem] bg-rose-50 p-4 text-rose-800">
              <BadgePercent className="mt-0.5 h-5 w-5 shrink-0" />
              {translate(language, "affiliateCancelledRule")}
            </li>
          </ul>
        </div>
        <div className="surface-card-dark p-8">
          <h2 className="font-serif text-2xl font-semibold">{translate(language, "earnMoneyCtaTitle")}</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">{translate(language, "earnMoneyCtaDescription")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/affiliate/register" className="primary-button inline-flex items-center gap-2">
              {translate(language, "earnMoneyCtaRegister")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/affiliate/login" className="ghost-button inline-flex items-center gap-2 border border-white/15 text-white">
              {translate(language, "earnMoneyCtaLogin")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
