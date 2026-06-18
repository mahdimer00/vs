import { env } from "../config/env.js";

export async function sendTelegramMessage(text: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    });

    if (!response.ok) {
      console.error("Telegram notification failed", await response.text());
    }
  } catch (error) {
    console.error("Telegram notification error", error);
  }
}

export async function sendTelegramDocument(pdfBuffer: Buffer, filename: string, caption?: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    throw new Error("Telegram not configured (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing)");
  }

  const form = new FormData();
  form.append("chat_id", env.TELEGRAM_CHAT_ID);
  const slice = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength) as ArrayBuffer;
  form.append("document", new Blob([slice], { type: "application/pdf" }), filename);
  if (caption) form.append("caption", caption);

  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`;
  const response = await fetch(url, { method: "POST", body: form });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Telegram sendDocument failed: ${err}`);
  }
}
