import { ArrowRight, BadgePercent, BarChart3, Check, CheckCircle2, Link2, Share2, ShieldCheck, Sparkles, Star, TrendingUp, Users, Wallet, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";

const levelTiers = [
  { label: "Bronze", labelAr: "برونز", percent: "3%", maxCap: "500", color: "from-amber-700 to-amber-500", ring: "ring-amber-300", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  { label: "Silver", labelAr: "فضي", percent: "5%", maxCap: "700", color: "from-slate-500 to-slate-400", ring: "ring-slate-300", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700", badge: "bg-slate-200 text-slate-700", dot: "bg-slate-400" },
  { label: "Gold", labelAr: "ذهبي", percent: "7%", maxCap: "900", color: "from-yellow-500 to-amber-400", ring: "ring-yellow-400", bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-800", badge: "bg-yellow-100 text-yellow-800", dot: "bg-yellow-500" },
  { label: "Platinum", labelAr: "بلاتيني", percent: "10%", maxCap: "1200", color: "from-teal-600 to-emerald-500", ring: "ring-teal-400", bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-800", badge: "bg-teal-100 text-teal-800", dot: "bg-teal-500" },
];

export function EarnMoneyPage() {
  const { language } = useApp();
  const isAr = language === "ar";
  const isFr = language === "fr";

  return (
    <div className="space-y-0">
      <Seo title={translate(language, "earnMoneyTitle")} description={translate(language, "earnMoneyDescription")} path="/earn-money" />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-14 sm:px-10 md:py-20">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-teal-500/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          {/* Badge */}
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-300">
            <BadgePercent className="h-3.5 w-3.5" />
            {isAr ? "برنامج المسوّقين" : isFr ? "Programme d'affiliation" : "Affiliate Program"}
          </span>

          <h1 className="mt-6 font-serif text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl">
            {isAr ? (
              <>اكسب <span className="text-amber-400">حتى 1200 دج</span> لكل طلب</>
            ) : isFr ? (
              <>Gagnez <span className="text-amber-400">jusqu'à 1200 DA</span> par commande</>
            ) : (
              <>Earn up to <span className="text-amber-400">1200 DZD</span> per order</>
            )}
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
            {isAr
              ? "شارك رابطك الخاص وابدأ الكسب على كل طلب مكتمل. بدون رأس مال، بدون مخاطرة."
              : isFr
                ? "Partagez votre lien et gagnez sur chaque commande réussie. Sans capital, sans risque."
                : "Share your link and earn on every completed order. No investment, no risk."}
          </p>

          {/* Stats row */}
          <div className="mx-auto mt-10 grid max-w-lg grid-cols-3 gap-3">
            {[
              { value: "3–10%", label: isAr ? "عمولة" : "Commission" },
              { value: "1200", suffix: isAr ? " دج" : " DA", label: isAr ? "أقصى ربح" : "Max/order" },
              { value: "100%", label: isAr ? "مجاني" : "Free" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center backdrop-blur">
                <div className="text-2xl font-extrabold text-amber-300">{s.value}<span className="text-sm">{s.suffix}</span></div>
                <div className="mt-1 text-[11px] font-medium text-slate-400">{s.label}</div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/affiliate/register"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-7 py-3.5 text-base font-bold text-slate-950 shadow-[0_8px_24px_rgba(251,191,36,0.4)] transition hover:from-amber-300 hover:to-orange-300 active:scale-95">
              <Zap className="h-5 w-5 fill-current" />
              {isAr ? "ابدأ الآن — مجاناً" : isFr ? "Commencer — Gratuit" : "Start now — Free"}
            </Link>
            <Link to="/affiliate/login"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/20">
              {isAr ? "لدي حساب" : isFr ? "J'ai un compte" : "I have an account"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Trust chips */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
            {[
              isAr ? "لا تحتاج خبرة" : "No experience needed",
              isAr ? "دفع عند الطلب" : "Pay on delivery",
              isAr ? "لوحة تحكم كاملة" : "Full dashboard",
              isAr ? "دعم مستمر" : "Ongoing support",
            ].map((t) => (
              <span key={t} className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-16">
        <div className="text-center">
          <span className="section-eyebrow">{isAr ? "كيف تعمل؟" : "How it works"}</span>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-slate-950 sm:text-4xl">
            {isAr ? "3 خطوات بسيطة للبدء" : isFr ? "3 étapes simples pour commencer" : "3 simple steps to start"}
          </h2>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Share2,
              num: "01",
              title: isAr ? "سجّل وأنشئ رابطك" : isFr ? "Inscrivez-vous et créez votre lien" : "Sign up and get your link",
              body: isAr ? "أنشئ حسابك مجاناً واحصل على رابط خاص بك لمشاركته في أي مكان." : "Create your free account and get a unique link to share anywhere.",
              color: "from-blue-500 to-indigo-600",
            },
            {
              icon: Link2,
              num: "02",
              title: isAr ? "شارك على منصاتك" : isFr ? "Partagez sur vos plateformes" : "Share on your platforms",
              body: isAr ? "شارك رابطك على واتساب، فيسبوك، انستغرام أو مع معارفك." : "Share on WhatsApp, Facebook, Instagram or with friends.",
              color: "from-amber-500 to-orange-600",
            },
            {
              icon: Wallet,
              num: "03",
              title: isAr ? "اجمع أرباحك" : isFr ? "Collectez vos gains" : "Collect your earnings",
              body: isAr ? "كسب عمولة على كل طلب مكتمل عبر رابطك. اسحب رصيدك متى تريد." : "Earn commission on every completed order. Withdraw whenever you want.",
              color: "from-teal-500 to-emerald-600",
            },
          ].map((step) => (
            <div key={step.num} className="relative rounded-[2rem] border border-slate-100 bg-white p-7 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${step.color} shadow-lg`}>
                <step.icon className="h-6 w-6 text-white" />
              </div>
              <div className="absolute end-6 top-6 text-5xl font-black text-slate-100 select-none">{step.num}</div>
              <h3 className="mt-5 text-lg font-bold text-slate-950">{step.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-500">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMMISSION TIERS ── */}
      <section className="rounded-[2.5rem] bg-gradient-to-b from-slate-50 to-white py-16 px-6 sm:px-10">
        <div className="text-center">
          <span className="section-eyebrow">{isAr ? "العمولات" : "Commissions"}</span>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-slate-950 sm:text-4xl">
            {isAr ? "كلما بعت أكثر، كسبت أكثر" : isFr ? "Plus vous vendez, plus vous gagnez" : "The more you sell, the more you earn"}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">{translate(language, "affiliateCommissionRule")}</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {levelTiers.map((tier, i) => (
            <div key={tier.label} className={`relative overflow-hidden rounded-[2rem] border-2 p-6 ${tier.bg} ${tier.border} ${i === levelTiers.length - 1 ? "ring-2 " + tier.ring : ""}`}>
              {i === levelTiers.length - 1 && (
                <div className="absolute end-3 top-3 rounded-full bg-teal-600 px-2.5 py-0.5 text-[10px] font-bold text-white">★ TOP</div>
              )}
              {/* Level badge */}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${tier.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
                {isAr ? tier.labelAr : tier.label}
              </span>

              {/* Percentage — hero */}
              <div className={`mt-5 text-5xl font-black ${tier.text}`}>{tier.percent}</div>
              <div className="text-xs font-medium text-slate-400">{isAr ? "عمولة على كل طلب" : "commission per order"}</div>

              {/* Max cap */}
              <div className={`mt-4 flex items-center gap-2 rounded-xl border ${tier.border} bg-white/70 px-3 py-2`}>
                <TrendingUp className={`h-4 w-4 shrink-0 ${tier.text}`} />
                <div>
                  <div className={`text-sm font-bold ${tier.text}`}>{tier.maxCap} DZD</div>
                  <div className="text-[10px] text-slate-400">{isAr ? "أقصى ربح لكل طلب" : "max per order"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Referral earning highlight */}
        <div className={`mt-6 flex items-start gap-4 rounded-2xl border border-teal-200 bg-teal-50 p-5`}>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-teal-900">{isAr ? "🎁 مكافأة الإحالة" : "🎁 Referral bonus"}</div>
            <p className="mt-1 text-sm text-teal-700">
              {isAr
                ? "اكسب 10% من عمولة كل مسوّق تدعوه للبرنامج. كلما أجرى مبيعات، كسبت أنت أيضاً."
                : "Earn 10% of commissions from every affiliate you invite. They sell, you earn too."}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700">
          <BadgePercent className="me-1.5 inline h-4 w-4" /> {translate(language, "affiliateCancelledRule")}
        </div>
      </section>

      {/* ── PAYOUT METHODS ── */}
      <section className="py-16">
        <div className="text-center">
          <span className="section-eyebrow">{isAr ? "طرق السحب" : "Payout methods"}</span>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-slate-950 sm:text-4xl">
            {isAr ? "استلم أرباحك بسهولة" : isFr ? "Recevez vos gains facilement" : "Receive your earnings easily"}
          </h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-5 rounded-[2rem] border-2 border-[#007C4E]/25 bg-[#007C4E]/5 p-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-[#007C4E]/15 ring-1 ring-[#007C4E]/20">
              <img src="/baridimob-logo.png" alt="BaridiMob" className="h-12 w-12 object-contain" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#007C4E]">BaridiMob</div>
              <p className="mt-1 text-sm text-slate-600">{isAr ? "تحويل مباشر إلى حسابك البريدي" : "Direct transfer to your postal account"}</p>
              <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-[#007C4E]/10 px-3 py-1 text-xs font-bold text-[#007C4E]">
                <Check className="h-3 w-3" /> {isAr ? "متاح" : "Available"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5 rounded-[2rem] border-2 border-slate-200 bg-slate-50 p-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-900 shadow-lg">
              <svg viewBox="0 0 40 40" className="h-9 w-9">
                <rect x="4" y="10" width="32" height="20" rx="4" fill="none" stroke="white" strokeWidth="2.5"/>
                <line x1="4" y1="16" x2="36" y2="16" stroke="white" strokeWidth="2.5"/>
                <rect x="8" y="22" width="9" height="3" rx="1.5" fill="white" opacity="0.85"/>
              </svg>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">Cardless</div>
              <p className="mt-1 text-sm text-slate-600">{isAr ? "سحب نقدي بدون بطاقة من أقرب صراف آلي" : "Cardless withdrawal at any ATM"}</p>
              <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600">
                <Check className="h-3 w-3" /> {isAr ? "متاح" : "Available"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50 px-5 py-3 text-sm text-teal-700">
          <Wallet className="me-1.5 inline h-4 w-4" />
          {isAr ? "الحد الأدنى للسحب: 500 دج — تتم المعالجة خلال 3–5 أيام عمل." : "Minimum withdrawal: 500 DZD — processed within 3–5 business days."}
        </div>
      </section>

      {/* ── WHY + CTA ── */}
      <section className="grid gap-6 md:grid-cols-2">
        {/* Why us */}
        <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
          <h2 className="font-serif text-2xl font-bold text-slate-950">{translate(language, "earnMoneyWhyTitle")}</h2>
          <div className="mt-6 space-y-3">
            {[
              { icon: ShieldCheck, title: translate(language, "earnMoneyHighlight1Title"), body: translate(language, "earnMoneyHighlight1Description") },
              { icon: BarChart3, title: translate(language, "earnMoneyHighlight2Title"), body: translate(language, "earnMoneyHighlight2Description") },
              { icon: Sparkles, title: translate(language, "earnMoneyHighlight3Title"), body: translate(language, "earnMoneyHighlight3Description") },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-amber-300">
                  <item.icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-950">{item.title}</div>
                  <p className="mt-0.5 text-sm leading-6 text-slate-500">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-8 flex flex-col justify-between">
          <div className="pointer-events-none absolute -bottom-16 -end-16 h-56 w-56 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -top-10 start-8 h-32 w-32 rounded-full bg-teal-500/15 blur-2xl" />

          <div className="relative z-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-4 py-1.5 text-xs font-bold text-amber-300">
              <Star className="h-3.5 w-3.5 fill-current" />
              {isAr ? "انضم اليوم — مجاناً" : "Join today — Free"}
            </div>
            <h2 className="font-serif text-2xl font-bold text-white leading-tight">
              {translate(language, "earnMoneyCtaTitle")}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{translate(language, "earnMoneyCtaDescription")}</p>

            <ul className="mt-5 space-y-2">
              {[
                isAr ? "لا تحتاج رأس مال أو خبرة" : "No capital or experience needed",
                isAr ? "لوحة تحكم بالوقت الفعلي" : "Real-time dashboard",
                isAr ? "دفع فوري عند كل طلب مكتمل" : "Instant payment on each order",
              ].map((p) => (
                <li key={p} className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative z-10 mt-8 space-y-3">
            <Link to="/affiliate/register"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4 text-base font-bold text-slate-950 shadow-[0_8px_24px_rgba(251,191,36,0.35)] transition hover:from-amber-300 active:scale-95">
              {translate(language, "earnMoneyCtaRegister")}
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to="/affiliate/login"
              className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/8 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/15">
              {translate(language, "earnMoneyCtaLogin")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
