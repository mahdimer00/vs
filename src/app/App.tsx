import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useApp } from "@/hooks/useApp";
import { MainLayout } from "@/layout/MainLayout";

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

  return (
    <MainLayout />
  );
}
