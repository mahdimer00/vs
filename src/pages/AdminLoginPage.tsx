import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { IconField } from "@/components/IconField";
import { Seo } from "@/components/Seo";
import { useApp } from "@/hooks/useApp";
import { authService } from "@/services/auth.service";
import { translate } from "@/utils/i18n";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAdminSession, language } = useApp();
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
      const session = await authService.adminLogin({ email, password });
      setAdminSession(session);
      navigate((location.state as { from?: string } | null)?.from || "/admin");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to login");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Seo title={translate(language, "authAdminTitle")} noindex />
      <section className="surface-card-dark p-6 sm:p-8">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-white/10">
          <ShieldCheck className="h-7 w-7 text-amber-300" />
        </div>
        <h1 className="mt-6 font-serif text-2xl font-semibold sm:text-3xl md:text-4xl">{translate(language, "authAdminTitle")}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">{translate(language, "authAdminDescription")}</p>
      </section>
      <section className="surface-card p-6 sm:p-8">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
          <ShieldCheck className="h-4 w-4" />
          {translate(language, "authSecureLogin")}
        </div>
        <form onSubmit={submit} className="space-y-4">
          <IconField icon={Mail}>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field-input field-input-icon"
              placeholder={translate(language, "authEmail")}
              autoComplete="username"
            />
          </IconField>
          <IconField icon={KeyRound}>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="field-input field-input-icon"
              placeholder={translate(language, "authPassword")}
              autoComplete="current-password"
            />
          </IconField>
          {error ? <div className="text-sm text-rose-600">{error}</div> : null}
          <button disabled={submitting} className="primary-button flex w-full justify-center py-4">
            {submitting ? translate(language, "loading") : translate(language, "authLogin")}
          </button>
        </form>
      </section>
    </div>
  );
}
