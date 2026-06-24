import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/hooks/useApp";
import { translate } from "@/utils/i18n";

export function BackToTopButton() {
  const { language } = useApp();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={translate(language, "scrollToTop")}
      title={translate(language, "scrollToTop")}
      className="fixed bottom-6 start-4 z-30 grid h-10 w-10 place-items-center rounded-full bg-slate-950/80 text-white shadow-lg backdrop-blur-sm transition hover:bg-slate-950"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
