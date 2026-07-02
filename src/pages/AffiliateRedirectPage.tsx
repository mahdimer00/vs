import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LoadingState } from "@/components/LoadingState";
import { useApp } from "@/hooks/useApp";

export function AffiliateRedirectPage() {
  const navigate = useNavigate();
  const params = useParams();
  const { setAffiliateRef, language } = useApp();

  useEffect(() => {
    const ref = String(params.ref ?? "").trim();
    if (!ref) {
      navigate("/", { replace: true });
      return;
    }

    void setAffiliateRef(ref);

    const target = String(params["*"] ?? "").replace(/^\/+/, "");
    navigate(target ? `/${target}` : "/", { replace: true });
  }, [navigate, params, setAffiliateRef]);

  return <LoadingState label={language === "ar" ? "جاري التحويل..." : language === "fr" ? "Redirection..." : "Redirecting..."} />;
}
