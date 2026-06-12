import { Bot, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import { aiService } from "@/services/ai.service";
import { orderService } from "@/services/order.service";
import { translate } from "@/utils/i18n";

type ChatMessage = { role: "assistant" | "user"; text: string; time: number };

export function CheckoutConfirmationPage() {
  const navigate = useNavigate();
  const { language, pendingOrder, rememberConfirmedOrder, clearCart } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!pendingOrder?.orderId) {
      return;
    }

    void orderService
      .startAiConfirmation(pendingOrder.orderId)
      .then((response) => {
        setMessages([{ role: "assistant", text: response.message, time: Date.now() }]);
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Unable to start AI confirmation");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [pendingOrder?.orderId]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    }
  }, [messages, sending]);

  useEffect(() => {
    if (!loading && !sending) {
      inputRef.current?.focus();
    }
  }, [loading, sending]);

  if (!pendingOrder) {
    return <Navigate to="/checkout" replace />;
  }

  const formatTime = (time: number) =>
    new Date(time).toLocaleTimeString(language === "ar" ? "ar-DZ" : language === "fr" ? "fr-FR" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const send = async () => {
    if (!input.trim() || sending) {
      return;
    }

    const userMessage = input;
    setInput("");
    setErrorMessage("");
    setSending(true);
    setMessages((current) => [...current, { role: "user", text: userMessage, time: Date.now() }]);

    try {
      const response = await aiService.continueOrderConfirmation({
        orderId: pendingOrder.orderId,
        message: userMessage,
        language,
      });
      setMessages((current) => [...current, { role: "assistant", text: response.message, time: Date.now() }]);

      if (response.confirmed) {
        const order = await orderService.confirmOrder(pendingOrder.orderId);
        rememberConfirmedOrder(order);
        clearCart();
        navigate("/order/success");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to continue confirmation");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="surface-card p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-700">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-serif text-3xl font-semibold text-slate-950">{translate(language, "aiConfirmationTitle")}</h1>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              {translate(language, "aiConfirmationDescription")} #{pendingOrder.orderNumber}
            </p>
          </div>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-4 text-sm text-slate-500">
          {translate(language, "aiHint")}
        </div>

        <div ref={scrollRef} className="max-h-[28rem] space-y-4 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] px-6 py-6 scroll-smooth">
          {messages.map((message, index) => (
            <div key={index} className={`flex flex-col gap-1 ${message.role === "user" ? "items-end" : "items-start"}`}>
              <div className={message.role === "assistant" ? "chat-bubble-assistant" : "chat-bubble-user"}>
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.24em] opacity-70">
                  {message.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                  {message.role}
                </div>
                {message.text}
              </div>
              <span className="px-1 text-[0.7rem] text-slate-400">{formatTime(message.time)}</span>
            </div>
          ))}
          {loading ? (
            <div className="text-sm text-slate-500">{translate(language, "aiConversationStarting")}</div>
          ) : null}
          {sending ? (
            <div className="flex flex-col items-start gap-1">
              <div className="chat-bubble-assistant">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.24em] opacity-70">
                  <Bot className="h-3.5 w-3.5" />
                  assistant
                </div>
                <div className="flex items-center gap-1.5 py-0.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-200 px-6 py-5">
          {errorMessage ? <p className="mb-3 text-sm text-rose-600">{errorMessage}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void send();
                }
              }}
              disabled={loading || sending}
              className="field-input flex-1"
              placeholder={translate(language, "aiReplyPlaceholder")}
            />
            <button onClick={() => void send()} disabled={sending || loading || !input.trim()} className="primary-button">
              {sending ? translate(language, "productAiThinking") : translate(language, "aiSend")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
