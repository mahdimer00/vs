import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useApp } from "@/hooks/useApp";
import { MainLayout } from "@/layout/MainLayout";
import { initAnalytics, trackPageview } from "@/utils/analytics";
import { initPixel, pixelPageView } from "@/utils/pixel";
import { trackEvent } from "@/utils/tracking";

export function App() {
  const location = useLocation();
  const { setAffiliateRef } = useApp();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get("ref") || params.get("aff");
    if (ref) {
      void setAffiliateRef(ref);
    }
  }, [location.search, setAffiliateRef]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [location.pathname]);

  useEffect(() => {
    initAnalytics();
    initPixel();
  }, []);

  useEffect(() => {
    const path = location.pathname + location.search;
    trackPageview(path);
    pixelPageView();
    trackEvent({ eventType: "page_view" });
  }, [location.pathname, location.search]);

  return (
    <MainLayout />
  );
}
