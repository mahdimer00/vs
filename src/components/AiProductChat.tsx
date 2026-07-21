import { Bot, Loader2, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { aiService } from "@/services/ai.service";
import type { Locale } from "@/types";

type Msg = { role: "user" | "ai"; text: string };

const GREET: Record<Locale, string> = {
  ar: "مرحباً! 👋 أنا مساعدك الذكي. اسألني أي شيء عن هذا المنتج — المواصفات، التوافق، الضمان، وغيره.",
  fr: "Bonjour ! 👋 Je suis votre assistant. Posez-moi toutes vos questions sur ce produit.",
  en: "Hello! 👋 I'm your smart assistant. Ask me anything about this product — specs, compatibility, warranty, and more.",
};

const PLACEHOLDER: Record<Locale, string> = {
  ar: "اكتب سؤالك هنا...",
  fr: "Posez votre question...",
  en: "Type your question here...",
};

const SEND_LABEL: Record<Locale, string> = {
  ar: "إرسال",
  fr: "Envoyer",
  en: "Send",
};

const TITLE: Record<Locale, string> = {
  ar: "🤖 اسأل عن المنتج",
  fr: "🤖 Posez une question",
  en: "🤖 Ask about this product",
};

const SLOW_NOTE: Record<Locale, string> = {
  ar: "⏳ المساعد الذكي يفكر... قد يستغرق لحظة.",
  fr: "⏳ L'IA réfléchit... cela peut prendre un moment.",
  en: "⏳ AI is thinking... may take a moment.",
};

export function AiProductChat({
  productId,
  language,
}: {
  productId: string;
  language: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "ai", text: GREET[language] },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAr = language === "ar";

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await aiService.askProductQuestion({ productId, message: q, language });
      setMessages((m) => [...m, { role: "ai", text: res.message }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text:
            language === "ar"
              ? "عذراً، لم أتمكن من الإجابة الآن. تواصل مع الدعم عبر واتساب."
              : "Sorry, I couldn't answer right now. Please contact support via WhatsApp.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-24 end-4 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(124,58,237,0.45)] transition hover:scale-105 active:scale-95 md:bottom-8 md:end-6"
        >
          <Bot className="h-4 w-4" />
          {isAr ? "اسأل عن المنتج؟" : language === "fr" ? "Une question ?" : "Ask AI"}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={`fixed bottom-0 end-0 z-50 flex w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl transition md:bottom-6 md:end-6 md:w-96 md:rounded-3xl`}
          style={{ maxHeight: "min(75vh, 560px)" }}
          dir={isAr ? "rtl" : "ltr"}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold text-white">{TITLE[language]}</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? (isAr ? "justify-start" : "justify-end") : (isAr ? "justify-end" : "justify-start")}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-es-sm"
                      : "bg-white text-slate-800 border border-slate-200 shadow-sm rounded-ss-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className={`flex ${isAr ? "justify-end" : "justify-start"}`}>
                <div className="rounded-2xl rounded-ss-sm border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-500 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
                    {SLOW_NOTE[language]}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-end gap-2 border-t border-slate-100 bg-white p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder={PLACEHOLDER[language]}
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              style={{ maxHeight: "100px", overflowY: "auto" }}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!input.trim() || loading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md transition disabled:opacity-40"
              aria-label={SEND_LABEL[language]}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
