import { Banknote, Eye, Truck } from "lucide-react";
import { useEffect, useState } from "react";

const MESSAGES = [
  { icon: Banknote, ar: "الدفع عند الاستلام فقط — لا حاجة لبطاقة بنكية", fr: "Paiement à la livraison uniquement — sans carte bancaire" },
  { icon: Eye,     ar: "معاينة الجهاز قبل الدفع — لا تدفع إلا بعد التأكد", fr: "Inspection avant paiement — payez seulement si satisfait" },
  { icon: Truck,   ar: "توصيل لجميع الولايات الـ58 خلال 2-5 أيام عمل", fr: "Livraison dans les 58 wilayas sous 2-5 jours ouvrables" },
];

export function AnnouncementBar({ language }: { language: string }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % MESSAGES.length);
        setVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const msg = MESSAGES[idx];
  const Icon = msg.icon;
  const text = language === "fr" ? msg.fr : msg.ar;

  return (
    <div className="z-50 bg-slate-950 py-2 text-center text-xs font-semibold text-white">
      <div
        className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-teal-400" />
        <span className="text-slate-200">{text}</span>
      </div>
    </div>
  );
}
