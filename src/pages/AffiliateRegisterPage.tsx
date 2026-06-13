import { ArrowRight, KeyRound, Mail, Phone, User, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { IconField } from "@/components/IconField";
import { useApp } from "@/hooks/useApp";
import { authService } from "@/services/auth.service";
import { translate } from "@/utils/i18n";

const phonePattern = /^(05|06|07)\d{8}$/;

export function AffiliateRegisterPage() {
  const { language } = useApp();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    if (!form.name.trim()) {
      return translate(language, "authValidationName");
    }
    if (!form.email.includes("@")) {
      return translate(language, "authValidationEmail");
    }
    if (!phonePattern.test(form.phone.trim())) {
      return translate(language, "authValidationPhone");
    }
    if (form.password.length < 8) {
      return translate(language, "authValidationPassword");
    }
    if (form.password !== form.confirmPassword) {
      return translate(language, "authValidationPasswordMatch");
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
    setSuccess("");
    try {
      const response = await authService.affiliateRegister({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      setSuccess(response.message || translate(language, "authRegisterPending"));
      setForm({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to register");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="surface-card-dark p-6 sm:p-8">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-white/10">
          <UserPlus className="h-7 w-7 text-amber-300" />
        </div>
        <h1 className="mt-6 font-serif text-2xl font-semibold sm:text-3xl md:text-4xl">{translate(language, "authAffiliateRegisterTitle")}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">{translate(language, "authAffiliateDescription")}</p>
      </section>
      <section className="surface-card p-6 sm:p-8">
        <form onSubmit={submit} className="space-y-4">
          <IconField icon={User}>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="field-input field-input-icon" placeholder={translate(language, "authName")} autoComplete="name" />
          </IconField>
          <IconField icon={Mail}>
            <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="field-input field-input-icon" placeholder={translate(language, "authEmail")} autoComplete="email" />
          </IconField>
          <IconField icon={Phone}>
            <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="field-input field-input-icon" placeholder={translate(language, "authPhone")} autoComplete="tel" />
          </IconField>
          <IconField icon={KeyRound}>
            <input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} type="password" className="field-input field-input-icon" placeholder={translate(language, "authPassword")} autoComplete="new-password" />
          </IconField>
          <IconField icon={KeyRound}>
            <input value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} type="password" className="field-input field-input-icon" placeholder={translate(language, "authConfirmPassword")} autoComplete="new-password" />
          </IconField>
          {error ? <div className="text-sm text-rose-600">{error}</div> : null}
          {success ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{translate(language, "authRegisterPending")}</div> : null}
          <button disabled={submitting} className="primary-button flex w-full justify-center py-4">
            {submitting ? translate(language, "loading") : translate(language, "authRegister")}
          </button>
        </form>
        <div className="mt-6 text-sm text-slate-500">
          {translate(language, "authHaveAccount")}{" "}
          <Link to="/affiliate/login" className="inline-flex items-center gap-1 font-semibold text-teal-700">
            {translate(language, "authLogin")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
