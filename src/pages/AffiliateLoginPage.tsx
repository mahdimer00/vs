import { ArrowRight, BadgePercent } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import { authService } from "@/services/auth.service";
import { translate } from "@/utils/i18n";

export function AffiliateLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAffiliateSession, language } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    if (!email.includes("@")) {
      return translate(language, "authValidationEmail");
    }
    if (password.length < 8) {
      return translate(language, "authValidationPassword");
    }
    return "";
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await authService.affiliateLogin({ email, password });
      setAffiliateSession({
        token: response.token,
        user: {
          id: response.affiliate._id,
          email: response.affiliate.email,
          name: response.affiliate.name,
          role: "AFFILIATE",
        },
      });
      navigate((location.state as { from?: string } | null)?.from || "/affiliate");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to login";
      setError(
        message.toLowerCase().includes("pending")
          ? translate(language, "authPendingApproval")
          : message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="surface-card-dark p-8">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-white/10">
          <BadgePercent className="h-7 w-7 text-amber-300" />
        </div>
        <h1 className="mt-6 font-serif text-4xl font-semibold">{translate(language, "authAffiliateLoginTitle")}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">{translate(language, "authAffiliateDescription")}</p>
        <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-200">
          {translate(language, "affiliateCommissionRule")}
          <br />
          {translate(language, "affiliateCancelledRule")}
        </div>
        <Link
          to="/earn-money"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-md shadow-amber-300/40"
        >
          {translate(language, "earnMoneyNav")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
      <section className="surface-card p-8">
        <form onSubmit={submit} className="space-y-4">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field-input"
            placeholder={translate(language, "authEmail")}
            autoComplete="username"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            className="field-input"
            placeholder={translate(language, "authPassword")}
            autoComplete="current-password"
          />
          {error ? <div className="text-sm text-rose-600">{error}</div> : null}
          <button disabled={submitting} className="primary-button flex w-full justify-center py-4">
            {submitting ? translate(language, "loading") : translate(language, "authLogin")}
          </button>
        </form>
        <div className="mt-6 text-sm text-slate-500">
          {translate(language, "authNoAccount")}{" "}
          <Link to="/affiliate/register" className="inline-flex items-center gap-1 font-semibold text-teal-700">
            {translate(language, "authCreateAccount")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
